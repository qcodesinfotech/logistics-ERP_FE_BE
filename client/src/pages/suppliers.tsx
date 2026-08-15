import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import {
  Building2, Plus, Edit, Trash2, Eye, Landmark, Phone, FileText, Download, Trash, Globe, ShieldAlert, Loader2
} from "lucide-react";
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
    setEditingSupplier(null);
    form.reset({
      name: "",
      companyName: "",
      email: "",
      phone: "",
      vatNumber: "",
      address: "",
      openingBalance: "0.000",
      status: "active",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.reset({
      name: supplier.name,
      companyName: supplier.companyName || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      vatNumber: supplier.vatNumber || "",
      address: supplier.address || "",
      openingBalance: supplier.openingBalance || "0.000",
      status: supplier.status || "active",
    });
    setIsDialogOpen(true);
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
            Suppliers Master
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage logistics vendor suppliers.
          </p>
        </div>
        {hasWrite && (
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        )}
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Suppliers List</CardTitle>
              <CardDescription>Showing all registered vendor suppliers</CardDescription>
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
            <div className="p-10 text-center text-muted-foreground">Loading suppliers...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
              <Building2 className="h-10 w-10 opacity-25" />
              <p className="text-sm">No suppliers found.</p>
              {hasWrite && (
                <Button variant="outline" onClick={openCreateDialog} className="gap-2 mt-1">
                  <Plus className="h-4 w-4" /> Add Supplier
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
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
                    onClick={() => setLocation(`/logistics/suppliers/${supplier.id}`)}
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
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/logistics/suppliers/${supplier.id}`)} title="View Transactions">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {hasWrite && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(supplier)} title="Edit Supplier">
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingSupplier(supplier)} title="Delete Supplier">
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

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier Details" : "Add New Supplier"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name *</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Al-Jazeera Industrial Co" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Al-Jazeera Group" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input {...field} placeholder="+973 17XXXXXX" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="supplier@email.com" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Number</FormLabel>
                      <FormControl><Input {...field} placeholder="3000XXXXXXXXXXX" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="openingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Balance (BD)</FormLabel>
                      <FormControl><Input {...field} type="number" step="0.001" disabled={!!editingSupplier} className={editingSupplier ? "bg-muted/40" : ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input {...field} placeholder="Building, Road, Block, Area" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingSupplier ? "Save Changes" : "Create Supplier"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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

  // Queries for Supplier Transactions
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
          title="Supplier not found"
          description="The requested supplier does not exist in the database."
        >
          <Button onClick={() => setLocation("/logistics/suppliers")}>Back to List</Button>
        </EmptyState>
      </div>
    );
  }

  // Filter supplier purchase invoices
  const supplierPurchases = purchases.filter(p => p.supplierId === id);

  // Consolidate all supplier ledger entries chronologically
  const consolidatedLedger: {
    date: Date;
    type: string;
    refNo: string;
    debit?: number; // Payments/Refunds decrease liability
    credit?: number; // Purchase invoices increase liability
    status?: string;
  }[] = [];

  // 1. Add Purchase Invoices (increases liability -> Credit)
  supplierPurchases.forEach(p => {
    consolidatedLedger.push({
      date: new Date(p.purchaseDate || p.date || Date.now()),
      type: "Purchase Invoice",
      refNo: p.purchaseNumber,
      credit: parseFloat(p.grandTotal || p.subtotal || "0"),
      status: p.paymentStatus || "pending",
    });
  });

  // 2. Add Supplier Payments (decreases liability -> Debit)
  paymentTransactions.forEach(t => {
    consolidatedLedger.push({
      date: new Date(t.date || t.createDate || Date.now()),
      type: "Supplier Payment",
      refNo: t.entryNumber || t.reference || "PAY",
      debit: parseFloat(t.amount || "0"),
      status: "paid",
    });
  });

  // 3. Add Opening Balance Payments (decreases liability -> Debit)
  obPayments.forEach(t => {
    consolidatedLedger.push({
      date: new Date(t.date || t.createDate || Date.now()),
      type: "Opening Balance Payment",
      refNo: t.entryNumber || t.reference || "OB-PAY",
      debit: parseFloat(t.amount || "0"),
      status: "paid",
    });
  });

  // 4. Add Credit Refunds (decreases liability -> Debit)
  creditRefunds.forEach(t => {
    consolidatedLedger.push({
      date: new Date(t.refundDate || t.createDate || Date.now()),
      type: "Credit Refund",
      refNo: t.refundNumber || "RFD",
      debit: parseFloat(t.amount || "0"),
      status: "refunded",
    });
  });

  // Sort consolidated ledger chronologically (newest first)
  consolidatedLedger.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={supplier.name}
        description={`Supplier Profile & Transactions`}
      >
        <Button variant="outline" onClick={() => setLocation("/logistics/suppliers")}>
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
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Supplier Transactions Ledger</CardTitle>
              <CardDescription>Chronological purchase and payment transactions history</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {purchasesLoading || paymentsLoading || obLoading || refundsLoading ? (
                <div className="p-10 text-center text-muted-foreground">Loading ledger entries...</div>
              ) : consolidatedLedger.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 opacity-20" />
                  <span>No transactions recorded for this supplier.</span>
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
                        <TableCell className="font-mono font-medium">{item.refNo}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-green-700">
                          {item.debit ? `${item.debit.toFixed(3)} BD` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-blue-700">
                          {item.credit ? `${item.credit.toFixed(3)} BD` : "—"}
                        </TableCell>
                        <TableCell>
                          {item.status ? (
                            <Badge
                              className={
                                ["paid", "refunded", "completed"].includes(item.status)
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              }
                            >
                              {item.status}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
