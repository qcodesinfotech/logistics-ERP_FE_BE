import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  FileCheck, 
  Plus, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  CreditCard, 
  Loader2, 
  Calendar, 
  Building2, 
  ArrowRight, 
  Trash2, 
  ChevronRight, 
  FileText,
  AlertCircle,
  Edit2,
  List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { useGlobalScope } from "@/contexts/global-scope";
import { QuickAddProduct } from "@/components/quick-add-product";

// Items inside Purchase Order Schema
const poItemSchema = z.object({
  productId: z.string().optional(),
  isCustom: z.boolean().optional().default(false),
  customName: z.string().optional(),
  quantity: z.string().transform(v => parseInt(v, 10) || 0).or(z.number()),
  unitPrice: z.string().transform(v => parseFloat(v) || 0).or(z.number()),
  vatRate: z.string().transform(v => parseFloat(v) || 0).or(z.number()),
  discount: z.string().transform(v => parseFloat(v) || 0).or(z.number()),
}).refine(data => {
  if (data.isCustom) {
    return !!data.customName?.trim();
  }
  return !!data.productId;
}, {
  message: "Product is required",
  path: ["productId"]
});

// Main Purchase Order Form Schema
const purchaseOrderFormSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1, "At least one item is required"),
});

type POFormData = z.input<typeof purchaseOrderFormSchema>;

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentShopId, currentBranchId, filteredWarehouses, warehouses } = useGlobalScope();
  const displayWarehouses = filteredWarehouses.length > 0 ? filteredWarehouses : warehouses;

  // Role Checks
  const isSupervisor = user?.role === "super_admin" || user?.role === "admin" || user?.role === "manager";

  // Page States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);

  // Pay Dialog State
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [payPettyCashId, setPayPettyCashId] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Queries
  const { data: purchaseOrders = [], isLoading: posLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: pettyCash = [] } = useQuery<any[]>({
    queryKey: ["/api/petty-cash"],
  });

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
  });

  const displayDestinations = useMemo(() => {
    const list: { id: string; name: string; type: "warehouse" | "truck" }[] = [];
    
    // Add warehouses
    displayWarehouses.forEach((w: any) => {
      list.push({ id: w.id, name: `${w.name} (Warehouse)`, type: "warehouse" });
    });
    
    // Add vehicles (trucks)
    vehicles.forEach((v: any) => {
      list.push({ id: v.id, name: `${v.name} - ${v.plateNumber} (Truck)`, type: "truck" });
    });
    
    return list;
  }, [displayWarehouses, vehicles]);

  // Query linked purchase invoice for payment details
  const { data: linkedPurchase } = useQuery<any>({
    queryKey: [`/api/purchase-orders/${selectedPO?.id}/purchase`],
    enabled: !!selectedPO && selectedPO.status === "converted",
  });

  // Outstanding details for the linked purchase invoice
  const { data: purchaseOutstanding } = useQuery<any>({
    queryKey: [`/api/purchases/${linkedPurchase?.id}/outstanding`],
    enabled: !!linkedPurchase?.id,
  });

  // React Hook Form for PO Creation
  const form = useForm<POFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      supplierId: "",
      warehouseId: "",
      notes: "",
      items: [{ productId: "", isCustom: false, customName: "", quantity: 1, unitPrice: 0, vatRate: 5, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Calculate dynamic values for PO item row
  const itemsWatched = useWatch({
    control: form.control,
    name: "items",
  }) || [];
  const poCalculations = useMemo(() => {
    let subtotal = 0;
    let vatAmount = 0;
    let discount = 0;
    let total = 0;

    itemsWatched.forEach((item) => {
      const q = parseFloat(String(item.quantity)) || 0;
      const p = parseFloat(String(item.unitPrice)) || 0;
      const d = parseFloat(String(item.discount)) || 0;
      const vatRate = parseFloat(String(item.vatRate)) || 0;

      const itemSubtotal = q * p - d;
      const itemVat = itemSubtotal * (vatRate / 100);
      const itemTotal = itemSubtotal + itemVat;

      subtotal += itemSubtotal;
      vatAmount += itemVat;
      discount += d;
      total += itemTotal;
    });

    return { subtotal, vatAmount, discount, total };
  }, [itemsWatched]);

  // Mutations
  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      // Map custom names to productId field in the payload and calculate row totals
      const mappedItems = data.items.map((item: any) => {
        const qty = parseFloat(String(item.quantity)) || 0;
        const price = parseFloat(String(item.unitPrice)) || 0;
        const disc = parseFloat(String(item.discount)) || 0;
        const vat = parseFloat(String(item.vatRate)) || 0;
        const total = (qty * price - disc) * (1 + vat / 100);
        return {
          ...item,
          productId: item.isCustom ? item.customName : item.productId,
          total: total.toFixed(3),
        };
      });
      const payload = {
        ...data,
        items: mappedItems,
        shopId: currentShopId,
        branchId: currentBranchId,
        status: "pending",
        subtotal: poCalculations.subtotal,
        vatAmount: poCalculations.vatAmount,
        discount: poCalculations.discount,
        total: poCalculations.total,
      };
      return apiRequest("POST", "/api/purchase-orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase Order created successfully and submitted for approval." });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (err) => {
      toast({
        title: "Failed to create Purchase Order",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const approvePOMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/purchase-orders/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({ title: "Purchase Order approved and converted to purchase invoice successfully." });
      setIsDetailOpen(false);
    },
    onError: (err) => {
      toast({
        title: "Failed to approve Purchase Order",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const rejectPOMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/purchase-orders/${id}/status`, { status: "rejected" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Purchase Order rejected successfully." });
      setIsDetailOpen(false);
    },
    onError: (err) => {
      toast({
        title: "Failed to reject Purchase Order",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/purchases/${linkedPurchase?.id}/payments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash"] });
      toast({ title: "Supplier payment recorded successfully." });
      setIsPayOpen(false);
      // Reset form
      setPayAmount(0);
      setPayNotes("");
      setPayBankAccountId("");
      setPayPettyCashId("");
    },
    onError: (err) => {
      toast({
        title: "Failed to record payment",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  // Filter Purchase Orders
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const supplierName = suppliers.find(s => s.id === po.supplierId)?.name || "";
      const matchesSearch = 
        po.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, suppliers, searchTerm, statusFilter]);

  // Set Pay Dialog initial amount when opened
  const handleOpenPay = (po: any) => {
    setSelectedPO(po);
    setPayAmount(0); // will be filled once outstanding data loads
    setIsPayOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader 
          title="Purchase Orders" 
          description="Manage procurement flows, verify supervisor approvals, and record supplier payments" 
        />
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 self-start md:self-auto bg-primary hover:bg-primary/95 text-white">
          <Plus className="h-4 w-4" /> Create Purchase Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border bg-card/65 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase">Total Orders</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono">{purchaseOrders.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border bg-card/65 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase text-amber-600">Pending Approval</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-amber-600">
              {purchaseOrders.filter(o => o.status === "pending").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border bg-card/65 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase text-emerald-600">Converted Invoices</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-emerald-600">
              {purchaseOrders.filter(o => o.status === "converted").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border bg-card/65 backdrop-blur">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase text-red-600">Rejected Orders</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-red-600">
              {purchaseOrders.filter(o => o.status === "rejected").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className="shadow-md">
        <CardHeader className="pb-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" /> Purchase Orders Ledger
            </CardTitle>
            <CardDescription>Procurement ledger tracking stages from request to settlement</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO no. or supplier..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {posLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span>Loading purchase orders...</span>
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <span className="text-sm font-medium">No purchase orders found matching your search.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.map((po) => {
                  const supplier = suppliers.find(s => s.id === po.supplierId);
                  const warehouse = warehouses.find(w => w.id === po.warehouseId);
                  const vehicle = vehicles.find(v => v.id === po.warehouseId);
                  const destinationName = warehouse 
                    ? `${warehouse.name} (Warehouse)` 
                    : vehicle 
                    ? `${vehicle.name} - ${vehicle.plateNumber} (Truck)` 
                    : "Direct/Unknown";
                  const orderDate = po.orderDate ? new Date(po.orderDate) : new Date();

                  return (
                    <TableRow key={po.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-semibold text-xs">
                        {po.orderNumber}
                      </TableCell>
                      <TableCell className="text-xs">
                        {orderDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {supplier?.name || "Unknown Supplier"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {destinationName}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-blue-700">
                        {parseFloat(po.total).toFixed(3)} BD
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            po.status === "pending" 
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200" 
                              : po.status === "converted" 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : po.status === "approved"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }
                        >
                          {po.status === "pending" ? "Pending Approval" : po.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8" 
                            onClick={() => {
                              setSelectedPO(po);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                          {po.status === "pending" && isSupervisor && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              onClick={() => approvePOMutation.mutate(po.id)}
                              disabled={approvePOMutation.isPending}
                            >
                              {approvePOMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              )}
                              Approve
                            </Button>
                          )}
                          {po.status === "converted" && (
                            <Button 
                              size="sm" 
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleOpenPay(po)}
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Creation Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create Purchase Order</DialogTitle>
            <DialogDescription>Input procurement details. Values are validated against hierarchical scope levels.</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit((data) => createPOMutation.mutate(data))} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplierId" className="font-semibold text-sm">Supplier</Label>
                <Select value={form.watch("supplierId")} onValueChange={(val) => form.setValue("supplierId", val)}>
                  <SelectTrigger id="supplierId">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.supplierId && (
                  <p className="text-xs text-red-500">{form.formState.errors.supplierId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouseId" className="font-semibold text-sm">Destination (Warehouse / Truck)</Label>
                <Select value={form.watch("warehouseId")} onValueChange={(val) => form.setValue("warehouseId", val)}>
                  <SelectTrigger id="warehouseId">
                    <SelectValue placeholder="Select Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {displayDestinations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.warehouseId && (
                  <p className="text-xs text-red-500">{form.formState.errors.warehouseId.message}</p>
                )}
              </div>
            </div>

            {/* Dynamic Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-sm text-primary">Order Items</h3>
                <div className="flex gap-2">
                  <QuickAddProduct 
                    onProductCreated={(id, name) => {
                      append({ productId: id, isCustom: false, customName: "", quantity: 1, unitPrice: 0, vatRate: 5, discount: 0 });
                    }} 
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={() => append({ productId: "", isCustom: false, customName: "", quantity: 1, unitPrice: 0, vatRate: 5, discount: 0 })}
                    className="h-8 gap-1 text-primary hover:text-primary-focus"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Product
                  </Button>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[30%]">Product</TableHead>
                      <TableHead className="w-[15%]">Quantity</TableHead>
                      <TableHead className="w-[15%]">Unit Price (BD)</TableHead>
                      <TableHead className="w-[12%]">VAT Rate (%)</TableHead>
                      <TableHead className="w-[12%]">Discount (BD)</TableHead>
                      <TableHead className="text-right w-[12%]">Total</TableHead>
                      <TableHead className="w-[4%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const itemVal = itemsWatched[index] || {};
                      const qty = parseFloat(String(itemVal.quantity)) || 0;
                      const price = parseFloat(String(itemVal.unitPrice)) || 0;
                      const disc = parseFloat(String(itemVal.discount)) || 0;
                      const vat = parseFloat(String(itemVal.vatRate)) || 0;
                      const rowTotal = (qty * price - disc) * (1 + vat / 100);

                      return (
                        <TableRow key={field.id} className="hover:bg-transparent">
                          <TableCell className="p-2">
                            {form.watch(`items.${index}.isCustom`) ? (
                              <div className="flex items-center gap-1.5">
                                <Input 
                                  placeholder="Enter custom product name..."
                                  className="h-9"
                                  {...form.register(`items.${index}.customName`)}
                                />
                                <Button 
                                  type="button" 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => {
                                    form.setValue(`items.${index}.isCustom`, false);
                                    form.setValue(`items.${index}.customName`, "");
                                  }}
                                  title="Choose from list"
                                  className="h-9 w-9 text-muted-foreground"
                                >
                                  <List className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Select 
                                  value={form.watch(`items.${index}.productId`)} 
                                  onValueChange={(val) => {
                                    form.setValue(`items.${index}.productId`, val);
                                    // Auto-populate unitPrice from product purchasePrice
                                    const selectedProduct = products.find(p => p.id === val);
                                    if (selectedProduct) {
                                      form.setValue(`items.${index}.unitPrice`, parseFloat(selectedProduct.purchasePrice) || 0);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9 flex-1">
                                    <SelectValue placeholder="Select Product" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button 
                                  type="button" 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => {
                                    form.setValue(`items.${index}.isCustom`, true);
                                    form.setValue(`items.${index}.productId`, "custom"); // dummy to bypass select validation
                                  }}
                                  title="Type custom product"
                                  className="h-9 w-9 text-muted-foreground"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number" 
                              className="h-9 font-mono" 
                              min="1"
                              {...form.register(`items.${index}.quantity`)}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number" 
                              step="0.001" 
                              className="h-9 font-mono" 
                              min="0"
                              {...form.register(`items.${index}.unitPrice`)}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number" 
                              className="h-9 font-mono" 
                              min="0"
                              {...form.register(`items.${index}.vatRate`)}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input 
                              type="number" 
                              step="0.001" 
                              className="h-9 font-mono" 
                              min="0"
                              {...form.register(`items.${index}.discount`)}
                            />
                          </TableCell>
                          <TableCell className="p-2 text-right font-mono font-semibold text-sm">
                            {rowTotal.toFixed(3)}
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            {fields.length > 1 && (
                              <Button 
                                type="button" 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => remove(index)}
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="notes" className="font-semibold text-sm">Order Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Terms, dispatch details, or general notes" 
                  rows={4}
                  {...form.register("notes")} 
                />
              </div>

              {/* Summary calculations */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-2.5">
                <div className="flex justify-between text-sm border-b pb-1.5">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-semibold">{poCalculations.subtotal.toFixed(3)} BD</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-1.5">
                  <span className="text-muted-foreground">Discount Applied</span>
                  <span className="font-mono font-semibold text-red-600">-{poCalculations.discount.toFixed(3)} BD</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-1.5">
                  <span className="text-muted-foreground">VAT Amount</span>
                  <span className="font-mono font-semibold">{poCalculations.vatAmount.toFixed(3)} BD</span>
                </div>
                <div className="flex justify-between text-base pt-1 font-bold">
                  <span>Grand Total</span>
                  <span className="font-mono text-primary text-lg">{poCalculations.total.toFixed(3)} BD</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createPOMutation.isPending} 
                className="bg-primary hover:bg-primary/95 text-white"
              >
                {createPOMutation.isPending ? "Creating PO..." : "Save & Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPO && (
            <>
              <DialogHeader className="border-b pb-3 flex flex-row items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-1.5">
                    Order Details: <span className="font-mono">{selectedPO.orderNumber}</span>
                  </DialogTitle>
                  <DialogDescription>
                    Created on {new Date(selectedPO.orderDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </DialogDescription>
                </div>
                <Badge 
                  className={
                    selectedPO.status === "pending" 
                      ? "bg-yellow-100 text-yellow-800" 
                      : selectedPO.status === "converted" 
                      ? "bg-green-100 text-green-800" 
                      : selectedPO.status === "approved"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {selectedPO.status.toUpperCase()}
                </Badge>
              </DialogHeader>

              <div className="py-4 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Supplier</span>
                    <span className="font-bold text-primary flex items-center gap-1">
                      <Building2 className="h-4 w-4" /> 
                      {suppliers.find(s => s.id === selectedPO.supplierId)?.name || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Destination</span>
                    <span className="font-medium text-foreground">
                      {(() => {
                        const warehouse = warehouses.find(w => w.id === selectedPO.warehouseId);
                        const vehicle = vehicles.find(v => v.id === selectedPO.warehouseId);
                        return warehouse 
                          ? `${warehouse.name} (Warehouse)` 
                          : vehicle 
                          ? `${vehicle.name} - ${vehicle.plateNumber} (Truck)` 
                          : "Direct/Unknown";
                      })()}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-primary">Line Items</h4>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price (BD)</TableHead>
                          <TableHead className="text-right">VAT Rate</TableHead>
                          <TableHead className="text-right">Discount</TableHead>
                          <TableHead className="text-right">Total (BD)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseOrders.find(o => o.id === selectedPO.id)?.items?.map((item: any, idx: number) => {
                          const product = products.find(p => p.id === item.productId);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{product?.name || item.productId || "Unknown"}</TableCell>
                              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="text-right font-mono">{parseFloat(item.unitPrice).toFixed(3)}</TableCell>
                              <TableCell className="text-right font-mono">{parseFloat(item.vatRate).toFixed(1)}%</TableCell>
                              <TableCell className="text-right font-mono">{parseFloat(item.discount).toFixed(3)}</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-blue-700">
                                {parseFloat(item.total).toFixed(3)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card p-3 rounded-lg border">
                    <span className="text-muted-foreground block text-xs font-semibold uppercase mb-1">Notes</span>
                    <p className="text-sm whitespace-pre-line italic text-muted-foreground">
                      {selectedPO.notes || "No notes provided."}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-sm p-4 bg-muted/40 rounded-lg">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono font-medium">{parseFloat(selectedPO.subtotal).toFixed(3)} BD</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Discount Applied:</span>
                      <span className="font-mono font-medium text-red-600">-{parseFloat(selectedPO.discount).toFixed(3)} BD</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">VAT Amount:</span>
                      <span className="font-mono font-medium">{parseFloat(selectedPO.vatAmount).toFixed(3)} BD</span>
                    </div>
                    <div className="flex justify-between pt-1.5 font-bold text-base text-primary">
                      <span>Total Amount:</span>
                      <span className="font-mono">{parseFloat(selectedPO.total).toFixed(3)} BD</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row gap-2">
                <div className="flex gap-2 w-full justify-between sm:justify-end">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                    Close
                  </Button>
                  
                  {selectedPO.status === "pending" && isSupervisor && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        onClick={() => rejectPOMutation.mutate(selectedPO.id)}
                        disabled={rejectPOMutation.isPending}
                      >
                        {rejectPOMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-1" />
                        )}
                        Reject
                      </Button>
                      <Button 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approvePOMutation.mutate(selectedPO.id)}
                        disabled={approvePOMutation.isPending}
                      >
                        {approvePOMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Approve & Convert
                      </Button>
                    </div>
                  )}

                  {selectedPO.status === "converted" && (
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        setIsDetailOpen(false);
                        handleOpenPay(selectedPO);
                      }}
                    >
                      <CreditCard className="h-4 w-4 mr-1" /> Pay Order
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedPO && (
            <>
              <DialogHeader>
                <DialogTitle>Record Payment for PO {selectedPO.orderNumber}</DialogTitle>
                <DialogDescription>
                  {linkedPurchase ? (
                    <span>Paying against Purchase Invoice <span className="font-mono font-semibold">{linkedPurchase.purchaseNumber}</span></span>
                  ) : (
                    <span>Locating converted invoice details...</span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {linkedPurchase && purchaseOutstanding ? (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 p-3 bg-muted/40 rounded-lg border text-sm">
                      <span className="text-xs text-muted-foreground block font-medium uppercase">Total Invoice</span>
                      <span className="font-mono font-bold">{parseFloat(purchaseOutstanding.totalInvoiceAmount || "0").toFixed(3)} BD</span>
                    </div>
                    <div className="space-y-1.5 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                      <span className="text-xs text-amber-600 block font-medium uppercase">Outstanding</span>
                      <span className="font-mono font-bold text-amber-700">{parseFloat(purchaseOutstanding.outstandingAmount || "0").toFixed(3)} BD</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payAmount" className="font-medium text-sm">Payment Amount (BD)</Label>
                    <Input
                      id="payAmount"
                      type="number"
                      step="0.001"
                      min="0.001"
                      max={parseFloat(purchaseOutstanding.outstandingAmount)}
                      value={payAmount || ""}
                      onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    />
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setPayAmount(parseFloat(purchaseOutstanding.outstandingAmount))}
                        className="text-xs h-7"
                      >
                        Pay Full Outstanding
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payMethod" className="font-medium text-sm">Payment Method</Label>
                    <Select value={payMethod} onValueChange={(val) => {
                      setPayMethod(val);
                      if (val === "bank_transfer") {
                        setPayPettyCashId("");
                      } else {
                        setPayBankAccountId("");
                      }
                    }}>
                      <SelectTrigger id="payMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer / Online</SelectItem>
                        <SelectItem value="cash">Petty Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {payMethod === "bank_transfer" ? (
                    <div className="space-y-2">
                      <Label htmlFor="bankAcc" className="font-medium text-sm">Select Bank Account</Label>
                      <Select value={payBankAccountId} onValueChange={setPayBankAccountId}>
                        <SelectTrigger id="bankAcc">
                          <SelectValue placeholder="Select Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} - {b.accountNumber} ({parseFloat(b.currentBalance).toFixed(3)} BD)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="cashBox" className="font-medium text-sm">Select Cash Box</Label>
                      <Select value={payPettyCashId} onValueChange={setPayPettyCashId}>
                        <SelectTrigger id="cashBox">
                          <SelectValue placeholder="Select Petty Cash" />
                        </SelectTrigger>
                        <SelectContent>
                          {pettyCash.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({parseFloat(c.currentBalance).toFixed(3)} BD)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="payNotes" className="font-medium text-sm">Notes / Reference</Label>
                    <Input
                      id="payNotes"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="Transaction reference or payment details"
                    />
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Loading outstanding invoice balances...</span>
                </div>
              )}

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setIsPayOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    recordPaymentMutation.isPending ||
                    payAmount <= 0 ||
                    !linkedPurchase?.id ||
                    (payMethod === "bank_transfer" && !payBankAccountId) ||
                    (payMethod === "cash" && !payPettyCashId)
                  }
                  onClick={() => {
                    recordPaymentMutation.mutate({
                      amount: payAmount,
                      paymentMethod: payMethod,
                      bankAccountId: payMethod === "bank_transfer" ? payBankAccountId : payPettyCashId,
                      notes: payNotes,
                    });
                  }}
                  className="bg-primary hover:bg-primary/95 text-white"
                >
                  {recordPaymentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Record Payment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
