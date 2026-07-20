import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users, roles, menus, permissions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "tt-erp-jwt-secret-key-2024";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "tt-erp-refresh-secret-key-2024";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  username: string;
  name: string | null;
  role: string;
  employeeId: string | null;
  companyId: string | null;
  shopId: string | null;
  branchId: string | null;
  warehouseId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateAccessToken = (user: AuthUser): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const generateRefreshToken = (user: AuthUser): string => {
  return jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

export const verifyAccessToken = (token: string): AuthUser | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): { id: string } | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { id: string };
  } catch {
    return null;
  }
};

const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const user = verifyAccessToken(token);

  if (!user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  next();
};

export const roleMiddleware = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }

    next();
  };
};

// Dynamic RBAC Permission Middleware
// Checks if user's role has the required permission for the given menu key
// GET requests require can_read, POST/PUT/DELETE require can_write
export const permissionMiddleware = (menuKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Super admin bypasses all permission checks
    if (req.user.role === "super_admin") {
      return next();
    }

    // Get user from database to check dynamic roleId
    const [dbUser] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!dbUser?.roleId) {
      // Fall back to legacy role behavior if no dynamic roleId assigned
      return next();
    }

    // Check if the role is active
    const [role] = await db.select().from(roles).where(eq(roles.id, dbUser.roleId));
    if (!role || role.status !== "active") {
      return res.status(403).json({ 
        success: false,
        message: "Your role has been disabled. Contact administrator.",
        code: "RBAC_ROLE_DISABLED"
      });
    }

    // Get the menu
    const [menu] = await db.select().from(menus).where(eq(menus.key, menuKey));
    if (!menu) {
      // If menu doesn't exist in RBAC, allow access (backward compatibility)
      return next();
    }

    // Get permission for this role and menu
    const [permission] = await db.select().from(permissions)
      .where(and(eq(permissions.roleId, dbUser.roleId), eq(permissions.menuId, menu.id)));

    // Determine required permission based on HTTP method
    const method = req.method.toUpperCase();
    const requiresWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    if (!permission) {
      return res.status(403).json({ 
        success: false,
        message: "You do not have permission to perform this action",
        code: "RBAC_ACCESS_DENIED"
      });
    }

    if (requiresWrite && !permission.canWrite) {
      return res.status(403).json({ 
        success: false,
        message: "You do not have permission to perform this action",
        code: "RBAC_ACCESS_DENIED"
      });
    }

    if (!requiresWrite && !permission.canRead) {
      return res.status(403).json({ 
        success: false,
        message: "You do not have permission to view this resource",
        code: "RBAC_ACCESS_DENIED"
      });
    }

    next();
  };
};

