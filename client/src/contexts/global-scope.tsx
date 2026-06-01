import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { setGlobalScope, queryClient } from "@/lib/queryClient";
import type { Shop, Branch, Warehouse, Company } from "@shared/schema";

interface UserScopeResponse {
  companyId: string | null;
  shopId: string | null;
  branchId: string | null;
  warehouseId: string | null;
  company: Company | null;
  shop: Shop | null;
  branch: Branch | null;
  warehouse: Warehouse | null;
}

interface GlobalScopeContextType {
  companies: Company[];
  shops: Shop[];
  branches: Branch[];
  warehouses: Warehouse[];
  currentCompanyId: string | null;
  currentShopId: string | null;
  currentBranchId: string | null;
  currentWarehouseId: string | null;
  currentCompany: Company | null;
  currentShop: Shop | null;
  currentBranch: Branch | null;
  currentWarehouse: Warehouse | null;
  setCurrentCompanyId: (id: string | null) => void;
  setCurrentShopId: (id: string | null) => void;
  setCurrentBranchId: (id: string | null) => void;
  setCurrentWarehouseId: (id: string | null) => void;
  filteredShops: Shop[];
  filteredBranches: Branch[];
  filteredWarehouses: Warehouse[];
  isLoading: boolean;
  isScopeReady: boolean;
  canChangeScope: boolean;
}

const GlobalScopeContext = createContext<GlobalScopeContextType | null>(null);

// RBAC: super_admin and admin can change company, shop, branch, and warehouse
// All other users have their scope locked to their assigned shop/branch
const SCOPE_CHANGE_ROLES = ["super_admin", "admin"];

