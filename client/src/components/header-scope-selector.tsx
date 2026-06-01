import { useGlobalScope } from "@/contexts/global-scope";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Warehouse, Lock, Building, Store } from "lucide-react";

export function HeaderScopeSelector() {
  const {
    companies,
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
    canChangeScope,
  } = useGlobalScope();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Company Selector */}
      <div className="flex items-center gap-1.5">
        <Building className="h-4 w-4 text-muted-foreground" />
        {canChangeScope && companies.length > 0 ? (
          <Select value={currentCompanyId || ""} onValueChange={setCurrentCompanyId}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-header-company">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
            <Lock className="h-3 w-3" />
            <span>{currentCompany?.name || "No company"}</span>
          </div>
        )}
      </div>



      {/* Branch Selector - Only show if company is selected */}
      {currentCompanyId && (filteredBranches.length > 0 || currentBranch) && (
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {canChangeScope && filteredBranches.length > 0 ? (
            <Select value={currentBranchId || ""} onValueChange={setCurrentBranchId}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-header-branch">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {filteredBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              <Lock className="h-3 w-3" />
              <span>{currentBranch?.name || "No branch"}</span>
            </div>
          )}
        </div>
      )}

      {/* Warehouse Selector - Only show if branch is selected */}
      {currentBranchId && (filteredWarehouses.length > 0 || currentWarehouse) && (
        <div className="flex items-center gap-1.5">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          {canChangeScope && filteredWarehouses.length > 0 ? (
            <Select value={currentWarehouseId || ""} onValueChange={setCurrentWarehouseId}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-header-warehouse">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {filteredWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              <Lock className="h-3 w-3" />
              <span>{currentWarehouse?.name || "No warehouse"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
