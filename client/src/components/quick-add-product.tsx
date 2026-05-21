import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useGlobalScope } from "@/contexts/global-scope";
import { useAuth } from "@/contexts/auth-context";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string | null;
  status: string;
}

interface QuickAddProductProps {
  onProductCreated: (productId: string, productName: string) => void;
  disabled?: boolean;
}

const ALLOWED_ROLES = ["super_admin", "admin", "manager", "purchase_executive", "sales_executive"];

export function QuickAddProduct({ onProductCreated, disabled = false }: QuickAddProductProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const { toast } = useToast();
  const { currentShopId, currentBranchId, currentWarehouseId } = useGlobalScope();
  const { user } = useAuth();

  const hasPermission = user && ALLOWED_ROLES.includes(user.role);
  const scopeValid = currentShopId && currentBranchId;

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isOpen,
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
    enabled: isOpen,
  });

  const parentCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId === categoryId);

  useEffect(() => {
    if (categoryId) {
      setSubCategoryId("");
    }
  }, [categoryId]);

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      categoryId: string;
      subcatId: string;
      unitId: string;
      shopId: string;
      branchId: string;
      warehouseId: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/products/quick-create", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product created successfully" });
      onProductCreated(data.id, data.name);
      resetAndClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create product",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const resetAndClose = () => {
    setProductName("");
    setCategoryId("");
    setSubCategoryId("");
    setUnitId("");
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (!unitId) {
      toast({ title: "Unit is required", variant: "destructive" });
      return;
    }
    if (!currentShopId || !currentBranchId) {
      toast({ title: "Shop and Branch must be selected in the header", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      name: productName.trim(),
      categoryId: categoryId || "",
      subcatId: subCategoryId || "",
      unitId,
      shopId: currentShopId,
      branchId: currentBranchId,
      warehouseId: currentWarehouseId || null,
    });
  };

  if (!hasPermission) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled || !scopeValid}
        title={!scopeValid ? "Select Shop and Branch in header first" : "Quick add a new product"}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quick Add Product
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name *</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {parentCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {categoryId && subCategories.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subCategory">Sub-Category</Label>
                <Select value={subCategoryId} onValueChange={setSubCategoryId}>
                  <SelectTrigger id="subCategory">
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="unit">Unit *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units
                    .filter((u) => u.status === "active")
                    .map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name} {unit.abbreviation && `(${unit.abbreviation})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              Product will be created for: {currentShopId ? "Current Shop" : "No shop"} / {currentBranchId ? "Current Branch" : "No branch"}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