// Cache for user permissions to improve performance
const permissionCache = new Map<string, { permissions: Map<string, { canRead: boolean; canWrite: boolean }>; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export const getCachedUserPermissions = async (userId: string): Promise<Map<string, { canRead: boolean; canWrite: boolean }>> => {
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
  if (!dbUser?.roleId) {
    return new Map();
  }

  const userPermissions = await db.select({
    menuKey: menus.key,
    canRead: permissions.canRead,
    canWrite: permissions.canWrite,
  })
    .from(permissions)
    .innerJoin(menus, eq(permissions.menuId, menus.id))
    .where(eq(permissions.roleId, dbUser.roleId));

  const permMap = new Map<string, { canRead: boolean; canWrite: boolean }>();
  for (const p of userPermissions) {
    permMap.set(p.menuKey, { canRead: p.canRead ?? false, canWrite: p.canWrite ?? false });
  }

  permissionCache.set(userId, { permissions: permMap, timestamp: Date.now() });
  return permMap;
};

export const clearPermissionCache = (userId?: string) => {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
};

// RBAC: ONLY super_admin can change company, shop, or branch
export const canChangeScope = (role: string): boolean => {
  return role === "super_admin";
};

export const ADMIN_ROLES = ["super_admin", "admin", "manager"];

export const validateBranchAccess = (user: AuthUser, requestedBranchId: string | null | undefined): { valid: boolean; branchId: string | null } => {
  const branchId = requestedBranchId || user.branchId;
  if (!branchId) return { valid: false, branchId: null };
  // Only super_admin can access any branch
  if (user.role === "super_admin") return { valid: true, branchId };
  // Other users can only access their assigned branch
  if (user.branchId === branchId) return { valid: true, branchId };
  return { valid: false, branchId: null };
};

// RBAC Scope Enforcement Middleware
// For non-super_admin users: Override request companyId/shopId/branchId with user's assigned values
// For super_admin users: Use request values or fall back to user's assigned values
// This ensures data is always scoped to the user's company/shop/branch
export const enforceScopeMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Super admin can use any scope provided in the request, but falls back to their assigned scope
  if (req.user.role === "super_admin") {
    if (req.body) {
      req.body.companyId = req.body.companyId || req.user.companyId;
      req.body.shopId = req.body.shopId || req.user.shopId;
      req.body.branchId = req.body.branchId || req.user.branchId;
    }
    if (req.query) {
      req.query.companyId = (req.query.companyId as string) || req.user.companyId || undefined;
      req.query.shopId = (req.query.shopId as string) || req.user.shopId || undefined;
      req.query.branchId = (req.query.branchId as string) || req.user.branchId || undefined;
    }
    return next();
  }

  // For all other users, enforce their assigned company/shop/branch scope
  const userCompanyId = req.user.companyId;
  const userShopId = req.user.shopId;
  const userBranchId = req.user.branchId;

  if (!userCompanyId || !userBranchId) {
    return res.status(403).json({ 
      error: "Access denied. Your account is not assigned to a company/branch. Contact administrator." 
    });
  }

  // Override any company/shop/branch in request body with user's assigned values
  if (req.body) {
    if (req.body.companyId && req.body.companyId !== userCompanyId) {
      console.log(`RBAC: Blocked companyId override attempt. User ${req.user.username} tried to set companyId=${req.body.companyId}, enforcing ${userCompanyId}`);
    }
    if (req.body.shopId && req.body.shopId !== userShopId) {
      console.log(`RBAC: Blocked shopId override attempt. User ${req.user.username} tried to set shopId=${req.body.shopId}, enforcing ${userShopId}`);
    }
    if (req.body.branchId && req.body.branchId !== userBranchId) {
      console.log(`RBAC: Blocked branchId override attempt. User ${req.user.username} tried to set branchId=${req.body.branchId}, enforcing ${userBranchId}`);
    }
    req.body.companyId = userCompanyId;
    req.body.shopId = userShopId;
    req.body.branchId = userBranchId;
  }

  // Also set on query params if present
  if (req.query) {
    if (req.query.companyId && req.query.companyId !== userCompanyId) {
      console.log(`RBAC: Blocked companyId query override. Enforcing user scope.`);
    }
    if (req.query.shopId && req.query.shopId !== userShopId) {
      console.log(`RBAC: Blocked shopId query override. Enforcing user scope.`);
    }
    req.query.companyId = userCompanyId || undefined;
    req.query.shopId = userShopId || undefined;
    req.query.branchId = userBranchId || undefined;
  }

  next();
};

// Full scope type for company/shop/branch RBAC
export interface ScopeParams {
  companyId: string;
  shopId: string;
  branchId: string;
}

// Helper to get enforced scope from request (works for both super_admin and regular users)
export const getEnforcedScope = (req: AuthRequest): ScopeParams | null => {
  if (!req.user) return null;
  
  // Super admin can use request body/query scope
  if (req.user.role === "super_admin") {
    const companyId = req.body?.companyId || req.query?.companyId || req.user.companyId;
    const shopId = req.body?.shopId || req.query?.shopId || req.user.shopId;
    const branchId = req.body?.branchId || req.query?.branchId || req.user.branchId;
    if (companyId && shopId && branchId) return { companyId, shopId, branchId };
    return null;
  }
  
  // Regular users always use their assigned scope
  if (req.user.companyId && req.user.shopId && req.user.branchId) {
    return { companyId: req.user.companyId, shopId: req.user.shopId, branchId: req.user.branchId };
  }
  return null;
};

// Helper to get optional scope - for queries that may allow broader access for super_admin
export const getOptionalScope = (req: AuthRequest): Partial<ScopeParams> => {
  if (!req.user) return {};
  
  // Super admin can optionally filter, but not required
  if (req.user.role === "super_admin") {
    const scope: Partial<ScopeParams> = {};
    if (req.body?.companyId || req.query?.companyId) {
      scope.companyId = (req.body?.companyId || req.query?.companyId) as string;
    }
    if (req.body?.shopId || req.query?.shopId) {
      scope.shopId = (req.body?.shopId || req.query?.shopId) as string;
    }
    if (req.body?.branchId || req.query?.branchId) {
      scope.branchId = (req.body?.branchId || req.query?.branchId) as string;
    }
    return scope;
  }
  
  // Regular users always use their assigned scope
  return {
    companyId: req.user.companyId || undefined,
    shopId: req.user.shopId || undefined,
    branchId: req.user.branchId || undefined,
  };
};

// Extended scope type including companyId and warehouseId
export interface ExtendedScopeParams {
  companyId?: string | null;
  shopId?: string | null;
  branchId?: string | null;
  warehouseId?: string | null;
}

