import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, ensureDriverTablesSchema } from "./db";
import { eq, and, or, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerAuthRoutes, hashPassword, authMiddleware, enforceScopeMiddleware, superAdminOnly, getEnforcedScope, getOptionalScope, getScopeFromRequest, validateBranchAccess, validateWarehouseAccess, permissionMiddleware, AuthRequest, ScopeParams, ExtendedScopeParams } from "./auth";
import {
  validateTransactionDatesMiddleware,
  validateProductDatesMiddleware,
  validateDocumentDatesMiddleware,
  validateReminderDatesMiddleware,
  validateProjectDatesMiddleware,
  validateProductBulkUpload,
} from "./date-validation";
 import { validateProductDates, validateTransactionDates, validateDocumentDates, validateReminderDates, validateProjectDates } from "@shared/date-validation";
import { sendTaskThresholdNotification } from "./lib/email";

const uploadDir = path.join(process.cwd(), "uploads", "invoices");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const complianceUploadDir = path.join(process.cwd(), "uploads", "compliance");
if (!fs.existsSync(complianceUploadDir)) {
  fs.mkdirSync(complianceUploadDir, { recursive: true });
}

const taskUploadDir = path.join(process.cwd(), "uploads", "tasks");
if (!fs.existsSync(taskUploadDir)) {
  fs.mkdirSync(taskUploadDir, { recursive: true });
}

const serviceTicketUploadDir = path.join(process.cwd(), "uploads", "service-tickets");
if (!fs.existsSync(serviceTicketUploadDir)) {
  fs.mkdirSync(serviceTicketUploadDir, { recursive: true });
}

const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const complianceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, complianceUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const invoiceUpload = multer({
  storage: invoiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images and PDFs are allowed."));
    }
  },
});

const complianceUpload = multer({
  storage: complianceStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images, PDFs, and Word documents are allowed."));
    }
  },
});

const taskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, taskUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const taskUpload = multer({
  storage: taskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images, PDFs, Word documents, and Excel files are allowed."));
    }
  },
});

const serviceTicketStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, serviceTicketUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const serviceTicketUpload = multer({
  storage: serviceTicketStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const projectUploadDir = path.join(process.cwd(), "uploads", "projects");
if (!fs.existsSync(projectUploadDir)) {
  fs.mkdirSync(projectUploadDir, { recursive: true });
}

const projectFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, projectUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const projectFileUpload = multer({
  storage: projectFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip", "application/x-rar-compressed",
      "text/plain", "text/csv"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type."));
    }
  },
});

const shopLogoUploadDir = path.join(process.cwd(), "uploads", "shops");
if (!fs.existsSync(shopLogoUploadDir)) {
  fs.mkdirSync(shopLogoUploadDir, { recursive: true });
}

const shopLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, shopLogoUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const shopLogoUpload = multer({
  storage: shopLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images are allowed."));
    }
  },
});

const companyLogoUploadDir = path.join(process.cwd(), "uploads", "companies");
if (!fs.existsSync(companyLogoUploadDir)) {
  fs.mkdirSync(companyLogoUploadDir, { recursive: true });
}

const companyLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, companyLogoUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const companyLogoUpload = multer({
  storage: companyLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images are allowed."));
    }
  },
});

// Employee photo upload
const employeePhotoUploadDir = path.join(process.cwd(), "uploads", "employees");
if (!fs.existsSync(employeePhotoUploadDir)) {
  fs.mkdirSync(employeePhotoUploadDir, { recursive: true });
}
const employeePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, employeePhotoUploadDir); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const employeePhotoUpload = multer({
  storage: employeePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only images are allowed."));
  },
});

// Product image upload
const productImageUploadDir = path.join(process.cwd(), "uploads", "products");
if (!fs.existsSync(productImageUploadDir)) {
  fs.mkdirSync(productImageUploadDir, { recursive: true });
}
const productImageStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, productImageUploadDir); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const productImageUpload = multer({
  storage: productImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only images are allowed."));
  },
});

// Quotation attachment upload
const quotationAttachmentUploadDir = path.join(process.cwd(), "uploads", "quotations");
if (!fs.existsSync(quotationAttachmentUploadDir)) {
  fs.mkdirSync(quotationAttachmentUploadDir, { recursive: true });
}
const quotationAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, quotationAttachmentUploadDir); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const quotationAttachmentUpload = multer({
  storage: quotationAttachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only images and PDFs are allowed."));
  },
});


import {
  insertCompanySchema,
  insertShopSchema,
  insertBranchSchema,
  insertWarehouseSchema,
  insertCategorySchema,
  insertBrandSchema,
  insertSupplierSchema,
  insertProductSchema,
  insertCustomerSchema,
  insertBankAccountSchema,
  insertBankTransactionSchema,
  insertPettyCashSchema,
  insertCapitalSchema,
  insertEmployeeSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertStockTransferSchema,
  insertSerialNumberSchema,
  insertServiceTicketSchema,
  insertZoneSchema,
  insertSupervisorZoneSchema,
  insertContractSchema,
  insertVehicleSchema,
  insertLocationSchema,
  insertRfqSchema,
  insertOrderSchema,
  insertTripSchema,
  insertTripOrderSchema,
  insertDeliverySchema,
  insertDriverActivitySchema,
  insertDriverAttendanceSchema,
  insertDriverSchema,
  insertVehicleMaintenanceSchema,
  insertFuelLogSchema,
  insertUserActivityLogSchema,
} from "@shared/schema";

// Validation helper that validates request body against a Zod schema
function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors
      });
    }
    req.body = result.data;
    next();
  };
}

// Middleware to inject scope from headers into request body before validation
// This allows forms to not include shopId/branchId since they come from header selection
function injectScopeFromHeaders(req: Request, res: Response, next: NextFunction) {
  const shopId = req.headers["x-shop-id"] as string | undefined;
  const branchId = req.headers["x-branch-id"] as string | undefined;
  const warehouseId = req.headers["x-warehouse-id"] as string | undefined;

  if (!req.body) {
    req.body = {};
  }

  // Only inject if not already provided in body
  if (shopId && !req.body.shopId) {
    req.body.shopId = shopId;
  }
  if (branchId && !req.body.branchId) {
    req.body.branchId = branchId;
  }
  if (warehouseId && !req.body.warehouseId) {
    req.body.warehouseId = warehouseId;
  }

  next();
}

// Helper function to validate manufacture and expiry dates - now uses centralized validation
function validateManufactureExpiryDates(manufacturerDate: string | null | undefined, expiryDate: string | null | undefined, itemLabel?: string): { valid: boolean; error?: string } {
  const label = itemLabel ? ` for "${itemLabel}"` : "";
  const result = validateProductDates({
    manufacturingDate: manufacturerDate,
    expiryDate: expiryDate,
  });

  if (!result.valid && result.errors.length > 0) {
    return { valid: false, error: result.errors[0].message + label };
  }

  return { valid: true };
}

// Composite schemas for purchases and sales with line items
const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  vatRate: z.number().optional().default(5),
  discount: z.number().optional().default(0),
  total: z.number().optional(),
  salesRate: z.number().optional().nullable(),
  boxSalesRate: z.number().optional().nullable(),
  manufacturingDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  warrantyMonths: z.number().optional().nullable(),
  storageType: z.string().optional().nullable(),
  serialNumbers: z.array(z.string()).optional().default([]),
});

const purchasePayloadSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required"),
  shopId: z.string().min(1, "Shop ID is required"),
  branchId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  paymentStatus: z.string().optional().default("pending"),
  paymentMethod: z.string().optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  paidAmount: z.number().optional().default(0),
  subtotal: z.number().optional().default(0),
  vatAmount: z.number().optional().default(0),
  discount: z.number().optional().default(0),
  freight: z.number().optional().default(0),
  total: z.number().optional().default(0),
  invoiceNo: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  otherCharges: z.number().optional().default(0),
  previousDue: z.number().optional().default(0),
  purchaseOrderId: z.string().optional().nullable(),
  file: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
});

const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  vatRate: z.number().optional().default(5),
  discount: z.number().optional().default(0),
  total: z.number().optional(),
  serialNumber: z.string().optional().nullable(),
  serialIds: z.array(z.string()).optional(),
});

