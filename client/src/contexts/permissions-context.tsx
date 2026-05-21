import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

interface Permission {
  menuKey: string;
  canRead: boolean;
  canWrite: boolean;
}

interface PermissionsContextType {
  permissions: Map<string, Permission>;
  isSuperAdmin: boolean;
  isLoading: boolean;
  hasReadPermission: (menuKey: string) => boolean;
  hasWritePermission: (menuKey: string) => boolean;
  refetchPermissions: () => void;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [permissionsMap, setPermissionsMap] = useState<Map<string, Permission>>(new Map());

  const { data, isLoading, refetch } = useQuery<{ isSuperAdmin: boolean; permissions: Permission[] }>({
    queryKey: ["/api/rbac/my-permissions"],
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  useEffect(() => {
    if (data?.permissions) {
      const map = new Map<string, Permission>();
      for (const perm of data.permissions) {
        map.set(perm.menuKey, perm);
      }
      setPermissionsMap(map);
    }
  }, [data]);

  const hasReadPermission = (menuKey: string): boolean => {
    if (!isAuthenticated) return false;
    if (user?.role === "super_admin" || data?.isSuperAdmin) return true;
    const perm = permissionsMap.get(menuKey);
    return perm?.canRead ?? false;
  };

  const hasWritePermission = (menuKey: string): boolean => {
    if (!isAuthenticated) return false;
    if (user?.role === "super_admin" || data?.isSuperAdmin) return true;
    const perm = permissionsMap.get(menuKey);
    return perm?.canWrite ?? false;
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions: permissionsMap,
        isSuperAdmin: user?.role === "super_admin" || data?.isSuperAdmin || false,
        isLoading,
        hasReadPermission,
        hasWritePermission,
        refetchPermissions: refetch,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}
