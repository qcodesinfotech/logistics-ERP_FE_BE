import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  Building2, Plus, Edit, Trash2, Eye, Landmark, Phone, FileText, Download, Trash, Globe, ShieldAlert, Loader2, CheckCircle, CreditCard, Upload
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/permissions-context";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Supplier, Purchase } from "@shared/schema";

// Form validation schema
const supplierFormSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  companyName: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  vatNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  openingBalance: z.string().default("0.000"),
  status: z.string().default("active"),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

export default function SuppliersPage() {
  const [location, setLocation] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const { hasReadPermission, hasWritePermission, isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const hasRead = hasReadPermission("suppliers") || isSuperAdmin;
  const hasWrite = hasWritePermission("suppliers") || isSuperAdmin;

  // Retrieve Suppliers
  const { data: suppliersList = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: hasRead,
  });

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: "",
      companyName: "",
      email: "",
      phone: "",
      vatNumber: "",
      address: "",
      openingBalance: "0.000",
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: SupplierFormData) => apiRequest("POST", "/api/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Supplier created successfully." });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Failed to create supplier", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: SupplierFormData & { id: string }) => 
      apiRequest("PATCH", `/api/suppliers/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${editingSupplier?.id}`] });
      toast({ title: "Supplier updated successfully." });
      setIsDialogOpen(false);
      setEditingSupplier(null);
      form.reset();
    },
    onError: (error) => {
      toast({ title: "Failed to update supplier", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Supplier deleted successfully." });
      setDeletingSupplier(null);
    },
    onError: (error) => {
      toast({ title: "Failed to delete supplier", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const openCreateDialog = () => {
    setLocation("/logistics/vendors/new");
  };

  const openEditDialog = (supplier: Supplier) => {
    setLocation(`/logistics/vendors/${supplier.id}/edit`);
  };

  const onSubmit = (data: SupplierFormData) => {
    if (editingSupplier) {
      updateMutation.mutate({ ...data, id: editingSupplier.id });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!hasRead) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
            <CardDescription>You do not have permission to view the Suppliers module.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // If dynamic id is present in the route, render the Details View
  if (id) {
    return <SupplierDetailsView id={id} setLocation={setLocation} hasWrite={hasWrite} />;
  }

  const filteredSuppliers = suppliersList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.companyName && s.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Vendors Master
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage logistics vendors and purchase ledgers.
          </p>
        </div>
        {hasWrite && (
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Add Vendor
          </Button>
        )}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Vendors List</CardTitle>
              <CardDescription>Showing all registered vendors</CardDescription>
            </div>
            <Input
              placeholder="Search by name, company or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading vendors...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
              <Building2 className="h-10 w-10 opacity-25" />
              <p className="text-sm">No vendors found.</p>
              {hasWrite && (
                <Button variant="outline" onClick={openCreateDialog} className="gap-2 mt-1">
                  <Plus className="h-4 w-4" /> Add Vendor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone / Email</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow 
                    key={supplier.id}
                    onClick={() => setLocation(`/logistics/vendors/${supplier.id}`)}
                    className="cursor-pointer hover:bg-accent/30 transition-colors"
                  >
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.companyName || "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{supplier.phone || "—"}</div>
                      {supplier.email && <div className="text-xs text-muted-foreground">{supplier.email}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{parseFloat(supplier.openingBalance || "0").toFixed(3)} BD</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-amber-700">{parseFloat(supplier.currentBalance || "0").toFixed(3)} BD</TableCell>
                    <TableCell><StatusBadge status={supplier.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/logistics/vendors/${supplier.id}`)} title="View Transactions">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {hasWrite && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(supplier)} title="Edit Vendor">
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingSupplier(supplier)} title="Delete Vendor">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>



      {/* Delete Alert Dialog */}
      <AlertDialog open={!!deletingSupplier} onOpenChange={(o) => !o && setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the supplier record from the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingSupplier && deleteMutation.mutate(deletingSupplier.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Supplier Details subview component
interface SupplierDetailsViewProps {
  id: string;
  setLocation: (loc: string) => void;
  hasWrite: boolean;
}

function SupplierDetailsView({ id, setLocation, hasWrite }: SupplierDetailsViewProps) {
  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: [`/api/suppliers/${id}`],
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground text-sm mt-2">Loading supplier details...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="Vendor not found"
          description="The requested vendor does not exist in the database."
        >
          <Button onClick={() => setLocation("/logistics/vendors")}>Back to List</Button>
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={supplier.name}
        description={`Vendor Profile & Transactions`}
      >
        <Button variant="outline" onClick={() => setLocation("/logistics/vendors")}>
          Back to List
        </Button>
      </PageHeader>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
          <TabsTrigger value="transactions">Transactions Ledger</TabsTrigger>
        </TabsList>

        {/* Profile Details Tab */}
        <TabsContent value="profile">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              {/* Supplier Info */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Supplier Identification</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Supplier Name</span>
                    <span className="font-semibold text-foreground">{supplier.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Company Name</span>
                    <span className="font-semibold text-foreground">{supplier.companyName || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">VAT Number</span>
                    <span className="font-semibold font-mono text-sm">{supplier.vatNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Status</span>
                    <div className="mt-1"><StatusBadge status={supplier.status} /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Contact & Address</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Phone Number</span>
                    <span className="font-semibold">{supplier.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Email Address</span>
                    <span className="font-semibold">{supplier.email || "N/A"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Address</span>
                    <p className="font-medium">{supplier.address || "N/A"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial Info */}
            <div>
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Financial Profile</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Opening Balance</span>
                    <span className="font-semibold font-mono">{parseFloat(supplier.openingBalance || "0").toFixed(3)} BD</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Current Balance</span>
                    <span className="font-bold text-amber-700 font-mono text-base">{parseFloat(supplier.currentBalance || "0").toFixed(3)} BD</span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 italic">
                    Current outstanding balance is dynamically updated through purchase transactions and payments.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <SupplierTransactionsLedger id={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SupplierTransactionsLedger({ id }: { id: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  // State for Purchase Dialog
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [purchaseInvoiceDate, setPurchaseInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState(0);
  const [purchaseVatRate, setPurchaseVatRate] = useState(5);
  const [purchaseDiscount, setPurchaseDiscount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  // State for Payment Dialog
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedPurchaseRef, setSelectedPurchaseRef] = useState("");
  const [selectedPurchaseTotal, setSelectedPurchaseTotal] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentBankAccountId, setPaymentBankAccountId] = useState("");
  const [paymentPettyCashId, setPaymentPettyCashId] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Queries
  const { data: myScope } = useQuery<any>({ queryKey: ["/api/my-scope"] });
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: bankAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/bank-accounts"] });
  const { data: pettyCash = [] } = useQuery<any[]>({ queryKey: ["/api/petty-cash"] });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });

  const { data: paymentTransactions = [], isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: [`/api/suppliers/${id}/payment-transactions`],
  });

  const { data: obPayments = [], isLoading: obLoading } = useQuery<any[]>({
    queryKey: [`/api/suppliers/${id}/opening-balance-payments`],
  });

  const { data: creditRefunds = [], isLoading: refundsLoading } = useQuery<any[]>({
    queryKey: [`/api/suppliers/${id}/credit-refunds`],
  });

  const isLoading = purchasesLoading || paymentsLoading || obLoading || refundsLoading;

  // Filter supplier purchase invoices
  const supplierPurchases = purchases.filter(p => p.supplierId === id);

  // Consolidate all supplier ledger entries chronologically
  const consolidatedLedger: {
    id: string;
    date: Date;
    type: string;
    refNo: string;
    debit?: number; // Payments/Refunds decrease liability
    credit?: number; // Purchase invoices increase liability
    status?: string;
    approvalStatus?: string;
    file?: string | null;
  }[] = [];

  // 1. Add Purchase Invoices (increases liability -> Credit)
  supplierPurchases.forEach(p => {
    consolidatedLedger.push({
      id: p.id,
      date: new Date(p.purchaseDate || p.date || Date.now()),
      type: "Purchase Invoice",
      refNo: p.purchaseNumber,
      credit: parseFloat(p.grandTotal || p.total || p.subtotal || "0"),
      status: p.paymentStatus || "pending",
      approvalStatus: p.status || "pending",
      file: p.file || null,
    });
  });

  // 2. Add Supplier Payments (decreases liability -> Debit)
  paymentTransactions.forEach(t => {
    consolidatedLedger.push({
      id: t.id,
      date: new Date(t.date || t.createDate || Date.now()),
      type: "Supplier Payment",
      refNo: t.entryNumber || t.reference || "PAY",
      debit: parseFloat(t.amount || "0"),
      status: "paid",
      approvalStatus: "approved",
    });
  });

  // 3. Add Opening Balance Payments (decreases liability -> Debit)
  obPayments.forEach(t => {
    consolidatedLedger.push({
      id: t.id,
      date: new Date(t.date || t.createDate || Date.now()),
      type: "Opening Balance Payment",
      refNo: t.entryNumber || t.reference || "OB-PAY",
      debit: parseFloat(t.amount || "0"),
      status: "paid",
      approvalStatus: "approved",
    });
  });

  // 4. Add Credit Refunds (decreases liability -> Debit)
  creditRefunds.forEach(t => {
    consolidatedLedger.push({
      id: t.id,
      date: new Date(t.refundDate || t.createDate || Date.now()),
      type: "Credit Refund",
      refNo: t.refundNumber || "RFD",
      debit: parseFloat(t.amount || "0"),
      status: "refunded",
      approvalStatus: "approved",
    });
  });

  // Sort consolidated ledger chronologically (newest first)
  consolidatedLedger.sort((a, b) => b.date.getTime() - a.date.getTime());

  // File Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiRequest("POST", "/api/upload/invoice", formData);
      const data = await res.json();
      setUploadedFileUrl(data.url);
      setUploadedFilename(data.filename);
      toast({ title: "Invoice attachment uploaded successfully." });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Purchase Mutation
  const createPurchaseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/purchases", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${id}`] });
      toast({ title: "Purchase invoice recorded successfully and sent for approval." });
      setIsPurchaseDialogOpen(false);
      resetPurchaseForm();
    },
    onError: (error) => {
      toast({
        title: "Failed to record purchase invoice",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const resetPurchaseForm = () => {
    setPurchaseInvoiceNo("");
    setPurchaseInvoiceDate(new Date().toISOString().split("T")[0]);
    setPurchaseNotes("");
    setSelectedWarehouseId("");
    setSelectedProductId("");
    setPurchaseQty(1);
    setPurchaseUnitPrice(0);
    setPurchaseVatRate(5);
    setPurchaseDiscount(0);
    setUploadedFileUrl(null);
    setUploadedFilename(null);
  };

  // Approve Mutation
  const approvePurchaseMutation = useMutation({
    mutationFn: (purchaseId: string) => apiRequest("POST", `/api/purchases/${purchaseId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${id}`] });
      toast({ title: "Purchase invoice approved successfully. Inventory and ledger updated." });
    },
    onError: (error) => {
      toast({
        title: "Failed to approve purchase invoice",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Pay Mutation
  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/purchases/${selectedPurchaseId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${id}/payment-transactions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/suppliers/${id}`] });
      toast({ title: "Vendor payment recorded successfully." });
      setIsPayDialogOpen(false);
      resetPayForm();
    },
    onError: (error) => {
      toast({
        title: "Failed to record payment",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const resetPayForm = () => {
    setSelectedPurchaseId(null);
    setSelectedPurchaseRef("");
    setSelectedPurchaseTotal(0);
    setPaymentAmount(0);
    setPaymentMethod("bank_transfer");
    setPaymentBankAccountId("");
    setPaymentPettyCashId("");
    setPaymentNotes("");
  };

  const purchaseSubtotal = purchaseQty * purchaseUnitPrice - purchaseDiscount;
  const purchaseVatAmount = purchaseSubtotal * (purchaseVatRate / 100);
  const purchaseTotal = purchaseSubtotal + purchaseVatAmount;

  return (
    <Card>
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-primary">Vendor Transactions Ledger</CardTitle>
          <CardDescription>Chronological purchase and payment transactions history</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsPurchaseDialogOpen(true)} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Record Purchase Invoice
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading ledger entries...</div>
        ) : consolidatedLedger.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 opacity-20" />
            <span>No transactions recorded for this vendor.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ref No / ID</TableHead>
                <TableHead className="text-right">Debit (Paid/Ref)</TableHead>
                <TableHead className="text-right">Credit (Purchased)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consolidatedLedger.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs">
                    {item.date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={item.type.includes("Payment") ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-mono font-medium">
                      {item.refNo}
                      {item.file && (
                        <a href={item.file} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-focus inline-flex items-center" title="View POD file">
                          <FileText className="h-3.5 w-3.5 cursor-pointer ml-1" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-green-700">
                    {item.debit ? `${item.debit.toFixed(3)} BD` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-blue-700">
                    {item.credit ? `${item.credit.toFixed(3)} BD` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.type === "Purchase Invoice" && (
                        <Badge className={item.approvalStatus === "approved" ? "bg-green-100 text-green-800 border-none" : "bg-yellow-100 text-yellow-800 border-none"}>
                          {item.approvalStatus === "approved" ? "Approved" : "Pending Approval"}
                        </Badge>
                      )}
                      {item.status && (item.approvalStatus === "approved" || item.type !== "Purchase Invoice") && (
                        <Badge
                          className={
                            ["paid", "refunded", "completed"].includes(item.status)
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-none"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-none"
                          }
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.type === "Purchase Invoice" && (
                      <div className="flex justify-end gap-1.5">
                        {item.approvalStatus === "pending" && isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            disabled={approvePurchaseMutation.isPending}
                            onClick={() => approvePurchaseMutation.mutate(item.id)}
                          >
                            {approvePurchaseMutation.isPending && approvePurchaseMutation.variables === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            Approve
                          </Button>
                        )}
                        {item.approvalStatus === "approved" && item.status !== "paid" && (
                          <Button
                            size="sm"
                            className="bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                              setSelectedPurchaseId(item.id);
                              setSelectedPurchaseRef(item.refNo);
                              setSelectedPurchaseTotal(item.credit || 0);
                              setPaymentAmount(item.credit || 0);
                              setIsPayDialogOpen(true);
                            }}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Pay
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Supplier Purchase Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNo">Invoice No / Ref</Label>
                <Input
                  id="invoiceNo"
                  value={purchaseInvoiceNo}
                  onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={purchaseInvoiceDate}
                  onChange={(e) => setPurchaseInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse</Label>
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger id="warehouse">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Select value={selectedProductId} onValueChange={(val) => {
                  setSelectedProductId(val);
                  const prod = products.find(p => p.id === val);
                  if (prod) {
                    setPurchaseUnitPrice(parseFloat(prod.purchasePrice || "0"));
                  }
                }}>
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  value={purchaseQty}
                  onChange={(e) => setPurchaseQty(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="price">Unit Price (BD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.001"
                  min="0"
                  value={purchaseUnitPrice}
                  onChange={(e) => setPurchaseUnitPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vatRate">VAT Rate (%)</Label>
                <Input
                  id="vatRate"
                  type="number"
                  value={purchaseVatRate}
                  onChange={(e) => setPurchaseVatRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Discount (BD)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.001"
                  value={purchaseDiscount}
                  onChange={(e) => setPurchaseDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice POD / Attachment</Label>
              <div className="flex items-center gap-4 border p-3 rounded-lg bg-muted/40">
                <Label htmlFor="pod-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploadedFilename ? "Change Invoice POD File" : "Upload Invoice POD File"}
                  </div>
                </Label>
                <input
                  id="pod-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                {uploadedFilename && (
                  <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                    {uploadedFilename}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                placeholder="Internal notes or description"
              />
            </div>

            <div className="border-t pt-4 mt-2 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">{purchaseSubtotal.toFixed(3)} BD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>VAT Amount:</span>
                <span className="font-mono font-semibold">{purchaseVatAmount.toFixed(3)} BD</span>
              </div>
              <div className="flex justify-between text-base font-bold text-primary">
                <span>Invoice Total:</span>
                <span className="font-mono">{purchaseTotal.toFixed(3)} BD</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createPurchaseMutation.isPending || !selectedProductId || !selectedWarehouseId || !purchaseInvoiceNo}
              onClick={() => {
                createPurchaseMutation.mutate({
                  supplierId: id,
                  shopId: myScope?.shopId || "1",
                  branchId: myScope?.branchId || null,
                  warehouseId: selectedWarehouseId,
                  invoiceNo: purchaseInvoiceNo,
                  invoiceDate: purchaseInvoiceDate,
                  notes: purchaseNotes,
                  file: uploadedFileUrl,
                  subtotal: purchaseSubtotal,
                  vatAmount: purchaseVatAmount,
                  total: purchaseTotal,
                  items: [
                    {
                      productId: selectedProductId,
                      quantity: purchaseQty,
                      unitPrice: purchaseUnitPrice,
                      vatRate: purchaseVatRate,
                      discount: purchaseDiscount,
                      total: purchaseTotal
                    }
                  ]
                });
              }}
            >
              {createPurchaseMutation.isPending ? "Saving..." : "Save Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment for {selectedPurchaseRef}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Invoice Total</Label>
              <Input value={`${selectedPurchaseTotal.toFixed(3)} BD`} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payAmount">Payment Amount (BD)</Label>
              <Input
                id="payAmount"
                type="number"
                step="0.001"
                min="0.001"
                max={selectedPurchaseTotal}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(val) => {
                setPaymentMethod(val);
                if (val === "bank_transfer") {
                  setPaymentPettyCashId("");
                } else {
                  setPaymentBankAccountId("");
                }
              }}>
                <SelectTrigger id="payMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Petty Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "bank_transfer" ? (
              <div className="space-y-2">
                <Label htmlFor="bankAcc">Select Bank Account</Label>
                <Select value={paymentBankAccountId} onValueChange={setPaymentBankAccountId}>
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
                <Label htmlFor="cashBox">Select Cash Box</Label>
                <Select value={paymentPettyCashId} onValueChange={setPaymentPettyCashId}>
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
              <Label htmlFor="payNotes">Notes / Reference</Label>
              <Input
                id="payNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Transaction reference or notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createPaymentMutation.isPending ||
                paymentAmount <= 0 ||
                (paymentMethod === "bank_transfer" && !paymentBankAccountId) ||
                (paymentMethod === "cash" && !paymentPettyCashId)
              }
              onClick={() => {
                createPaymentMutation.mutate({
                  amount: paymentAmount,
                  paymentMethod,
                  bankAccountId: paymentMethod === "bank_transfer" ? paymentBankAccountId : paymentPettyCashId,
                  notes: paymentNotes,
                });
              }}
            >
              {createPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