const salePayloadSchema = z.object({
  customerId: z.string().optional().nullable(),
  shopId: z.string().min(1, "Shop ID is required"),
  branchId: z.string().optional().nullable(),
  paymentMethod: z.string().min(1, "Payment method is required"),
  bankAccountId: z.string().optional().nullable(),
  cashAmount: z.number().optional().default(0),
  cardAmount: z.number().optional().default(0),
  creditAmount: z.number().optional().default(0),
  appliedStoreCredit: z.number().optional().default(0),
  subtotal: z.number().optional().default(0),
  vatAmount: z.number().optional().default(0),
  discount: z.number().optional().default(0),
  total: z.number().optional().default(0),
  lpoNumber: z.string().optional().nullable(),
  paymentStatus: z.string().optional().default("paid"),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // STRICT HIERARCHY VALIDATION HELPER
  // Validates that a warehouse belongs to the specified shop and branch
  async function validateWarehouseHierarchy(
    warehouseId: string | null | undefined,
    shopId: string | null | undefined,
    branchId: string | null | undefined
  ): Promise<{ valid: boolean; error?: string }> {
    if (!warehouseId) return { valid: true }; // No warehouse to validate

    const warehouse = await storage.getWarehouse(warehouseId);
    if (!warehouse) {
      return { valid: false, error: "Warehouse not found" };
    }

    // Validate warehouse belongs to the selected shop
    if (shopId && warehouse.shopId !== shopId) {
      return { valid: false, error: "Selected warehouse does not belong to the current shop" };
    }

    // Validate warehouse belongs to the selected branch
    if (branchId && warehouse.branchId !== branchId) {
      return { valid: false, error: "Selected warehouse does not belong to the current branch" };
    }

    return { valid: true };
  }

  // Register auth routes
  registerAuthRoutes(app);

  // Serve uploaded files (all subdirectories)
  const uploadsBaseDir = path.join(process.cwd(), "uploads");
  app.use("/uploads", (await import("express")).default.static(uploadsBaseDir));
  // File upload endpoint - RBAC protected
  app.post("/api/upload/invoice", authMiddleware, permissionMiddleware("purchases"), invoiceUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Compliance Reminder attachment upload
  app.post("/api/upload/compliance-reminder", authMiddleware, complianceUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/compliance/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Shop Logo upload endpoint - RBAC protected
  app.post("/api/upload/shop-logo", authMiddleware, permissionMiddleware("shops"), shopLogoUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/shops/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Company Logo upload endpoint - RBAC protected
  app.post("/api/upload/company-logo", authMiddleware, permissionMiddleware("companies"), companyLogoUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/companies/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Employee photo upload endpoint
  app.post("/api/upload/employee-photo", authMiddleware, employeePhotoUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileUrl = `/uploads/employees/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Product image upload endpoint
  app.post("/api/upload/product-image", authMiddleware, productImageUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileUrl = `/uploads/products/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Quotation attachment upload endpoint
  app.post("/api/upload/quotation-attachment", authMiddleware, quotationAttachmentUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileUrl = `/uploads/quotations/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Generic Driver Upload Endpoint (POD, Fuel receipt, Maintenance photo)
  const driverUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), "uploads", "driver");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    })
  });

  app.post("/api/upload/driver-attachment", authMiddleware, driverUpload.single("file"), (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileUrl = `/uploads/driver/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
    } catch (error) {
      console.error("Driver upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get next sale number (year-based sequential)
  app.get("/api/sales/next-number", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    try {
      const nextNumber = await storage.getNextSaleNumber();
      res.json({ nextNumber });
    } catch (error) {
      console.error("Get next sale number error:", error);
      res.status(500).json({ error: "Failed to get next sale number" });
    }
  });

  // User's scope info - returns only the user's assigned shop/branch/warehouse with names
  // This endpoint is accessible by all authenticated users
  app.get("/api/my-scope", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const result: any = {
        companyId: user.companyId,
        shopId: user.shopId,
        branchId: user.branchId,
        warehouseId: user.warehouseId,
        company: null,
        shop: null,
        branch: null,
        warehouse: null,
      };

      // Fetch names for the user's assigned entities
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        result.company = company || null;
      }
      if (user.shopId) {
        const shop = await storage.getShop(user.shopId);
        result.shop = shop || null;
      }
      if (user.branchId) {
        const branch = await storage.getBranch(user.branchId);
        result.branch = branch || null;
      }
      if (user.warehouseId) {
        const warehouse = await storage.getWarehouse(user.warehouseId);
        result.warehouse = warehouse || null;
      }

      res.json(result);
    } catch (error) {
      console.error("Get user scope error:", error);
      res.status(500).json({ error: "Failed to get user scope" });
    }
  });

  // Dashboard - requires authentication and dashboard permission
  app.get("/api/dashboard", authMiddleware, permissionMiddleware("dashboard"), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const stats = await storage.getDashboardStats(scope);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Companies - RBAC protected
  app.get("/api/companies", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/companies/:id", authMiddleware, async (req: AuthRequest, res) => {
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  });

  app.post("/api/companies", authMiddleware, permissionMiddleware("companies"), validateBody(insertCompanySchema), async (req: AuthRequest, res) => {
    try {
      const company = await storage.createCompany(req.body);
      res.status(201).json(company);
    } catch (error) {
      res.status(400).json({ error: "Failed to create company" });
    }
  });

  app.patch("/api/companies/:id", authMiddleware, permissionMiddleware("companies"), async (req: AuthRequest, res) => {
    const company = await storage.updateCompany(req.params.id, req.body);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  });

  app.delete("/api/companies/:id", authMiddleware, permissionMiddleware("companies"), async (req: AuthRequest, res) => {
    await storage.deleteCompany(req.params.id);
    res.status(204).send();
  });

  // Users - RBAC protected
  app.get("/api/users", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const users = await storage.getUsers();
      const safeUsers = users.map(u => ({
        ...u,
        password: undefined,
        refreshToken: undefined
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, refreshToken, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const { username, password, name, email, role, roleId, employeeId, companyId, shopId, branchId, warehouseId, status } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name: name || username,
        email,
        role: role || "staff",
        roleId: roleId || null,
        employeeId,
        companyId,
        shopId,
        branchId,
        warehouseId,
        status: status || "active"
      });

      const { password: _, refreshToken: __, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const { password, ...updateData } = req.body;

      let finalUpdateData: any = { ...updateData };
      if (password && password.trim()) {
        finalUpdateData.password = await hashPassword(password);
      }

      const user = await storage.updateUser(req.params.id, finalUpdateData);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { password: _, refreshToken: __, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.patch("/api/users/:id/status", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      if (!["active", "blocked"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'active' or 'blocked'" });
      }

      const user = await storage.updateUser(req.params.id, { status });
      if (!user) return res.status(404).json({ error: "User not found" });

      const { password: _, refreshToken: __, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user status error:", error);
      res.status(400).json({ error: "Failed to update user status" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const requestingUser = req.user;
      if (requestingUser?.id === req.params.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(400).json({ error: "Failed to delete user" });
    }
  });

  // User scope assignments (multi-company/shop/branch)
  app.get("/api/users/:id/scopes", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const scopes = await storage.getUserScopes(req.params.id);
      res.json(scopes);
    } catch (error) {
      console.error("Get user scopes error:", error);
      res.status(500).json({ error: "Failed to fetch user scopes" });
    }
  });

  app.put("/api/users/:id/scopes", authMiddleware, permissionMiddleware("users"), async (req: AuthRequest, res) => {
    try {
      const { scopes } = req.body;
      if (!Array.isArray(scopes)) {
        return res.status(400).json({ error: "scopes must be an array" });
      }
      const result = await storage.setUserScopes(req.params.id, scopes);
      res.json(result);
    } catch (error) {
      console.error("Set user scopes error:", error);
      res.status(400).json({ error: "Failed to set user scopes" });
    }
  });

  // ==================== BANK ACCOUNTS ====================

  app.get("/api/shops/:shopId/bank-accounts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const bankAccounts = await storage.getBankAccounts({ shopId: req.params.shopId });
      res.json(bankAccounts);
    } catch (error) {
      console.error("Get bank accounts error:", error);
      res.status(500).json({ error: "Failed to fetch bank accounts" });
    }
  });

  // ==================== DYNAMIC RBAC ====================

  // Roles CRUD
  app.get("/api/rbac/roles", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/rbac/roles/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) return res.status(404).json({ error: "Role not found" });
      res.json(role);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/rbac/roles", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const { name, description, status } = req.body;
      if (!name) return res.status(400).json({ error: "Role name is required" });

      const existing = await storage.getRoleByName(name);
      if (existing) return res.status(400).json({ error: "Role with this name already exists" });

      const role = await storage.createRole({ name, description, status: status || "active" });
      res.status(201).json(role);
    } catch (error) {
      res.status(400).json({ error: "Failed to create role" });
    }
  });

  app.patch("/api/rbac/roles/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const role = await storage.updateRole(req.params.id, req.body);
      if (!role) return res.status(404).json({ error: "Role not found" });
      res.json(role);
    } catch (error) {
      res.status(400).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/rbac/roles/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      await storage.deleteRole(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete role" });
    }
  });

  app.post("/api/rbac/roles/:id/clone", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const { newName } = req.body;
      if (!newName) return res.status(400).json({ error: "New role name is required" });

      const clonedRole = await storage.cloneRole(req.params.id, newName);
      res.status(201).json(clonedRole);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to clone role" });
    }
  });

  // Menus CRUD
  app.get("/api/rbac/menus", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const menus = await storage.getMenus();
      res.json(menus);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch menus" });
    }
  });

  app.post("/api/rbac/menus", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const menu = await storage.createMenu(req.body);
      res.status(201).json(menu);
    } catch (error) {
      res.status(400).json({ error: "Failed to create menu" });
    }
  });

  app.patch("/api/rbac/menus/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const menu = await storage.updateMenu(req.params.id, req.body);
      if (!menu) return res.status(404).json({ error: "Menu not found" });
      res.json(menu);
    } catch (error) {
      res.status(400).json({ error: "Failed to update menu" });
    }
  });

  app.delete("/api/rbac/menus/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      await storage.deleteMenu(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete menu" });
    }
  });

  // Seed default menus
  app.post("/api/rbac/menus/seed", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const defaultMenus = [
        // Core
        { key: "dashboard", title: "Dashboard", icon: "LayoutDashboard", path: "/", sortOrder: 1 },

        // Sales
        { key: "sales", title: "Sales (POS)", icon: "ShoppingCart", path: "/sales", sortOrder: 10 },
        { key: "sales_list", title: "Sales List", icon: "ClipboardList", path: "/sales-list", sortOrder: 11 },
        { key: "quotations", title: "Quotations", icon: "FileText", path: "/quotations", sortOrder: 12 },
        { key: "customer_transactions", title: "Customer Transactions", icon: "UserCheck", path: "/customer-transactions", sortOrder: 13 },

        // Purchases
        { key: "purchases", title: "Purchase Orders", icon: "Package", path: "/purchases", sortOrder: 20 },
        { key: "purchase_list", title: "Purchase List", icon: "List", path: "/purchases-list", sortOrder: 21 },
        { key: "purchase_returns", title: "Purchase Returns", icon: "RotateCcw", path: "/purchase-returns", sortOrder: 22 },
        { key: "supplier_transactions", title: "Supplier Transactions", icon: "Truck", path: "/supplier-transactions", sortOrder: 23 },

        // Inventory & Products
        { key: "inventory", title: "Inventory", icon: "Boxes", path: "/inventory", sortOrder: 30 },
        { key: "products", title: "Products", icon: "Package2", path: "/products", sortOrder: 31 },
        { key: "serial_numbers", title: "Serial Numbers", icon: "Hash", path: "/serial-numbers", sortOrder: 32 },
        { key: "stock_transfers", title: "Stock Transfers", icon: "ArrowLeftRight", path: "/stock-transfers", sortOrder: 33 },
        { key: "categories", title: "Categories", icon: "Tag", path: "/categories", sortOrder: 34 },
        { key: "brands", title: "Brands", icon: "Bookmark", path: "/brands", sortOrder: 35 },
        { key: "units", title: "Units", icon: "Ruler", path: "/units", sortOrder: 36 },

        // People
        { key: "customers", title: "Customers", icon: "Users", path: "/customers", sortOrder: 40 },
        { key: "suppliers", title: "Suppliers", icon: "Truck", path: "/suppliers", sortOrder: 41 },

        // Services
        { key: "services", title: "Service Tickets", icon: "Wrench", path: "/services", sortOrder: 50 },

        // Accounting
        { key: "accounting", title: "Accounting", icon: "Calculator", path: "/accounting", sortOrder: 60 },
        { key: "chart_of_accounts", title: "Chart of Accounts", icon: "BookOpen", path: "/chart-of-accounts", sortOrder: 61 },
        { key: "bank_accounts", title: "Bank Accounts", icon: "Landmark", path: "/bank-accounts", sortOrder: 62 },
        { key: "petty_cash", title: "Petty Cash", icon: "Banknote", path: "/petty-cash", sortOrder: 63 },
        { key: "capital", title: "Capital", icon: "TrendingUp", path: "/capital", sortOrder: 64 },

        // HR & Payroll
        { key: "employees", title: "Employees", icon: "UserCog", path: "/employees", sortOrder: 70 },
        { key: "leave_management", title: "Leave Management", icon: "Calendar", path: "/leave-management", sortOrder: 71 },

        // Projects & CRM
        { key: "projects", title: "Projects", icon: "Briefcase", path: "/projects", sortOrder: 80 },
        { key: "tasks", title: "Tasks", icon: "CheckSquare", path: "/tasks", sortOrder: 81 },
        { key: "crm", title: "CRM", icon: "Target", path: "/crm", sortOrder: 82 },

        // Compliance
        { key: "compliance_documents", title: "Documents", icon: "FileArchive", path: "/documents", sortOrder: 90 },
        { key: "compliance_reminders", title: "Reminders", icon: "Bell", path: "/reminders", sortOrder: 91 },

        // Reports
        { key: "reports", title: "Reports", icon: "BarChart3", path: "/reports", sortOrder: 100 },

        // Administration
        { key: "companies", title: "Companies", icon: "Building2", path: "/companies", sortOrder: 110 },
        { key: "shops", title: "Shops", icon: "Store", path: "/shops", sortOrder: 111 },
        { key: "branches", title: "Branches", icon: "GitBranch", path: "/branches", sortOrder: 112 },
        { key: "warehouses", title: "Warehouses", icon: "Warehouse", path: "/warehouses", sortOrder: 113 },
        { key: "users", title: "Users", icon: "Users", path: "/users", sortOrder: 114 },
        { key: "settings", title: "Settings", icon: "Settings", path: "/settings", sortOrder: 120 },
      ];


      let created = 0;
      let existing = 0;

      for (const menu of defaultMenus) {
        const existingMenus = await storage.getMenus();
        const exists = existingMenus.find(m => m.key === menu.key);
        if (!exists) {
          await storage.createMenu(menu);
          created++;
        } else {
          existing++;
        }
      }

      res.json({ message: `Created ${created} menus, ${existing} already existed`, created, existing });
    } catch (error) {
      res.status(400).json({ error: "Failed to seed menus" });
    }
  });

  // Permissions
  app.get("/api/rbac/permissions", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const roleId = req.query.roleId as string | undefined;
      const permissions = await storage.getPermissions(roleId);
      res.json(permissions);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch permissions" });
    }
  });

  app.get("/api/rbac/permissions/role/:roleId", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const permissions = await storage.getPermissionsByRole(req.params.roleId);
      res.json(permissions);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/rbac/permissions", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const { roleId, menuId, canRead, canWrite } = req.body;
      if (!roleId || !menuId) {
        return res.status(400).json({ error: "roleId and menuId are required" });
      }
      const permission = await storage.setPermission(roleId, menuId, canRead ?? false, canWrite ?? false);
      res.json(permission);
    } catch (error) {
      res.status(400).json({ error: "Failed to set permission" });
    }
  });

  app.post("/api/rbac/permissions/bulk", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const { roleId, permissions: permList } = req.body;
      if (!roleId || !Array.isArray(permList)) {
        return res.status(400).json({ error: "roleId and permissions array are required" });
      }

      const results = [];
      for (const perm of permList) {
        const result = await storage.setPermission(roleId, perm.menuId, perm.canRead ?? false, perm.canWrite ?? false);
        results.push(result);
      }
      res.json(results);
    } catch (error) {
      res.status(400).json({ error: "Failed to set permissions" });
    }
  });

  // Get current user permissions (for frontend)
  app.get("/api/rbac/my-permissions", authMiddleware, async (req: AuthRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      // Super admin has all permissions
      if (req.user.role === "super_admin") {
        const menus = await storage.getMenus();
        const allPermissions = menus.map(m => ({
          menuKey: m.key,
          canRead: true,
          canWrite: true,
        }));
        return res.json({ isSuperAdmin: true, permissions: allPermissions });
      }

      const permissions = await storage.getUserPermissions(req.user.id);
      res.json({ isSuperAdmin: false, permissions });
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch permissions" });
    }
  });

  // Seed default roles with permissions
  app.post("/api/rbac/roles/seed", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const defaultRoles = [
        { name: "Super Admin", description: "Full system access", isSystemRole: true },
        { name: "Admin", description: "Administrative access with some restrictions", isSystemRole: true },
        { name: "Manager", description: "Management level access", isSystemRole: true },
        { name: "Cashier", description: "Sales and basic operations", isSystemRole: true },
        { name: "Staff", description: "Limited operational access", isSystemRole: true },
      ];

      let created = 0;
      let existing = 0;

      for (const role of defaultRoles) {
        const existingRole = await storage.getRoleByName(role.name);
        if (!existingRole) {
          await storage.createRole(role);
          created++;
        } else {
          existing++;
        }
      }

      res.json({ message: `Created ${created} roles, ${existing} already existed`, created, existing });
    } catch (error) {
      res.status(400).json({ error: "Failed to seed roles" });
    }
  });

  // Shops - GET is open to all authenticated users (needed for invoice printing by any role)
  app.get("/api/shops", authMiddleware, async (req: AuthRequest, res) => {
    const shops = await storage.getShops();
    res.json(shops);
  });

  app.get("/api/shops/:id", authMiddleware, async (req: AuthRequest, res) => {
    const shop = await storage.getShop(req.params.id);
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    res.json(shop);
  });

  app.post("/api/shops", authMiddleware, permissionMiddleware("shops"), validateBody(insertShopSchema), async (req: AuthRequest, res) => {
    try {
      const shop = await storage.createShop(req.body);
      res.status(201).json(shop);
    } catch (error) {
      res.status(400).json({ error: "Failed to create shop" });
    }
  });

  app.patch("/api/shops/:id", authMiddleware, permissionMiddleware("shops"), async (req: AuthRequest, res) => {
    const shop = await storage.updateShop(req.params.id, req.body);
    if (!shop) return res.status(404).json({ error: "Shop not found" });
    res.json(shop);
  });

  app.delete("/api/shops/:id", authMiddleware, permissionMiddleware("shops"), async (req: AuthRequest, res) => {
    await storage.deleteShop(req.params.id);
    res.status(204).send();
  });

  // Branches - GET is open to all authenticated users (needed for invoice printing by any role)
  app.get("/api/branches", authMiddleware, async (req: AuthRequest, res) => {
    const branches = await storage.getBranches();
    res.json(branches);
  });

  app.get("/api/branches/:id", authMiddleware, async (req: AuthRequest, res) => {
    const branch = await storage.getBranch(req.params.id);
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    res.json(branch);
  });

  app.post("/api/branches", authMiddleware, permissionMiddleware("branches"), validateBody(insertBranchSchema), async (req: AuthRequest, res) => {
    try {
      const branch = await storage.createBranch(req.body);

      // Auto-seed chart of accounts for the new shop+branch if not already present
      try {
        await storage.seedChartOfAccountsForShop(branch.shopId || "", branch.id);
        console.log(`Auto-seeded chart of accounts for shop ${branch.shopId || ""}, branch ${branch.id}`);
      } catch (seedError) {
        console.warn("Failed to auto-seed chart of accounts:", seedError);
        // Don't fail the branch creation if seeding fails
      }

      res.status(201).json(branch);
    } catch (error) {
      res.status(400).json({ error: "Failed to create branch" });
    }
  });

  app.patch("/api/branches/:id", authMiddleware, permissionMiddleware("branches"), async (req: AuthRequest, res) => {
    const branch = await storage.updateBranch(req.params.id, req.body);
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    res.json(branch);
  });

  app.delete("/api/branches/:id", authMiddleware, permissionMiddleware("branches"), async (req: AuthRequest, res) => {
    await storage.deleteBranch(req.params.id);
    res.status(204).send();
  });

  // Warehouses - RBAC protected
  app.get("/api/warehouses", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    const warehouses = await storage.getWarehouses();
    res.json(warehouses);
  });

  app.get("/api/warehouses/:id", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    const warehouse = await storage.getWarehouse(req.params.id);
    if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });
    res.json(warehouse);
  });

  app.post("/api/warehouses", authMiddleware, permissionMiddleware("warehouses"), validateBody(insertWarehouseSchema), async (req: AuthRequest, res) => {
    try {
      const warehouse = await storage.createWarehouse(req.body);
      res.status(201).json(warehouse);
    } catch (error) {
      res.status(400).json({ error: "Failed to create warehouse" });
    }
  });

  app.patch("/api/warehouses/:id", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    const warehouse = await storage.updateWarehouse(req.params.id, req.body);
    if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });
    res.json(warehouse);
  });

  app.delete("/api/warehouses/:id", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    await storage.deleteWarehouse(req.params.id);
    res.status(204).send();
  });

  // Categories - RBAC protected
  app.get("/api/categories", authMiddleware, permissionMiddleware("categories"), async (req: AuthRequest, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.get("/api/categories/:id", authMiddleware, permissionMiddleware("categories"), async (req: AuthRequest, res) => {
    const category = await storage.getCategory(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  });

  app.post("/api/categories", authMiddleware, permissionMiddleware("categories"), enforceScopeMiddleware, validateBody(insertCategorySchema), async (req: AuthRequest, res) => {
    try {
      // Check for duplicate category name
      const existingCategories = await storage.getCategories();
      const duplicate = existingCategories.find(c =>
        c.name?.toLowerCase() === req.body.name?.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: `Category "${req.body.name}" already exists` });
      }
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", authMiddleware, permissionMiddleware("categories"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const category = await storage.updateCategory(req.params.id, req.body);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  });

  app.delete("/api/categories/:id", authMiddleware, permissionMiddleware("categories"), async (req: AuthRequest, res) => {
    await storage.deleteCategory(req.params.id);
    res.status(204).send();
  });

  // Brands - RBAC protected
  app.get("/api/brands", authMiddleware, permissionMiddleware("brands"), async (req: AuthRequest, res) => {
    const brands = await storage.getBrands(
      req.query.companyId as string,
      req.query.branchId as string
    );
    res.json(brands);
  });

  app.get("/api/brands/:id", authMiddleware, permissionMiddleware("brands"), async (req: AuthRequest, res) => {
    const brand = await storage.getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    res.json(brand);
  });

  app.post("/api/brands", authMiddleware, permissionMiddleware("brands"), enforceScopeMiddleware, validateBody(insertBrandSchema), async (req: AuthRequest, res) => {
    try {
      // Check for duplicate brand name
      const existingBrands = await storage.getBrands();
      const duplicate = existingBrands.find(b =>
        b.name?.toLowerCase() === req.body.name?.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: `Brand "${req.body.name}" already exists` });
      }
      const brand = await storage.createBrand(req.body);
      res.status(201).json(brand);
    } catch (error) {
      res.status(400).json({ error: "Failed to create brand" });
    }
  });

  app.patch("/api/brands/:id", authMiddleware, permissionMiddleware("brands"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const brand = await storage.updateBrand(req.params.id, req.body);
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    res.json(brand);
  });

  app.delete("/api/brands/:id", authMiddleware, permissionMiddleware("brands"), async (req: AuthRequest, res) => {
    await storage.deleteBrand(req.params.id);
    res.status(204).send();
  });

  // Manufacturers - uses inventory permission
  app.get("/api/manufacturers", authMiddleware, permissionMiddleware("inventory"), async (req: AuthRequest, res) => {
    const manufacturers = await storage.getManufacturers();
    res.json(manufacturers);
  });

  app.post("/api/manufacturers", authMiddleware, permissionMiddleware("inventory"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      // Check for duplicate manufacturer name
      const existingManufacturers = await storage.getManufacturers();
      const duplicate = existingManufacturers.find(m =>
        m.name?.toLowerCase() === req.body.name?.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: `Manufacturer "${req.body.name}" already exists` });
      }
      const manufacturer = await storage.createManufacturer(req.body);
      res.status(201).json(manufacturer);
    } catch (error) {
      res.status(400).json({ error: "Failed to create manufacturer" });
    }
  });

  app.delete("/api/manufacturers/:id", authMiddleware, permissionMiddleware("inventory"), async (req: AuthRequest, res) => {
    await storage.deleteManufacturer(req.params.id);
    res.status(204).send();
  });

  // Units - RBAC protected
  app.get("/api/units", authMiddleware, permissionMiddleware("units"), async (req: AuthRequest, res) => {
    const units = await storage.getUnits();
    res.json(units);
  });

  app.post("/api/units", authMiddleware, permissionMiddleware("units"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      // Check for duplicate unit name
      const existingUnits = await storage.getUnits();
      const duplicate = existingUnits.find(u =>
        u.name?.toLowerCase() === req.body.name?.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: `Unit "${req.body.name}" already exists` });
      }
      const unit = await storage.createUnit(req.body);
      res.status(201).json(unit);
    } catch (error) {
      res.status(400).json({ error: "Failed to create unit" });
    }
  });

  app.patch("/api/units/:id", authMiddleware, permissionMiddleware("units"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const unit = await storage.updateUnit(req.params.id, req.body);
    if (!unit) return res.status(404).json({ error: "Unit not found" });
    res.json(unit);
  });

  app.delete("/api/units/:id", authMiddleware, permissionMiddleware("units"), async (req: AuthRequest, res) => {
    await storage.deleteUnit(req.params.id);
    res.status(204).send();
  });

  // Suppliers - RBAC protected
  app.get("/api/suppliers", authMiddleware, permissionMiddleware("suppliers"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const suppliers = await storage.getSuppliers(scope);
    res.json(suppliers);
  });

  app.get("/api/suppliers/:id", authMiddleware, permissionMiddleware("suppliers"), async (req: AuthRequest, res) => {
    const supplier = await storage.getSupplier(req.params.id);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  });

  app.post("/api/suppliers", authMiddleware, permissionMiddleware("suppliers"), enforceScopeMiddleware, validateBody(insertSupplierSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      // Check for duplicate supplier name
      const existingSuppliers = await storage.getSuppliers(scope);
      const duplicate = existingSuppliers.find(s =>
        s.name?.toLowerCase() === req.body.name?.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: `Supplier "${req.body.name}" already exists` });
      }
      const supplier = await storage.createSupplier({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(supplier);
    } catch (error) {
      res.status(400).json({ error: "Failed to create supplier" });
    }
  });

  app.patch("/api/suppliers/:id", authMiddleware, permissionMiddleware("suppliers"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const supplier = await storage.updateSupplier(req.params.id, req.body);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  });

  app.delete("/api/suppliers/:id", authMiddleware, permissionMiddleware("suppliers"), async (req: AuthRequest, res) => {
    await storage.deleteSupplier(req.params.id);
    res.status(204).send();
  });

  // Get supplier balance info (LEDGER-DRIVEN) with strict accounting - RBAC protected
  // Balance = Purchases - Payments - Returns
  // STRICT ACCOUNTING RULE: A supplier can NEVER have both AP and AR simultaneously
  app.get("/api/suppliers/:id/balance", authMiddleware, permissionMiddleware("suppliers"), async (req: AuthRequest, res) => {
    try {
      const supplier = await storage.getSupplier(req.params.id);
      if (!supplier) return res.status(404).json({ error: "Supplier not found" });

      // LEDGER-DRIVEN: Calculate supplier balances from actual transaction records
      const ledgerSummary = await storage.getSupplierLedgerSummary(req.params.id);

      // STRICT MUTUAL EXCLUSIVITY ENFORCEMENT:
      // A supplier can NEVER have both AP and AR simultaneously
      // Use ledger values directly but enforce exclusivity via netBalance sign
      const tolerance = 0.001;
      const rawPayable = ledgerSummary.outstandingPayable || 0;
      const rawReceivable = ledgerSummary.overpayment || 0;

      // Error condition: both payable and receivable exceed tolerance (data inconsistency)
      if (rawPayable > tolerance && rawReceivable > tolerance) {
        console.error(`ACCOUNTING ERROR: Supplier ${req.params.id} has both AP (${rawPayable}) and AR (${rawReceivable}). Data needs reconciliation.`);
        // Use netBalance to resolve: positive = payable, negative = receivable
        // This allows the system to continue while logging the issue
      }

      // Derive final values from netBalance to ensure mutual exclusivity
      let payableAmount = 0;
      let receivableAmount = 0;

      if (ledgerSummary.netBalance > tolerance) {
        // We owe supplier (AP) - use netBalance as the authoritative payable
        payableAmount = ledgerSummary.netBalance;
        receivableAmount = 0;
      } else if (ledgerSummary.netBalance < -tolerance) {
        // Supplier owes us (AR) - use absolute netBalance as receivable
        payableAmount = 0;
        receivableAmount = Math.abs(ledgerSummary.netBalance);
      } else {
        // Within tolerance - treat as balanced
        payableAmount = 0;
        receivableAmount = 0;
      }

      res.json({
        supplierId: req.params.id,
        supplierName: supplier.name,
        totalPurchases: ledgerSummary.totalPurchases,
        totalPayments: ledgerSummary.totalPayments,
        totalReturns: ledgerSummary.totalReturns,
        totalCreditsApplied: ledgerSummary.totalCreditsApplied,  // Credits applied (internal ledger offset, not cash)
        outstandingPayable: payableAmount,
        overpayment: receivableAmount,
        netBalance: ledgerSummary.netBalance,
        // For Create Purchase auto-application:
        payableAmount: payableAmount,  // AP: Store owes Supplier
        receivableAmount: receivableAmount,  // AR: Supplier owes Store (credit available)
        supplierCredit: receivableAmount,  // Alias for UI compatibility
        previousDue: payableAmount,  // Outstanding from prior purchases
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get supplier balance" });
    }
  });

  // Products - Sample template download - RBAC protected
  app.get("/api/products/sample-template", authMiddleware, permissionMiddleware("products"), async (req: AuthRequest, res) => {
    const csvContent = [
      "name,productCode,barcode,boxBarCode,categoryName,subcategoryName,warehouseName,supplierName,manufacturerName,purchaseUnit,salesUnit,reorderPoint,productQty,boxQty,purchasePrice,sellingPrice,boxSalesCost,taxCommodity,storageType,manufacturerDate,expiryDate,description",
      "iPhone 17 Pro,PRO-008,IP17-010,IP17-BOX-010,Electronics,Mobile Phones,WH-2,Apple Inc,Apple,Piece,Piece,5,10,5,500,600,2300,Standard Rate,Shelf,12/10/25,12/12/26,Latest iPhone model with A17 chip",
      "Samsung Galaxy S25,PRO-009,SG25-010,SG25-BOX-010,Electronics,Mobile Phones,WH-2,Samsung,Samsung Electronics,Piece,Piece,5,10,3,500,600,2300,Standard Rate,Shelf,01/10/25,01/12/26,Samsung flagship smartphone",
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=product_template.csv");
    res.send(csvContent);
  });

  // Products - Export all products as CSV - RBAC protected
  app.get("/api/products/export", authMiddleware, permissionMiddleware("products"), async (req: AuthRequest, res) => {
    try {
      const { products } = await storage.getProducts();
      const categories = await storage.getCategories();
      const warehouses = await storage.getWarehouses();
      const suppliers = await storage.getSuppliers();
      const manufacturers = await storage.getManufacturers();
      const units = await storage.getUnits();

      const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || "";
      const getWarehouseName = (id: string | null) => warehouses.find(w => w.id === id)?.name || "";
      const getSupplierName = (id: string | null) => suppliers.find(s => s.id === id)?.name || "";
      const getManufacturerName = (id: string | null) => manufacturers.find(m => m.id === id)?.name || "";
      const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name || "";

      const csvRows = [
        "name,productCode,barcode,boxBarCode,category,subcategory,warehouse,supplier,manufacturer,purchaseUnit,salesUnit,reorderPoint,productQty,boxQty,purchasePrice,sellingPrice,boxSalesCost,taxCommodity,storageType,manufacturerDate,expiryDate,warrantyMonths,description"
      ];

      for (const p of products) {
        const row = [
          `"${(p.name || "").replace(/"/g, '""')}"`,
          p.productCode || "",
          p.barcode || "",
          p.boxBarCode || "",
          getCategoryName(p.categoryId),
          getCategoryName(p.subcatId),
          getWarehouseName(p.wareId),
          getSupplierName(p.supplierId),
          getManufacturerName(p.manufacturerId),
          getUnitName(p.purchaseUnitId),
          getUnitName(p.salesUnitId),
          p.reorderPoint || "",
          p.productQty || 0,
          p.boxQty || "",
          p.purchasePrice || "0.000",
          p.sellingPrice || "0.000",
          p.boxSalesCost || "",
          p.taxCommodity || "",
          p.storageType || "",
          p.manufacturerDate || "",
          p.expiryDate || "",
          p.warrantyMonths || "",
          `"${(p.descriptions || "").replace(/"/g, '""')}"`,
        ].join(",");
        csvRows.push(row);
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=products_export.csv");
      res.send(csvRows.join("\n"));
    } catch (error) {
      res.status(500).json({ error: "Failed to export products" });
    }
  });

  // Products - Bulk upload
  const productUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/products/bulk-upload", authMiddleware, productUpload.single("file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get scope from request headers for shop/branch assignment
      const scope = getScopeFromRequest(req);

      // Get bankAccountId from form data
      const bankAccountId = req.body.bankAccountId;

      // STRICT FINANCIAL CONTROL: Check if any funds exist before allowing bulk upload
      const breakdown = await storage.getAvailableBalanceBreakdown();
      if (breakdown.totalAvailable <= 0) {
        return res.status(400).json({
          message: "Insufficient funds. Please add capital or bank balance before uploading products."
        });
      }

      // Bank account is required for bulk upload (will be used for accounting)
      if (!bankAccountId) {
        return res.status(400).json({
          message: "Bank account is required for bulk product upload. Please select a bank account."
        });
      }

      const content = req.file.buffer.toString("utf-8");
      const lines = content.split("\n").filter(line => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({ message: "File must contain header and at least one data row" });
      }

      const header = lines[0].toLowerCase();
      if (!header.includes("name")) {
        return res.status(400).json({ message: "Invalid file format. Header must include 'name' column" });
      }

      let categories = await storage.getCategories();
      let warehouses = await storage.getWarehouses();
      let suppliers = await storage.getSuppliers();
      let manufacturers = await storage.getManufacturers();
      let units = await storage.getUnits();

      // Helper to find or create category
      const findOrCreateCategory = async (name: string, parentId?: string): Promise<string | undefined> => {
        if (!name) return undefined;
        let cat = categories.find(c => c.name?.toLowerCase() === name.toLowerCase());
        if (!cat) {
          cat = await storage.createCategory({ name, parentId: parentId || "" });
          categories = [...categories, cat];
        }
        return cat.id;
      };

      // Helper to find or create unit
      const findOrCreateUnit = async (name: string): Promise<string | undefined> => {
        if (!name) return undefined;
        let unit = units.find(u => u.name?.toLowerCase() === name.toLowerCase());
        if (!unit) {
          const abbreviation = name.substring(0, 3).toUpperCase();
          unit = await storage.createUnit({ name, abbreviation });
          units = [...units, unit];
        }
        return unit.id;
      };

      // Helper to find or create warehouse
      const findOrCreateWarehouse = async (name: string): Promise<string | undefined> => {
        if (!name) return undefined;
        let warehouse = warehouses.find(w => w.name?.toLowerCase() === name.toLowerCase());
        if (!warehouse) {
          warehouse = await storage.createWarehouse({
            name,
            shopId: scope.shopId || "",
            branchId: scope.branchId || undefined,
            status: "active"
          });
          warehouses = [...warehouses, warehouse];
        }
        return warehouse.id;
      };

      // Helper to find or create supplier
      const findOrCreateSupplier = async (name: string): Promise<string | undefined> => {
        if (!name) return undefined;
        let supplier = suppliers.find(s => s.name?.toLowerCase() === name.toLowerCase());
        if (!supplier) {
          supplier = await storage.createSupplier({
            name,
            companyId: scope.shopId ? undefined : undefined,
            shopId: scope.shopId || undefined,
            branchId: scope.branchId || undefined,
            status: "active"
          });
          suppliers = [...suppliers, supplier];
        }
        return supplier.id;
      };

      // Helper to find or create manufacturer
      const findOrCreateManufacturer = async (name: string): Promise<string | undefined> => {
        if (!name) return undefined;
        let manufacturer = manufacturers.find(m => m.name?.toLowerCase() === name.toLowerCase());
        if (!manufacturer) {
          manufacturer = await storage.createManufacturer({ name });
          manufacturers = [...manufacturers, manufacturer];
        }
        return manufacturer.id;
      };

      const findCategory = (name: string) => categories.find(c => c.name?.toLowerCase() === name.toLowerCase())?.id;
      const findWarehouse = (name: string) => warehouses.find(w => w.name?.toLowerCase() === name.toLowerCase())?.id;
      const findSupplier = (name: string) => suppliers.find(s => s.name?.toLowerCase() === name.toLowerCase())?.id;
      const findManufacturer = (name: string) => manufacturers.find(m => m.name?.toLowerCase() === name.toLowerCase())?.id;
      const findUnit = (name: string) => units.find(u => u.name?.toLowerCase() === name.toLowerCase())?.id;

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0].toLowerCase());
      const validationErrors: string[] = [];
      const productsToProcess: Array<{
        data: any;
        isUpdate: boolean;
        existingProductId?: string;
        existingProduct?: any;
        newQuantity?: number;
        explicitSerials?: string[];
      }> = [];

      const { products: existingProducts } = await storage.getProducts(scope);
      let totalRequiredFunds = 0;
      const seenInFile = new Map<string, number>();

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

        if (!row.name) continue;

        const productName = row.name.toLowerCase();
        const productCode = (row.productcode || row["product code"] || "").toLowerCase();
        const barcode = (row.barcode || row["bar code"] || "").toLowerCase();

        const productKeys = [
          `name:${productName}`,
          productCode ? `code:${productCode}` : null,
          barcode ? `barcode:${barcode}` : null,
        ].filter(Boolean) as string[];

        let duplicateRow: number | undefined;
        for (const key of productKeys) {
          if (seenInFile.has(key)) {
            duplicateRow = seenInFile.get(key);
            break;
          }
        }

        if (duplicateRow) {
          validationErrors.push(`Row ${i + 1}: Duplicate product "${row.name}" found in the same file (first seen at row ${duplicateRow}). Merge quantities into a single row.`);
          continue;
        }

        for (const key of productKeys) {
          seenInFile.set(key, i + 1);
        }

        // Auto-create category and subcategory if they don't exist
        const categoryNameFromCSV = row.categoryname || row["category name"] || row.category || "";
        const subcategoryNameFromCSV = row.subcategoryname || row["subcategory name"] || row.subcategory || row["sub category"] || row["sub category name"] || "";

        let categoryId: string | undefined;
        let subcatId: string | undefined;

        if (categoryNameFromCSV) {
          categoryId = await findOrCreateCategory(categoryNameFromCSV);
        }
        if (subcategoryNameFromCSV && categoryId) {
          subcatId = await findOrCreateCategory(subcategoryNameFromCSV, categoryId);
        }

        // Auto-create units if they don't exist
        const purchaseUnitName = row.purchaseunit || row["purchase unit"] || "";
        const salesUnitName = row.salesunit || row["sales unit"] || row["sale unit"] || "";

        const purchaseUnitId = purchaseUnitName ? await findOrCreateUnit(purchaseUnitName) : undefined;
        const salesUnitId = salesUnitName ? await findOrCreateUnit(salesUnitName) : undefined;

        // Auto-create warehouse, supplier, and manufacturer if they don't exist
        const warehouseName = row.warehousename || row["warehouse name"] || row.warehouse || "";
        const supplierName = row.suppliername || row["supplier name"] || row.supplier || "";
        const manufacturerName = row.manufacturername || row["manufacturer name"] || row.manufacturer || "";

        const wareId = await findOrCreateWarehouse(warehouseName);
        const supplierId = await findOrCreateSupplier(supplierName);
        const manufacturerId = await findOrCreateManufacturer(manufacturerName);

        const productData: any = {
          name: row.name,
          productCode: row.productcode || row["product code"] || undefined,
          barcode: row.barcode || row["bar code"] || undefined,
          boxBarCode: row.boxbarcode || row["box bar code"] || row["box barcode"] || undefined,
          categoryId,
          subcatId,
          wareId,
          supplierId,
          manufacturerId,
          purchaseUnitId,
          salesUnitId,
          reorderPoint: row.reorderpoint || row["reorder point"] || undefined,
          productQty: row.productqty || row["product qty"] ? parseInt(row.productqty || row["product qty"]) : 0,
          boxQty: row.boxqty || row["box qty"] || undefined,
          purchasePrice: row.purchaseprice || row["purchase price"] || "0.000",
          sellingPrice: row.sellingprice || row["selling price"] || "0.000",
          boxSalesCost: row.boxsalescost || row["box sales cost"] || undefined,
          taxCommodity: row.taxcommodity || row["tax commodity"] || undefined,
          storageType: row.storagetype || row["storage type"] || undefined,
          manufacturerDate: row.manufacturerdate || row["manufacturer date"] || undefined,
          expiryDate: row.expirydate || row["expiry date"] || undefined,
          warrantyMonths: row.warrantymonths || row["warranty months"] ? parseInt(row.warrantymonths || row["warranty months"]) : undefined,
          descriptions: row.description || row.descriptions || undefined,
          // Store shop and branch IDs from the selected scope
          shopId: scope.shopId || undefined,
          branchId: scope.branchId || undefined,
        };

        // Validate manufacturing date is not in the future
        if (productData.manufacturerDate) {
          const mfgDate = new Date(productData.manufacturerDate);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          if (mfgDate > today) {
            validationErrors.push(`Row ${i + 1}: Manufacturing date cannot be in the future for "${row.name}"`);
            continue;
          }
        }

        // Validate expiry date is not in the past
        if (productData.expiryDate) {
          const expDate = new Date(productData.expiryDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expDate < today) {
            validationErrors.push(`Row ${i + 1}: Expiry date cannot be in the past for "${row.name}"`);
            continue;
          }
        }

        if (productData.manufacturerDate && productData.expiryDate) {
          if (new Date(productData.expiryDate) <= new Date(productData.manufacturerDate)) {
            validationErrors.push(`Row ${i + 1}: Expiry date must be after manufacturing date for "${row.name}"`);
            continue;
          }
        }

        if (!productData.purchaseUnitId) {
          validationErrors.push(`Row ${i + 1}: Purchase unit is mandatory for "${row.name}". Please specify a purchase unit name in the 'purchaseunit' column.`);
          continue;
        }
        if (!productData.salesUnitId) {
          validationErrors.push(`Row ${i + 1}: Sale unit is mandatory for "${row.name}". Please specify a sale unit name in the 'salesunit' column.`);
          continue;
        }

        const qty = productData.productQty || 0;
        const purchasePrice = parseFloat(productData.purchasePrice || "0");
        const sellingPrice = parseFloat(productData.sellingPrice || "0");

        if (qty < 0) {
          validationErrors.push(`Row ${i + 1}: Quantity must be >= 0 for "${row.name}".`);
          continue;
        }
        if (purchasePrice < 0) {
          validationErrors.push(`Row ${i + 1}: Purchase price must be >= 0 for "${row.name}".`);
          continue;
        }
        if (sellingPrice < 0) {
          validationErrors.push(`Row ${i + 1}: Sale price must be >= 0 for "${row.name}".`);
          continue;
        }

        const existingProduct = existingProducts.find(p =>
          (productData.name && p.name?.toLowerCase() === productData.name.toLowerCase()) ||
          (productData.barcode && p.barcode === productData.barcode) ||
          (productData.productCode && p.productCode === productData.productCode)
        );

        const serialNumbersStr = row.serialnumbers || row["serial numbers"] || row.serialnumber || row["serial number"] || "";
        const explicitSerials = serialNumbersStr.trim().length > 0
          ? serialNumbersStr.split(/[,;]/).map((s: string) => s.trim()).filter((s: string) => s)
          : [];

        let effectiveQty = qty;
        if (explicitSerials.length > 0) {
          if (qty > 0 && qty !== explicitSerials.length) {
            validationErrors.push(`Row ${i + 1}: Quantity (${qty}) doesn't match serial number count (${explicitSerials.length}) for "${row.name}". Either leave quantity empty or make it match the number of serials.`);
            continue;
          }
          effectiveQty = explicitSerials.length;
          productData.productQty = explicitSerials.length;
        }

        if (existingProduct) {
          const existingQty = existingProduct.productQty || 0;
          const newQty = explicitSerials.length > 0 ? explicitSerials.length : (productData.productQty || 0);
          productData.productQty = existingQty + newQty;
          totalRequiredFunds += newQty * purchasePrice;

          productsToProcess.push({
            data: productData,
            isUpdate: true,
            existingProductId: existingProduct.id,
            existingProduct: existingProduct,
            newQuantity: newQty,
            explicitSerials,
          });
        } else {
          totalRequiredFunds += effectiveQty * purchasePrice;
          productsToProcess.push({
            data: productData,
            isUpdate: false,
            explicitSerials,
          });
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Validation failed. Please fix the errors and try again.",
          errors: validationErrors,
        });
      }

      if (productsToProcess.length === 0) {
        return res.status(400).json({ message: "No valid products found in the file" });
      }

      if (totalRequiredFunds > breakdown.totalAvailable) {
        return res.status(400).json({
          message: `Insufficient funds. Required: ${totalRequiredFunds.toFixed(3)} BD, Available: ${breakdown.totalAvailable.toFixed(3)} BD. Please add capital or bank balance first.`
        });
      }

      const result = await storage.bulkCreateProductsWithAccounting(productsToProcess, bankAccountId);

      res.json({
        count: result.created + result.updated,
        message: `Successfully uploaded ${result.created} new products and updated ${result.updated} existing products`,
        created: result.created,
        updated: result.updated,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to process upload" });
    }
  });

  // Products - RBAC protected
  app.get("/api/products", authMiddleware, permissionMiddleware("products"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const limitParam = req.query.limit as string | undefined;
    const pageParam = req.query.page as string | undefined;
    const search = req.query.search as string | undefined;

    if (!limitParam && !pageParam && !search) {
      const { products: allProducts } = await storage.getProducts(scope);
      // Get actual available stock counts from serial numbers
      const productStockCounts = await storage.getProductStockCounts();
      // Merge actual stock counts into products
      const productsWithStock = allProducts.map(p => ({
        ...p,
        productQty: productStockCounts[p.id] ?? p.productQty ?? 0
      }));
      return res.json(productsWithStock);
    }

    const limit = parseInt(limitParam || "100");
    const page = parseInt(pageParam || "1");
    const offset = (page - 1) * limit;

    const { products: fetchedProducts, total } = await storage.getProducts(scope, { limit, offset, search });
    
    // Get actual available stock counts from serial numbers
    const productStockCounts = await storage.getProductStockCounts();
    // Merge actual stock counts into products
    const productsWithStock = fetchedProducts.map(p => ({
      ...p,
      productQty: productStockCounts[p.id] ?? p.productQty ?? 0
    }));

    res.json({
      products: productsWithStock,
      total,
      limit,
      page
    });
  });

  app.get("/api/products/:id", authMiddleware, permissionMiddleware("products"), async (req: AuthRequest, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  });

  app.post("/api/products", authMiddleware, permissionMiddleware("products"), enforceScopeMiddleware, validateBody(insertProductSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);

      // STRICT HIERARCHY: Validate warehouse belongs to selected shop/branch
      const warehouseValidation = await validateWarehouseHierarchy(
        req.body.wareId,
        scope.shopId || req.body.shopId,
        scope.branchId || req.body.branchId
      );
      if (!warehouseValidation.valid) {
        return res.status(400).json({ error: warehouseValidation.error });
      }

      // Validate required units
      if (!req.body.purchaseUnitId) {
        return res.status(400).json({ error: "Purchase unit is mandatory. Please select a purchase unit." });
      }
      if (!req.body.salesUnitId) {
        return res.status(400).json({ error: "Sale unit is mandatory. Please select a sale unit." });
      }

      // Validate manufacture and expiry dates
      const dateValidation = validateManufactureExpiryDates(req.body.manufacturerDate, req.body.expiryDate, req.body.name);
      if (!dateValidation.valid) {
        return res.status(400).json({ error: dateValidation.error });
      }

      // Calculate total product value
      const quantity = req.body.productQty || 0;
      const purchasePrice = parseFloat(req.body.purchasePrice || "0");
      const totalValue = quantity * purchasePrice;

      // If product has value, require bank account and validate funds
      if (totalValue > 0) {
        if (!req.body.bankAccountId) {
          return res.status(400).json({
            error: "Bank account is required when adding products with quantity and cost."
          });
        }

        // Validate sufficient funds in bank account
        const validation = await storage.validateAvailableBalance(totalValue, req.body.bankAccountId, "product creation");
        if (!validation.valid) {
          return res.status(400).json({
            error: "Insufficient funds. Please add capital or bank balance.",
            details: validation.message
          });
        }
      }

      // Create product with accounting entries (atomic transaction)
      const productData = {
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
        warehouseId: scope.warehouseId || req.body.warehouseId,
      };
      const product = await storage.createProductWithAccounting(productData, req.body.bankAccountId);
      res.status(201).json(product);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create product" });
    }
  });

  // Quick create product - minimal fields for inline creation during Purchase/Quotation
  app.post("/api/products/quick-create", authMiddleware, permissionMiddleware("products"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const { name, categoryId, subcatId, unitId } = req.body;

      // Use enforced scope from middleware, not user-supplied values
      const shopId = scope.shopId || req.body.shopId;
      const branchId = scope.branchId || req.body.branchId;
      const warehouseId = scope.warehouseId || req.body.warehouseId;

      // STRICT HIERARCHY: Validate warehouse belongs to selected shop/branch
      const warehouseValidation = await validateWarehouseHierarchy(warehouseId, shopId, branchId);
      if (!warehouseValidation.valid) {
        return res.status(400).json({ error: warehouseValidation.error });
      }

      // Validate required fields
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Product name is required" });
      }
      if (!unitId) {
        return res.status(400).json({ error: "Unit is required" });
      }
      if (!shopId || !branchId) {
        return res.status(400).json({ error: "Shop and Branch are required" });
      }

      // Check for duplicate product name within same scope
      const { products: existingProducts } = await storage.getProducts({ shopId, branchId });
      const duplicate = existingProducts.find(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({
          error: `Product "${name}" already exists in this shop/branch`
        });
      }

      // Create minimal product with defaults
      const productData = {
        name: name.trim(),
        categoryId: categoryId || null,
        subcatId: subcatId || null,
        purchaseUnitId: unitId,
        salesUnitId: unitId,
        shopId,
        branchId,
        warehouseId: warehouseId || null,
        purchasePrice: "0.000",
        sellingPrice: "0.000",
        productQty: 0,
        status: "active",
        createdVia: "quick_add",
        createdById: req.user?.id || null,
      };

      const product = await storage.createProduct(productData);

      // Log audit
      console.log(`[Quick Add Product] Created product "${product.name}" (${product.id}) by user ${req.user?.id}`);

      res.status(201).json(product);
    } catch (error: any) {
      console.error("[Quick Add Product] Error:", error);
      res.status(400).json({ error: error.message || "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", authMiddleware, permissionMiddleware("products"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const product = await storage.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  });

  app.delete("/api/products/:id", authMiddleware, permissionMiddleware("products"), async (req: AuthRequest, res) => {
    await storage.deleteProduct(req.params.id);
    res.status(204).send();
  });

  // Inventory - RBAC protected
  app.get("/api/inventory", authMiddleware, permissionMiddleware("inventory"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const warehouseId = scope.warehouseId || req.query.warehouseId as string | undefined;
    const inventory = await storage.getInventory(warehouseId || undefined);
    res.json(inventory);
  });

  // Customers - RBAC protected
  app.get("/api/customers", authMiddleware, permissionMiddleware("customers"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const customers = await storage.getCustomers(scope);
    res.json(customers);
  });

  app.get("/api/customers/:id", authMiddleware, permissionMiddleware("customers"), async (req: AuthRequest, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  });

  // Customer Ledger Summary (LEDGER-DRIVEN)
  app.get("/api/customers/:id/ledger", authMiddleware, permissionMiddleware("customers"), async (req: AuthRequest, res) => {
    try {
      const ledger = await storage.getCustomerLedgerSummary(req.params.id);
      res.json(ledger);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get customer ledger" });
    }
  });

  app.post("/api/customers", authMiddleware, permissionMiddleware("customers"), enforceScopeMiddleware, validateBody(insertCustomerSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      // Check for duplicate customer name
      const existingCustomers = await storage.getCustomers(scope);
      const duplicate = existingCustomers.find(c =>
        c.name?.toLowerCase() === req.body.name?.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: `Customer "${req.body.name}" already exists` });
      }
      const customer = await storage.createCustomer({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", authMiddleware, permissionMiddleware("customers"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const customer = await storage.updateCustomer(req.params.id, req.body);
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  });

  app.delete("/api/customers/:id", authMiddleware, permissionMiddleware("customers"), async (req: AuthRequest, res) => {
    await storage.deleteCustomer(req.params.id);
    res.status(204).send();
  });

  // Clear customer credit
  const clearCreditSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    paymentMethod: z.enum(["cash", "card", "bank_transfer"]),
    bankAccountId: z.string().min(1, "Bank account is required"),
    notes: z.string().optional(),
    shopId: z.string().nullable().optional(),
    branchId: z.string().nullable().optional(),
  });

  app.post("/api/customers/:id/clear-credit", authMiddleware, enforceScopeMiddleware, validateBody(clearCreditSchema), async (req: AuthRequest, res) => {
    try {
      // Use the enforced scope from middleware (which falls back to user's assigned scope)
      const scope = {
        shopId: req.body.shopId || req.user?.shopId,
        branchId: req.body.branchId || req.user?.branchId,
      };
      const result = await storage.clearCustomerCredit(
        req.params.id,
        req.body.amount,
        req.body.paymentMethod,
        req.body.bankAccountId,
        req.body.notes,
        scope
      );
      res.json(result);
    } catch (error: any) {
      console.error("Clear credit error:", error);
      res.status(400).json({ error: error?.message || "Failed to clear customer credit" });
    }
  });

  // Refund customer store credit
  const refundCreditSchema = z.object({
    amount: z.number().positive(),
    paymentMethod: z.string(),
    bankAccountId: z.string(),
    notes: z.string().optional(),
  });

  app.post("/api/customers/:id/refund-credit", authMiddleware, enforceScopeMiddleware, validateBody(refundCreditSchema), async (req: AuthRequest, res) => {
    try {
      const result = await storage.refundCustomerCredit(
        req.params.id,
        req.body.amount,
        req.body.paymentMethod,
        req.body.bankAccountId,
        req.body.notes
      );
      res.json(result);
    } catch (error: any) {
      console.error("Refund credit error:", error);
      const message = error?.message || "Failed to refund customer credit";
      res.status(400).json({ error: message });
    }
  });

  // Clear customer opening balance (receive payment for initial receivable)
  const clearCustomerOpeningBalanceSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    paymentMethod: z.enum(["cash", "card", "bank_transfer"]),
    bankAccountId: z.string().min(1, "Bank account is required"),
    notes: z.string().optional(),
  });

  app.post("/api/customers/:id/clear-opening-balance", authMiddleware, enforceScopeMiddleware, validateBody(clearCustomerOpeningBalanceSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getEnforcedScope(req);
      const result = await storage.clearCustomerOpeningBalance(
        req.params.id,
        req.body.amount,
        req.body.paymentMethod,
        req.body.bankAccountId,
        req.body.notes,
        scope || undefined
      );
      res.json(result);
    } catch (error: any) {
      console.error("Clear customer opening balance error:", error);
      const message = error?.message || "Failed to clear customer opening balance";
      res.status(400).json({ error: message });
    }
  });

  // Clear supplier credit (pay what we owe to supplier)
  const clearSupplierCreditSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    paymentMethod: z.enum(["cash", "card", "bank_transfer"]),
    bankAccountId: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/suppliers/:id/clear-credit", authMiddleware, enforceScopeMiddleware, validateBody(clearSupplierCreditSchema), async (req: AuthRequest, res) => {
    try {
      const result = await storage.clearSupplierCredit(
        req.params.id,
        req.body.amount,
        req.body.paymentMethod,
        req.body.bankAccountId,
        req.body.notes
      );
      res.json(result);
    } catch (error: any) {
      console.error("Clear credit error:", error);
      const message = error?.message || "Failed to clear supplier credit";
      res.status(400).json({ error: message });
    }
  });

  // Clear supplier opening balance (pay off the initial balance owed)
  const clearOpeningBalanceSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    paymentMethod: z.enum(["cash", "card", "bank_transfer"]),
    bankAccountId: z.string().min(1, "Bank account is required"),
    notes: z.string().optional(),
  });

  app.post("/api/suppliers/:id/clear-opening-balance", authMiddleware, enforceScopeMiddleware, validateBody(clearOpeningBalanceSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getEnforcedScope(req);
      const result = await storage.clearSupplierOpeningBalance(
        req.params.id,
        req.body.amount,
        req.body.paymentMethod,
        req.body.bankAccountId,
        req.body.notes,
        scope || undefined
      );
      res.json(result);
    } catch (error: any) {
      console.error("Clear opening balance error:", error);
      const message = error?.message || "Failed to clear supplier opening balance";
      res.status(400).json({ error: message });
    }
  });

  // Purchase Orders
  app.get("/api/purchase-orders", authMiddleware, async (req: AuthRequest, res) => {
    const orders = await storage.getPurchaseOrders();
    res.json(orders);
  });

  app.get("/api/purchase-orders/:id", authMiddleware, async (req: AuthRequest, res) => {
    const order = await storage.getPurchaseOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Purchase order not found" });
    res.json(order);
  });

  app.get("/api/purchase-orders/:id/with-items", authMiddleware, async (req: AuthRequest, res) => {
    const result = await storage.getPurchaseOrderWithItems(req.params.id);
    if (!result) return res.status(404).json({ error: "Purchase order not found" });
    res.json(result);
  });

  const purchaseOrderPayloadSchema = z.object({
    supplierId: z.string(),
    shopId: z.string().nullable().optional(),
    branchId: z.string().nullable().optional(),
    warehouseId: z.string().nullable().optional(),
    status: z.string().optional(),
    subtotal: z.number().optional(),
    vatAmount: z.number().optional(),
    discount: z.number().optional(),
    freight: z.number().optional(),
    total: z.number().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
      unitPrice: z.number().nullable().optional(),
      vatRate: z.number().nullable().optional(),
      discount: z.number().nullable().optional(),
      total: z.number().nullable().optional(),
      warehouseId: z.string().nullable().optional(),
      salesRate: z.number().nullable().optional(),
      boxSalesRate: z.number().nullable().optional(),
      manufacturingDate: z.string().nullable().optional(),
      expiryDate: z.string().nullable().optional(),
      warrantyMonths: z.number().nullable().optional(),
      storageType: z.string().nullable().optional(),
    })),
  });

  app.post("/api/purchase-orders", authMiddleware, enforceScopeMiddleware, validateBody(purchaseOrderPayloadSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const { items, ...orderData } = req.body;

      // STRICT HIERARCHY: Validate warehouse belongs to selected shop/branch
      const shopId = scope.shopId || orderData.shopId;
      const branchId = scope.branchId || orderData.branchId;
      const warehouseId = scope.warehouseId || orderData.warehouseId;
      const warehouseValidation = await validateWarehouseHierarchy(warehouseId, shopId, branchId);
      if (!warehouseValidation.valid) {
        return res.status(400).json({ error: warehouseValidation.error });
      }

      // Validate manufacture and expiry dates for each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dateValidation = validateManufactureExpiryDates(item.manufacturingDate, item.expiryDate, `Item ${i + 1}`);
        if (!dateValidation.valid) {
          return res.status(400).json({ error: dateValidation.error });
        }
      }

      const order = await storage.createPurchaseOrder({
        ...orderData,
        shopId,
        branchId,
        warehouseId,
      }, items);
      res.status(201).json(order);
    } catch (error) {
      console.error("Purchase order error:", error);
      res.status(400).json({ error: "Failed to create purchase order" });
    }
  });

  app.patch("/api/purchase-orders/:id/status", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updatePurchaseOrderStatus(req.params.id, status);
      if (!order) return res.status(404).json({ error: "Purchase order not found" });
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: "Failed to update purchase order status" });
    }
  });

  // Get purchase with items - RBAC protected
  app.get("/api/purchases/:id/with-items", authMiddleware, permissionMiddleware("purchases"), async (req: AuthRequest, res) => {
    const result = await storage.getPurchaseWithItems(req.params.id);
    if (!result) return res.status(404).json({ error: "Purchase not found" });
    res.json(result);
  });

  // Purchases - RBAC protected
  app.get("/api/purchases", authMiddleware, permissionMiddleware("purchases"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const purchases = await storage.getPurchases(scope);
    res.json(purchases);
  });

  
  app.delete("/api/purchases/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      await storage.deletePurchase(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Purchase delete error:", error);
      res.status(400).json({ error: error.message || "Failed to delete purchase" });
    }
  });

  app.get("/api/purchases/:id", authMiddleware, permissionMiddleware("purchases"), async (req: AuthRequest, res) => {
    const purchase = await storage.getPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });
    res.json(purchase);
  });

  app.post("/api/purchases", authMiddleware, permissionMiddleware("purchases"), enforceScopeMiddleware, validateBody(purchasePayloadSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const { items, ...purchaseData } = req.body;

      console.log("[DEBUG] Purchase request received. Items:", JSON.stringify(items.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity,
        serialNumbers: i.serialNumbers,
      })), null, 2));

      // STRICT HIERARCHY: Validate warehouse belongs to selected shop/branch
      const shopId = scope.shopId || purchaseData.shopId;
      const branchId = scope.branchId || purchaseData.branchId;
      const warehouseId = scope.warehouseId || purchaseData.warehouseId;
      const warehouseValidation = await validateWarehouseHierarchy(warehouseId, shopId, branchId);
      if (!warehouseValidation.valid) {
        return res.status(400).json({ error: warehouseValidation.error });
      }

      // Validate manufacture and expiry dates for each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dateValidation = validateManufactureExpiryDates(item.manufacturingDate, item.expiryDate, `Item ${i + 1}`);
        if (!dateValidation.valid) {
          return res.status(400).json({ error: dateValidation.error });
        }
      }

      const purchase = await storage.createPurchase({
        ...purchaseData,
        shopId,
        branchId,
        warehouseId,
      }, items);
      res.status(201).json(purchase);
    } catch (error: any) {
      console.error("Purchase error:", error);
      const message = error?.message || "Failed to create purchase";
      res.status(400).json({ error: message });
    }
  });

  // Purchase Payments - fetch from purchasePayments table by purchase ID
  app.get("/api/purchases/:id/payments", authMiddleware, permissionMiddleware("purchases"), async (req: AuthRequest, res) => {
    try {
      const payments = await storage.getPurchasePayments(req.params.id);
      res.json(payments);
    } catch (error) {
      console.error("Get purchase payments error:", error);
      res.status(400).json({ error: "Failed to get purchase payments" });
    }
  });

  // Purchase Invoice Outstanding (LEDGER-DRIVEN)
  app.get("/api/purchases/:id/outstanding", authMiddleware, permissionMiddleware("purchases"), async (req: AuthRequest, res) => {
    try {
      const outstanding = await storage.getPurchaseOutstanding(req.params.id);
      res.json(outstanding);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get purchase outstanding" });
    }
  });

  // Purchase Returns by Purchase ID (with items)
  app.get("/api/purchases/:id/returns", authMiddleware, permissionMiddleware("purchase_returns"), async (req: AuthRequest, res) => {
    try {
      const returns = await storage.getPurchaseReturnsByPurchase(req.params.id);
      const returnsWithItems = await Promise.all(
        returns.map(async (ret) => {
          const items = await storage.getPurchaseReturnItems(ret.id);
          return { ...ret, items };
        })
      );
      res.json(returnsWithItems);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get purchase returns" });
    }
  });

  // Purchase Invoice Summary (LEDGER-DRIVEN - comprehensive invoice details)
  app.get("/api/purchases/:id/summary", authMiddleware, permissionMiddleware("purchases"), async (req: AuthRequest, res) => {
    try {
      const summary = await storage.getPurchaseInvoiceSummary(req.params.id);
      if (!summary) return res.status(404).json({ error: "Purchase not found" });
      res.json(summary);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get purchase summary" });
    }
  });

  app.post("/api/purchases/:id/payments", authMiddleware, permissionMiddleware("purchases"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const { amount, paymentMethod, bankAccountId, notes } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid payment amount is required" });
      }
      if (!bankAccountId) {
        return res.status(400).json({ error: "Bank account is required for payment" });
      }
      const payment = await storage.createPurchasePayment({
        purchaseId: req.params.id,
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId,
        notes,
      });
      res.status(201).json(payment);
    } catch (error: any) {
      console.error("Purchase payment error:", error);
      res.status(400).json({ error: error.message || "Failed to create payment" });
    }
  });

  // Sales - RBAC protected
  app.get("/api/sales", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const sales = await storage.getSales(scope);
    res.json(sales);
  });

  
  // Update sale (super admin only - for LPO, payment status, notes edits)
  app.patch("/api/sales/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const { lpoNumber, paymentStatus, notes } = req.body;
      const updated = await storage.updateSaleMetadata(req.params.id, { lpoNumber, paymentStatus, notes });
      res.json(updated);
    } catch (error: any) {
      console.error("Sale update error:", error);
      res.status(400).json({ error: error.message || "Failed to update sale" });
    }
  });

  app.delete("/api/sales/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      await storage.deleteSale(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Sale delete error:", error);
      res.status(400).json({ error: error.message || "Failed to delete sale" });
    }
  });


  app.get("/api/sales/next-number", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const nextNumber = await storage.getNextSaleNumber();
      res.json({ nextNumber });
    } catch (error) {
      res.status(400).json({ error: "Failed to generate next sale number" });
    }
  });

  app.get("/api/sales/:id", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    const sale = await storage.getSale(req.params.id);
    if (!sale) return res.status(404).json({ error: "Sale not found" });
    res.json(sale);
  });

  app.get("/api/sales/:id/items", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    try {
      const items = await storage.getSaleItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(400).json({ error: "Failed to get sale items" });
    }
  });

  app.get("/api/sales/:id/replacements", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    try {
      const replacements = await storage.getSaleReplacementsBySaleId(req.params.id);
      res.json(replacements);
    } catch (error) {
      res.status(400).json({ error: "Failed to get sale replacements" });
    }
  });

  // Get sale items with replacement history for invoice display
  app.get("/api/sales/:id/invoice-items", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    try {
      const result = await storage.getSaleItemsWithReplacementHistory(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: "Failed to get invoice items" });
    }
  });

  app.post("/api/sales", authMiddleware, permissionMiddleware("sales"), enforceScopeMiddleware, validateBody(salePayloadSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const { items, ...saleData } = req.body;
      const sale = await storage.createSale({
        ...saleData,
        shopId: scope.shopId || saleData.shopId,
        branchId: scope.branchId || saleData.branchId,
      }, items);

      for (const item of items) {
        if (item.serialIds && Array.isArray(item.serialIds)) {
          for (const serialId of item.serialIds) {
            if (serialId && !serialId.startsWith("manual-") && !serialId.startsWith("temp-")) {
              await storage.updateSerialNumberStatus(serialId, "sold", { saleId: sale.id, soldAt: new Date() });
            }
          }
        }
      }

      res.status(201).json(sale);
    } catch (error: any) {
      console.error("Sale error:", error);
      const message = error?.message || "Failed to create sale";
      res.status(400).json({ error: message });
    }
  });

  // Get sales by customer with items
  app.get("/api/customers/:id/sales", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const sales = await storage.getCustomerSalesWithItems(req.params.id);
      res.json(sales);
    } catch (error) {
      console.error("Customer sales error:", error);
      res.status(400).json({ error: "Failed to get customer sales" });
    }
  });

  // Quick customer creation (minimal info)
  const quickCustomerSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().min(1, "Phone is required"),
  });

  app.post("/api/customers/quick", authMiddleware, enforceScopeMiddleware, validateBody(quickCustomerSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const shopId = scope.shopId || req.body.shopId;
      const branchId = scope.branchId || req.body.branchId || null;

      if (!shopId) {
        return res.status(400).json({ error: "Shop must be selected to create a customer" });
      }

      const customer = await storage.createCustomer({
        ...req.body,
        shopId,
        branchId,
        openingBalance: "0.000",
        currentBalance: "0.000",
        status: "active",
      });
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Failed to create customer" });
    }
  });

  // Sale Returns
  const saleReturnSchema = z.object({
    saleId: z.string().min(1, "Sale ID is required"),
    customerId: z.string().optional().nullable(),
    shopId: z.string().optional().nullable(),
    bankAccountId: z.string().optional().nullable(),
    returnType: z.string().optional().default("refund"),
    refundMethod: z.string().optional(),
    refundAmount: z.number().optional().default(0),
    creditAmount: z.number().optional().default(0),
    reason: z.string().optional(),
    items: z.array(z.object({
      saleItemId: z.string().min(1),
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
      total: z.number().nonnegative(),
      vatAmount: z.number().optional().default(0),
      reason: z.string().optional().nullable(),
      warrantyStatus: z.string().optional().nullable(),
      serialNumber: z.string().optional().nullable(),
    })).min(1, "At least one item is required"),
  });

  app.post("/api/sale-returns", authMiddleware, enforceScopeMiddleware, validateBody(saleReturnSchema), async (req: AuthRequest, res) => {
    try {
      const { items, ...returnData } = req.body;
      const saleReturn = await storage.createSaleReturn(returnData, items);
      res.status(201).json(saleReturn);
    } catch (error: any) {
      console.error("Sale return error:", error);
      // Return specific error message for user feedback
      const errorMessage = error?.message || "Failed to create sale return";
      res.status(400).json({ error: errorMessage });
    }
  });

  app.get("/api/sale-returns", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const returns = await storage.getSaleReturns();
      res.json(returns);
    } catch (error) {
      res.status(400).json({ error: "Failed to get sale returns" });
    }
  });

  // Get sale returns for a specific sale with items
  app.get("/api/sales/:saleId/returns", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allReturns = await storage.getSaleReturns();
      const saleReturns = allReturns.filter((r: any) => r.saleId === req.params.saleId);

      // Get items for each return
      const returnsWithItems = await Promise.all(saleReturns.map(async (ret: any) => {
        const items = await storage.getSaleReturnItems(ret.id);
        // Get product names for items
        const itemsWithProducts = await Promise.all(items.map(async (item: any) => {
          const product = await storage.getProduct(item.productId);
          return { ...item, productName: product?.name || "Unknown Product" };
        }));
        return { ...ret, items: itemsWithProducts };
      }));

      res.json(returnsWithItems);
    } catch (error) {
      console.error("Get sale returns error:", error);
      res.status(400).json({ error: "Failed to get sale returns" });
    }
  });

  // Get payment history for a specific sale (from customer transactions/journal entries)
  app.get("/api/sales/:saleId/payments", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const entries = await storage.getJournalEntries(undefined, "customer_payment");
      const sale = await storage.getSale(req.params.saleId);

      if (!sale?.customerId) {
        return res.json([]);
      }

      // Filter to payments for this customer after the sale date
      const payments = entries.filter((e: any) =>
        e.sourceId === sale.customerId &&
        e.description?.includes(sale.saleNumber)
      ).map((entry: any) => ({
        id: entry.id,
        date: entry.entryDate,
        reference: entry.reference,
        description: entry.description,
        amount: entry.totalAmount || 0,
      }));

      res.json(payments);
    } catch (error) {
      console.error("Get sale payments error:", error);
      res.status(400).json({ error: "Failed to get sale payments" });
    }
  });

  // Sale Replacements
  const saleReplacementSchema = z.object({
    saleId: z.string().min(1, "Sale ID is required"),
    customerId: z.string().optional().nullable(),
    shopId: z.string().optional().nullable(),
    originalProductId: z.string().min(1, "Original product is required"),
    replacementProductId: z.string().min(1, "Replacement product is required"),
    originalQuantity: z.number().int().positive(),
    replacementQuantity: z.number().int().positive(),
    priceDifference: z.number().optional().default(0),
    reason: z.string().optional(),
    warrantyStatus: z.string().optional(),
  });

  app.post("/api/sale-replacements", authMiddleware, enforceScopeMiddleware, validateBody(saleReplacementSchema), async (req: AuthRequest, res) => {
    try {
      const replacement = await storage.createSaleReplacement(req.body);
      res.status(201).json(replacement);
    } catch (error) {
      console.error("Sale replacement error:", error);
      res.status(400).json({ error: "Failed to create sale replacement" });
    }
  });

  app.get("/api/sale-replacements", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const replacements = await storage.getSaleReplacements();
      res.json(replacements);
    } catch (error) {
      res.status(400).json({ error: "Failed to get sale replacements" });
    }
  });

  // Enhanced Sale Item Replacement (with serial numbers and accounting)
  const replaceItemSchema = z.object({
    saleItemId: z.string().min(1, "Sale item ID is required"),
    originalSerialNumberId: z.string().min(1, "Original serial number is required"),
    replacementProductId: z.string().min(1, "Replacement product is required"),
    replacementSerialNumberId: z.string().min(1, "Replacement serial number is required"),
    paymentMethod: z.string().optional(),
    bankAccountId: z.string().optional(),
    reason: z.string().optional(),
  });

  app.post("/api/sales/:saleId/replace", authMiddleware, enforceScopeMiddleware, validateBody(replaceItemSchema), async (req: AuthRequest, res) => {
    try {
      const { saleId } = req.params;
      const scope = getEnforcedScope(req);
      const replacement = await storage.replaceSaleItem({
        saleId,
        ...req.body,
        shopId: scope?.shopId || undefined,
        branchId: scope?.branchId || undefined,
      });
      res.status(201).json(replacement);
    } catch (error) {
      console.error("Sale item replacement error:", error);
      const message = error instanceof Error ? error.message : "Failed to replace item";
      res.status(400).json({ error: message });
    }
  });

  // Sale Payments (Payment History)
  const salePaymentSchema = z.object({
    saleId: z.string().min(1, "Sale ID is required"),
    customerId: z.string().optional().nullable(),
    paymentMethod: z.string().min(1, "Payment method is required"),
    bankAccountId: z.string().optional().nullable(),
    amount: z.number().positive("Amount must be positive"),
    reference: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/sale-payments", authMiddleware, enforceScopeMiddleware, validateBody(salePaymentSchema), async (req: AuthRequest, res) => {
    try {
      const payment = await storage.createSalePayment(req.body);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Sale payment error:", error);
      const message = error instanceof Error ? error.message : "Failed to record payment";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/sale-payments", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const saleId = req.query.saleId as string | undefined;
      const payments = await storage.getSalePayments(saleId);
      res.json(payments);
    } catch (error) {
      res.status(400).json({ error: "Failed to get sale payments" });
    }
  });

  app.get("/api/sales/:id/summary", authMiddleware, permissionMiddleware("sales"), async (req: AuthRequest, res) => {
    try {
      const summary = await storage.getSaleInvoiceSummary(req.params.id);
      if (!summary) {
        return res.status(404).json({ error: "Sale not found" });
      }
      res.json(summary);
    } catch (error) {
      console.error("Sale summary error:", error);
      res.status(400).json({ error: "Failed to get sale summary" });
    }
  });

  // Bank Accounts - RBAC protected
  app.get("/api/available-balance", authMiddleware, permissionMiddleware("bank_accounts"), async (req: AuthRequest, res) => {
    try {
      const bankAccountId = req.query.bankAccountId as string | undefined;
      const balance = await storage.getAvailableBalanceBreakdown(bankAccountId || null);
      res.json(balance);
    } catch (error) {
      res.status(400).json({ error: "Failed to get available balance" });
    }
  });

  app.get("/api/bank-accounts", authMiddleware, permissionMiddleware("bank_accounts"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const accounts = await storage.getBankAccounts(scope);
    res.json(accounts);
  });

  app.get("/api/bank-accounts/:id", authMiddleware, permissionMiddleware("bank_accounts"), async (req: AuthRequest, res) => {
    const account = await storage.getBankAccount(req.params.id);
    if (!account) return res.status(404).json({ error: "Bank account not found" });
    res.json(account);
  });

  app.post("/api/bank-accounts", authMiddleware, permissionMiddleware("bank_accounts"), injectScopeFromHeaders, enforceScopeMiddleware, validateBody(insertBankAccountSchema), async (req: AuthRequest, res) => {
    try {
      const account = await storage.createBankAccount(req.body);
      res.status(201).json(account);
    } catch (error: any) {
      console.error("Failed to create bank account:", error);
      res.status(400).json({ error: "Failed to create bank account: " + (error.message || String(error)) });
    }
  });

  app.patch("/api/bank-accounts/:id", authMiddleware, permissionMiddleware("bank_accounts"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    // Get existing account to preserve scope fields
    const existingAccount = await storage.getBankAccount(req.params.id);
    if (!existingAccount) return res.status(404).json({ error: "Bank account not found" });

    // Preserve scope fields - don't allow changing shop/branch via update
    const updateData = {
      ...req.body,
      companyId: existingAccount.companyId,
      shopId: existingAccount.shopId,
      branchId: existingAccount.branchId,
    };

    const account = await storage.updateBankAccount(req.params.id, updateData);
    if (!account) return res.status(404).json({ error: "Bank account not found" });
    res.json(account);
  });

  app.delete("/api/bank-accounts/:id", authMiddleware, permissionMiddleware("bank_accounts"), async (req: AuthRequest, res) => {
    await storage.deleteBankAccount(req.params.id);
    res.status(204).send();
  });

  // Bank Transactions - uses bank_accounts permission
  app.get("/api/bank-transactions", authMiddleware, permissionMiddleware("bank_accounts"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const accountId = req.query.accountId as string | undefined;
    const transactions = await storage.getBankTransactions(accountId, scope);
    res.json(transactions);
  });

  app.post("/api/bank-transactions", authMiddleware, permissionMiddleware("bank_accounts"), injectScopeFromHeaders, enforceScopeMiddleware, validateBody(insertBankTransactionSchema), async (req: AuthRequest, res) => {
    try {
      const transaction = await storage.createBankTransaction(req.body);
      res.status(201).json(transaction);
    } catch (error: any) {
      console.error("Bank transaction error:", error);
      res.status(400).json({ error: error.message || "Failed to create bank transaction" });
    }
  });

  // Petty Cash - RBAC protected
  app.get("/api/petty-cash", authMiddleware, permissionMiddleware("petty_cash"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const accounts = await storage.getPettyCashAccounts(scope);
    res.json(accounts);
  });

  app.post("/api/petty-cash", authMiddleware, permissionMiddleware("petty_cash"), injectScopeFromHeaders, enforceScopeMiddleware, validateBody(insertPettyCashSchema), async (req: AuthRequest, res) => {
    try {
      const account = await storage.createPettyCash(req.body);
      res.status(201).json(account);
    } catch (error) {
      res.status(400).json({ error: "Failed to create petty cash account" });
    }
  });

  app.get("/api/petty-cash-transactions", authMiddleware, permissionMiddleware("petty_cash"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const transactions = await storage.getPettyCashTransactions(scope);
    res.json(transactions);
  });

  
  app.delete("/api/petty-cash-transactions/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      await storage.deletePettyCashTransaction(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Petty cash transaction delete error:", error);
      res.status(400).json({ error: error.message || "Failed to delete petty cash transaction" });
    }
  });

  app.post("/api/petty-cash-transactions", authMiddleware, permissionMiddleware("petty_cash"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const transaction = await storage.createPettyCashTransaction({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(transaction);
    } catch (error: any) {
      console.error("Petty cash transaction error:", error);
      res.status(400).json({ error: error.message || "Failed to create petty cash transaction" });
    }
  });

  // Capital - RBAC protected
  app.get("/api/capital", authMiddleware, permissionMiddleware("capital"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const entries = await storage.getCapitalEntries(scope);
    res.json(entries);
  });

  app.post("/api/capital", authMiddleware, permissionMiddleware("capital"), injectScopeFromHeaders, enforceScopeMiddleware, validateBody(insertCapitalSchema), async (req: AuthRequest, res) => {
    try {
      if (!req.body.bankAccountId) {
        return res.status(400).json({ error: "Bank account is required for capital entries" });
      }
      const entry = await storage.createCapital(req.body);
      res.status(201).json(entry);
    } catch (error: any) {
      console.error("Capital creation error:", error);
      res.status(400).json({ error: error.message || "Failed to create capital entry" });
    }
  });

  // Employees - RBAC protected
  app.get("/api/employees/minimal", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const employees = await storage.getEmployees();
      // Return only necessary fields
      const minimalEmployees = employees.map(e => ({ id: e.id, name: e.name }));
      res.json(minimalEmployees);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get employees" });
    }
  });

  app.get("/api/employees", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const employees = await storage.getEmployees(scope);
    res.json(employees);
  });

  app.get("/api/employees/:id", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json(employee);
  });

  app.post("/api/employees", authMiddleware, permissionMiddleware("employees"), enforceScopeMiddleware, validateBody(insertEmployeeSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const employee = await storage.createEmployee({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(employee);
    } catch (error: any) {
      console.error("Create employee error:", error);
      res.status(400).json({ error: "Failed to create employee: " + (error.message || String(error)) });
    }
  });

  app.patch("/api/employees/:id", authMiddleware, permissionMiddleware("employees"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const employee = await storage.updateEmployee(req.params.id, req.body);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json(employee);
  });

  app.delete("/api/employees/:id", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    await storage.deleteEmployee(req.params.id);
    res.status(204).send();
  });

  // Salary Payments - RBAC protected
  
  app.delete("/api/salary-payments/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      await storage.deleteSalaryPayment(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Salary delete error:", error);
      res.status(400).json({ error: error.message || "Failed to delete salary payment" });
    }
  });

  app.get("/api/salary-payments", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const employeeId = req.query.employeeId as string | undefined;
    const payments = await storage.getSalaryPayments(employeeId, scope);
    res.json(payments);
  });

  app.post("/api/salary-payments", authMiddleware, permissionMiddleware("employees"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const payment = await storage.createSalaryPayment({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ error: "Failed to create salary payment" });
    }
  });

  // Salary Advances - RBAC protected
  app.get("/api/salary-advances", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const employeeId = req.query.employeeId as string | undefined;
    const advances = await storage.getSalaryAdvances(employeeId, scope);
    res.json(advances);
  });

  app.post("/api/salary-advances", authMiddleware, permissionMiddleware("employees"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const advance = await storage.createSalaryAdvance({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(advance);
    } catch (error: any) {
      const message = error?.message || "Failed to create salary advance";
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/salary-advances/:id", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const advance = await storage.updateSalaryAdvance(req.params.id, req.body);
      res.json(advance);
    } catch (error: any) {
      const message = error?.message || "Failed to update salary advance";
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/salary-advances/:id/repay", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const { amount, bankAccountId, notes } = req.body;
      const result = await storage.repaySalaryAdvance(req.params.id, parseFloat(amount), bankAccountId, notes);
      res.json(result);
    } catch (error: any) {
      const message = error?.message || "Failed to repay advance";
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/salary-advances/:id/history", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const history = await storage.getAdvanceRepaymentHistory(req.params.id);
      res.json(history);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to get repayment history" });
    }
  });

  app.get("/api/employees/:id/advance-balance", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    const balance = await storage.getEmployeeAdvanceBalance(req.params.id);
    res.json({ balance });
  });

  app.get("/api/employees/:id/unapproved-leave-deduction", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const { month, year } = req.query;
      if (!month || !year) {
        return res.status(400).json({ error: "Month and year are required" });
      }
      const deduction = await storage.getUnapprovedLeaveDeduction(
        req.params.id,
        parseInt(month as string),
        parseInt(year as string)
      );
      res.json(deduction);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to calculate leave deduction" });
    }
  });

  // Clients - RBAC protected
  app.get("/api/clients", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error: any) {
      console.error("Get clients error:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });

  app.post("/api/clients", authMiddleware, permissionMiddleware("projects"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const client = await storage.createClient(req.body);
      res.status(201).json(client);
    } catch (error) {
      res.status(400).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", authMiddleware, permissionMiddleware("projects"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const client = await storage.updateClient(req.params.id, req.body);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });

  app.delete("/api/clients/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    await storage.deleteClient(req.params.id);
    res.status(204).send();
  });

  // Projects - RBAC protected
  app.get("/api/projects", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const projects = await storage.getProjects(scope);
      res.json(projects);
    } catch (error: any) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  });

  app.post("/api/projects", authMiddleware, permissionMiddleware("projects"), projectFileUpload.array("files", 5), async (req: AuthRequest, res) => {
    try {
      const body = req.body;

      // Map API payload field names → DB column names
      const projectData: any = {
        name: body.title || body.name,
        description: body.description || null,
        clientId: body.client_id || body.clientId || null,
        clientName: body.clientName || null,
        startDate: body.start_date || body.startDate || null,
        endDate: body.end_date || body.endDate || null,
        hourlyRate: body.hourly_rate != null ? String(body.hourly_rate) : "0.000",
        totalCost: body.total_cost != null ? String(body.total_cost) : "0.000",
        totalHours: body.total_hours != null ? String(body.total_hours) : "0.000",
        isBillable: body.is_billable === true || body.is_billable === "true" || false,
        projectType: body.project_type != null ? parseInt(String(body.project_type)) : 1,
        projectStatus: body.Project_status != null ? parseInt(String(body.Project_status)) : (body.status_int != null ? parseInt(String(body.status_int)) : 0),
        departId: body.depart_id || null,
        subdeptId: body.subdept_id || null,
        manager: body.manager || null,
        team: body.team || null,
        status: "planned",
        priority: body.priority || "medium",
      };

      // Validate project dates
      if (projectData.startDate || projectData.endDate) {
        const dateValidation = validateProjectDates({
          startDate: projectData.startDate,
          endDate: projectData.endDate,
        });
        if (!dateValidation.valid) {
          const errorMessages = dateValidation.errors.map((e: any) => e.message).join(", ");
          console.warn(`[DATE VALIDATION] Project creation rejected: ${errorMessages}, User: ${req.user?.id}`);
          return res.status(400).json({ error: errorMessages });
        }
      }

      const project = await storage.createProject(projectData);

      // Save uploaded files (up to 5) to project_files
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      for (const file of uploadedFiles) {
        await storage.createProjectFile({
          projectId: project.id,
          fileName: file.originalname,
          filePath: `/uploads/projects/${file.filename}`,
          fileType: file.mimetype,
          fileSize: file.size,
          description: null,
          uploadedBy: req.user?.id || null,
        });
      }

      res.status(201).json(project);
    } catch (error: any) {
      console.error("Project creation error:", error);
      res.status(400).json({ error: error?.message || "Failed to create project" });
    }
  });


  app.patch("/api/projects/:id", authMiddleware, permissionMiddleware("projects"), projectFileUpload.array("files", 5), async (req: AuthRequest, res) => {
    try {
      const body = req.body;
      
      const projectData: any = {};
      if (body.title !== undefined || body.name !== undefined) projectData.name = body.title || body.name;
      if (body.description !== undefined) projectData.description = body.description;
      if (body.client_id !== undefined || body.clientId !== undefined) projectData.clientId = body.client_id || body.clientId;
      if (body.start_date !== undefined || body.startDate !== undefined) projectData.startDate = body.start_date || body.startDate;
      if (body.end_date !== undefined || body.endDate !== undefined) projectData.endDate = body.end_date || body.endDate;
      if (body.hourly_rate !== undefined) projectData.hourlyRate = String(body.hourly_rate);
      if (body.total_cost !== undefined) projectData.totalCost = String(body.total_cost);
      if (body.total_hours !== undefined) projectData.totalHours = String(body.total_hours);
      if (body.is_billable !== undefined) projectData.isBillable = body.is_billable === true || body.is_billable === "true";
      if (body.project_type !== undefined) projectData.projectType = parseInt(String(body.project_type));
      if (body.Project_status !== undefined) projectData.projectStatus = parseInt(String(body.Project_status));
      if (body.depart_id !== undefined) projectData.departId = body.depart_id;
      if (body.subdept_id !== undefined) projectData.subdeptId = body.subdept_id;
      if (body.manager !== undefined) projectData.manager = body.manager;
      if (body.team !== undefined) projectData.team = body.team;
      if (body.priority !== undefined) projectData.priority = body.priority;

      // Validate project dates if being updated
      if (projectData.startDate || projectData.endDate) {
        const existingProject = await storage.getProject(req.params.id);
        if (existingProject) {
          const dateValidation = validateProjectDates({
            startDate: projectData.startDate || existingProject.startDate,
            endDate: projectData.endDate || existingProject.endDate,
          });
          if (!dateValidation.valid) {
            const errorMessages = dateValidation.errors.map(e => e.message).join(", ");
            console.warn(`[DATE VALIDATION] Project update rejected: ${errorMessages}, User: ${(req as AuthRequest).user?.id}`);
            return res.status(400).json({ error: errorMessages });
          }
        }
      }

      const project = await storage.updateProject(req.params.id, projectData);
      if (!project) return res.status(404).json({ error: "Project not found" });

      // Save uploaded files to project_files if provided
      const uploadedFiles = (req.files as Express.Multer.File[]) || [];
      for (const file of uploadedFiles) {
        await storage.createProjectFile({
          projectId: project.id,
          fileName: file.originalname,
          filePath: `/uploads/projects/${file.filename}`,
          fileType: file.mimetype,
          fileSize: file.size,
          description: null,
          uploadedBy: req.user?.id || null,
        });
      }

      res.json(project);
    } catch (error) {
      res.status(400).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    await storage.deleteProject(req.params.id);
    res.status(204).send();
  });

  // Tasks - RBAC protected
  app.get("/api/tasks", authMiddleware, permissionMiddleware("tasks"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = {
        shopId: req.user?.shopId || null,
        branchId: req.user?.branchId || null
      };
      const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin";
      const currentEmployeeId = req.user?.employeeId;

      const tasks = await storage.getTasks(scope, { isAdmin, currentEmployeeId });
      res.json(tasks);
    } catch (error: any) {
      console.error("Get tasks error:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", authMiddleware, permissionMiddleware("tasks"), async (req: AuthRequest, res) => {
    const task = await storage.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.post("/api/tasks", authMiddleware, permissionMiddleware("tasks"), enforceScopeMiddleware, taskUpload.single("attachment"), async (req: AuthRequest, res) => {
    try {
      const body = req.body;

      // Validate required fields
      if (!body.title || String(body.title).trim() === "") {
        return res.status(400).json({ error: "Validation failed", details: { title: ["Required"] } });
      }

      let assigneeIdStr = null;
      if (body.emp_id) {
        if (Array.isArray(body.emp_id)) {
           assigneeIdStr = body.emp_id.join(",");
        } else if (typeof body.emp_id === "string") {
           try {
             const parsed = JSON.parse(body.emp_id);
             if (Array.isArray(parsed)) assigneeIdStr = parsed.join(",");
             else assigneeIdStr = String(parsed);
           } catch (e) {
             assigneeIdStr = body.emp_id;
           }
        }
      } else if (body.assigneeId) {
        assigneeIdStr = Array.isArray(body.assigneeId) ? body.assigneeId.join(",") : body.assigneeId;
      }
      
      let estimatedHoursVal = "0.00";
      if (body.estimated_hours) {
        const parts = String(body.estimated_hours).split(":");
        if (parts.length === 2) {
           const mins = parseInt(parts[1], 10);
           const frac = Math.round((mins * 100) / 60);
           estimatedHoursVal = `${parts[0]}.${frac.toString().padStart(2, "0")}`;
        } else {
           estimatedHoursVal = String(body.estimated_hours);
        }
      } else if (body.estimatedHours) {
        estimatedHoursVal = String(body.estimatedHours);
      }

      let mappedStatus = body.status || "todo";
      const s = parseInt(body.status);
      if (s === 1) mappedStatus = "todo";
      else if (s === 2) mappedStatus = "in_progress";
      else if (s === 3) mappedStatus = "completed";

      const isBillable = body.is_billable === "1" || body.is_billable === 1 || body.is_billable === "true" || body.is_billable === true || body.billable === true;

      const taskData = {
        title: body.title,
        description: body.description || null,
        projectId: body.project_id || body.projectId || null,
        companyId: req.user?.companyId || null,
        shopId: req.user?.shopId || null,
        branchId: req.user?.branchId || null,
        assigneeId: assigneeIdStr,
        startDate: body.from_date_time || body.startDate || null,
        dueDate: body.to_date_time || body.dueDate || null,
        estimatedHours: estimatedHoursVal,
        status: mappedStatus,
        billable: isBillable,
        priority: body.priority || "medium",
      };

      const task = await storage.createTask(taskData);
      
      if (req.file) {
        await storage.createTaskAttachment({
          taskId: task.id,
          fileName: req.file.originalname,
          filePath: `/uploads/tasks/${req.file.filename}`,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          uploadedBy: req.user?.id || null,
        });
      }

      res.status(201).json(task);
    } catch (error: any) {
      console.error("Task creation error:", error);
      res.status(400).json({ error: error?.message || "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", authMiddleware, permissionMiddleware("tasks"), enforceScopeMiddleware, taskUpload.single("attachment"), async (req: AuthRequest, res) => {
    try {
      const body = req.body;
      const updates: any = {};

      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.project_id !== undefined || body.projectId !== undefined) {
        updates.projectId = body.project_id || body.projectId;
      }
      if (body.priority !== undefined) updates.priority = body.priority;

      // Handle assignee mapping
      if (body.emp_id !== undefined || body.assigneeId !== undefined) {
        const val = body.emp_id !== undefined ? body.emp_id : body.assigneeId;
        if (Array.isArray(val)) {
          updates.assigneeId = val.join(",");
        } else if (typeof val === "string") {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) updates.assigneeId = parsed.join(",");
            else updates.assigneeId = String(parsed);
          } catch (e) {
            updates.assigneeId = val;
          }
        } else {
          updates.assigneeId = val ? String(val) : null;
        }
      }

      // Handle hours mapping
      if (body.estimated_hours !== undefined || body.estimatedHours !== undefined) {
        const val = body.estimated_hours !== undefined ? body.estimated_hours : body.estimatedHours;
        const parts = String(val).split(":");
        if (parts.length === 2) {
          const mins = parseInt(parts[1], 10);
          const frac = Math.round((mins * 100) / 60);
          updates.estimatedHours = `${parts[0]}.${frac.toString().padStart(2, "0")}`;
        } else {
          updates.estimatedHours = String(val);
        }
      }

      if (body.actualHours !== undefined) updates.actualHours = body.actualHours;

      // Handle status mapping
      if (body.status !== undefined) {
        let mappedStatus = body.status;
        const s = parseInt(body.status);
        if (s === 1) mappedStatus = "todo";
        else if (s === 2) mappedStatus = "in_progress";
        else if (s === 3) mappedStatus = "completed";
        updates.status = mappedStatus;
      }

      // Handle billable mapping
      if (body.is_billable !== undefined || body.billable !== undefined) {
        const val = body.is_billable !== undefined ? body.is_billable : body.billable;
        updates.billable = val === "1" || val === 1 || val === "true" || val === true;
      }

      if (body.from_date_time !== undefined || body.startDate !== undefined) {
        updates.startDate = body.from_date_time || body.startDate;
      }
      if (body.to_date_time !== undefined || body.dueDate !== undefined) {
        updates.dueDate = body.to_date_time || body.dueDate;
      }

      const task = await storage.updateTask(req.params.id, updates);
      if (!task) return res.status(404).json({ error: "Task not found" });

      if (req.file) {
        await storage.createTaskAttachment({
          taskId: task.id,
          fileName: req.file.originalname,
          filePath: `/uploads/tasks/${req.file.filename}`,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          uploadedBy: req.user?.id || null,
        });
      }

      res.json(task);
    } catch (error: any) {
      console.error("Task update error:", error);
      res.status(400).json({ error: error?.message || "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", authMiddleware, permissionMiddleware("tasks"), async (req: AuthRequest, res) => {
    await storage.deleteTask(req.params.id);
    res.status(204).send();
  });

  // Project Expenses - RBAC protected
  app.get("/api/project-expenses", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const expenses = await storage.getProjectExpenses(projectId);
      res.json(expenses);
    } catch (error: any) {
      console.error("Get project-expenses error:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch project expenses" });
    }
  });

  app.post("/api/project-expenses", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { branchId: requestedBranchId, warehouseId: requestedWarehouseId, expenseDate, ...restData } = req.body;

      const branchCheck = validateBranchAccess(user, requestedBranchId);
      if (!branchCheck.valid) {
        return res.status(403).json({ error: "Access denied. You can only create expenses for your assigned branch." });
      }

      const warehouseCheck = validateWarehouseAccess(user, requestedWarehouseId);
      if (!warehouseCheck.valid) {
        return res.status(403).json({ error: "Access denied. You can only create expenses for your assigned warehouse." });
      }

      const expenseData = {
        ...restData,
        branchId: branchCheck.branchId,
        warehouseId: warehouseCheck.warehouseId,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      };

      const expense = await storage.createProjectExpenseWithAccounting(expenseData);
      res.status(201).json(expense);
    } catch (error: any) {
      console.error("Project expense creation error:", error);
      res.status(400).json({ error: error.message || "Failed to create project expense with accounting" });
    }
  });
  app.patch("/api/project-expenses/:id", authMiddleware, permissionMiddleware("projects"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const expense = await storage.updateProjectExpense(req.params.id, req.body);
      res.json(expense);
    } catch (error) {
      res.status(400).json({ error: "Failed to update project expense" });
    }
  });

  app.delete("/api/project-expenses/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    await storage.deleteProjectExpense(req.params.id);
    res.status(204).send();
  });

  app.get("/api/projects/:id/budget-summary", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    const summary = await storage.getProjectBudgetSummary(req.params.id);
    res.json(summary);
  });

  // Project P&L (derived from accounting) - RBAC protected
  app.get("/api/projects/:id/profit-loss", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const pnl = await storage.getProjectProfitLoss(req.params.id);
      res.json(pnl);
    } catch (error) {
      res.status(400).json({ error: "Failed to calculate project P&L" });
    }
  });

  // Project Income (Client Payments) - RBAC protected
  app.get("/api/project-income", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    const projectId = req.query.projectId as string | undefined;
    const income = await storage.getProjectIncome(projectId);
    res.json(income);
  });

  app.post("/api/project-income", authMiddleware, permissionMiddleware("projects"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const income = await storage.createProjectIncome(req.body);
      res.status(201).json(income);
    } catch (error: any) {
      console.error("Failed to create project income:", error);
      res.status(400).json({ error: error?.message || "Failed to create project income" });
    }
  });

  app.patch("/api/project-income/:id/confirm-payment", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const { payments, paymentDate, paymentMethod, reference } = req.body;
      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: "At least one payment is required" });
      }
      const validPayments = payments.filter((p: any) => p.bankAccountId && Number(p.amount) > 0);
      if (validPayments.length === 0) {
        return res.status(400).json({ error: "At least one valid payment with amount > 0 is required" });
      }
      
      const income = await storage.confirmProjectIncomePayment(req.params.id, {
        payments: validPayments,
        paymentDate: new Date(paymentDate || Date.now()),
        paymentMethod: paymentMethod || "bank",
        reference: reference || ""
      });
      res.json(income);
    } catch (error: any) {
      console.error("Failed to confirm project payment:", error);
      res.status(400).json({ error: error?.message || "Failed to confirm project payment" });
    }
  });

  app.patch("/api/project-income/:id", authMiddleware, permissionMiddleware("projects"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const income = await storage.updateProjectIncome(req.params.id, req.body);
      res.json(income);
    } catch (error: any) {
      console.error("Failed to update project income:", error);
      res.status(400).json({ error: error?.message || "Failed to update project income" });
    }
  });

  app.delete("/api/project-income/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteProjectIncome(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Failed to delete project income:", error);
      res.status(400).json({ error: error?.message || "Failed to delete project income" });
    }
  });

  // Task Completion with Accounting
  app.post("/api/tasks/:id/complete", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const actualHours = parseFloat(req.body.actualHours || "0");
      const task = await storage.completeTask(req.params.id, actualHours);
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to complete task" });
    }
  });

  // Task Attachments
  app.get("/api/tasks/:taskId/attachments", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const attachments = await storage.getTaskAttachments(req.params.taskId);
      res.json(attachments);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get attachments" });
    }
  });

  app.post("/api/tasks/:taskId/attachments", authMiddleware, taskUpload.single("file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const attachment = await storage.createTaskAttachment({
        taskId: req.params.taskId,
        fileName: req.file.originalname,
        filePath: `/uploads/tasks/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user?.id || null,
      });

      res.status(201).json(attachment);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to upload attachment" });
    }
  });

  // Task Timer APIs
  app.get("/api/tasks/:taskId/timer/active", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const session = await storage.getActiveTaskTimerSession(req.params.taskId, req.user!.id);
      res.json(session || null);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get active timer" });
    }
  });

  app.get("/api/tasks/all/active-timers", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const sessions = await storage.getAllActiveTimerSessions(req.user!.id);
      res.json(sessions);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get active timers" });
    }
  });

  app.post("/api/tasks/:taskId/timer/start", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const active = await storage.getActiveTaskTimerSession(req.params.taskId, req.user!.id);
      if (active) {
        return res.status(400).json({ error: "Timer already running for this task" });
      }

      const session = await storage.createTaskTimerSession({
        taskId: req.params.taskId,
        userId: req.user!.id,
        startTime: new Date(),
        status: "running",
      });

      await storage.updateTask(req.params.taskId, { status: "in_progress" });
      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to start timer" });
    }
  });

  app.post("/api/tasks/:taskId/timer/pause", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const session = await storage.getActiveTaskTimerSession(req.params.taskId, req.user!.id);
      if (!session || session.status !== "running") {
        return res.status(400).json({ error: "No running timer found" });
      }

      const updated = await storage.updateTaskTimerSession(session.id, {
        status: "paused",
        lastPauseTime: new Date(),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to pause timer" });
    }
  });

  app.post("/api/tasks/:taskId/timer/resume", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const session = await storage.getActiveTaskTimerSession(req.params.taskId, req.user!.id);
      if (!session || session.status !== "paused") {
        return res.status(400).json({ error: "Timer is not paused" });
      }

      const now = new Date();
      const pauseDuration = Math.round((now.getTime() - session.lastPauseTime!.getTime()) / 1000);
      const totalPauseDuration = (session.totalPauseDuration || 0) + pauseDuration;

      const updated = await storage.updateTaskTimerSession(session.id, {
        status: "running",
        totalPauseDuration,
        lastPauseTime: null,
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to resume timer" });
    }
  });

  app.post("/api/tasks/:taskId/timer/stop", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const session = await storage.getActiveTaskTimerSession(req.params.taskId, req.user!.id);
      if (!session) return res.status(400).json({ error: "No active timer found" });

      const endTime = new Date();
      let totalPauseDuration = session.totalPauseDuration || 0;
      if (session.status === "paused" && session.lastPauseTime) {
        totalPauseDuration += Math.round((endTime.getTime() - session.lastPauseTime.getTime()) / 1000);
      }

      const durationSeconds = Math.round((endTime.getTime() - session.startTime.getTime()) / 1000) - totalPauseDuration;
      const durationHours = durationSeconds / 3600;

      await storage.updateTaskTimerSession(session.id, {
        status: "completed",
        endTime,
        totalPauseDuration,
      });

      const task = await storage.getTask(req.params.taskId);
      if (task) {
         const newActualHours = (Number(task.actualHours) || 0) + durationHours;
        await storage.updateTask(task.id, { actualHours: newActualHours.toFixed(2) });

        await storage.createTimesheet({
          taskId: task.id,
          projectId: task.projectId,
          userId: req.user!.id,
          hours: durationHours.toFixed(2),
          source: "timer",
          date: new Date().toISOString().split('T')[0],
          startTime: session.startTime,
          endTime: endTime,
        });

        // Threshold check: If actual hours exceed estimated hours and not already notified
        if (Number(task.estimatedHours) > 0 && newActualHours > Number(task.estimatedHours) && !task.notified) {
          try {
            const project = await storage.getProject(task.projectId || "");
            const employee = await storage.getUser(req.user!.id);
            
            // Find recipients (Admins and Super Admins)
            const allUsers = await storage.getUsers();
            const recipientEmails = allUsers
              .filter(u => (u.role === "admin" || u.role === "super_admin") && u.email)
              .map(u => u.email as string);

            if (recipientEmails.length > 0) {
              await sendTaskThresholdNotification({
                taskTitle: task.title,
                projectName: project?.name || "N/A",
                estimatedHours: task.estimatedHours || "0",
                actualHours: newActualHours.toFixed(2),
                employeeName: employee?.name || employee?.username || "Staff",
                recipientEmails
              });
              
              // Mark as notified to avoid duplicate emails
              await storage.updateTask(task.id, { notified: true });
            }
          } catch (notifyErr) {
            console.error("Failed to send threshold notification:", notifyErr);
          }
        }
      }
      res.json({ message: "Timer stopped", hours: durationHours });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to stop timer" });
    }
  });

  app.post("/api/tasks/:taskId/manual-hours", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { hours, description } = req.body;
      const task = await storage.getTask(req.params.taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const newActualHours = (Number(task.actualHours) || 0) + Number(hours);
      await storage.updateTask(task.id, { actualHours: newActualHours.toFixed(2) });

       await storage.createTimesheet({
        taskId: task.id,
        projectId: task.projectId,
        userId: req.user!.id,
        hours: Number(hours).toFixed(2),
        source: "manual",
        date: new Date().toISOString().split('T')[0],
        description: description || "Manual entry",
      });

      // Threshold check: If actual hours exceed estimated hours and not already notified
      if (Number(task.estimatedHours) > 0 && newActualHours > Number(task.estimatedHours) && !task.notified) {
        try {
          const project = await storage.getProject(task.projectId || "");
          const employee = await storage.getUser(req.user!.id);
          const allUsers = await storage.getUsers();
          const recipientEmails = allUsers
            .filter(u => (u.role === "admin" || u.role === "super_admin") && u.email)
            .map(u => u.email as string);

          if (recipientEmails.length > 0) {
            await sendTaskThresholdNotification({
              taskTitle: task.title,
              projectName: project?.name || "N/A",
              estimatedHours: task.estimatedHours || "0",
              actualHours: newActualHours.toFixed(2),
              employeeName: employee?.name || employee?.username || "Staff",
              recipientEmails
            });
            await storage.updateTask(task.id, { notified: true });
          }
        } catch (notifyErr) {
          console.error("Failed to send threshold notification from manual hours:", notifyErr);
        }
      }

      res.json({ message: "Hours added successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to add manual hours" });
    }
  });

  app.get("/api/projects/:projectId/timesheets", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const entries = await storage.getTimesheets(req.params.projectId);
      res.json(entries);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get timesheets" });
    }
  });

  app.get("/api/server-time", (req, res) => {
    res.json({ time: new Date().toISOString() });
  });

  app.delete("/api/tasks/:taskId/attachments/:attachmentId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteTaskAttachment(req.params.attachmentId);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete attachment" });
    }
  });

  // Project Files
  app.get("/api/projects/:projectId/files", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.projectId);
      res.json(files);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get project files" });
    }
  });

  app.post("/api/projects/:projectId/files", authMiddleware, projectFileUpload.single("file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = await storage.createProjectFile({
        projectId: req.params.projectId,
        fileName: req.file.originalname,
        filePath: `/uploads/projects/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        description: req.body.description || null,
        uploadedBy: req.user?.id || null,
      });

      res.status(201).json(file);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to upload file" });
    }
  });

  app.delete("/api/projects/:projectId/files/:fileId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteProjectFile(req.params.fileId);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete file" });
    }
  });

  // Serve project files
  app.use("/uploads/projects", (await import("express")).default.static(projectUploadDir));

  // Project Timesheet Summary (for graphs)
  app.get("/api/projects/:projectId/timesheet-summary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.projectId;
      const allTasks = await storage.getTasks();
      const projectTasks = allTasks.filter((t: any) => t.projectId === projectId);

      let totalEstimated = 0;
      let totalActual = 0;

      for (const task of projectTasks) {
        totalEstimated += parseFloat(task.estimatedHours || "0");
        totalActual += parseFloat(task.actualHours || "0");
      }

      const remaining = Math.max(0, totalEstimated - totalActual);

      res.json({
        totalEstimated,
        totalActual,
        remaining,
        taskCount: projectTasks.length,
        completedTasks: projectTasks.filter((t: any) => t.status === "completed").length,
        inProgressTasks: projectTasks.filter((t: any) => t.status === "in_progress").length,
        todoTasks: projectTasks.filter((t: any) => t.status === "todo").length,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get timesheet summary" });
    }
  });

  // Stock Transfers - RBAC protected
  app.get("/api/stock-transfers", authMiddleware, permissionMiddleware("stock_transfers"), async (req: AuthRequest, res) => {
    const transfers = await storage.getStockTransfers();
    res.json(transfers);
  });

  app.get("/api/stock-transfers/:id", authMiddleware, permissionMiddleware("stock_transfers"), async (req: AuthRequest, res) => {
    const transfer = await storage.getStockTransfer(req.params.id);
    if (!transfer) return res.status(404).json({ error: "Transfer not found" });
    const items = await storage.getStockTransferItems(req.params.id);
    res.json({ ...transfer, items });
  });

  app.get("/api/warehouses/:id/inventory", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    try {
      const warehouseInventory = await storage.getInventoryByWarehouse(req.params.id);
      res.json(warehouseInventory);
    } catch (error: any) {
      console.error("Error fetching warehouse inventory:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/stock-transfers", authMiddleware, permissionMiddleware("stock_transfers"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const transfer = await storage.createStockTransfer({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(transfer);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create stock transfer" });
    }
  });

  // ==================== ACCOUNTING ROUTES ====================

  // Chart of Accounts - RBAC protected
  app.get("/api/chart-of-accounts", authMiddleware, permissionMiddleware("chart_of_accounts"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const companyId = req.query.companyId as string | undefined;
    const accounts = await storage.getChartOfAccounts(companyId, scope);
    res.json(accounts);
  });

  app.get("/api/chart-of-accounts/:id", authMiddleware, permissionMiddleware("chart_of_accounts"), async (req: AuthRequest, res) => {
    const account = await storage.getChartOfAccount(req.params.id);
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  });

  app.post("/api/chart-of-accounts", authMiddleware, permissionMiddleware("chart_of_accounts"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const account = await storage.createChartOfAccount({
        ...req.body,
        shopId: scope.shopId || req.body.shopId,
        branchId: scope.branchId || req.body.branchId,
      });
      res.status(201).json(account);
    } catch (error) {
      res.status(400).json({ error: "Failed to create account" });
    }
  });

  app.patch("/api/chart-of-accounts/:id", authMiddleware, permissionMiddleware("chart_of_accounts"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    const account = await storage.updateChartOfAccount(req.params.id, req.body);
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  });

  app.delete("/api/chart-of-accounts/:id", authMiddleware, permissionMiddleware("chart_of_accounts"), async (req: AuthRequest, res) => {
    await storage.deleteChartOfAccount(req.params.id);
    res.status(204).send();
  });

  app.post("/api/chart-of-accounts/seed", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      // Optional: accept shopId and branchId from request body for scoped seeding
      const { shopId, branchId } = req.body || {};
      const result = await storage.seedDefaultChartOfAccounts(shopId, branchId);
      res.json({ message: `Created ${result.created} accounts, ${result.existing} already existed`, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to seed chart of accounts" });
    }
  });

  app.post("/api/chart-of-accounts/seed-branch/:branchId", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const result = await storage.seedChartOfAccountsForBranch(req.params.branchId);
      res.json({ message: `Created ${result.created} accounts for branch, ${result.existing} already existed`, ...result });
    } catch (error) {
      res.status(500).json({ error: "Failed to seed chart of accounts for branch" });
    }
  });

  app.post("/api/chart-of-accounts/seed-shop/:shopId/:branchId", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const result = await storage.seedChartOfAccountsForShop(req.params.shopId, req.params.branchId);
      res.json({ message: `Created ${result.created} accounts for shop, ${result.existing} already existed`, ...result });
    } catch (error) {
      res.status(500).json({ error: "Failed to seed chart of accounts for shop" });
    }
  });

  // Seed missing accounts to ALL existing shops/branches (idempotent)
  app.post("/api/chart-of-accounts/seed-all", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const result = await storage.seedMissingAccountsToAllShops();
      res.json({
        message: `Seeded ${result.totalCreated} missing accounts across ${result.shopsProcessed} shop-branch combinations`,
        ...result
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to seed accounts to all shops" });
    }
  });

  // Seed demo users - super admin only
  app.post("/api/users/seed", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const demoUsers = [
        { username: "admin", name: "Super Admin", role: "super_admin" },
        { username: "manager", name: "Manager", role: "manager" },
        { username: "cashier", name: "Cashier", role: "cashier" },
        { username: "staff1", name: "Staff Member", role: "staff" },
      ];

      const password = "password123";
      const hashedPassword = await hashPassword(password);

      let created = 0;
      let existing = 0;

      for (const user of demoUsers) {
        const existingUser = await storage.getUserByUsername(user.username);
        if (!existingUser) {
          await storage.createUser({
            username: user.username,
            password: hashedPassword,
            name: user.name,
            role: user.role,
          });
          created++;
        } else {
          existing++;
        }
      }

      res.json({ message: `Created ${created} users, ${existing} already existed`, created, existing });
    } catch (error) {
      res.status(500).json({ error: "Failed to seed demo users" });
    }
  });

  // Journal Entries
  app.get("/api/journal-entries", authMiddleware, async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const sourceType = req.query.sourceType as string | undefined;
    const sourceId = req.query.sourceId as string | undefined;
    const entries = await storage.getJournalEntries(undefined, sourceType, sourceId, scope.shopId || undefined, scope.branchId || undefined);

    // Add total amount for each entry - for sales, exclude COGS (5000) to show actual transaction value
    const accounts = await storage.getChartOfAccounts();
    const entriesWithTotals = await Promise.all(
      entries.map(async (entry) => {
        const lines = await storage.getJournalLines(entry.id);

        let totalAmount = 0;
        if (entry.sourceType === "sale") {
          // For sales: show cash/credit received - exclude COGS (5000) to match actual sale amount
          totalAmount = lines.reduce((sum, line) => {
            const account = accounts.find((a: any) => a.id === line.accountId);
            // Include only cash (1000), receivables (1100), and applied store credit (2000)
            if (account && (account.accountCode === "1000" || account.accountCode === "1100" || account.accountCode === "2000")) {
              return sum + parseFloat(line.debit?.toString() || "0");
            }
            return sum;
          }, 0);
        } else if (entry.sourceType === "purchase") {
          // For purchases: use inventory debit (1200) - this is the actual purchase cost
          totalAmount = lines.reduce((sum, line) => {
            const account = accounts.find((a: any) => a.id === line.accountId);
            if (account && account.accountCode === "1200") {
              return sum + parseFloat(line.debit?.toString() || "0");
            }
            return sum;
          }, 0);
        } else {
          // For other entries: sum all debits
          totalAmount = lines.reduce((sum, line) => sum + parseFloat(line.debit?.toString() || "0"), 0);
        }

        return { ...entry, totalAmount };
      })
    );

    res.json(entriesWithTotals);
  });

  // Customer payment transactions for reports - RBAC protected
  app.get("/api/customers/:id/payment-transactions", authMiddleware, permissionMiddleware("customer_transactions"), async (req: AuthRequest, res) => {
    try {
      const entries = await storage.getJournalEntries(undefined, "customer_payment", req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch customer payments" });
    }
  });

  // Customer store credit refund transactions for reports - RBAC protected
  app.get("/api/customers/:id/refund-transactions", authMiddleware, permissionMiddleware("customer_transactions"), async (req: AuthRequest, res) => {
    try {
      const entries = await storage.getJournalEntries(undefined, "customer_refund", req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch customer refunds" });
    }
  });

  // Customer AR statement - generated exclusively from Accounts Receivable journal entries
  app.get("/api/customers/:id/ar-statement", authMiddleware, permissionMiddleware("customer_transactions"), async (req: AuthRequest, res) => {
    try {
      const statement = await storage.getCustomerARStatement(req.params.id);
      res.json(statement);
    } catch (error) {
      console.error("Failed to fetch customer AR statement:", error);
      res.status(400).json({ error: "Failed to fetch customer AR statement" });
    }
  });

  // Customer payment statement - comprehensive view of all invoices and payments
  app.get("/api/customers/:id/payment-statement", authMiddleware, permissionMiddleware("customer_transactions"), async (req: AuthRequest, res) => {
    try {
      const statement = await storage.getCustomerPaymentStatement(req.params.id);
      res.json(statement);
    } catch (error) {
      console.error("Failed to fetch customer payment statement:", error);
      res.status(400).json({ error: "Failed to fetch customer payment statement" });
    }
  });

  // Repair missing serviceTicketPayments record for a ticket (after update wiped it)
  app.post("/api/service-tickets/:id/repair-payment-record", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.repairServiceTicketPaymentRecord(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Failed to repair payment record:", error);
      res.status(500).json({ error: "Failed to repair payment record" });
    }
  });

  // Supplier payment transactions for reports - RBAC protected
  app.get("/api/suppliers/:id/payment-transactions", authMiddleware, permissionMiddleware("supplier_transactions"), async (req: AuthRequest, res) => {
    try {
      const entries = await storage.getJournalEntries(undefined, "supplier_payment", req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch supplier payments" });
    }
  });

  // Supplier opening balance payment transactions for reports - RBAC protected
  app.get("/api/suppliers/:id/opening-balance-payments", authMiddleware, permissionMiddleware("supplier_transactions"), async (req: AuthRequest, res) => {
    try {
      const entries = await storage.getJournalEntries(undefined, "opening_balance_payment", req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch supplier opening balance payments" });
    }
  });

  // Supplier credit refunds (cash received from supplier for credit balance) - RBAC protected
  app.get("/api/suppliers/:id/credit-refunds", authMiddleware, permissionMiddleware("supplier_transactions"), async (req: AuthRequest, res) => {
    try {
      const refunds = await storage.getSupplierCreditRefunds(req.params.id);
      res.json(refunds);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch supplier credit refunds" });
    }
  });

  app.get("/api/journal-entries/:id", authMiddleware, permissionMiddleware("accounting"), async (req: AuthRequest, res) => {
    const entry = await storage.getJournalEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: "Journal entry not found" });
    res.json(entry);
  });

  app.get("/api/journal-entries/:id/lines", authMiddleware, permissionMiddleware("accounting"), async (req: AuthRequest, res) => {
    const lines = await storage.getJournalLines(req.params.id);
    res.json(lines);
  });

  app.post("/api/journal-entries", authMiddleware, permissionMiddleware("accounting"), async (req: AuthRequest, res) => {
    try {
      const { lines, ...entryData } = req.body;
      const entry = await storage.createJournalEntry(entryData, lines || []);
      res.status(201).json(entry);
    } catch (error) {
      res.status(400).json({ error: "Failed to create journal entry" });
    }
  });

  // Financial Reports - RBAC protected
  app.get("/api/reports/trial-balance", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const { companyId, startDate, endDate } = req.query as any;
    const report = await storage.getTrialBalance(companyId, startDate, endDate, scope);
    res.json(report);
  });

  app.get("/api/reports/general-ledger/:accountId", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const { startDate, endDate } = req.query as any;
    const report = await storage.getGeneralLedger(req.params.accountId, startDate, endDate, scope);
    res.json(report);
  });

  app.get("/api/reports/employee-work", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    try {
      const { employeeId, startDate, endDate } = req.query as any;
      if (!employeeId) {
        return res.status(400).json({ error: "Employee ID is required" });
      }
      const report = await storage.getEmployeeWorkReport(employeeId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to get employee work report" });
    }
  });

  app.get("/api/reports/driver-attendance", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    try {
      const { driverId, startDate, endDate } = req.query as any;
      const report = await storage.getDriverAttendanceReport(driverId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      console.error("Error in /api/reports/driver-attendance:", error);
      res.status(400).json({ error: error.message || "Failed to get driver attendance report" });
    }
  });

  app.get("/api/reports/driver-deliveries", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    try {
      const { driverId, startDate, endDate } = req.query as any;
      const report = await storage.getDriverDeliveriesReport(driverId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      console.error("Error in /api/reports/driver-deliveries:", error);
      res.status(400).json({ error: error.message || "Failed to get driver deliveries report" });
    }
  });

  app.get("/api/reports/profit-loss", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const { companyId, startDate, endDate } = req.query as any;
    const report = await storage.getProfitAndLoss(companyId, startDate, endDate, scope);
    res.json(report);
  });

  app.get("/api/reports/balance-sheet", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const { companyId, asOfDate } = req.query as any;
    const report = await storage.getBalanceSheet(companyId, asOfDate, scope);
    res.json(report);
  });

  // Salary Reports - RBAC protected
  app.get("/api/reports/salary", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const { employeeId, startDate, endDate } = req.query as any;
    const report = await storage.getSalaryReport(employeeId, startDate, endDate, scope);
    res.json(report);
  });

  // Project Reports - RBAC protected
  app.get("/api/reports/project", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const { projectId, employeeId, startDate, endDate } = req.query as any;
    const report = await storage.getProjectReport(projectId, employeeId, startDate, endDate, scope);
    res.json(report);
  });

  app.get("/api/reports/petty-cash", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const { startDate, endDate } = req.query as any;
      const report = await storage.getPettyCashReport(startDate, endDate, scope);
      res.json(report);
    } catch (error: any) {
      console.error("Error in /api/reports/petty-cash:", error);
      res.status(500).json({ error: error.message || "Failed to generate petty cash report" });
    }
  });

  app.get("/api/reports/service-tickets", authMiddleware, permissionMiddleware("reports"), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const filters = {
        technicianId: req.query.technicianId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        paymentStatus: req.query.paymentStatus as "paid" | "outstanding" | undefined,
        shopId: (req.query.shopId as string) || scope.shopId || undefined,
        branchId: (req.query.branchId as string) || scope.branchId || undefined,
      };
      
      const tickets = await storage.getServiceTicketsReport(filters);
      res.json(tickets);
    } catch (error) {
      console.error("Error in /api/reports/service-tickets:", error);
      res.status(400).json({ error: "Failed to get service tickets report" });
    }
  });

  app.get("/api/reports/overall", async (req, pRes, next) => {
    try {
      const scope = getScopeFromRequest(req);
      const { startDate, endDate, warehouseId } = req.query as any;
      const report = await storage.getOverallReport(startDate, endDate, warehouseId, scope);
      pRes.json(report);
    } catch (error: any) {
      console.error("Error in /api/reports/overall:", error);
      pRes.status(500).json({ error: error.message || "Failed to generate overall report" });
    }
  });

  // ==================== QUOTATION ROUTES ==================== (RBAC protected)

  app.get("/api/quotations", authMiddleware, permissionMiddleware("quotations"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const quotations = await storage.getQuotations(scope);
    res.json(quotations);
  });

  app.get("/api/quotations/:id", authMiddleware, permissionMiddleware("quotations"), async (req: AuthRequest, res) => {
    const quotation = await storage.getQuotation(req.params.id);
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    res.json(quotation);
  });

  app.post("/api/quotations", authMiddleware, permissionMiddleware("quotations"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      // Validate quotation date - cannot be in the past
      if (req.body.quotationDate) {
        const dateValidation = validateTransactionDates({
          quotationDate: req.body.quotationDate,
        });
        if (!dateValidation.valid) {
          const errorMessages = dateValidation.errors.map(e => e.message).join(", ");
          console.warn(`[DATE VALIDATION] Quotation creation rejected: ${errorMessages}, User: ${req.user?.id}`);
          return res.status(400).json({ error: errorMessages });
        }
      }

      const scope = getScopeFromRequest(req);
      const { items, ...quotationData } = req.body;
      const quotation = await storage.createQuotation({
        ...quotationData,
        shopId: scope.shopId || quotationData.shopId,
        branchId: scope.branchId || quotationData.branchId,
      }, items || []);
      res.status(201).json(quotation);
    } catch (error) {
      res.status(400).json({ error: "Failed to create quotation" });
    }
  });

  app.patch("/api/quotations/:id", authMiddleware, permissionMiddleware("quotations"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      // Validate quotation date if being updated
      if (req.body.quotationDate) {
        const dateValidation = validateTransactionDates({
          quotationDate: req.body.quotationDate,
        });
        if (!dateValidation.valid) {
          const errorMessages = dateValidation.errors.map(e => e.message).join(", ");
          console.warn(`[DATE VALIDATION] Quotation update rejected: ${errorMessages}, User: ${req.user?.id}`);
          return res.status(400).json({ error: errorMessages });
        }
      }

      const quotation = await storage.updateQuotation(req.params.id, req.body);
      if (!quotation) return res.status(404).json({ error: "Quotation not found" });
      res.json(quotation);
    } catch (error) {
      res.status(400).json({ error: "Failed to update quotation" });
    }
  });

  app.post("/api/quotations/:id/convert", authMiddleware, permissionMiddleware("quotations"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const sale = await storage.convertQuotationToSale(req.params.id);
      res.status(201).json(sale);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to convert quotation" });
    }
  });

  app.patch("/api/quotations/:id/status", authMiddleware, permissionMiddleware("quotations"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const quotation = await storage.updateQuotation(req.params.id, { status });
      if (!quotation) return res.status(404).json({ error: "Quotation not found" });
      res.json(quotation);
    } catch (error) {
      res.status(400).json({ error: "Failed to update quotation status" });
    }
  });

  app.post("/api/quotations/:id/approve", authMiddleware, permissionMiddleware("quotations"), enforceScopeMiddleware, quotationAttachmentUpload.fields([
    { name: "signatureFile", maxCount: 1 },
    { name: "stampFile", maxCount: 1 },
  ]), async (req: AuthRequest, res) => {
    try {
      const { signatureBase64 } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let managerSignature = "";
      let companyStamp = "";

      // Handle signature (file or base64)
      if (files?.signatureFile?.[0]) {
        managerSignature = `/uploads/quotations/${files.signatureFile[0].filename}`;
      } else if (signatureBase64) {
        // Save base64 as file
        const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `sig-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
        const filePath = path.join(quotationAttachmentUploadDir, fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        managerSignature = `/uploads/quotations/${fileName}`;
      }

      // Handle stamp (file)
      if (files?.stampFile?.[0]) {
        companyStamp = `/uploads/quotations/${files.stampFile[0].filename}`;
      }

      const quotation = await storage.updateQuotation(req.params.id, { 
        status: "approved",
        managerSignature,
        companyStamp
      });

      if (!quotation) return res.status(404).json({ error: "Quotation not found" });
      res.json(quotation);
    } catch (error: any) {
      console.error("Quotation approval error:", error);
      res.status(400).json({ error: error.message || "Failed to approve quotation" });
    }
  });

  app.get("/api/quotations/:id/with-items", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.getQuotationWithItems(req.params.id);
      if (!result) return res.status(404).json({ error: "Quotation not found" });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: "Failed to get quotation with items" });
    }
  });

  app.get("/api/approved-quotations", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { customerId } = req.query;
      const scope = getScopeFromRequest(req);
      const quotations = await storage.getApprovedQuotationsForCustomer(customerId as string, scope);
      res.json(quotations);
    } catch (error) {
      res.status(400).json({ error: "Failed to get approved quotations" });
    }
  });

  // ==================== EMPLOYEE DOCUMENT ROUTES ==================== (RBAC protected)

  app.get("/api/employee-documents", authMiddleware, permissionMiddleware("compliance_documents"), async (req: AuthRequest, res) => {
    const employeeId = req.query.employeeId as string | undefined;
    const documents = await storage.getEmployeeDocuments(employeeId);
    res.json(documents);
  });

  app.get("/api/employee-documents/expiring", authMiddleware, permissionMiddleware("compliance_documents"), async (req: AuthRequest, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const documents = await storage.getExpiringDocuments(days);
    res.json(documents);
  });

  app.post("/api/employee-documents", authMiddleware, permissionMiddleware("compliance_documents"), async (req: AuthRequest, res) => {
    try {
      const doc = await storage.createEmployeeDocument(req.body);
      res.status(201).json(doc);
    } catch (error) {
      res.status(400).json({ error: "Failed to create document" });
    }
  });

  app.patch("/api/employee-documents/:id", authMiddleware, permissionMiddleware("compliance_documents"), async (req: AuthRequest, res) => {
    const doc = await storage.updateEmployeeDocument(req.params.id, req.body);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  });

  app.delete("/api/employee-documents/:id", authMiddleware, permissionMiddleware("compliance_documents"), async (req: AuthRequest, res) => {
    await storage.deleteEmployeeDocument(req.params.id);
    res.status(204).send();
  });

  // ==================== LEAVE MANAGEMENT ROUTES ==================== (RBAC protected)

  // Leave Types
  app.get("/api/leave-types", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    const types = await storage.getLeaveTypes();
    res.json(types);
  });

  app.post("/api/leave-types", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    try {
      const type = await storage.createLeaveType(req.body);
      res.status(201).json(type);
    } catch (error) {
      res.status(400).json({ error: "Failed to create leave type" });
    }
  });

  app.patch("/api/leave-types/:id", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    const type = await storage.updateLeaveType(req.params.id, req.body);
    if (!type) return res.status(404).json({ error: "Leave type not found" });
    res.json(type);
  });

  app.delete("/api/leave-types/:id", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    await storage.deleteLeaveType(req.params.id);
    res.status(204).send();
  });

  // Leave Requests
  app.get("/api/leave-requests", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    const scope = getScopeFromRequest(req);
    const employeeId = req.query.employeeId as string | undefined;
    const requests = await storage.getLeaveRequests(employeeId, scope);
    res.json(requests);
  });

  app.post("/api/leave-requests", authMiddleware, permissionMiddleware("leave_management"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const request = await storage.createLeaveRequest(req.body);
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ error: "Failed to create leave request" });
    }
  });

  app.patch("/api/leave-requests/:id", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    const request = await storage.updateLeaveRequest(req.params.id, req.body);
    if (!request) return res.status(404).json({ error: "Leave request not found" });
    res.json(request);
  });

  app.get("/api/leave/accrual/:employeeId", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    try {
      const data = await storage.getAccruedLeave(req.params.employeeId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accrued leave" });
    }
  });

  app.post("/api/leave-requests/:id/approve", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    try {
      const request = await storage.approveLeaveRequest(
        req.params.id, 
        req.body.approvedById,
        req.body.approvedPaidDays !== undefined ? parseFloat(req.body.approvedPaidDays) : undefined,
        req.body.approvedUnpaidDays !== undefined ? parseFloat(req.body.approvedUnpaidDays) : undefined,
        req.body.comments
      );
      if (!request) return res.status(404).json({ error: "Leave request not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve leave request", details: (error as Error).message });
    }
  });

  app.post("/api/leave-requests/:id/reject", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    try {
      const request = await storage.rejectLeaveRequest(req.params.id, req.body.comments || "");
      if (!request) return res.status(404).json({ error: "Leave request not found" });
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: "Failed to reject leave request" });
    }
  });

  // Leave Balances
  app.get("/api/leave-balances/:employeeId", authMiddleware, permissionMiddleware("leave_management"), async (req: AuthRequest, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const balances = await storage.getLeaveBalances(req.params.employeeId, year);
    res.json(balances);
  });

  // ==================== WAREHOUSE LOCATION ROUTES ==================== (RBAC protected)

  app.get("/api/warehouse-locations", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    const warehouseId = req.query.warehouseId as string | undefined;
    const locations = await storage.getWarehouseLocations(warehouseId);
    res.json(locations);
  });

  app.post("/api/warehouse-locations", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    try {
      const location = await storage.createWarehouseLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      res.status(400).json({ error: "Failed to create warehouse location" });
    }
  });

  app.patch("/api/warehouse-locations/:id", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    const location = await storage.updateWarehouseLocation(req.params.id, req.body);
    if (!location) return res.status(404).json({ error: "Location not found" });
    res.json(location);
  });

  app.delete("/api/warehouse-locations/:id", authMiddleware, permissionMiddleware("warehouses"), async (req: AuthRequest, res) => {
    await storage.deleteWarehouseLocation(req.params.id);
    res.status(204).send();
  });

  // ==================== PAYROLL ROUTES ==================== (RBAC protected)

  app.post("/api/payroll/generate", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const { month, year } = req.body;
      const payments = await storage.generateMonthlySalaries(month, year);
      res.status(201).json(payments);
    } catch (error) {
      res.status(400).json({ error: "Failed to generate salaries" });
    }
  });

  app.post("/api/payroll/pay/:id", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const { paymentMethod } = req.body;
      const payment = await storage.processSalaryPayment(req.params.id, paymentMethod || "bank_transfer");
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      res.json(payment);
    } catch (error) {
      res.status(400).json({ error: "Failed to process salary payment" });
    }
  });

  app.post("/api/employees/:id/advance", authMiddleware, permissionMiddleware("employees"), async (req: AuthRequest, res) => {
    try {
      const { amount, paymentMethod, notes } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }
      const result = await storage.payAdvanceToEmployee(req.params.id, amount, paymentMethod || "cash", notes);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to pay advance" });
    }
  });

  // ==================== CASH VALIDATION ROUTES ==================== (RBAC protected)

  app.get("/api/accounting/available-cash", authMiddleware, permissionMiddleware("accounting"), async (req: AuthRequest, res) => {
    try {
      const availableCash = await storage.getTotalAvailableCash();
      res.json({ availableCash: availableCash.toFixed(3), currency: "BHD" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get available cash" });
    }
  });

  app.post("/api/accounting/validate-purchase", authMiddleware, permissionMiddleware("accounting"), async (req: AuthRequest, res) => {
    try {
      const { paidAmount } = req.body;
      const validation = await storage.validateCashForPurchase(parseFloat(paidAmount || "0"));
      res.json(validation);
    } catch (error) {
      res.status(500).json({ error: "Failed to validate purchase" });
    }
  });

  // ==================== EXPENSE ROUTES ==================== (RBAC protected)

  app.post("/api/projects/:id/expenses", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const { description, amount, category, paymentMethod, expenseDate, bankAccountId } = req.body;
      if (!description || !amount || amount <= 0) {
        return res.status(400).json({ error: "Valid description and amount required" });
      }
      const result = await storage.recordProjectExpense(req.params.id, {
        description,
        amount: parseFloat(amount),
        category: category || "general",
        paymentMethod: paymentMethod || "cash",
        bankAccountId: bankAccountId || null,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to record project expense" });
    }
  });

  app.post("/api/expenses", authMiddleware, permissionMiddleware("accounting"), async (req: AuthRequest, res) => {
    try {
      const { description, amount, category, paymentMethod, expenseDate, bankAccountId } = req.body;
      if (!description || !amount || amount <= 0) {
        return res.status(400).json({ error: "Valid description and amount required" });
      }
      const result = await storage.recordGeneralExpense({
        description,
        amount: parseFloat(amount),
        category: category || "general",
        paymentMethod: paymentMethod || "cash",
        bankAccountId: bankAccountId || null,
        expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to record expense" });
    }
  });

  // ==================== SERIAL NUMBERS ROUTES ==================== (RBAC protected)

  app.get("/api/serial-numbers", authMiddleware, permissionMiddleware("serial_numbers"), async (req: AuthRequest, res) => {
    try {
      const filters: { productId?: string; warehouseId?: string; shopId?: string; status?: string; serialNumber?: string; saleItemId?: string } = {};
      if (req.query.productId) filters.productId = req.query.productId as string;
      if (req.query.warehouseId) filters.warehouseId = req.query.warehouseId as string;
      if (req.query.shopId) filters.shopId = req.query.shopId as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.serialNumber) filters.serialNumber = req.query.serialNumber as string;
      if (req.query.saleItemId) filters.saleItemId = req.query.saleItemId as string;
      const serials = await storage.getSerialNumbers(filters);
      res.json(serials);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch serial numbers" });
    }
  });

  app.get("/api/serial-numbers/:id", authMiddleware, permissionMiddleware("serial_numbers"), async (req: AuthRequest, res) => {
    const serial = await storage.getSerialNumber(req.params.id);
    if (!serial) return res.status(404).json({ error: "Serial number not found" });
    res.json(serial);
  });

  app.post("/api/serial-numbers", authMiddleware, permissionMiddleware("serial_numbers"), async (req: AuthRequest, res) => {
    try {
      const serials = await storage.createSerialNumbers(req.body);
      res.status(201).json(serials);
    } catch (error) {
      res.status(400).json({ error: "Failed to create serial numbers" });
    }
  });

  app.post("/api/serial-numbers/generate", authMiddleware, permissionMiddleware("serial_numbers"), async (req: AuthRequest, res) => {
    try {
      const { productId, warehouseId, shopId, purchaseId, purchaseItemId, quantity, prefix, costPrice, sellingPrice } = req.body;
      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({ error: "Product ID and positive quantity are required" });
      }

      const timestamp = Date.now().toString(36).toUpperCase();
      const serialPrefix = prefix || "SN";
      const serialsToCreate = [];

      for (let i = 0; i < quantity; i++) {
        const uniquePart = (i + 1).toString().padStart(4, "0");
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        const serialNumber = `${serialPrefix}-${timestamp}-${uniquePart}-${randomPart}`;

        serialsToCreate.push({
          serialNumber,
          productId,
          warehouseId: warehouseId || null,
          shopId: shopId || null,
          purchaseId: purchaseId || null,
          purchaseItemId: purchaseItemId || null,
          costPrice: costPrice?.toString() || null,
          sellingPrice: sellingPrice?.toString() || null,
          status: "available",
        });
      }

      const createdSerials = await storage.createSerialNumbers(serialsToCreate);
      res.status(201).json(createdSerials);
    } catch (error) {
      res.status(400).json({ error: "Failed to generate serial numbers" });
    }
  });

  app.patch("/api/serial-numbers/:id/status", authMiddleware, permissionMiddleware("serial_numbers"), async (req: AuthRequest, res) => {
    try {
      const { status, saleId, saleItemId, soldAt, returnedAt, replacedAt } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const additionalData: any = {};
      if (saleId) additionalData.saleId = saleId;
      if (saleItemId) additionalData.saleItemId = saleItemId;
      if (soldAt) additionalData.soldAt = new Date(soldAt);
      if (returnedAt) additionalData.returnedAt = new Date(returnedAt);
      if (replacedAt) additionalData.replacedAt = new Date(replacedAt);

      const serial = await storage.updateSerialNumberStatus(req.params.id, status, additionalData);
      if (!serial) return res.status(404).json({ error: "Serial number not found" });
      res.json(serial);
    } catch (error) {
      res.status(400).json({ error: "Failed to update serial number status" });
    }
  });

  // Edit serial number details (price, warehouse, etc.)
  app.patch("/api/serial-numbers/:id", authMiddleware, permissionMiddleware("serial_numbers"), async (req: AuthRequest, res) => {
    try {
      // First check if serial exists and is not sold
      const existingSerial = await storage.getSerialNumber(req.params.id);
      if (!existingSerial) {
        return res.status(404).json({ error: "Serial number not found" });
      }
      if (existingSerial.status === "sold") {
        return res.status(400).json({ error: "Cannot edit a sold serial number" });
      }

      const { costPrice, sellingPrice, warehouseId, serialNumber } = req.body;
      const updateData: any = { updatedAt: new Date() };

      // Only update fields that are explicitly provided with non-empty values
      if (costPrice !== undefined && costPrice !== null && costPrice !== "") {
        updateData.costPrice = costPrice.toString();
      }
      if (sellingPrice !== undefined && sellingPrice !== null && sellingPrice !== "") {
        updateData.sellingPrice = sellingPrice.toString();
      }
      if (warehouseId !== undefined) {
        updateData.warehouseId = warehouseId || null;
      }
      // Allow editing the serial number value itself
      if (serialNumber !== undefined && serialNumber !== null && serialNumber.trim() !== "") {
        // Check for duplicate serial number
        const duplicateSerial = await storage.getSerialNumberByValue(serialNumber.trim());
        if (duplicateSerial && duplicateSerial.id !== req.params.id) {
          return res.status(400).json({ error: `Serial number "${serialNumber}" already exists for another item` });
        }
        updateData.serialNumber = serialNumber.trim();
      }

      const serial = await storage.updateSerialNumber(req.params.id, updateData);
      res.json(serial);
    } catch (error) {
      res.status(400).json({ error: "Failed to update serial number" });
    }
  });

  // Purchase Returns
  app.get("/api/purchase-returns", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const supplierId = req.query.supplierId as string | undefined;
      const returns = await storage.getPurchaseReturns(supplierId, scope);

      const returnsWithItems = await Promise.all(
        returns.map(async (ret) => {
          const items = await storage.getPurchaseReturnItems(ret.id);
          return { ...ret, items };
        })
      );

      res.json(returnsWithItems);
    } catch (error) {
      res.status(400).json({ error: "Failed to get purchase returns" });
    }
  });

  app.get("/api/purchase-returns/:id/items", authMiddleware, permissionMiddleware("purchase_returns"), async (req: AuthRequest, res) => {
    try {
      const items = await storage.getPurchaseReturnItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(400).json({ error: "Failed to get purchase return items" });
    }
  });

  app.get("/api/purchase-returns/:id", authMiddleware, permissionMiddleware("purchase_returns"), async (req: AuthRequest, res) => {
    const returnData = await storage.getPurchaseReturn(req.params.id);
    if (!returnData) return res.status(404).json({ error: "Purchase return not found" });
    res.json(returnData);
  });

  app.post("/api/purchase-returns", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const { purchaseIds, ...restBody } = req.body;

      // Handle both single purchaseId and array purchaseIds for backward compatibility
      // Use first purchase ID for the database column (required for schema)
      const purchaseId = purchaseIds?.length > 0 ? purchaseIds[0].split('_')[0] : restBody.purchaseId;

      const purchaseReturn = await storage.createPurchaseReturn({
        ...restBody,
        purchaseId,
        purchaseIds, // Pass full array for multi-purchase VAT calculation
        shopId: scope.shopId || restBody.shopId,
        branchId: scope.branchId || restBody.branchId,
        warehouseId: scope.warehouseId || restBody.warehouseId,
      });
      res.status(201).json(purchaseReturn);
    } catch (error: any) {
      console.error("Purchase return error:", error);
      res.status(400).json({ error: error?.message || "Failed to create purchase return" });
    }
  });

  // Supplier Balances - STRICT ACCOUNTING
  // Returns all suppliers with their ledger balances (Purchases - Payments - Returns)
  app.get("/api/supplier-credits", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const allSuppliers = await storage.getSuppliers(scope);

      // Calculate ledger summary for each supplier
      const supplierBalances = await Promise.all(
        allSuppliers.map(async (supplier) => {
          const ledger = await storage.getSupplierLedgerSummary(supplier.id);
          return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            totalPurchases: ledger.totalPurchases.toFixed(3),
            totalPayments: ledger.totalPayments.toFixed(3),
            totalReturns: ledger.totalReturns.toFixed(3),
            totalCreditsApplied: ledger.totalCreditsApplied.toFixed(3),
            outstandingPayable: ledger.outstandingPayable.toFixed(3),
            overpayment: ledger.overpayment.toFixed(3),
            netBalance: ledger.netBalance.toFixed(3),
            // Legacy field for backwards compatibility
            creditBalance: ledger.overpayment.toFixed(3),
          };
        })
      );

      // Filter to only suppliers with non-zero overpayment (actual credits owed)
      const creditsOnly = supplierBalances.filter(s => parseFloat(s.overpayment) > 0);
      res.json(creditsOnly);
    } catch (error) {
      res.status(400).json({ error: "Failed to get supplier credits" });
    }
  });

  // Get all supplier balances (including AP and AR)
  app.get("/api/supplier-balances", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const allSuppliers = await storage.getSuppliers(scope);

      // Calculate ledger summary for each supplier
      const supplierBalances = await Promise.all(
        allSuppliers.map(async (supplier) => {
          const ledger = await storage.getSupplierLedgerSummary(supplier.id);
          return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            totalPurchases: ledger.totalPurchases.toFixed(3),
            totalPayments: ledger.totalPayments.toFixed(3),
            totalReturns: ledger.totalReturns.toFixed(3),
            totalCreditsApplied: ledger.totalCreditsApplied.toFixed(3),
            totalRefundsReceived: ledger.totalRefundsReceived.toFixed(3),
            outstandingPayable: ledger.outstandingPayable.toFixed(3),
            overpayment: ledger.overpayment.toFixed(3),
            netBalance: ledger.netBalance.toFixed(3),
          };
        })
      );

      // Filter to only suppliers with non-zero balances
      const activeBalances = supplierBalances.filter(s =>
        parseFloat(s.outstandingPayable) > 0 || parseFloat(s.overpayment) > 0
      );
      res.json(activeBalances);
    } catch (error) {
      res.status(400).json({ error: "Failed to get supplier balances" });
    }
  });

  // Get all customer balances (LEDGER-DRIVEN)
  app.get("/api/customer-balances", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const allCustomers = await storage.getCustomers(scope);

      const customerBalances = await Promise.all(
        allCustomers.map(async (customer) => {
          const ledger = await storage.getCustomerLedgerSummary(customer.id);
          return {
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            totalSales: ledger.totalSales.toFixed(3),
            totalPayments: ledger.totalPayments.toFixed(3),
            totalReturns: ledger.totalReturns.toFixed(3),
            totalServiceInvoices: ledger.totalServiceInvoices.toFixed(3),
            totalServicePayments: ledger.totalServicePayments.toFixed(3),
            outstandingReceivable: ledger.outstandingReceivable.toFixed(3),
            storeCredit: ledger.storeCredit.toFixed(3),
            netBalance: ledger.netBalance.toFixed(3),
          };
        })
      );

      res.json(customerBalances);
    } catch (error) {
      res.status(400).json({ error: "Failed to get customer balances" });
    }
  });

  // STRICT ACCOUNTING: Recalculate and correct all supplier credits
  // This corrects any incorrect credits from previous logic
  app.post("/api/supplier-balances/recalculate", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const allSuppliers = await storage.getSuppliers();
      const corrections: string[] = [];

      for (const supplier of allSuppliers) {
        const ledger = await storage.getSupplierLedgerSummary(supplier.id);

        // Get current credit record
        const currentCredit = await storage.getSupplierCredit(supplier.id);
        const currentCreditBalance = parseFloat(currentCredit?.creditBalance || "0");

        // The correct credit should only be the overpayment amount
        const correctCredit = ledger.overpayment;

        if (Math.abs(currentCreditBalance - correctCredit) > 0.001) {
          // Correct the credit balance
          await storage.updateSupplierCredit(supplier.id, correctCredit.toFixed(3));
          corrections.push(`${supplier.name}: ${currentCreditBalance.toFixed(3)} -> ${correctCredit.toFixed(3)}`);
        }
      }

      res.json({
        message: "Supplier credits recalculated based on strict accounting",
        corrections,
        count: corrections.length
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to recalculate supplier balances" });
    }
  });

  app.get("/api/supplier-credits/:supplierId", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const shopId = scope?.shopId || (req.query.shopId as string | undefined);
      const credit = await storage.getSupplierCredit(req.params.supplierId, shopId);
      res.json(credit || { creditBalance: "0.000" });
    } catch (error) {
      res.status(400).json({ error: "Failed to get supplier credit" });
    }
  });

  app.get("/api/supplier-credits/:supplierId/transactions", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const transactions = await storage.getSupplierCreditTransactions(req.params.supplierId, scope?.shopId || undefined);
      res.json(transactions);
    } catch (error) {
      res.status(400).json({ error: "Failed to get supplier credit transactions" });
    }
  });

  // Receive cash refund from supplier (clear supplier credit)
  const receiveSupplierRefundSchema = z.object({
    amount: z.number().positive("Amount must be positive"),
    bankAccountId: z.string().min(1, "Bank account is required"),
    notes: z.string().optional(),
  });

  app.post("/api/supplier-credits/:supplierId/receive-refund", authMiddleware, enforceScopeMiddleware, validateBody(receiveSupplierRefundSchema), async (req: AuthRequest, res) => {
    try {
      const { amount, bankAccountId, notes } = req.body;
      // Use getScopeFromRequest to get the selected shop from headers for admin users
      const scope = getScopeFromRequest(req);
      if (!scope) return res.status(400).json({ error: "Scope is required" });
      const result = await storage.receiveSupplierRefund(
        req.params.supplierId,
        amount,
        bankAccountId,
        notes,
        { shopId: scope.shopId || undefined, branchId: scope.branchId || undefined }
      );
      res.json(result);
    } catch (error: any) {
      console.error("Receive supplier refund error:", error);
      res.status(400).json({ error: error.message || "Failed to receive supplier refund" });
    }
  });

  // Purchase Returns Helper endpoints - RBAC protected
  app.get("/api/purchases-for-return/:supplierId", authMiddleware, permissionMiddleware("purchase_returns"), async (req: AuthRequest, res) => {
    try {
      const purchases = await storage.getPurchasesForReturn(req.params.supplierId);
      res.json(purchases);
    } catch (error) {
      res.status(400).json({ error: "Failed to get purchases for return" });
    }
  });

  app.get("/api/purchases/:purchaseId/available-serials", authMiddleware, permissionMiddleware("purchase_returns"), async (req: AuthRequest, res) => {
    try {
      const serials = await storage.getAvailableSerialsForPurchase(req.params.purchaseId);
      res.json(serials);
    } catch (error) {
      res.status(400).json({ error: "Failed to get available serials" });
    }
  });

  // ==================== SERVICE TICKETS ROUTES ==================== (RBAC protected)

  app.get("/api/service-tickets", authMiddleware, permissionMiddleware("services"), async (req: AuthRequest, res) => {
    try {
      const shopId = req.query.shopId as string | undefined;
      const tickets = await storage.getServiceTickets(shopId);
      res.json(tickets);
    } catch (error) {
      res.status(400).json({ error: "Failed to get service tickets" });
    }
  });

  app.get("/api/service-tickets/:id", authMiddleware, permissionMiddleware("services"), async (req: AuthRequest, res) => {
    try {
      const ticket = await storage.getServiceTicket(req.params.id);
      if (!ticket) return res.status(404).json({ error: "Service ticket not found" });
      res.json(ticket);
    } catch (error) {
      res.status(400).json({ error: "Failed to get service ticket" });
    }
  });

  app.post("/api/service-tickets", authMiddleware, permissionMiddleware("services"), enforceScopeMiddleware, serviceTicketUpload.array("attachments"), async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      let bodyData = req.body;

      // Handle multipart/form-data where body is in a 'data' field
      if (req.body.data) {
        try {
          bodyData = JSON.parse(req.body.data);
        } catch (e) {
          return res.status(400).json({ error: "Invalid data format" });
        }
      }

      // Add file paths to attachments
      const attachments = (req.files as Express.Multer.File[] || []).map(file => `/uploads/service-tickets/${file.filename}`);
      if (bodyData.attachments && Array.isArray(bodyData.attachments)) {
        bodyData.attachments = [...bodyData.attachments, ...attachments];
      } else {
        bodyData.attachments = attachments;
      }

      // Validate the body after all data is gathered
      const validationResult = insertServiceTicketSchema.safeParse(bodyData);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        });
      }

      const ticket = await storage.createServiceTicket({
        ...validationResult.data,
        shopId: scope.shopId || validationResult.data.shopId,
        branchId: scope.branchId || validationResult.data.branchId,
      });
      res.status(201).json(ticket);
    } catch (error: any) {
      console.error("Service ticket creation error:", error);
      res.status(400).json({ error: error.message || "Failed to create service ticket" });
    }
  });

  app.post("/api/service-tickets/:id/pay", authMiddleware, permissionMiddleware("services"), async (req: AuthRequest, res) => {
    try {
      const { amount, paymentMethod, bankAccountId, notes } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Payment amount must be greater than zero" });
      }
      if (!paymentMethod) {
        return res.status(400).json({ error: "Payment method is required" });
      }
      if (!bankAccountId) {
        return res.status(400).json({ error: "Bank account is required" });
      }
      const ticket = await storage.addServiceTicketPayment(req.params.id, {
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId,
        notes,
      });
      res.json(ticket);
    } catch (error: any) {
      console.error("Service ticket payment error:", error);
      res.status(400).json({ error: error.message || "Failed to process payment" });
    }
  });

  app.patch("/api/service-tickets/:id", authMiddleware, permissionMiddleware("services"), serviceTicketUpload.array("attachments"), async (req: AuthRequest, res) => {
    try {
      let bodyData = req.body;

      // Handle multipart/form-data where body is in a 'data' field
      if (req.body.data) {
        try {
          bodyData = JSON.parse(req.body.data);
        } catch (e) {
          return res.status(400).json({ error: "Invalid data format" });
        }
      }

      // Add file paths to attachments
      const newAttachments = (req.files as Express.Multer.File[] || []).map(file => `/uploads/service-tickets/${file.filename}`);
      if (bodyData.attachments && Array.isArray(bodyData.attachments)) {
        bodyData.attachments = [...bodyData.attachments, ...newAttachments];
      } else if (newAttachments.length > 0) {
        bodyData.attachments = newAttachments;
      }

      const validationResult = insertServiceTicketSchema.partial().safeParse(bodyData);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors
        });
      }

      const ticket = await storage.updateServiceTicket(req.params.id, validationResult.data);
      if (!ticket) return res.status(404).json({ error: "Service ticket not found" });
      res.json(ticket);
    } catch (error: any) {
      console.error("Service ticket update error:", error);
      res.status(400).json({ error: error.message || "Failed to update service ticket" });
    }
  });

  app.delete("/api/service-tickets/:id", authMiddleware, permissionMiddleware("services"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteServiceTicket(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete service ticket" });
    }
  });

  // Service ticket payments
  app.get("/api/service-tickets/:id/payments", authMiddleware, permissionMiddleware("services"), async (req: AuthRequest, res) => {
    try {
      const payments = await storage.getServiceTicketPayments(req.params.id);
      res.json(payments);
    } catch (error) {
      res.status(400).json({ error: "Failed to get service ticket payments" });
    }
  });

  app.post("/api/service-tickets/:id/payments", authMiddleware, permissionMiddleware("services"), async (req: AuthRequest, res) => {
    try {
      const { amount, paymentMethod, bankAccountId, notes } = req.body;
      if (!amount || !paymentMethod) {
        return res.status(400).json({ error: "amount and paymentMethod are required" });
      }
      const result = await storage.addServiceTicketPayment(req.params.id, {
        amount: parseFloat(amount),
        paymentMethod,
        bankAccountId: bankAccountId || undefined,
        notes: notes || undefined,
        processedBy: req.user?.id,
      });
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Service ticket payment error:", error);
      res.status(400).json({ error: error.message || "Failed to add payment" });
    }
  });

  // ==================== CRM ROUTES ====================

  // CRM Leads - RBAC protected
  app.get("/api/crm/leads", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const leads = await storage.getCrmLeads();
      res.json(leads);
    } catch (error) {
      res.status(400).json({ error: "Failed to get leads" });
    }
  });

  app.get("/api/crm/leads/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const lead = await storage.getCrmLead(req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    } catch (error) {
      res.status(400).json({ error: "Failed to get lead" });
    }
  });

  app.post("/api/crm/leads", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const lead = await storage.createCrmLead(req.body);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Lead creation error:", error);
      res.status(400).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/crm/leads/:id", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const lead = await storage.updateCrmLead(req.params.id, req.body);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    } catch (error) {
      res.status(400).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/crm/leads/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmLead(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete lead" });
    }
  });

  app.post("/api/crm/leads/:id/convert", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.convertLeadToCustomer(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error("Lead conversion error:", error);
      res.status(400).json({ error: error.message || "Failed to convert lead" });
    }
  });

  // CRM Deals - RBAC protected
  app.get("/api/crm/deals", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const deals = await storage.getCrmDeals();
      res.json(deals);
    } catch (error) {
      res.status(400).json({ error: "Failed to get deals" });
    }
  });

  app.get("/api/crm/deals/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      res.json(deal);
    } catch (error) {
      res.status(400).json({ error: "Failed to get deal" });
    }
  });

  app.post("/api/crm/deals", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const deal = await storage.createCrmDeal(req.body);
      res.status(201).json(deal);
    } catch (error) {
      console.error("Deal creation error:", error);
      res.status(400).json({ error: "Failed to create deal" });
    }
  });

  app.patch("/api/crm/deals/:id", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const deal = await storage.updateCrmDeal(req.params.id, req.body);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      res.json(deal);
    } catch (error) {
      res.status(400).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/crm/deals/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmDeal(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete deal" });
    }
  });

  // CRM Activities - RBAC protected
  app.get("/api/crm/activities", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const { leadId, dealId, customerId } = req.query;
      const activities = await storage.getCrmActivities({
        leadId: leadId as string,
        dealId: dealId as string,
        customerId: customerId as string,
      });
      res.json(activities);
    } catch (error) {
      res.status(400).json({ error: "Failed to get activities" });
    }
  });

  app.get("/api/crm/activities/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const activity = await storage.getCrmActivity(req.params.id);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error) {
      res.status(400).json({ error: "Failed to get activity" });
    }
  });

  app.post("/api/crm/activities", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const activity = await storage.createCrmActivity(req.body);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Activity creation error:", error);
      res.status(400).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/crm/activities/:id", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const activity = await storage.updateCrmActivity(req.params.id, req.body);
      if (!activity) return res.status(404).json({ error: "Activity not found" });
      res.json(activity);
    } catch (error) {
      res.status(400).json({ error: "Failed to update activity" });
    }
  });

  app.delete("/api/crm/activities/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmActivity(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete activity" });
    }
  });

  // CRM Reports/Stats - RBAC protected
  app.get("/api/crm/stats", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const leads = await storage.getCrmLeads();
      const deals = await storage.getCrmDeals();

      const leadsByStatus = leads.reduce((acc: any, lead) => {
        acc[lead.status || 'new'] = (acc[lead.status || 'new'] || 0) + 1;
        return acc;
      }, {});

      const dealsByStage = deals.reduce((acc: any, deal) => {
        acc[deal.stage || 'prospecting'] = (acc[deal.stage || 'prospecting'] || 0) + 1;
        return acc;
      }, {});

      const pipelineValue = deals
        .filter(d => d.stage !== 'won' && d.stage !== 'lost')
        .reduce((sum, d) => sum + parseFloat(d.estimatedValue || '0'), 0);

      const wonValue = deals
        .filter(d => d.stage === 'won')
        .reduce((sum, d) => sum + parseFloat(d.estimatedValue || '0'), 0);

      const convertedLeads = leads.filter(l => l.convertedToCustomerId).length;

      res.json({
        totalLeads: leads.length,
        leadsByStatus,
        totalDeals: deals.length,
        dealsByStage,
        pipelineValue: pipelineValue.toFixed(3),
        wonValue: wonValue.toFixed(3),
        convertedLeads,
        conversionRate: leads.length > 0
          ? ((convertedLeads / leads.length) * 100).toFixed(1)
          : '0.0'
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to get CRM stats" });
    }
  });

  // ==================== CRM LEAD NOTES ====================

  app.get("/api/crm/leads/:leadId/notes", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const notes = await storage.getCrmLeadNotes(req.params.leadId);
      res.json(notes);
    } catch (error) {
      res.status(400).json({ error: "Failed to get lead notes" });
    }
  });

  app.post("/api/crm/leads/:leadId/notes", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const note = await storage.createCrmLeadNote({
        ...req.body,
        leadId: req.params.leadId,
        createdBy: req.user?.id,
      });
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Failed to create lead note" });
    }
  });

  app.delete("/api/crm/lead-notes/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmLeadNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete lead note" });
    }
  });

  // ==================== CRM CALENDAR EVENTS ==================== (RBAC protected)

  app.get("/api/crm/calendar-events", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate, assignedTo } = req.query;
      const scope = getScopeFromRequest(req);
      const events = await storage.getCrmCalendarEvents({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        assignedTo: assignedTo as string,
        shopId: scope?.shopId || undefined,
        branchId: scope?.branchId || undefined,
      });
      res.json(events);
    } catch (error) {
      res.status(400).json({ error: "Failed to get calendar events" });
    }
  });

  app.get("/api/crm/calendar-events/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const event = await storage.getCrmCalendarEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: "Failed to get event" });
    }
  });

  app.post("/api/crm/calendar-events", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const event = await storage.createCrmCalendarEvent({
        ...req.body,
        shopId: scope?.shopId,
        branchId: scope?.branchId,
        createdBy: req.user?.id,
      });
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ error: "Failed to create event" });
    }
  });

  app.patch("/api/crm/calendar-events/:id", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const event = await storage.updateCrmCalendarEvent(req.params.id, req.body);
      if (!event) return res.status(404).json({ error: "Event not found" });
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/crm/calendar-events/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmCalendarEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete event" });
    }
  });

  // ==================== CRM REMINDERS ==================== (RBAC protected)

  app.get("/api/crm/reminders", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const { assignedTo, status } = req.query;
      const scope = getScopeFromRequest(req);
      const reminders = await storage.getCrmReminders({
        assignedTo: assignedTo as string,
        status: status as string,
        shopId: scope?.shopId || undefined,
        branchId: scope?.branchId || undefined,
      });
      res.json(reminders);
    } catch (error) {
      res.status(400).json({ error: "Failed to get reminders" });
    }
  });

  app.get("/api/crm/reminders/due", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const reminders = await storage.getDueCrmReminders(userId);
      res.json(reminders);
    } catch (error) {
      res.status(400).json({ error: "Failed to get due reminders" });
    }
  });

  app.get("/api/crm/reminders/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const reminder = await storage.getCrmReminder(req.params.id);
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      res.json(reminder);
    } catch (error) {
      res.status(400).json({ error: "Failed to get reminder" });
    }
  });

  app.post("/api/crm/reminders", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const reminder = await storage.createCrmReminder({
        ...req.body,
        shopId: scope?.shopId,
        branchId: scope?.branchId,
        createdBy: req.user?.id,
      });
      res.status(201).json(reminder);
    } catch (error) {
      res.status(400).json({ error: "Failed to create reminder" });
    }
  });

  app.patch("/api/crm/reminders/:id", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const reminder = await storage.updateCrmReminder(req.params.id, req.body);
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      res.json(reminder);
    } catch (error) {
      res.status(400).json({ error: "Failed to update reminder" });
    }
  });

  app.delete("/api/crm/reminders/:id", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmReminder(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete reminder" });
    }
  });

  // ==================== CRM CUSTOMER CONTACTS ==================== (RBAC protected)

  app.get("/api/crm/customers/:customerId/contacts", authMiddleware, permissionMiddleware("crm"), async (req: AuthRequest, res) => {
    try {
      const contacts = await storage.getCrmCustomerContacts(req.params.customerId);
      res.json(contacts);
    } catch (error) {
      res.status(400).json({ error: "Failed to get customer contacts" });
    }
  });

  app.post("/api/crm/customers/:customerId/contacts", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const contact = await storage.createCrmCustomerContact({
        ...req.body,
        customerId: req.params.customerId,
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(400).json({ error: "Failed to create customer contact" });
    }
  });

  app.patch("/api/crm/customer-contacts/:id", authMiddleware, permissionMiddleware("crm"), enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const contact = await storage.updateCrmCustomerContact(req.params.id, req.body);
      if (!contact) return res.status(404).json({ error: "Contact not found" });
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/crm/customer-contacts/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmCustomerContact(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete contact" });
    }
  });

  // ==================== CRM NOTIFICATIONS ====================

  app.get("/api/crm/notifications", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const unreadOnly = req.query.unreadOnly === "true";
      const notifications = await storage.getCrmNotifications(userId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      res.status(400).json({ error: "Failed to get notifications" });
    }
  });

  app.post("/api/crm/notifications", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const notification = await storage.createCrmNotification({
        ...req.body,
        shopId: scope?.shopId,
        branchId: scope?.branchId,
      });
      res.status(201).json(notification);
    } catch (error) {
      res.status(400).json({ error: "Failed to create notification" });
    }
  });

  app.patch("/api/crm/notifications/:id/read", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const notification = await storage.markCrmNotificationRead(req.params.id);
      if (!notification) return res.status(404).json({ error: "Notification not found" });
      res.json(notification);
    } catch (error) {
      res.status(400).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/crm/notifications/mark-all-read", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      await storage.markAllCrmNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // ==================== CRM TASKS ====================

  app.get("/api/crm/tasks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { assignedTo, status, leadId, dealId, customerId } = req.query;
      const scope = getScopeFromRequest(req);
      const tasks = await storage.getCrmTasks({
        assignedTo: assignedTo as string,
        status: status as string,
        leadId: leadId as string,
        dealId: dealId as string,
        customerId: customerId as string,
        shopId: scope?.shopId || undefined,
        branchId: scope?.branchId || undefined,
      });
      res.json(tasks);
    } catch (error) {
      res.status(400).json({ error: "Failed to get tasks" });
    }
  });

  app.get("/api/crm/tasks/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const task = await storage.getCrmTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to get task" });
    }
  });

  app.post("/api/crm/tasks", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getScopeFromRequest(req);
      const task = await storage.createCrmTask({
        ...req.body,
        shopId: scope?.shopId,
        branchId: scope?.branchId,
        createdBy: req.user?.id,
      });
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/crm/tasks/:id", authMiddleware, enforceScopeMiddleware, async (req: AuthRequest, res) => {
    try {
      const task = await storage.updateCrmTask(req.params.id, req.body);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/crm/tasks/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete task" });
    }
  });

  // ==================== DOCUMENT & COMPLIANCE MODULE ====================

  // Serve compliance files (auth protected)
  app.use("/uploads/compliance", authMiddleware, (await import("express")).default.static(complianceUploadDir));

  // Get all compliance documents with filters
  app.get("/api/compliance/documents", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { category, status, employeeId, shopId, branchId, warehouseId, expiringWithinDays } = req.query;
      const documents = await storage.getComplianceDocuments({
        category: category as string,
        status: status as string,
        employeeId: employeeId as string,
        shopId: shopId as string,
        branchId: branchId as string,
        warehouseId: warehouseId as string,
        expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays as string) : undefined,
      });
      res.json(documents);
    } catch (error) {
      console.error("Error fetching compliance documents:", error);
      res.status(400).json({ error: "Failed to fetch documents" });
    }
  });

  // Get single document
  app.get("/api/compliance/documents/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const doc = await storage.getComplianceDocument(req.params.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json(doc);
    } catch (error) {
      res.status(400).json({ error: "Failed to get document" });
    }
  });

  // Create compliance document with file upload
  app.post("/api/compliance/documents", authMiddleware, complianceUpload.single("file"), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      const data = JSON.parse(req.body.data || "{}");

      // Centralized date validation
      const dateValidation = validateDocumentDates({
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
      });
      if (!dateValidation.valid) {
        const errorMessages = dateValidation.errors.map(e => e.message).join(", ");
        console.warn(`[DATE VALIDATION] Document creation rejected: ${errorMessages}, User: ${req.user?.id}`);
        return res.status(400).json({ error: errorMessages });
      }

      const documentData = {
        ...data,
        filePath: file ? `/uploads/compliance/${file.filename}` : null,
        fileName: file ? file.originalname : null,
        mimeType: file ? file.mimetype : null,
        fileSize: file ? file.size : null,
        createdById: req.user?.id,
        status: 'pending_review',
      };

      const doc = await storage.createComplianceDocument(documentData);

      await storage.createDocumentAuditLog({
        documentId: doc.id,
        action: 'upload',
        newStatus: 'pending_review',
        actorId: req.user?.id,
        notes: `Document uploaded: ${doc.title}`,
      });

      res.status(201).json(doc);
    } catch (error) {
      console.error("Document creation error:", error);
      res.status(400).json({ error: "Failed to create document" });
    }
  });

  // Update compliance document
  app.patch("/api/compliance/documents/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const existingDoc = await storage.getComplianceDocument(req.params.id);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      // Validate document dates if being updated
      if (req.body.issueDate || req.body.expiryDate) {
        const dateValidation = validateDocumentDates({
          issueDate: req.body.issueDate || existingDoc.issueDate,
          expiryDate: req.body.expiryDate || existingDoc.expiryDate,
        });
        if (!dateValidation.valid) {
          const errorMessages = dateValidation.errors.map(e => e.message).join(", ");
          console.warn(`[DATE VALIDATION] Document update rejected: ${errorMessages}, User: ${req.user?.id}`);
          return res.status(400).json({ error: errorMessages });
        }
      }

      const doc = await storage.updateComplianceDocument(req.params.id, req.body);

      await storage.createDocumentAuditLog({
        documentId: req.params.id,
        action: 'update',
        actorId: req.user?.id,
        notes: `Document updated`,
        metadata: JSON.stringify(req.body),
      });

      res.json(doc);
    } catch (error) {
      res.status(400).json({ error: "Failed to update document" });
    }
  });

  // Review/Approve/Reject document
  app.patch("/api/compliance/documents/:id/review", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const { status, reviewComments } = req.body;
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid review status" });
      }

      const existingDoc = await storage.getComplianceDocument(req.params.id);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      const doc = await storage.updateComplianceDocument(req.params.id, {
        status,
        reviewComments,
        reviewedById: req.user?.id,
        reviewedAt: new Date(),
      });

      await storage.createDocumentAuditLog({
        documentId: req.params.id,
        action: 'review',
        previousStatus: existingDoc.status,
        newStatus: status,
        actorId: req.user?.id,
        notes: reviewComments || `Document ${status}`,
      });

      res.json(doc);
    } catch (error) {
      res.status(400).json({ error: "Failed to review document" });
    }
  });

  // Replace document file
  app.post("/api/compliance/documents/:id/replace", authMiddleware, complianceUpload.single("file"), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const existingDoc = await storage.getComplianceDocument(req.params.id);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      // Delete old file if exists
      if (existingDoc.filePath) {
        const oldPath = path.join(process.cwd(), existingDoc.filePath);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const doc = await storage.updateComplianceDocument(req.params.id, {
        filePath: `/uploads/compliance/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: 'pending_review',
      });

      await storage.createDocumentAuditLog({
        documentId: req.params.id,
        action: 'replace',
        previousStatus: existingDoc.status,
        newStatus: 'pending_review',
        actorId: req.user?.id,
        notes: `File replaced with: ${file.originalname}`,
      });

      res.json(doc);
    } catch (error) {
      res.status(400).json({ error: "Failed to replace document" });
    }
  });

  // Delete document
  app.delete("/api/compliance/documents/:id", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const existingDoc = await storage.getComplianceDocument(req.params.id);
      if (!existingDoc) return res.status(404).json({ error: "Document not found" });

      // Delete file if exists
      if (existingDoc.filePath) {
        const filePath = path.join(process.cwd(), existingDoc.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await storage.deleteComplianceDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete document" });
    }
  });

  // Get document audit logs
  app.get("/api/compliance/documents/:id/audit", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const logs = await storage.getDocumentAuditLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      res.status(400).json({ error: "Failed to get audit logs" });
    }
  });

  // Download document (with audit logging)
  app.get("/api/compliance/documents/:id/download", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const doc = await storage.getComplianceDocument(req.params.id);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      if (!doc.filePath) return res.status(404).json({ error: "No file attached" });

      const filePath = path.join(process.cwd(), doc.filePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on server" });
      }

      await storage.createDocumentAuditLog({
        documentId: doc.id,
        action: 'download',
        actorId: req.user?.id,
        notes: `File downloaded by user`,
      });

      res.download(filePath, doc.fileName || 'document');
    } catch (error) {
      res.status(400).json({ error: "Failed to download document" });
    }
  });

  // Update expired documents (can be called by cron or manually)
  app.post("/api/compliance/documents/update-expired", authMiddleware, superAdminOnly, async (req: AuthRequest, res) => {
    try {
      const count = await storage.updateExpiredDocuments();
      res.json({ message: `Updated ${count} expired documents` });
    } catch (error) {
      res.status(400).json({ error: "Failed to update expired documents" });
    }
  });

  // ==================== COMPLIANCE REMINDERS ====================

  // Get all reminders
  app.get("/api/compliance/reminders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { shopId, branchId, warehouseId, isActive } = req.query;
      const reminders = await storage.getComplianceReminders({
        shopId: shopId as string,
        branchId: branchId as string,
        warehouseId: warehouseId as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      res.json(reminders);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch reminders" });
    }
  });

  // Get single reminder
  app.get("/api/compliance/reminders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const reminder = await storage.getComplianceReminder(req.params.id);
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      res.json(reminder);
    } catch (error) {
      res.status(400).json({ error: "Failed to get reminder" });
    }
  });

  // Create reminder
  app.post("/api/compliance/reminders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const reminder = await storage.createComplianceReminder({
        ...req.body,
        createdById: req.user?.id,
      });
      res.status(201).json(reminder);
    } catch (error) {
      console.error("Reminder creation error:", error);
      res.status(400).json({ error: "Failed to create reminder" });
    }
  });

  // Update reminder
  app.patch("/api/compliance/reminders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const reminder = await storage.updateComplianceReminder(req.params.id, req.body);
      res.json(reminder);
    } catch (error) {
      res.status(400).json({ error: "Failed to update reminder" });
    }
  });

  // Delete reminder
  app.delete("/api/compliance/reminders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteComplianceReminder(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: "Failed to delete reminder" });
    }
  });

  // Pay reminder
  app.post("/api/compliance/reminders/:id/pay", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { bankAccountId, notes } = req.body;
      if (!bankAccountId) return res.status(400).json({ error: "Bank account is required for payment" });
      
      const reminder = await storage.payComplianceReminder(req.params.id, bankAccountId, notes);
      res.json(reminder);
    } catch (error: any) {
      console.error("Reminder payment error:", error);
      res.status(400).json({ error: error.message || "Failed to process reminder payment" });
    }
  });

  // Get due reminders
  app.get("/api/compliance/reminders-due", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const reminders = await storage.getDueReminders();
      res.json(reminders);
    } catch (error) {
      res.status(400).json({ error: "Failed to fetch due reminders" });
    }
  });

  // ==================== COMPLIANCE DASHBOARD ====================

  app.get("/api/compliance/dashboard", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const allDocs = await storage.getComplianceDocuments();
      const expiringSoon = await storage.getComplianceDocuments({ expiringWithinDays: 30 });
      const dueReminders = await storage.getDueReminders();

      const pendingReview = allDocs.filter(d => d.status === 'pending_review').length;
      const expired = allDocs.filter(d => d.status === 'expired').length;
      const approved = allDocs.filter(d => d.status === 'approved').length;
      const expiring7Days = allDocs.filter(d => {
        if (!d.expiryDate) return false;
        const expiry = new Date(d.expiryDate);
        const now = new Date();
        const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
      }).length;

      res.json({
        totalDocuments: allDocs.length,
        pendingReview,
        expired,
        approved,
        expiringSoon: expiringSoon.length,
        expiring7Days,
        dueReminders: dueReminders.length,
        documentsByCategory: {
          employee: allDocs.filter(d => d.category === 'employee').length,
          office: allDocs.filter(d => d.category === 'office').length,
        },
      });
    } catch (error) {
      res.status(400).json({ error: "Failed to get compliance dashboard" });
    }
  });

  // ==================== MOBILE APP API ENDPOINTS ====================

  // Mobile Login - Returns JWT token in response body (not cookies)
  app.post("/api/auth/mobile-login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      let user = await storage.getUserByUsername(username);
      let isEmployeeLogin = false;
      let employeeObj: any = null;

      if (!user) {
        // Fallback: Check employees table by employeeCode or phone
        const [emp] = await db.select().from(schema.employees)
          .where(or(eq(schema.employees.employeeCode, username), eq(schema.employees.phone, username)))
          .limit(1);

        if (!emp) {
          return res.status(401).json({ message: "Invalid username or password" });
        }

        if (emp.status !== "active") {
          return res.status(401).json({ message: "Account is not active" });
        }

        let isValid = (password === emp.password);
        if (!isValid && emp.password) {
          try {
            const bcryptLib = await import("bcrypt");
            isValid = await bcryptLib.default.compare(password, emp.password);
          } catch (e) {}
        }

        if (!isValid) {
          return res.status(401).json({ message: "Invalid username or password" });
        }

        isEmployeeLogin = true;
        employeeObj = emp;
      } else {
        if (user.status !== "active") {
          return res.status(401).json({ message: "Account is not active" });
        }

        const bcryptLib = await import("bcrypt");
        const isValid = await bcryptLib.default.compare(password, user.password);
        if (!isValid) {
          return res.status(401).json({ message: "Invalid username or password" });
        }
      }

      const jwtLib = await import("jsonwebtoken");
      const jwtSecret = process.env.JWT_SECRET || "tt-erp-jwt-secret-key-2024";

      const activeUser = isEmployeeLogin ? {
        id: employeeObj.id,
        username: employeeObj.employeeCode,
        role: "driver",
        name: employeeObj.name,
        employeeId: employeeObj.id,
        companyId: employeeObj.companyId,
        shopId: employeeObj.shopId,
        branchId: employeeObj.branchId,
      } : {
        id: user!.id,
        username: user!.username,
        role: user!.role,
        name: user!.name,
        employeeId: user!.employeeId,
        companyId: user!.companyId,
        shopId: user!.shopId,
        branchId: user!.branchId,
      };

      const token = jwtLib.default.sign(
        activeUser,
        jwtSecret,
        { expiresIn: "7d" }
      );

      const refreshToken = jwtLib.default.sign(
        { userId: activeUser.id, type: "refresh" },
        jwtSecret,
        { expiresIn: "30d" }
      );

      res.json({
        user: activeUser,
        token,
        accessToken: token,
        refreshToken,
      });
    } catch (error) {
      console.error("Mobile login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Mobile Token Refresh
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token required" });
      }

      const jwtLib = await import("jsonwebtoken");
      const jwtSecret = process.env.JWT_SECRET || "tt-erp-jwt-secret-key-2024";

      const decoded = jwtLib.default.verify(refreshToken, jwtSecret) as any;
      if (decoded.type !== "refresh") {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      const user = await storage.getUser(decoded.userId);
      if (!user || user.status !== "active") {
        return res.status(401).json({ message: "User not found or inactive" });
      }

      const token = jwtLib.default.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name, companyId: user.companyId, shopId: user.shopId, branchId: user.branchId },
        jwtSecret,
        { expiresIn: "7d" }
      );

      res.json({ token });
    } catch (error) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
    }
  });

  // Mobile: Get tasks for current user (employees see assigned tasks, managers see scoped tasks)
  app.get("/api/mobile/tasks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const { status } = req.query;

      let tasks = await storage.getTasks();

      // SECURITY: Filter by user role and scope
      if (user.role === "employee") {
        // Employees only see tasks assigned to them
        tasks = tasks.filter(t => t.assigneeId === user.id);
      } else if (user.role === "manager") {
        // Managers see tasks they can access based on scope (via assignee's company/shop)
        const scopedUsers = await storage.getUsers();
        const scopedUserIds = new Set(
          scopedUsers
            .filter(u => u.companyId === user.companyId && (!user.shopId || u.shopId === user.shopId))
            .map(u => u.id)
        );
        tasks = tasks.filter(t => t.assigneeId && scopedUserIds.has(t.assigneeId));
      }
      // Super admins and admins can see all tasks

      // Filter by status if provided
      if (status && status !== "all") {
        tasks = tasks.filter(t => t.status === status);
      }

      // Enrich with assignee names
      const enrichedTasks = await Promise.all(tasks.map(async (task) => {
        const assignee = task.assigneeId ? await storage.getUser(task.assigneeId) : null;
        const attachments = await storage.getTaskAttachments(task.id);
        return {
          ...task,
          assigneeName: assignee?.name || assignee?.username,
          assignerName: user.name || user.username,
          hasProof: attachments.length > 0,
        };
      }));

      res.json({ tasks: enrichedTasks });
    } catch (error) {
      console.error("Mobile get tasks error:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Mobile: Get single task with details
  app.get("/api/mobile/tasks/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // SECURITY: Verify user has access to this task
      if (user.role === "employee" && task.assigneeId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      } else if (user.role === "manager") {
        // Managers can only access tasks assigned to users in their scope
        if (task.assigneeId) {
          const assignee = await storage.getUser(task.assigneeId);
          if (!assignee || assignee.companyId !== user.companyId || (user.shopId && assignee.shopId !== user.shopId)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const assignee = task.assigneeId ? await storage.getUser(task.assigneeId) : null;
      const attachments = await storage.getTaskAttachments(task.id);

      res.json({
        ...task,
        assigneeName: assignee?.name || assignee?.username,
        assignerName: user.name || user.username,
        proofImages: attachments.map(a => ({ id: a.id, url: a.filePath })),
      });
    } catch (error) {
      console.error("Mobile get task error:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Mobile: Create task (managers only)
  app.post("/api/mobile/tasks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      if (!["super_admin", "admin", "manager"].includes(user.role || "")) {
        return res.status(403).json({ message: "Only managers can create tasks" });
      }

      // SECURITY: Verify assignee is within manager's scope
      if (req.body.assigneeId && user.role === "manager") {
        const assignee = await storage.getUser(req.body.assigneeId);
        if (!assignee || assignee.companyId !== user.companyId || (user.shopId && assignee.shopId !== user.shopId)) {
          return res.status(403).json({ message: "Cannot assign tasks to users outside your scope" });
        }
      }

      const taskData = {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || "medium",
        dueDate: req.body.dueDate,
        assigneeId: req.body.assigneeId,
        status: "todo",
      };

      const task = await storage.createTask(taskData);
      res.status(201).json(task);
    } catch (error) {
      console.error("Mobile create task error:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Mobile: Update task status
  app.patch("/api/mobile/tasks/:id/status", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const user = req.user!;
      const task = await storage.getTask(req.params.id);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Employees can only update their own tasks
      if (user.role === "employee" && task.assigneeId !== user.id) {
        return res.status(403).json({ message: "You can only update your own tasks" });
      }

      const updateData: any = { status };
      if (status === "completed") {
        updateData.completedAt = new Date().toISOString();
      }

      const updatedTask = await storage.updateTask(req.params.id, updateData);
      res.json(updatedTask);
    } catch (error) {
      console.error("Mobile update task status error:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });

  // Mobile: Upload task proof photo
  app.post("/api/mobile/tasks/:id/proof", authMiddleware, taskUpload.single("photo"), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const task = await storage.getTask(req.params.id);

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (user.role === "employee" && task.assigneeId !== user.id) {
        return res.status(403).json({ message: "You can only upload proof for your own tasks" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No photo provided" });
      }

      const attachment = await storage.createTaskAttachment({
        taskId: task.id,
        fileName: req.file.originalname,
        filePath: `/uploads/tasks/${req.file.filename}`,
        fileType: req.file.mimetype,
        uploadedBy: user.id,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Mobile upload task proof error:", error);
      res.status(500).json({ message: "Failed to upload proof" });
    }
  });

  // Mobile: Get employees list for task assignment
  app.get("/api/mobile/employees", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      if (!["super_admin", "admin", "manager"].includes(user.role || "")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const users = await storage.getUsers();
      // SECURITY: Filter employees by user's scope
      const employees = users
        .filter(u => {
          if (u.status !== "active") return false;
          // Super admins see all
          if (user.role === "super_admin") return true;
          // Others see only users in their company
          if (u.companyId !== user.companyId) return false;
          // If manager has shop scope, filter by shop
          if (user.role === "manager" && user.shopId && u.shopId !== user.shopId) return false;
          return true;
        })
        .map(u => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
        }));

      res.json({ employees });
    } catch (error) {
      console.error("Mobile get employees error:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  // Mobile: Search products
  app.get("/api/mobile/products/search", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { q, limit = 50 } = req.query;
      const searchQuery = String(q || "").trim();
      const scope = getScopeFromRequest(req);

      let { products } = await storage.getProducts(scope || undefined);

      if (searchQuery.length >= 2) {
        const lowerQuery = searchQuery.toLowerCase();
        products = products.filter(p =>
          p.name?.toLowerCase().includes(lowerQuery) ||
          p.sku?.toLowerCase().includes(lowerQuery) ||
          p.barcode?.toLowerCase().includes(lowerQuery)
        );
      }

      // Limit results
      products = products.slice(0, Number(limit));

      // Get categories for names
      const categories = await storage.getCategories();
      const categoryMap = new Map(categories.map(c => [c.id, c.name]));

      // Enrich with serial counts and category names (only show selling price, not cost)
      const enrichedProducts = await Promise.all(products.map(async (product) => {
        const serials = await storage.getSerialNumbers({ productId: product.id, status: "available" });
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          sellingPrice: product.sellingPrice,
          quantity: product.productQty,
          categoryName: product.categoryId ? categoryMap.get(product.categoryId) : null,
          serialCount: serials.length,
          hasSerials: serials.length > 0,
        };
      }));

      res.json({ products: enrichedProducts });
    } catch (error) {
      console.error("Mobile product search error:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Mobile: Get product details
  app.get("/api/mobile/products/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const scope = getEnforcedScope(req);
      if (!scope) return res.status(401).json({ message: "Unauthorized" });
      const product = await storage.getProduct(req.params.id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // SECURITY: Verify product is within user's scope
      if (user.role !== "super_admin") {
        if (scope.companyId && product.companyId !== scope.companyId) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (scope.shopId && product.shopId !== scope.shopId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const category = product.categoryId ? await storage.getCategory(product.categoryId) : null;
      const brand = product.brandId ? await storage.getBrand(product.brandId) : null;
      const serials = await storage.getSerialNumbers({ productId: product.id, status: "available" });

      res.json({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        description: product.descriptions,
        sellingPrice: product.sellingPrice,
        quantity: product.productQty,
        warranty: product.warrantyMonths,
        categoryName: category?.name,
        brandName: brand?.name,
        serialCount: serials.length,
        hasSerials: serials.length > 0,
      });
    } catch (error) {
      console.error("Mobile get product error:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Mobile: Get product serial numbers
  app.get("/api/mobile/products/:id/serials", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const scope = getEnforcedScope(req);
      if (!scope) return res.status(401).json({ message: "Unauthorized" });
      // SECURITY: Verify product is within user's scope before returning serials
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (user.role !== "super_admin") {
        if (scope.companyId && product.companyId !== scope.companyId) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (scope.shopId && product.shopId !== scope.shopId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const serials = await storage.getSerialNumbers({
        productId: req.params.id,
        status: "available"
      });

      res.json({
        serials: serials.map(s => ({
          id: s.id,
          serialNumber: s.serialNumber,
          status: s.status,
        }))
      });
    } catch (error) {
      console.error("Mobile get serials error:", error);
      res.status(500).json({ message: "Failed to fetch serial numbers" });
    }
  });

  // Helper to calculate distance for Geofence validation
  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in meters
  }

  // Logistics Zones API
  app.get("/api/zones", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = getOptionalScope(req);
      const zonesList = await storage.getZones(scope);
      res.json(zonesList);
    } catch (error) {
      console.error("Get zones error:", error);
      res.status(500).json({ error: "Failed to fetch zones" });
    }
  });

  app.get("/api/zones/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const zone = await storage.getZone(req.params.id);
      if (!zone) return res.status(404).json({ error: "Zone not found" });
      res.json(zone);
    } catch (error) {
      console.error("Get zone error:", error);
      res.status(500).json({ error: "Failed to fetch zone" });
    }
  });

  app.post("/api/zones", authMiddleware, injectScopeFromHeaders, validateBody(insertZoneSchema), async (req: AuthRequest, res) => {
    try {
      const scope = getOptionalScope(req);
      const zone = await storage.createZone({ ...req.body, ...scope });
      res.status(201).json(zone);
    } catch (error) {
      console.error("Create zone error:", error);
      res.status(500).json({ error: "Failed to create zone" });
    }
  });

  app.put("/api/zones/:id", authMiddleware, validateBody(insertZoneSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const zone = await storage.updateZone(req.params.id, req.body);
      if (!zone) return res.status(404).json({ error: "Zone not found" });
      res.json(zone);
    } catch (error) {
      console.error("Update zone error:", error);
      res.status(500).json({ error: "Failed to update zone" });
    }
  });

  app.delete("/api/zones/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteZone(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete zone error:", error);
      res.status(500).json({ error: "Failed to delete zone" });
    }
  });

  app.get("/api/zones/:id/outlets", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const outlets = await storage.getZoneOutlets(req.params.id);
      res.json(outlets);
    } catch (error) {
      console.error("Get zone outlets error:", error);
      res.status(500).json({ error: "Failed to fetch zone outlets" });
    }
  });

  app.post("/api/zones/:id/outlets", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { outletIds } = req.body;
      await storage.appendOutletsToZone(req.params.id, outletIds);
      res.sendStatus(200);
    } catch (error) {
      console.error("Append zone outlets error:", error);
      res.status(500).json({ error: "Failed to append outlets to zone" });
    }
  });

  app.delete("/api/zones/:id/outlets/:outletId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.removeOutletFromZone(req.params.id, req.params.outletId);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete zone outlet mapping error:", error);
      res.status(500).json({ error: "Failed to remove outlet from zone" });
    }
  });

  app.get("/api/zones/supervisor/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const list = await storage.getSupervisorZones(req.params.id);
      res.json(list);
    } catch (error) {
      console.error("Get supervisor zones error:", error);
      res.status(500).json({ error: "Failed to fetch supervisor zones" });
    }
  });

  app.post("/api/zones/assign-supervisor", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { supervisorId, zoneIds } = req.body;
      if (!supervisorId || !Array.isArray(zoneIds)) {
        return res.status(400).json({ error: "supervisorId and zoneIds array are required" });
      }
      const assignments = await storage.assignSupervisorZones(supervisorId, zoneIds);
      res.json(assignments);
    } catch (error) {
      console.error("Assign supervisor zones error:", error);
      res.status(500).json({ error: "Failed to assign supervisor zones" });
    }
  });

  app.post("/api/zones/auto-allocate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { address } = req.body;
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      const allZones = await storage.getZones();
      let matchedZone = null;
      const addrLower = address.toLowerCase();
      for (const zone of allZones) {
        if (addrLower.includes(zone.name.toLowerCase()) || 
            (zone.description && addrLower.includes(zone.description.toLowerCase()))) {
          matchedZone = zone;
          break;
        }
      }
      res.json({ zone: matchedZone || (allZones[0] || null) });
    } catch (error) {
      console.error("Auto allocate zone error:", error);
      res.status(500).json({ error: "Failed to auto-allocate zone" });
    }
  });

  // Logistics Contracts API
  app.get("/api/contracts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const contractsList = await storage.getContracts(customerId);
      res.json(contractsList);
    } catch (error) {
      console.error("Get contracts error:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contract not found" });
      res.json(contract);
    } catch (error) {
      console.error("Get contract error:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  app.post("/api/contracts", authMiddleware, validateBody(insertContractSchema), async (req: AuthRequest, res) => {
    try {
      const contract = await storage.createContract(req.body);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Create contract error:", error);
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  app.put("/api/contracts/:id", authMiddleware, validateBody(insertContractSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const contract = await storage.updateContract(req.params.id, req.body);
      if (!contract) return res.status(404).json({ error: "Contract not found" });
      res.json(contract);
    } catch (error) {
      console.error("Update contract error:", error);
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteContract(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete contract error:", error);
      res.status(500).json({ error: "Failed to delete contract" });
    }
  });

  app.delete("/api/clients/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteClient(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Routes
  app.get("/api/routes", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const routes = await storage.getRoutes();
      res.json(routes);
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.get("/api/routes/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const route = await storage.getRoute(req.params.id);
      if (!route) return res.status(404).json({ error: "Route not found" });
      res.json(route);
    } catch (error) {
      console.error("Error fetching route:", error);
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  app.post("/api/routes", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const route = await storage.createRoute(req.body);
      res.status(201).json(route);
    } catch (error) {
      console.error("Error creating route:", error);
      res.status(500).json({ error: "Failed to create route", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/routes/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const route = await storage.updateRoute(req.params.id, req.body);
      if (!route) return res.status(404).json({ error: "Route not found" });
      res.json(route);
    } catch (error) {
      console.error("Error updating route:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete("/api/routes/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteRoute(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting route:", error);
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  // Outlets
  app.get("/api/outlets", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const clientId = req.query.clientId as string | undefined;
      const routeId = req.query.routeId as string | undefined;
      const brandId = req.query.brandId as string | undefined;
      const outlets = await storage.getOutlets(clientId, routeId, brandId);
      res.json(outlets);
    } catch (error) {
      console.error("Error fetching outlets:", error);
      res.status(500).json({ error: "Failed to fetch outlets" });
    }
  });

  app.get("/api/outlets/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const outlet = await storage.getOutlet(req.params.id);
      if (!outlet) return res.status(404).json({ error: "Outlet not found" });
      res.json(outlet);
    } catch (error) {
      console.error("Error fetching outlet:", error);
      res.status(500).json({ error: "Failed to fetch outlet" });
    }
  });

  app.get("/api/outlets/:id/attachments", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const attachments = await storage.getOutletDeliveryAttachments(req.params.id);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching outlet attachments:", error);
      res.status(500).json({ error: "Failed to fetch outlet attachments" });
    }
  });

  app.post("/api/outlets", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const { zoneIds, ...data } = req.body;
      const outlet = await storage.createOutlet(data);
      if (zoneIds && Array.isArray(zoneIds)) {
        await storage.assignOutletZones(outlet.id, zoneIds);
      }
      res.status(201).json(outlet);
    } catch (error) {
      console.error("Error creating outlet:", error);
      res.status(500).json({ error: "Failed to create outlet", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/outlets/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const { zoneIds, ...data } = req.body;
      const outlet = await storage.updateOutlet(req.params.id, data);
      if (zoneIds && Array.isArray(zoneIds)) {
        await storage.assignOutletZones(req.params.id, zoneIds);
      }
      if (!outlet) return res.status(404).json({ error: "Outlet not found" });
      res.json(outlet);
    } catch (error) {
      console.error("Error updating outlet:", error);
      res.status(500).json({ error: "Failed to update outlet" });
    }
  });

  app.delete("/api/outlets/:id", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteOutlet(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting outlet:", error);
      res.status(500).json({ error: "Failed to delete outlet" });
    }
  });

  app.get("/api/outlets/:id/zones", authMiddleware, permissionMiddleware("projects"), async (req: AuthRequest, res) => {
    try {
      const zones = await storage.getOutletZones(req.params.id);
      res.json(zones);
    } catch (error) {
      console.error("Error fetching outlet zones:", error);
      res.status(500).json({ error: "Failed to fetch outlet zones" });
    }
  });

  // ===== DAILY DISPATCH MODULE ROUTES =====

  // Driver Zone Assignments
  app.get("/api/dispatch/driver-zones", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rows = await storage.getDriverZones();
      res.json(rows);
    } catch (e) {
      console.error("Get driver zones error:", e);
      res.status(500).json({ error: "Failed to fetch driver zones" });
    }
  });

  app.post("/api/dispatch/driver-zones", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { driverId, zoneId } = req.body;
      const row = await storage.assignDriverZone(driverId, zoneId);
      res.status(201).json(row);
    } catch (e) {
      console.error("Assign driver zone error:", e);
      res.status(500).json({ error: "Failed to assign driver zone" });
    }
  });

  app.delete("/api/dispatch/driver-zones/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.removeDriverZone(req.params.id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Remove driver zone error:", e);
      res.status(500).json({ error: "Failed to remove driver zone" });
    }
  });

  // Dispatch Sheets
  app.get("/api/dispatch/sheets", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const sheets = await storage.getDispatchSheets();
      res.json(sheets);
    } catch (e) {
      console.error("Get dispatch sheets error:", e);
      res.status(500).json({ error: "Failed to fetch dispatch sheets" });
    }
  });

  // Delete dispatch sheet
  app.delete("/api/dispatch/sheets/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteDispatchSheet(req.params.id);
      res.sendStatus(200);
    } catch (e) {
      console.error("Delete dispatch sheet error:", e);
      res.status(500).json({ error: "Failed to delete dispatch sheet" });
    }
  });

  // Upload CSV and create dispatch sheet
  app.post("/api/dispatch/sheets", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { date, fileName, items } = req.body; // items: parsed CSV rows from frontend
      const uploadedBy = req.user?.id;

      const sheet = await storage.createDispatchSheet({ date, uploadedBy, fileName });

      // Resolve outlet codes to outlet IDs and route IDs
      const allOutlets = await storage.getOutlets();
      const outletCodeMap = new Map(allOutlets.map(o => [o.code?.trim().toLowerCase(), o]));

      const resolvedItems = items.map((row: any) => {
        const outlet = outletCodeMap.get((row.to_sub_code || row.outlet_code || row.outletCode || "").trim().toLowerCase());
        return {
          sheetId: sheet.id,
          outletCode: row.to_sub_code || row.outlet_code || row.outletCode || "",
          outletId: outlet?.id || null,
          routeId: outlet?.routeId || null,
          itemCode: row.item_number || row.item_code || row.itemCode || "",
          description: row.description || row.item_name || row.item_desc || row.itemName || row.product_name || row.item_description || row.to_sub_desc || null,
          toNo: row.to_no || null,
          lineNumber: row.line_number || null,
          requestedDeliveryDate: row.requested_delivery_date ? new Date(row.requested_delivery_date.split('-').reverse().join('-')) : null, // Assuming DD-MM-YYYY
          storageType: row.storage_type || null,
          uom: row.uom || null,
          fromOrg: row.from_org || null,
          requestedQty: row.fus_requested_qty ? parseFloat(row.fus_requested_qty) : null,
          weight: row.weight || null,
          totalDelivered: row.total_delivered || row.totalDelivered || null,
          remaining: row.remaining || null,
          remark: row.remark || null,
          grnNumber: row.grn_number || row.grnNumber || null,
        };
      });

      await storage.createDispatchItems(resolvedItems);


      // Dispatch Engine Automation is NOT triggered automatically on upload anymore
      // Users will trigger allocation manually from the UI


      res.status(201).json({ sheet, itemCount: resolvedItems.length });
    } catch (e) {
      console.error("Create dispatch sheet error:", e);
      res.status(500).json({ error: "Failed to create dispatch sheet", details: e instanceof Error ? e.message : String(e) });
    }
  });

  // Get dispatch board for a specific sheet
  app.get("/api/dispatch/sheets/:id/board", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const board = await storage.getDispatchBoard(req.params.id);
      res.json(board);
    } catch (e: any) {
      console.error("Get dispatch board error:", e?.stack || e);
      res.status(500).json({ error: "Failed to fetch dispatch board", details: e?.message || String(e) });
    }
  });

  // Get dispatch report for a specific sheet (grouped by Route -> Outlet -> Items)
  app.get("/api/dispatch/sheets/:id/report", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getDispatchItemsForSheet(req.params.id);
      const routes = await storage.getRoutes();
      const routeMap = new Map(routes.map(r => [r.id, r.name]));

      res.json({ items, routeMap: Object.fromEntries(routeMap) });
    } catch (e) {
      console.error("Get dispatch report error:", e);
      res.status(500).json({ error: "Failed to fetch dispatch report" });
    }
  });

  // Update delivery status for a dispatch item
  app.patch("/api/dispatch/items/:id/delivery", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.updateDispatchDelivery(req.params.id, { ...req.body, driverId: req.user?.id });
      res.json(result);
    } catch (e) {
      console.error("Update delivery error:", e);
      res.status(500).json({ error: "Failed to update delivery" });
    }
  });

  // Supervisor override: move outlet to different zone for this sheet
  app.post("/api/dispatch/overrides", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { sheetId, outletId, overrideZoneId, overrideTruckId, reason } = req.body;
      const result = await storage.createDispatchOverride({ sheetId, outletId, overrideZoneId, overrideTruckId, reason, createdBy: req.user?.id });
      res.status(201).json(result);
    } catch (e) {
      console.error("Create override error:", e);
      res.status(500).json({ error: "Failed to create zone override" });
    }
  });

  app.delete("/api/dispatch/overrides/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteDispatchOverride(req.params.id);
      res.sendStatus(204);
    } catch (e) {
      console.error("Delete override error:", e);
      res.status(500).json({ error: "Failed to delete zone override" });
    }
  });

  app.put("/api/dispatch/items/:id/override", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { overrideRouteId } = req.body;
      const result = await storage.updateDispatchItemOverride(req.params.id, overrideRouteId);
      res.json(result);
    } catch (e) {
      console.error("Item override error:", e);
      res.status(500).json({ error: "Failed to update item override" });
    }
  });



  const contractUploadDir = path.join(process.cwd(), "uploads", "contracts");
  if (!fs.existsSync(contractUploadDir)) {
    fs.mkdirSync(contractUploadDir, { recursive: true });
  }
  const contractStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, contractUploadDir); },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });
  const contractUpload = multer({
    storage: contractStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Only images, PDFs, and Word documents are allowed."));
    },
  });

  app.post("/api/upload/contracts", authMiddleware, contractUpload.array("documents"), (req: AuthRequest, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      const uploadedDocs = files.map(file => ({
        name: file.originalname,
        url: `/uploads/contracts/${file.filename}`
      }));
      res.json({ documents: uploadedDocs });
    } catch (error) {
      console.error("Contract upload error:", error);
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // Advanced Driver Management APIs
  app.post("/api/drivers/attendance/auto-checkin", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { driverId, latitude, longitude } = req.body;
      if (!driverId || !latitude || !longitude) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Auto-attendance logic: Verify location
      const autoVerified = true; // Replace with actual geo-fencing logic
      
      const record = await storage.createDriverAttendance({
        driverId,
        latitude,
        longitude,
        checkInTime: new Date(),
        isAuthorizedDevice: true,
        autoVerified,
        status: "present"
      } as any); // Type assertion until storage interface is updated
      
      res.status(201).json(record);
    } catch (error) {
      console.error("Auto checkin error:", error);
      res.status(500).json({ error: "Failed to process auto checkin" });
    }
  });

  app.get("/api/drivers/earnings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Stub for driver earnings
      res.json([]);
    } catch (error) {
      console.error("Get driver earnings error:", error);
      res.status(500).json({ error: "Failed to fetch driver earnings" });
    }
  });

  // Expanded Finance APIs
  app.post("/api/finance/invoices/auto-generate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { orderId, tripId, type } = req.body;
      if (!type) return res.status(400).json({ error: "Invoice type is required" });
      
      // Auto-generation logic stub
      const invoice = {
        invoiceNumber: `INV-${Date.now()}`,
        type,
        customerId: req.body.customerId || "temp",
        orderId,
        tripId,
        status: "draft"
      };
      
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Auto invoice generation error:", error);
      res.status(500).json({ error: "Failed to auto-generate invoice" });
    }
  });

  app.get("/api/finance/profit-analysis", authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Stub for profitability analysis calculation
      res.json({ totalRevenue: 0, totalCosts: 0, profitMargin: 0 });
    } catch (error) {
      console.error("Profit analysis error:", error);
      res.status(500).json({ error: "Failed to perform profit analysis" });
    }
  });

  // Fleet Advanced API
  app.get("/api/vehicles/maintenance", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const vehicleId = req.query.vehicleId as string | undefined;
      const driverId = req.query.driverId as string | undefined;
      const maintenance = await storage.getVehicleMaintenance(vehicleId, driverId);
      res.json(maintenance);
    } catch (error) {
      console.error("Get maintenance error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle maintenance logs" });
    }
  });

  app.post("/api/vehicles/maintenance", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = {
        ...req.body,
        driverId: req.body.driverId || req.user?.id,
      };
      const log = await storage.createVehicleMaintenance(payload);
      res.status(201).json(log);
    } catch (error) {
      console.error("Create maintenance log error:", error);
      res.status(500).json({ error: "Failed to create vehicle maintenance log" });
    }
  });

  app.get("/api/vehicles/fuel", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const vehicleId = req.query.vehicleId as string | undefined;
      const tripId = req.query.tripId as string | undefined;
      const driverId = req.query.driverId as string | undefined;
      const logs = await storage.getFuelLogs(vehicleId, tripId, driverId);
      res.json(logs);
    } catch (error) {
      console.error("Get fuel logs error:", error);
      res.status(500).json({ error: "Failed to fetch fuel logs" });
    }
  });

  app.post("/api/vehicles/fuel", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = {
        ...req.body,
        driverId: req.body.driverId || req.user?.id,
      };
      const log = await storage.createFuelLog(payload);
      res.status(201).json(log);
    } catch (error) {
      console.error("Create fuel log error:", error);
      res.status(500).json({ error: "Failed to create fuel log" });
    }
  });

  // Logistics Vehicles API
  app.get("/api/vehicles", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      const vehiclesList = await storage.getVehicles(status, type);
      res.json(vehiclesList);
    } catch (error) {
      console.error("Get vehicles error:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
      res.json(vehicle);
    } catch (error) {
      console.error("Get vehicle error:", error);
      res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  app.post("/api/vehicles", authMiddleware, validateBody(insertVehicleSchema), async (req: AuthRequest, res) => {
    try {
      const vehicle = await storage.createVehicle(req.body);
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Create vehicle error:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.put("/api/vehicles/:id", authMiddleware, validateBody(insertVehicleSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const vehicle = await storage.updateVehicle(req.params.id, req.body);
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
      res.json(vehicle);
    } catch (error) {
      console.error("Update vehicle error:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteVehicle(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete vehicle error:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Assign vehicle to a zone
  app.patch("/api/vehicles/:id/zone", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const vehicle = await storage.updateVehicle(req.params.id, { currentZoneId: req.body.zoneId });
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
      res.json(vehicle);
    } catch (error) {
      console.error("Assign vehicle zone error:", error);
      res.status(500).json({ error: "Failed to assign vehicle to zone" });
    }
  });

  // Logistics Locations API
  app.get("/api/locations", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const list = await storage.getLocations();
      res.json(list);
    } catch (error) {
      console.error("Get locations error:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.get("/api/locations/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const location = await storage.getLocation(req.params.id);
      if (!location) return res.status(404).json({ error: "Location not found" });
      res.json(location);
    } catch (error) {
      console.error("Get location error:", error);
      res.status(500).json({ error: "Failed to fetch location" });
    }
  });

  app.post("/api/locations", authMiddleware, validateBody(insertLocationSchema), async (req: AuthRequest, res) => {
    try {
      const location = await storage.createLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      console.error("Create location error:", error);
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  app.put("/api/locations/:id", authMiddleware, validateBody(insertLocationSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const location = await storage.updateLocation(req.params.id, req.body);
      if (!location) return res.status(404).json({ error: "Location not found" });
      res.json(location);
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteLocation(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete location error:", error);
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Logistics RFQs API
  app.get("/api/rfqs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const list = await storage.getRfqs();
      res.json(list);
    } catch (error) {
      console.error("Get rfqs error:", error);
      res.status(500).json({ error: "Failed to fetch RFQs" });
    }
  });

  app.get("/api/rfqs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const rfq = await storage.getRfq(req.params.id);
      if (!rfq) return res.status(404).json({ error: "RFQ not found" });
      res.json(rfq);
    } catch (error) {
      console.error("Get rfq error:", error);
      res.status(500).json({ error: "Failed to fetch RFQ" });
    }
  });

  app.post("/api/rfqs", authMiddleware, validateBody(insertRfqSchema), async (req: AuthRequest, res) => {
    try {
      const rfq = await storage.createRfq(req.body);
      res.status(201).json(rfq);
    } catch (error) {
      console.error("Create rfq error:", error);
      res.status(500).json({ error: "Failed to create RFQ" });
    }
  });

  app.put("/api/rfqs/:id", authMiddleware, validateBody(insertRfqSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const rfq = await storage.updateRfq(req.params.id, req.body);
      if (!rfq) return res.status(404).json({ error: "RFQ not found" });
      res.json(rfq);
    } catch (error) {
      console.error("Update rfq error:", error);
      res.status(500).json({ error: "Failed to update RFQ" });
    }
  });

  app.delete("/api/rfqs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteRfq(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete rfq error:", error);
      res.status(500).json({ error: "Failed to delete RFQ" });
    }
  });

  // Logistics Orders API
  app.get("/api/orders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const zoneId = req.query.zoneId as string | undefined;
      const status = req.query.status as string | undefined;
      const list = await storage.getOrders(customerId, zoneId, status);
      res.json(list);
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const data = await storage.getOrderWithCharges(req.params.id);
      if (!data) return res.status(404).json({ error: "Order not found" });
      res.json(data); // Returns { order, charges }
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const order = await storage.createOrder(req.body);
      res.status(201).json(order);
    } catch (error: any) {
      console.error("Create order error:", error);
      res.status(500).json({ error: "Failed to create order: " + (error.message || String(error)) });
    }
  });

  app.put("/api/orders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const order = await storage.updateOrder(req.params.id, req.body);
      if (!order) return res.status(404).json({ error: "Order not found" });
      res.json(order);
    } catch (error) {
      console.error("Update order error:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteOrder(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete order error:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  app.post("/api/orders/:id/pay", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const order = await storage.payOrderInvoice(req.params.id, req.body);
      res.json(order);
    } catch (error: any) {
      console.error("Pay order error:", error);
      res.status(500).json({ error: "Failed to process payment: " + error.message });
    }
  });

  // Logistics Trips API
  app.get("/api/trips", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const driverId = req.query.driverId as string | undefined;
      const status = req.query.status as string | undefined;
      const list = await storage.getTrips(driverId, status);
      res.json(list);
    } catch (error) {
      console.error("Get trips error:", error);
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const trip = await storage.getTrip(req.params.id);
      if (!trip) return res.status(404).json({ error: "Trip not found" });
      res.json(trip);
    } catch (error) {
      console.error("Get trip error:", error);
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  app.post("/api/trips", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { orderIds, ...tripData } = req.body;
      if (!tripData.vehicleId || !tripData.driverId) {
        return res.status(400).json({ error: "vehicleId and driverId are required" });
      }
      const trip = await storage.createTrip({ ...tripData, orderIds: orderIds || [] });
      res.status(201).json(trip);
    } catch (error) {
      console.error("Create trip error:", error);
      res.status(500).json({ error: "Failed to create trip" });
    }
  });

  app.put("/api/trips/:id", authMiddleware, validateBody(insertTripSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const trip = await storage.updateTrip(req.params.id, req.body);
      if (!trip) return res.status(404).json({ error: "Trip not found" });
      res.json(trip);
    } catch (error) {
      console.error("Update trip error:", error);
      res.status(500).json({ error: "Failed to update trip" });
    }
  });

  app.delete("/api/trips/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteTrip(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete trip error:", error);
      res.status(500).json({ error: "Failed to delete trip" });
    }
  });

  app.get("/api/trips/:id/orders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const list = await storage.getTripOrders(req.params.id);
      res.json(list);
    } catch (error) {
      console.error("Get trip orders error:", error);
      res.status(500).json({ error: "Failed to fetch trip orders" });
    }
  });

  app.post("/api/trips/:id/update-delivery", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { orderId, status, podUrl, issueLog } = req.body;
      if (!orderId || !status) {
        return res.status(400).json({ error: "orderId and status are required" });
      }
      const delivery = await storage.recordDeliveryPOD(req.params.id, orderId, podUrl, status, issueLog);
      res.json(delivery);
    } catch (error) {
      console.error("Update delivery error:", error);
      res.status(500).json({ error: "Failed to update delivery status" });
    }
  });

  // Logistics Deliveries API
  app.get("/api/deliveries", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const tripId = req.query.tripId as string | undefined;
      const orderId = req.query.orderId as string | undefined;
      const list = await storage.getDeliveries(tripId, orderId);
      res.json(list);
    } catch (error) {
      console.error("Get deliveries error:", error);
      res.status(500).json({ error: "Failed to fetch deliveries" });
    }
  });

  // Logistics Driver Hub API
  app.get("/api/drivers", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const driversList = await storage.getDrivers();
      res.json(driversList);
    } catch (error) {
      console.error("Get drivers error:", error);
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  app.post("/api/drivers", authMiddleware, validateBody(insertDriverSchema), async (req: AuthRequest, res) => {
    try {
      const driver = await storage.createDriver(req.body);
      res.status(201).json(driver);
    } catch (error) {
      console.error("Create driver error:", error);
      res.status(500).json({ error: "Failed to create driver" });
    }
  });

  app.get("/api/drivers/activities", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const driverId = req.query.driverId as string | undefined;
      const tripId = req.query.tripId as string | undefined;
      const list = await storage.getDriverActivities(driverId, tripId);
      res.json(list);
    } catch (error) {
      console.error("Get driver activities error:", error);
      res.status(500).json({ error: "Failed to fetch driver activities" });
    }
  });

  app.post("/api/drivers/activities", authMiddleware, validateBody(insertDriverActivitySchema), async (req: AuthRequest, res) => {
    try {
      const activity = await storage.createDriverActivity(req.body);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Create driver activity error:", error);
      res.status(500).json({ error: "Failed to create driver activity" });
    }
  });

  app.get("/api/drivers/my-deliveries", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const driverId = req.query.driverId as string | undefined || req.user?.employeeId || req.user?.id;
      if (!driverId) {
        return res.status(400).json({ error: "driverId is required" });
      }
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const report = await storage.getDriverDeliveriesReport(driverId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      console.error("Error in /api/drivers/my-deliveries:", error);
      res.status(500).json({ error: error.message || "Failed to fetch driver deliveries" });
    }
  });

  app.get("/api/drivers/attendance", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const driverId = req.query.driverId as string | undefined;
      const date = req.query.date as string | undefined;
      const list = await storage.getDriverAttendance(driverId, date);
      res.json(list);
    } catch (error) {
      console.error("Get driver attendance error:", error);
      res.status(500).json({ error: "Failed to fetch driver attendance" });
    }
  });

  app.post("/api/drivers/attendance", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await ensureDriverTablesSchema();
      const { driverId, latitude, longitude, deviceToken } = req.body;
      const effectiveDriverId = driverId || req.user?.employeeId || req.user?.id;
      if (!effectiveDriverId) {
        return res.status(400).json({ error: "driverId is required" });
      }

      const latNum = parseFloat(latitude);
      const lonNum = parseFloat(longitude);
      
      const allLocations = await storage.getLocations();
      let isWithinRange = false;
      let nearestLoc: any = null;
      let minDistance = Infinity;

      if (Array.isArray(allLocations) && !isNaN(latNum) && !isNaN(lonNum)) {
        for (const loc of allLocations) {
          if (loc.latitude && loc.longitude) {
            const locLat = parseFloat(loc.latitude.toString());
            const locLon = parseFloat(loc.longitude.toString());
            if (!isNaN(locLat) && !isNaN(locLon)) {
              const dist = getDistanceInMeters(latNum, lonNum, locLat, locLon);
              if (dist < minDistance) {
                minDistance = dist;
                nearestLoc = loc;
              }
            }
          }
        }
      }
      
      if (minDistance <= 100) {
        isWithinRange = true;
      }

      const isAuthorizedDevice = !!deviceToken;

      const attendance = await storage.createDriverAttendance({
        driverId: effectiveDriverId,
        checkInTime: new Date(),
        latitude: !isNaN(latNum) ? latNum.toString() : null,
        longitude: !isNaN(lonNum) ? lonNum.toString() : null,
        isAuthorizedDevice,
        status: "present",
      } as any);

      res.status(201).json({
        attendance,
        geofenceValid: isWithinRange,
        distanceToNearest: nearestLoc && minDistance !== Infinity ? `${minDistance.toFixed(1)}m from ${nearestLoc.name}` : "outside geofence",
        isAuthorizedDevice
      });
    } catch (error: any) {
      console.error("Driver attendance checkin error:", error);
      res.status(500).json({ error: error.message || "Failed to record attendance" });
    }
  });

  app.post("/api/drivers/opening-km", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { attendanceId, truckId, openingKm, latitude, longitude } = req.body;
      if (!attendanceId || openingKm === undefined || openingKm === null) {
        return res.status(400).json({ error: "attendanceId and openingKm are required" });
      }

      const kmVal = parseInt(openingKm, 10);
      if (isNaN(kmVal) || kmVal < 0) {
        return res.status(400).json({ error: "openingKm must be a valid non-negative number" });
      }

      const updated = await storage.updateDriverAttendance(attendanceId, {
        truckId: truckId || null,
        openingKm: kmVal,
        openingKmTimestamp: new Date(),
      });

      // Record driver activity log
      await storage.createDriverActivity({
        driverId: req.user?.id || updated.driverId,
        kmBefore: kmVal,
        notes: `Duty started. Truck Opening KM: ${kmVal}`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Record opening KM error:", error);
      res.status(500).json({ error: "Failed to record Opening KM" });
    }
  });

  app.post("/api/drivers/closing-km", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { attendanceId, closingKm, latitude, longitude } = req.body;
      if (!attendanceId || closingKm === undefined || closingKm === null) {
        return res.status(400).json({ error: "attendanceId and closingKm are required" });
      }

      const closeKmVal = parseInt(closingKm, 10);
      if (isNaN(closeKmVal) || closeKmVal < 0) {
        return res.status(400).json({ error: "closingKm must be a valid non-negative number" });
      }

      // Fetch attendance record to validate closing KM >= opening KM
      const [record] = await storage.getDriverAttendance(req.user?.id);
      const openingKmVal = record?.openingKm ?? 0;

      if (closeKmVal < openingKmVal) {
        return res.status(400).json({
          error: `Closing KM (${closeKmVal}) cannot be less than Opening KM (${openingKmVal})`
        });
      }

      const updated = await storage.updateDriverAttendance(attendanceId, {
        closingKm: closeKmVal,
        closingKmTimestamp: new Date(),
        checkOutTime: new Date(),
        endLatitude: latitude ? latitude.toString() : null,
        endLongitude: longitude ? longitude.toString() : null,
      });

      // Record driver activity log
      await storage.createDriverActivity({
        driverId: req.user?.id || updated.driverId,
        kmBefore: openingKmVal,
        kmAfter: closeKmVal,
        notes: `Duty ended. Closing KM: ${closeKmVal}. Total KM: ${closeKmVal - openingKmVal}`,
      });

      res.json({
        attendance: updated,
        totalKmTravelled: closeKmVal - openingKmVal,
      });
    } catch (error) {
      console.error("Record closing KM error:", error);
      res.status(500).json({ error: "Failed to record Closing KM" });
    }
  });

  // User Activity Logs API
  app.get("/api/user-activity-logs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const logs = await storage.getUserActivityLogs(userId);
      res.json(logs);
    } catch (error) {
      console.error("Get user activity logs error:", error);
      res.status(500).json({ error: "Failed to fetch user activity logs" });
    }
  });

  app.post("/api/user-activity-logs", authMiddleware, validateBody(insertUserActivityLogSchema.partial()), async (req: AuthRequest, res) => {
    try {
      const log = await storage.createUserActivityLog({
        ...req.body,
        userId: req.user?.id || null,
        username: req.user?.username || null
      });
      res.status(201).json(log);
    } catch (error) {
      console.error("Create activity log error:", error);
      res.status(500).json({ error: "Failed to create activity log" });
    }
  });

  // ==================== DISPATCH TRUCK PLANNING ROUTES ====================
  app.get("/api/dispatch/sheets/:sheetId/trucks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.autoAssignZoneTrucksToSheet(req.params.sheetId);
      const trucks = await storage.getDispatchTruckAssignments(req.params.sheetId);
      const outletAssignments = await storage.getDispatchOutletTruckAssignmentsBySheet(req.params.sheetId);
      res.json({ trucks, outletAssignments });
    } catch (error) {
      console.error("Get truck assignments error:", error);
      res.status(500).json({ error: "Failed to fetch truck assignments" });
    }
  });

  app.post("/api/dispatch/sheets/:sheetId/trucks", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const truck = await storage.createDispatchTruckAssignment({ ...req.body, sheetId: req.params.sheetId });
      res.status(201).json(truck);
    } catch (error) {
      console.error("Create truck assignment error:", error);
      res.status(500).json({ error: "Failed to add truck to dispatch" });
    }
  });

  app.delete("/api/dispatch/trucks/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.deleteDispatchTruckAssignment(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete truck assignment error:", error);
      res.status(500).json({ error: "Failed to remove truck" });
    }
  });

  app.patch("/api/dispatch/truck-assignments/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const truck = await storage.updateDispatchTruckAssignment(req.params.id, req.body);
      if (!truck) return res.status(404).json({ error: "Assignment not found" });
      res.json(truck);
    } catch (error) {
      console.error("Update truck assignment error:", error);
      res.status(500).json({ error: "Failed to update truck assignment" });
    }
  });

  app.post("/api/dispatch/sheets/:sheetId/trucks/auto-allocate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.autoAllocateFfd(req.params.sheetId);
      res.json(result);
    } catch (error) {
      console.error("Auto-allocate error:", error);
      res.status(500).json({ error: "Failed to auto-allocate outlets to trucks" });
    }
  });

  app.post("/api/dispatch/trucks/:truckAssignmentId/move-outlet", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { outletCode, reason } = req.body;
      await storage.moveOutletBetweenTrucks(outletCode, req.params.truckAssignmentId, reason);
      res.json({ success: true });
    } catch (error) {
      console.error("Move outlet error:", error);
      res.status(500).json({ error: "Failed to move outlet" });
    }
  });

  // Manually assign a specific outlet to a specific truck (with capacity check)
  app.post("/api/dispatch/outlets/assign", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { outletCode, truckAssignmentId, outletWeight, sheetId } = req.body;
      if (!outletCode || !truckAssignmentId) {
        return res.status(400).json({ error: "outletCode and truckAssignmentId are required" });
      }

      // Load the truck assignment to check capacity
      const [truckAssign] = await db.select().from(schema.dispatchTruckAssignments)
        .where(eq(schema.dispatchTruckAssignments.id, truckAssignmentId));
      if (!truckAssign) return res.status(404).json({ error: "Truck assignment not found" });

      // Load the vehicle to get capacity
      const [vehicle] = await db.select().from(schema.vehicles)
        .where(eq(schema.vehicles.id, truckAssign.truckId));
      const capacity = parseFloat(vehicle?.capacity || "0");
      const usedCapacity = parseFloat(truckAssign.usedCapacity?.toString() || "0");
      const weight = parseFloat(outletWeight || "0");

      if (capacity > 0 && usedCapacity + weight > capacity) {
        return res.status(422).json({
          error: `Capacity exceeded: Adding this outlet (${weight.toFixed(3)}T) would exceed ${vehicle?.plateNumber || "truck"}'s capacity of ${capacity}T. Current load: ${usedCapacity.toFixed(3)}T.`
        });
      }

      // Remove existing assignment for this outlet (if any) in this sheet to avoid duplicates
      if (sheetId) {
        const existingTrucks = await db.select().from(schema.dispatchTruckAssignments)
          .where(eq(schema.dispatchTruckAssignments.sheetId, sheetId));
        const existingTruckIds = existingTrucks.map((t: any) => t.id);
        if (existingTruckIds.length > 0) {
          const existing = await db.select().from(schema.dispatchOutletTruckAssignments)
            .where(and(
              inArray(schema.dispatchOutletTruckAssignments.truckAssignmentId, existingTruckIds),
              eq(schema.dispatchOutletTruckAssignments.outletCode, outletCode)
            ));
          for (const e of existing) {
            // Reduce old truck's usedCapacity
            const [oldTruck] = await db.select().from(schema.dispatchTruckAssignments)
              .where(eq(schema.dispatchTruckAssignments.id, e.truckAssignmentId));
            if (oldTruck) {
              const oldUsed = parseFloat(oldTruck.usedCapacity?.toString() || "0");
              const oldWeight = parseFloat(e.assignedWeight?.toString() || "0");
              await db.update(schema.dispatchTruckAssignments)
                .set({ usedCapacity: Math.max(0, oldUsed - oldWeight).toFixed(3) } as any)
                .where(eq(schema.dispatchTruckAssignments.id, e.truckAssignmentId));
            }
            await db.delete(schema.dispatchOutletTruckAssignments)
              .where(eq(schema.dispatchOutletTruckAssignments.id, e.id));
          }
        }
      }

      // Insert new assignment
      await db.insert(schema.dispatchOutletTruckAssignments).values({
        truckAssignmentId,
        outletCode,
        assignedWeight: weight.toFixed(3),
      });

      // Update truck usedCapacity
      await db.update(schema.dispatchTruckAssignments)
        .set({ usedCapacity: (usedCapacity + weight).toFixed(3) } as any)
        .where(eq(schema.dispatchTruckAssignments.id, truckAssignmentId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Assign outlet error:", error);
      res.status(500).json({ error: "Failed to assign outlet: " + error.message });
    }
  });

  // Unassign an outlet from its current truck
  app.delete("/api/dispatch/outlets/assign", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { outletCode, sheetId } = req.body;
      const allTrucks = await db.select().from(schema.dispatchTruckAssignments)
        .where(eq(schema.dispatchTruckAssignments.sheetId, sheetId));
      const truckIds = allTrucks.map((t: any) => t.id);
      if (truckIds.length === 0) return res.json({ success: true });

      const existing = await db.select().from(schema.dispatchOutletTruckAssignments)
        .where(and(
          inArray(schema.dispatchOutletTruckAssignments.truckAssignmentId, truckIds),
          eq(schema.dispatchOutletTruckAssignments.outletCode, outletCode)
        ));

      for (const e of existing) {
        const [truck] = await db.select().from(schema.dispatchTruckAssignments)
          .where(eq(schema.dispatchTruckAssignments.id, e.truckAssignmentId));
        if (truck) {
          const oldUsed = parseFloat(truck.usedCapacity?.toString() || "0");
          const w = parseFloat(e.assignedWeight?.toString() || "0");
          await db.update(schema.dispatchTruckAssignments)
            .set({ usedCapacity: Math.max(0, oldUsed - w).toFixed(3) } as any)
            .where(eq(schema.dispatchTruckAssignments.id, e.truckAssignmentId));
        }
        await db.delete(schema.dispatchOutletTruckAssignments)
          .where(eq(schema.dispatchOutletTruckAssignments.id, e.id));
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Unassign outlet error:", error);
      res.status(500).json({ error: "Failed to unassign outlet" });
    }
  });

  // Pending quantities
  app.get("/api/dispatch/pending", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const pending = await storage.getPendingQuantities();
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending quantities" });
    }
  });

  app.post("/api/dispatch/pending", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const item = await storage.createPendingQuantity(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pending quantity" });
    }
  });

  app.patch("/api/dispatch/pending/:id/carry-forward", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await storage.markPendingCarriedForward(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark as carried forward" });
    }
  });

  // ==================== TRUCK TRANSFERS ROUTES ====================
  app.get("/api/truck-transfers", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const truckId = req.query.truckId as string | undefined;
      const transfers = await storage.getTruckTransfers(truckId);
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch truck transfers" });
    }
  });

  app.post("/api/truck-transfers", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.createTruckTransfer(req.body);
      res.status(201).json(transfer);
    } catch (error) {
      console.error("Create truck transfer error:", error);
      res.status(500).json({ error: "Failed to create truck transfer" });
    }
  });

  app.put("/api/truck-transfers/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const transfer = await storage.updateTruckTransfer(req.params.id, req.body);
      if (!transfer) return res.status(404).json({ error: "Transfer not found" });
      res.json(transfer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update truck transfer" });
    }
  });

  // ==================== CONTRACT INVOICE ENGINE ROUTES ====================
  app.get("/api/contract-invoices", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const contractId = req.query.contractId as string | undefined;
      const customerId = req.query.customerId as string | undefined;
      const invoices = await storage.getContractInvoices(contractId, customerId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contract invoices" });
    }
  });

  app.get("/api/contract-invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.getContractInvoice(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.post("/api/contract-invoices/generate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { contractId, periodStart, periodEnd } = req.body;
      if (!contractId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: "contractId, periodStart, and periodEnd are required" });
      }

      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }

      let generatedInvoices = [];

      if (contract.invoiceGenerationType === "outlet" && contract.linkedOutlets && Array.isArray(contract.linkedOutlets) && contract.linkedOutlets.length > 0) {
        for (const outletId of contract.linkedOutlets as string[]) {
          await storage.calculateContractUsage(contract.id, periodStart, periodEnd, outletId);
          const inv = await storage.generateContractInvoice(contract.id, periodStart, periodEnd, outletId);
          generatedInvoices.push(inv);
        }
      } else {
        await storage.calculateContractUsage(contract.id, periodStart, periodEnd);
        const inv = await storage.generateContractInvoice(contractId, periodStart, periodEnd);
        generatedInvoices.push(inv);
      }
      
      res.status(201).json(generatedInvoices.length === 1 ? generatedInvoices[0] : generatedInvoices);
    } catch (error) {
      console.error("Generate invoice error:", error);
      res.status(500).json({ error: "Failed to generate invoice: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  app.put("/api/contract-invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.updateContractInvoice(req.params.id, req.body);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.patch("/api/contract-invoices/:id/status", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const invoice = await storage.updateContractInvoice(req.params.id, { status });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to update invoice status" });
    }
  });

  // Monthly usage for a contract
  app.get("/api/contracts/:id/usage", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const month = req.query.month as string | undefined;
      const usage = await storage.getContractMonthlyUsage(req.params.id, month);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage data" });
    }
  });

  app.put("/api/contracts/:id/usage", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { month, ...data } = req.body;
      if (!month) return res.status(400).json({ error: "month is required" });
      const usage = await storage.upsertContractMonthlyUsage(req.params.id, month, data);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to update usage data" });
    }
  });

  return httpServer;
}
