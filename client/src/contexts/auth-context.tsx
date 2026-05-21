import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { setAuthToken, queryClient } from "@/lib/queryClient";

interface AuthUser {
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

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthReady: boolean;
  canChangeScope: boolean;
  accessToken: string | null;
  login: (username: string, password: string) => Promise<string | true>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<string | true>;
  updateScope: (shopId: string, branchId: string, warehouseId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [canChangeScope, setCanChangeScope] = useState(false);
  const refreshCalledRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      return !!accessToken;
    }
    
    isRefreshingRef.current = true;
    
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setUser(null);
        setAccessToken(null);
        setAuthToken(null);
        return false;
      }

      const data = await response.json();
      setAuthToken(data.accessToken);
      setUser(data.user);
      setAccessToken(data.accessToken);
      setCanChangeScope(data.canChangeScope);
      return true;
    } catch {
      setAuthToken(null);
      setUser(null);
      setAccessToken(null);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [accessToken]);

  useEffect(() => {
    if (refreshCalledRef.current) return;
    refreshCalledRef.current = true;
    
    const initAuth = async () => {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        setUser(null);
        setAccessToken(null);
      }
      setIsLoading(false);
      setIsAuthReady(true);
    };

    initAuth();
  }, []);

  useEffect(() => {
    setAuthToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(async () => {
      await refreshAccessToken();
    }, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  const login = async (username: string, password: string): Promise<string | true> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || errorData.error || "Login failed";
        console.error("API ERROR:", errorData);
        return errorMessage;
      }

      const data = await response.json();
      setAuthToken(data.accessToken);
      queryClient.clear();
      setUser(data.user);
      setAccessToken(data.accessToken);
      setCanChangeScope(data.canChangeScope);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return "Network error – try again";
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (accessToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAuthToken(null);
      setAccessToken(null);
      setUser(null);
      setCanChangeScope(false);
      queryClient.clear();
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<string | true> => {
    if (!accessToken) return "Not authenticated";

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return errorData.error || "Failed to change password";
      }

      return true;
    } catch (error) {
      console.error("Change password error:", error);
      return "Network error – try again";
    }
  };

  const updateScope = async (shopId: string, branchId: string, warehouseId: string): Promise<boolean> => {
    if (!accessToken || !canChangeScope) return false;

    try {
      const response = await fetch("/api/auth/scope", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ shopId, branchId, warehouseId }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      setAuthToken(data.accessToken);
      setUser(data.user);
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthReady,
        canChangeScope,
        accessToken,
        login,
        logout,
        changePassword,
        updateScope,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