export function GlobalScopeProvider({ children }: { children: ReactNode }) {
  const { user, canChangeScope: authCanChangeScope, isLoading: authIsLoading, isAuthReady } = useAuth();

  // Only super_admin and admin can change scope - all other roles are locked
  const canChangeScope = !!(user?.role && SCOPE_CHANGE_ROLES.includes(user.role));
  const [isScopeReady, setIsScopeReady] = useState(false);

  const [currentCompanyId, setCurrentCompanyIdInternal] = useState<string | null>(null);
  const [currentShopId, setCurrentShopIdInternal] = useState<string | null>(null);
  const [currentBranchId, setCurrentBranchIdInternal] = useState<string | null>(null);
  const [currentWarehouseId, setCurrentWarehouseIdInternal] = useState<string | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [currentWarehouse, setCurrentWarehouse] = useState<Warehouse | null>(null);
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [shopInitialized, setShopInitialized] = useState(false);
  const [branchInitialized, setBranchInitialized] = useState(false);
  const [warehouseInitialized, setWarehouseInitialized] = useState(false);

  // Fetch user's personal scope info (accessible by all authenticated users)
  const { data: myScope, isLoading: myScopeLoading } = useQuery<UserScopeResponse>({
    queryKey: ["/api/my-scope"],
    enabled: !!user,
  });

  useEffect(() => {
    if (authIsLoading) return;

    if (!user) {
      localStorage.removeItem("tt-erp-shop-id");
      localStorage.removeItem("tt-erp-branch-id");
      localStorage.removeItem("tt-erp-warehouse-id");
      localStorage.removeItem("tt-erp-company-id");
      setCurrentCompanyIdInternal(null);
      setCurrentShopIdInternal(null);
      setCurrentBranchIdInternal(null);
      setCurrentWarehouseIdInternal(null);
      setCurrentCompany(null);
      setCurrentShop(null);
      setCurrentBranch(null);
      setCurrentWarehouse(null);
      setScopeInitialized(false);
      setShopInitialized(false);
      setBranchInitialized(false);
      setWarehouseInitialized(false);
      return;
    }

    if (canChangeScope) {
      if (!scopeInitialized) {
        const storedShop = localStorage.getItem("tt-erp-shop-id");
        const storedBranch = localStorage.getItem("tt-erp-branch-id");
        const storedWarehouse = localStorage.getItem("tt-erp-warehouse-id");
        const storedCompany = localStorage.getItem("tt-erp-company-id");
        setCurrentCompanyIdInternal(storedCompany || user.companyId || null);
        setCurrentShopIdInternal(storedShop || user.shopId || null);
        setCurrentBranchIdInternal(storedBranch || user.branchId || null);
        setCurrentWarehouseIdInternal(storedWarehouse || user.warehouseId || null);
      }
    } else {
      localStorage.removeItem("tt-erp-shop-id");
      localStorage.removeItem("tt-erp-branch-id");
      localStorage.removeItem("tt-erp-warehouse-id");
      localStorage.removeItem("tt-erp-company-id");
      setCurrentCompanyIdInternal(user.companyId || null);
      setCurrentShopIdInternal(user.shopId || null);
      setCurrentBranchIdInternal(user.branchId || null);
      setCurrentWarehouseIdInternal(user.warehouseId || null);
    }
    setScopeInitialized(true);
  }, [user, canChangeScope, authIsLoading, scopeInitialized]);

  // Update current entity objects - use myScope for initial/non-admin, use fetched lists for admin
  useEffect(() => {
    if (myScope && !canChangeScope) {
      // Non-admin users: use their assigned scope from myScope
      setCurrentCompany(myScope.company);
      setCurrentShop(myScope.shop);
      setCurrentBranch(myScope.branch);
      setCurrentWarehouse(myScope.warehouse);
    }
  }, [myScope, canChangeScope]);

  const setCurrentCompanyId = (id: string | null) => {
    if (!canChangeScope) return;
    setCurrentCompanyIdInternal(id);
    // STRICT HIERARCHY: When company changes, clear shop, branch and warehouse
    setCurrentShopIdInternal(null);
    setCurrentBranchIdInternal(null);
    setCurrentWarehouseIdInternal(null);
    localStorage.removeItem("tt-erp-shop-id");
    localStorage.removeItem("tt-erp-branch-id");
    localStorage.removeItem("tt-erp-warehouse-id");
    setShopInitialized(false);
    setBranchInitialized(false);
    setWarehouseInitialized(false);
    setCurrentShop(null);
    setCurrentBranch(null);
    setCurrentWarehouse(null);
  };

  const setCurrentShopId = (id: string | null) => {
    if (!canChangeScope) return;
    setCurrentShopIdInternal(id);
    // STRICT HIERARCHY: When shop changes, clear branch and warehouse
    // They will be auto-selected by the useEffect hooks if valid options exist
    setCurrentBranchIdInternal(null);
    setCurrentWarehouseIdInternal(null);
    localStorage.removeItem("tt-erp-branch-id");
    localStorage.removeItem("tt-erp-warehouse-id");
    setBranchInitialized(false);
    setWarehouseInitialized(false);
  };

  const setCurrentBranchId = (id: string | null) => {
    if (!canChangeScope) return;
    setCurrentBranchIdInternal(id);
    
    // Auto-set the underlying shopId based on the selected branch
    if (id) {
      const branch = branches.find(b => b.id === id);
      if (branch && branch.shopId) {
        setCurrentShopIdInternal(branch.shopId);
      }
    }
    
    // STRICT HIERARCHY: When branch changes, clear warehouse
    // It will be auto-selected by the useEffect hook if valid options exist
    setCurrentWarehouseIdInternal(null);
    localStorage.removeItem("tt-erp-warehouse-id");
    setWarehouseInitialized(false);
  };

  const setCurrentWarehouseId = (id: string | null) => {
    if (!canChangeScope) return;
    setCurrentWarehouseIdInternal(id);
  };

  // Only super_admin can fetch all companies/shops/branches/warehouses
  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: canChangeScope && !!user,
  });

  const { data: shops = [], isLoading: shopsLoading } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
    enabled: canChangeScope && !!user,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    enabled: canChangeScope && !!user,
  });

  const { data: warehouses = [], isLoading: warehousesLoading } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
    enabled: canChangeScope && !!user,
  });

  // STRICT HIERARCHY: Shops must filter by Company
  const filteredShops = currentCompanyId
    ? shops.filter((s) => s.companyId === currentCompanyId)
    : [];

  // ALL branches for the current company (temporary: since branches don't have companyId, show all if company is selected)
  const filteredBranches = currentCompanyId
    ? branches
    : [];

  // STRICT HIERARCHY: Warehouses must filter by branch
  const filteredWarehouses = currentBranchId
    ? warehouses.filter((w) => w.branchId === currentBranchId)
    : [];

  // Admin users: update currentShop/currentBranch/currentWarehouse from fetched lists based on selected IDs
  useEffect(() => {
    if (canChangeScope && shops.length > 0 && currentShopId) {
      const shop = shops.find((s) => s.id === currentShopId) || null;
      setCurrentShop(shop);
    }
  }, [canChangeScope, shops, currentShopId]);

  useEffect(() => {
    if (canChangeScope && branches.length > 0 && currentBranchId) {
      const branch = branches.find((b) => b.id === currentBranchId) || null;
      setCurrentBranch(branch);
    } else if (canChangeScope && !currentBranchId) {
      setCurrentBranch(null);
    }
  }, [canChangeScope, branches, currentBranchId]);

  useEffect(() => {
    if (canChangeScope && warehouses.length > 0 && currentWarehouseId) {
      const warehouse = warehouses.find((w) => w.id === currentWarehouseId) || null;
      setCurrentWarehouse(warehouse);
    } else if (canChangeScope && !currentWarehouseId) {
      setCurrentWarehouse(null);
    }
  }, [canChangeScope, warehouses, currentWarehouseId]);

  useEffect(() => {
    if (canChangeScope && currentShopId) {
      localStorage.setItem("tt-erp-shop-id", currentShopId);
    }
  }, [currentShopId, canChangeScope]);

  useEffect(() => {
    if (canChangeScope && currentCompanyId) {
      localStorage.setItem("tt-erp-company-id", currentCompanyId);
    }
  }, [currentCompanyId, canChangeScope]);

  useEffect(() => {
    if (canChangeScope && currentBranchId) {
      localStorage.setItem("tt-erp-branch-id", currentBranchId);
    }
  }, [currentBranchId, canChangeScope]);

  useEffect(() => {
    if (canChangeScope && currentWarehouseId) {
      localStorage.setItem("tt-erp-warehouse-id", currentWarehouseId);
    }
  }, [currentWarehouseId, canChangeScope]);

  const prevScopeRef = useRef<string>("");
  useEffect(() => {
    const scopeKey = `${currentCompanyId}-${currentShopId}-${currentBranchId}-${currentWarehouseId}`;
    setGlobalScope({ companyId: currentCompanyId, shopId: currentShopId, branchId: currentBranchId, warehouseId: currentWarehouseId });

    if (prevScopeRef.current && prevScopeRef.current !== scopeKey) {
      queryClient.invalidateQueries();
    }
    prevScopeRef.current = scopeKey;
  }, [currentCompanyId, currentShopId, currentBranchId, currentWarehouseId]);

  // Auto-select first company if none selected
  useEffect(() => {
    if (canChangeScope && companies.length > 0 && !currentCompanyId) {
      setCurrentCompanyIdInternal(companies[0].id);
      setCurrentCompany(companies[0]);
    }
  }, [companies, currentCompanyId, canChangeScope]);

  // Update currentCompany when companies list or currentCompanyId changes
  useEffect(() => {
    if (canChangeScope && companies.length > 0 && currentCompanyId) {
      const company = companies.find((c) => c.id === currentCompanyId) || null;
      setCurrentCompany(company);
    }
  }, [canChangeScope, companies, currentCompanyId]);

  // Auto-select first shop from filtered list when company changes
  useEffect(() => {
    if (canChangeScope && currentCompanyId && filteredShops.length > 0 && !shopInitialized) {
      const isValidShop = currentShopId && filteredShops.some((s) => s.id === currentShopId);
      if (!isValidShop) {
        setCurrentShopIdInternal(filteredShops[0].id);
      }
      setShopInitialized(true);
    } else if (canChangeScope && filteredShops.length === 0 && currentCompanyId) {
      // No shops for this company, clear shop
      setCurrentShopIdInternal(null);
      setCurrentShop(null);
    }
  }, [filteredShops, currentShopId, currentCompanyId, canChangeScope, shopInitialized]);

  useEffect(() => {
    if (canChangeScope && currentCompanyId && filteredBranches.length > 0 && !branchInitialized) {
      const currentValid = filteredBranches.some((b) => b.id === currentBranchId);
      if (!currentValid) {
        setCurrentBranchIdInternal(filteredBranches[0].id);
        // Also set the underlying shop ID
        if (filteredBranches[0].shopId) {
          setCurrentShopIdInternal(filteredBranches[0].shopId);
        }
      }
      setBranchInitialized(true);
    } else if (canChangeScope && filteredBranches.length === 0 && branchInitialized) {
      setCurrentBranchIdInternal(null);
    }
  }, [currentCompanyId, filteredBranches, currentBranchId, canChangeScope, branchInitialized]);

  useEffect(() => {
    // STRICT HIERARCHY: Warehouse selection depends on branch
    if (canChangeScope && currentBranchId && filteredWarehouses.length > 0 && !warehouseInitialized) {
      const currentValid = filteredWarehouses.some((w) => w.id === currentWarehouseId);
      if (!currentValid) {
        setCurrentWarehouseIdInternal(filteredWarehouses[0].id);
      }
      setWarehouseInitialized(true);
    } else if (canChangeScope && filteredWarehouses.length === 0 && warehouseInitialized) {
      setCurrentWarehouseIdInternal(null);
    }
  }, [currentBranchId, filteredWarehouses, currentWarehouseId, canChangeScope, warehouseInitialized]);

  const isLoading = myScopeLoading || (canChangeScope && (companiesLoading || shopsLoading || branchesLoading || warehousesLoading));

  // Determine when scope is ready for API calls
  useEffect(() => {
    if (!isAuthReady || authIsLoading) {
      setIsScopeReady(false);
      return;
    }

    if (!user) {
      setIsScopeReady(false);
      return;
    }

    // For users who can change scope (super_admin/admin), allow them to proceed
    // even without shops/branches so they can create them
    if (canChangeScope) {
      // If shops data has loaded (even if empty), we're ready
      if (!shopsLoading) {
        setIsScopeReady(true);
      }
    } else {
      // For locked users, scope is ready once user data is loaded
      // Don't require both shopId AND branchId - some users may not have both
      // Just mark as ready since their scope is fixed to whatever they have
      if (!myScopeLoading) {
        setIsScopeReady(true);
      }
    }
  }, [isAuthReady, authIsLoading, user, canChangeScope, currentShopId, currentBranchId, shopsLoading, myScopeLoading]);

  // Update global scope in queryClient when scope is ready
  useEffect(() => {
    if (isScopeReady) {
      setGlobalScope({ companyId: currentCompanyId, shopId: currentShopId, branchId: currentBranchId, warehouseId: currentWarehouseId });
    }
  }, [isScopeReady, currentCompanyId, currentShopId, currentBranchId, currentWarehouseId]);

  return (
    <GlobalScopeContext.Provider
      value={{
        companies,
        shops,
        branches,
        warehouses,
        currentCompanyId,
        currentShopId,
        currentBranchId,
        currentWarehouseId,
        currentCompany,
        currentShop,
        currentBranch,
        currentWarehouse,
        setCurrentCompanyId,
        setCurrentShopId,
        setCurrentBranchId,
        setCurrentWarehouseId,
        filteredShops,
        filteredBranches,
        filteredWarehouses,
        isLoading,
        isScopeReady,
        canChangeScope: !!canChangeScope,
      }}
    >
      {children}
    </GlobalScopeContext.Provider>
  );
}

export function useGlobalScope() {
  const context = useContext(GlobalScopeContext);
  if (!context) {
    throw new Error("useGlobalScope must be used within GlobalScopeProvider");
  }
  return context;
}