// Get scope from headers (for admin scope selection) or user scope (for regular users)
export const getScopeFromRequest = (req: AuthRequest): ExtendedScopeParams => {
  if (!req.user) return {};
  
  const adminRoles = ["super_admin", "admin"];
  
  if (adminRoles.includes(req.user.role)) {
    const companyId = req.headers["x-company-id"] as string || req.query?.companyId as string || req.user.companyId;
    const shopId = req.headers["x-shop-id"] as string || req.query?.shopId as string || req.user.shopId;
    const branchId = req.headers["x-branch-id"] as string || req.query?.branchId as string || req.user.branchId;
    const warehouseId = req.headers["x-warehouse-id"] as string || req.query?.warehouseId as string || req.user.warehouseId;
    return { companyId, shopId, branchId, warehouseId };
  }
  
  return {
    companyId: req.user.companyId || undefined,
    shopId: req.user.shopId || undefined,
    branchId: req.user.branchId || undefined,
    warehouseId: req.user.warehouseId || undefined,
  };
};

// Middleware to restrict routes to super_admin only
export const superAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "Access denied. Super Admin privileges required." });
  }
  
  next();
};

export const validateWarehouseAccess = (user: AuthUser, requestedWarehouseId: string | null | undefined): { valid: boolean; warehouseId: string | null } => {
  const warehouseId = requestedWarehouseId || user.warehouseId || null;
  if (!warehouseId) return { valid: true, warehouseId: null };
  if (ADMIN_ROLES.includes(user.role)) return { valid: true, warehouseId };
  if (user.warehouseId === warehouseId) return { valid: true, warehouseId };
  return { valid: false, warehouseId: null };
};

// Middleware to require shop scope for data APIs
// This ensures no data API is called without shop context being set
export const requireShopScope = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const scope = getScopeFromRequest(req);
  
  if (!scope.shopId || !scope.branchId) {
    return res.status(400).json({ 
      error: "Shop context required. Please select a shop and branch before accessing this resource.",
      code: "SCOPE_REQUIRED"
    });
  }
  
  // Attach scope to request for easy access in route handlers
  (req as any).scope = scope;
  
  next();
};

export const registerAuthRoutes = (app: any) => {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

      if (!user) {
        return res.status(401).json({ error: "Incorrect password or username" });
      }

      if (user.status !== "active") {
        return res.status(401).json({ error: "Account is not active" });
      }

      const isValidPassword = await verifyPassword(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Incorrect password or username" });
      }

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        companyId: user.companyId,
        shopId: user.shopId,
        branchId: user.branchId,
        warehouseId: user.warehouseId,
      };

      const accessToken = generateAccessToken(authUser);
      const refreshToken = generateRefreshToken(authUser);

      await db.update(users)
        .set({ refreshToken, lastLogin: new Date() })
        .where(eq(users.id, user.id));

      setRefreshTokenCookie(res, refreshToken);

      res.json({
        user: authUser,
        accessToken,
        canChangeScope: canChangeScope(user.role),
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token is required" });
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        clearRefreshTokenCookie(res);
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);

      if (!user || user.refreshToken !== refreshToken) {
        clearRefreshTokenCookie(res);
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        companyId: user.companyId,
        shopId: user.shopId,
        branchId: user.branchId,
        warehouseId: user.warehouseId,
      };

      const newAccessToken = generateAccessToken(authUser);
      const newRefreshToken = generateRefreshToken(authUser);

      await db.update(users)
        .set({ refreshToken: newRefreshToken })
        .where(eq(users.id, user.id));

      setRefreshTokenCookie(res, newRefreshToken);

      res.json({
        user: authUser,
        accessToken: newAccessToken,
        canChangeScope: canChangeScope(user.role),
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(500).json({ error: "Token refresh failed" });
    }
  });

  app.post("/api/auth/logout", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (req.user) {
        await db.update(users)
          .set({ refreshToken: null })
          .where(eq(users.id, req.user.id));
      }
      clearRefreshTokenCookie(res);
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        user: req.user,
        canChangeScope: req.user ? canChangeScope(req.user.role) : false,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  app.patch("/api/auth/scope", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || !canChangeScope(req.user.role)) {
        return res.status(403).json({ error: "You cannot change your scope" });
      }

      const { shopId, branchId, warehouseId } = req.body;

      await db.update(users)
        .set({ shopId, branchId, warehouseId })
        .where(eq(users.id, req.user.id));

      const authUser: AuthUser = {
        ...req.user,
        shopId,
        branchId,
        warehouseId,
      };

      const newAccessToken = generateAccessToken(authUser);

      res.json({
        user: authUser,
        accessToken: newAccessToken,
      });
    } catch (error) {
      console.error("Update scope error:", error);
      res.status(500).json({ error: "Failed to update scope" });
    }
  });

  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: "Old password and new password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });

      const isValid = await verifyPassword(oldPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: "Incorrect old password" });
      }

      const hashedNewPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, hashedNewPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
};
