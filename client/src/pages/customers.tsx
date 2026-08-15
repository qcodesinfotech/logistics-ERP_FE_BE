import React, { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Users, Plus, Pencil, Eye, Power, PowerOff, ChevronRight, ChevronLeft, 
  MapPin, Loader2, Download, Trash, FileText, Landmark, Phone, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/loading-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/permissions-context";
import { useAuth } from "@/contexts/auth-context";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import type { Client } from "@shared/schema";

// Form Schema matching db schema and prompt requirements
const customerFormSchema = z.object({
  customerCode: z.string().min(1, "Customer Code is required"),
  name: z.string().min(1, "Customer name is required"),
  tradeName: z.string().optional().default(""),
  customerType: z.enum(["company", "individual"]),
  customerCategory: z.enum(["trucking", "delivery", "both"]),
  status: z.enum(["active", "inactive"]),
  crNumber: z.string().min(1, "CR Number is required"),
  vatNumber: z.string().optional().default(""),
  
  // Contact
  contactPerson: z.string().min(1, "Contact Person is required"),
  designation: z.string().optional().default(""),
  phone: z.string().min(1, "Mobile Number is required"),
  whatsappNumber: z.string().optional().default(""),
  email: z.string().email("Invalid email format").optional().or(z.literal("")).default(""),
  alternativeContact: z.string().optional().default(""),
  contacts: z.array(z.object({
    name: z.string().min(1, "Contact name is required"),
    designation: z.string().optional().default(""),
    phone: z.string().min(1, "Phone / Mobile number is required"),
    whatsapp: z.string().optional().default(""),
    email: z.string().email("Invalid email format").optional().or(z.literal("")).default(""),
  })).optional().default([]),
  
  // Accounts
  accountsContactName: z.string().optional().default(""),
  accountsEmail: z.string().email("Invalid accounts email").optional().or(z.literal("")).default(""),
  accountsContactNumber: z.string().optional().default(""),
  
  // Address
  billingAddress: z.string().min(1, "Billing Address is required"),
  deliveryAddress: z.string().min(1, "Delivery Address is required"),
  buildingNo: z.string().optional().default(""),
  roadStreet: z.string().optional().default(""),
  area: z.string().min(1, "Area is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  
  // GPS
  latitude: z.string().optional().default(""),
  longitude: z.string().optional().default(""),
  
  // Financial
  currency: z.enum(["BHD", "USD", "SAR", "AED"]),
  paymentTerms: z.enum(["Immediate", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"]),
  creditLimit: z.string().optional().default(""),
  openingBalance: z.string().optional().default("0.000"),
  bankName: z.string().optional().default(""),
  iban: z.string().optional().default(""),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

export default function CustomersPage() {
  const [location, setLocation] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { hasReadPermission, hasWritePermission, isSuperAdmin } = usePermissions();

  const [deactivatingCustomer, setDeactivatingCustomer] = useState<Client | null>(null);
  const [activatingCustomer, setActivatingCustomer] = useState<Client | null>(null);

  // Lists state / Pagination & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Retrieve Clients
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: hasReadPermission("customers"),
  });

  // Soft Deactivate / Activate Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "inactive" }) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, { status });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: `Customer ${data.status === "active" ? "activated" : "deactivated"} successfully.` });
      setDeactivatingCustomer(null);
      setActivatingCustomer(null);
    },
    onError: (error) => {
      toast({ title: "Failed to update status", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  if (!hasReadPermission("customers")) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
            <CardDescription>You do not have the required permissions to view the Customer Master module.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => setLocation("/")}>Go to Dashboard</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Determine current active subview
  if (location === "/logistics/customers/new" || location === "/logistics/vendors/new") {
    return <CustomerFormView key="new-customer" mode="create" hasWrite={hasWritePermission("customers") || isSuperAdmin} />;
  }

  if (location.endsWith("/edit") && id) {
    return <CustomerFormView key={`edit-customer-${id}`} id={id} mode="edit" hasWrite={hasWritePermission("customers") || isSuperAdmin} />;
  }

  if ((location.startsWith("/logistics/customers/") || location.startsWith("/logistics/vendors/") || location.startsWith("/logistics/outlets/")) && id) {
    return <CustomerDetailsView id={id} setLocation={setLocation} hasWrite={hasWritePermission("customers") || isSuperAdmin} />;
  }

  // Filter and search logic on the client side
  const filteredClients = clients.filter(c => {
    const code = c.customerCode || "";
    const name = c.name || "";
    const trade = c.tradeName || "";
    const matchesSearch = 
      code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trade.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" ? true : c.status === statusFilter;
    const matchesType = typeFilter === "all" ? true : c.customerType === typeFilter;
    const matchesCategory = categoryFilter === "all" ? true : c.customerCategory === categoryFilter;
    const matchesCountry = countryFilter === "all" ? true : c.country === countryFilter;

    return matchesSearch && matchesStatus && matchesType && matchesCategory && matchesCountry;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  const countriesList = Array.from(new Set(clients.map(c => c.country).filter(Boolean)));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Customer Master"
        description="Administration directory for trucking and delivery clients"
      >
        {(hasWritePermission("customers") || isSuperAdmin) && (
          <Button onClick={() => setLocation("/logistics/customers/new")} data-testid="button-add-customer">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        )}
      </PageHeader>

      <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4 border-b">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search Input */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search code, name, trade..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                data-testid="input-search-customer"
              />
            </div>
            
            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Type Filter */}
            <div className="flex flex-col gap-1.5">
              <Label>Customer Type</Label>
              <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Category Filter */}
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="trucking">Trucking Only</SelectItem>
                  <SelectItem value="delivery">Delivery Only</SelectItem>
                  <SelectItem value="both">Both (Trucking & Delivery)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Country Filter */}
            <div className="flex flex-col gap-1.5">
              <Label>Country</Label>
              <Select value={countryFilter} onValueChange={(val) => { setCountryFilter(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countriesList.map(c => (
                    <SelectItem key={c} value={c!}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton rows={5} cols={8} />
          ) : filteredClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="No customers match your search filters. Click Add Customer to create one."
            >
              {(hasWritePermission("customers") || isSuperAdmin) && (
                <Button onClick={() => setLocation("/logistics/customers/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm text-left border-collapse border-slate-200">
                  <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-slate-200">
                    <tr>
                      <th className="p-4">Customer Code</th>
                      <th className="p-4">Customer Name</th>
                      <th className="p-4">Trade Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Country & City</th>
                      <th className="p-4">Contact Mob / Email</th>
                      <th className="p-4">Outstanding</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedClients.map((client, idx) => (
                      <tr 
                        key={client.id}
                        onClick={() => setLocation(`/logistics/customers/${client.id}`)}
                        className={`cursor-pointer hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"}`}
                        data-testid={`table-row-${client.id}`}
                      >
                        <td className="p-4 font-mono font-medium">{client.customerCode || "N/A"}</td>
                        <td className="p-4 font-semibold">{client.name}</td>
                        <td className="p-4 text-muted-foreground">{client.tradeName || "N/A"}</td>
                        <td className="p-4 capitalize">{client.customerType || "N/A"}</td>
                        <td className="p-4 capitalize">{client.customerCategory || "N/A"}</td>
                        <td className="p-4">
                          {client.city ? `${client.city}, ${client.country}` : client.country || "N/A"}
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{client.phone}</div>
                          <div className="text-xs text-muted-foreground">{client.email}</div>
                        </td>
                        <td className="p-4 font-mono font-semibold text-amber-700">
                          {parseFloat(client.currentOutstanding || "0.000").toFixed(3)} BD
                        </td>
                        <td className="p-4">
                          <StatusBadge status={client.status} />
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLocation(`/logistics/customers/${client.id}`)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            {(hasWritePermission("customers") || isSuperAdmin) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setLocation(`/logistics/customers/${client.id}/edit`)}
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                </Button>
                                {client.status === "active" ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeactivatingCustomer(client)}
                                    title="Deactivate"
                                  >
                                    <PowerOff className="h-4 w-4 text-red-600" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setActivatingCustomer(client)}
                                    title="Activate"
                                  >
                                    <Power className="h-4 w-4 text-green-600" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredClients.length)} of {filteredClients.length} customers
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <div className="text-xs font-semibold px-2">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Soft Deactivation Confirmation Dialog */}
      <AlertDialog open={!!deactivatingCustomer} onOpenChange={() => setDeactivatingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate the customer <strong>{deactivatingCustomer?.name}</strong>?
              They will no longer be available for new routing, contracts, or orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivatingCustomer && toggleStatusMutation.mutate({ id: deactivatingCustomer.id, status: "inactive" })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activation Confirmation Dialog */}
      <AlertDialog open={!!activatingCustomer} onOpenChange={() => setActivatingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to activate the customer <strong>{activatingCustomer?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activatingCustomer && toggleStatusMutation.mutate({ id: activatingCustomer.id, status: "active" })}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// 7-STEP CUSTOMER FORM VIEW (WIZARD)
// ==========================================
interface CustomerFormViewProps {
  id?: string;
  mode: "create" | "edit";
  hasWrite: boolean;
}

function CustomerFormView({ id, mode, hasWrite }: CustomerFormViewProps) {
  const [location, setLocation] = useLocation();
  const isVendorContext = location.startsWith("/logistics/vendors");
  const listPath = isVendorContext ? "/logistics/vendors" : "/logistics/outlets";
  const entityLabel = isVendorContext ? "Vendor Customer" : "Customer";

  const { toast } = useToast();
  const { accessToken } = useAuth();
  const [activeStep, setActiveStep] = useState(1);
  const totalSteps = 7;

  // File states for Documents step
  const [isUploading, setIsUploading] = useState(false);
  const [documentsState, setDocumentsState] = useState<{
    crCertificate?: { name: string; url: string; uploadedAt?: string };
    vatCertificate?: { name: string; url: string; uploadedAt?: string };
    customerAgreement?: { name: string; url: string; uploadedAt?: string };
    otherDocuments?: { name: string; url: string; uploadedAt?: string }[];
  }>({});

  // Query details if in Edit mode
  const { data: customer, isLoading: isDetailsLoading } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
    enabled: mode === "edit" && !!id,
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      customerCode: "",
      name: "",
      tradeName: "",
      customerType: "company",
      customerCategory: "both",
      status: "active",
      crNumber: "",
      vatNumber: "",
      contactPerson: "",
      designation: "",
      phone: "",
      whatsappNumber: "",
      email: "",
      alternativeContact: "",
      accountsContactName: "",
      accountsEmail: "",
      accountsContactNumber: "",
      billingAddress: "",
      deliveryAddress: "",
      buildingNo: "",
      roadStreet: "",
      area: "",
      city: "",
      country: "Bahrain",
      latitude: "",
      longitude: "",
      currency: "BHD",
      paymentTerms: "30 Days",
      creditLimit: "",
      openingBalance: "0.000",
      bankName: "",
      iban: "",
      contacts: [],
    }
  });

  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
    control: form.control,
    name: "contacts"
  });

  // Prefill details on edit
  React.useEffect(() => {
    if (customer && mode === "edit") {
      form.reset({
        customerCode: customer.customerCode || "",
        name: customer.name || "",
        tradeName: customer.tradeName || "",
        customerType: (customer as any).customerType || "company",
        customerCategory: (customer as any).customerCategory || "both",
        status: (customer.status as any) === "active" ? "active" : "inactive",
        crNumber: (customer as any).crNumber || "",
        vatNumber: (customer as any).vatNumber || "",
        contactPerson: customer.contactPerson || "",
        designation: (customer as any).designation || "",
        phone: customer.phone || "",
        whatsappNumber: (customer as any).whatsappNumber || "",
        email: customer.email || "",
        alternativeContact: (customer as any).alternativeContact || "",
        accountsContactName: (customer as any).accountsContactName || "",
        accountsEmail: (customer as any).accountsEmail || "",
        accountsContactNumber: (customer as any).accountsContactNumber || "",
        billingAddress: (customer as any).billingAddress || "",
        deliveryAddress: (customer as any).deliveryAddress || "",
        buildingNo: (customer as any).buildingNo || "",
        roadStreet: (customer as any).roadStreet || "",
        area: (customer as any).area || "",
        city: (customer as any).city || "",
        country: (customer as any).country || "Bahrain",
        latitude: (customer as any).latitude || "",
        longitude: (customer as any).longitude || "",
        currency: (customer as any).currency || "BHD",
        paymentTerms: (customer as any).paymentTerms || "30 Days",
        creditLimit: (customer as any).creditLimit || "",
        openingBalance: (customer as any).openingBalance || "0.000",
        bankName: (customer as any).bankName || "",
        iban: (customer as any).iban || "",
        contacts: (customer as any).contacts || [],
      });
      if (customer.documents) {
        setDocumentsState(customer.documents as any);
      }
    }
  }, [customer, mode, form]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData & { documents: any }) => 
      apiRequest("POST", "/api/clients", data),
    onSuccess: async (res) => {
      const savedClient = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ 
        title: `${entityLabel} created successfully.`,
        description: `${entityLabel} Code: ${savedClient.customerCode}`
      });
      setLocation(listPath);
    },
    onError: (error) => {
      toast({ title: `Failed to create ${entityLabel.toLowerCase()}`, description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormData & { id: string; documents: any }) => 
      apiRequest("PATCH", `/api/clients/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}`] });
      toast({ title: `${entityLabel} details updated successfully.` });
      setLocation(`${listPath}/${id}`);
    },
    onError: (error) => {
      toast({ title: `Failed to update ${entityLabel.toLowerCase()}`, description: getErrorMessage(error), variant: "destructive" });
    }
  });

  if (!hasWrite) {
    return <div className="p-6 text-red-600">Access Denied. You do not have writing permissions.</div>;
  }

  if (mode === "edit" && isDetailsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle Multi-file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "crCertificate" | "vatCertificate" | "customerAgreement" | "otherDocuments") => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append("documents", e.target.files[i]);
    }

    try {
      const res = await fetch("/api/upload/contracts", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken || ""}` },
        body: formData,
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload failed");
      
      if (fieldName === "otherDocuments") {
        const newDocs = result.documents.map((d: any) => ({
          name: d.name,
          url: d.url,
          uploadedAt: new Date().toISOString()
        }));
        setDocumentsState(prev => ({
          ...prev,
          otherDocuments: [...(prev.otherDocuments || []), ...newDocs]
        }));
      } else {
        const uploadedDoc = {
          name: result.documents[0].name,
          url: result.documents[0].url,
          uploadedAt: new Date().toISOString()
        };
        setDocumentsState(prev => ({
          ...prev,
          [fieldName]: uploadedDoc
        }));
      }
      toast({ title: "Document uploaded successfully." });
    } catch (error: any) {
      toast({ title: "Document upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeDoc = (fieldName: "crCertificate" | "vatCertificate" | "customerAgreement") => {
    setDocumentsState(prev => {
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  const removeOtherDoc = (index: number) => {
    setDocumentsState(prev => ({
      ...prev,
      otherDocuments: (prev.otherDocuments || []).filter((_, i) => i !== index)
    }));
  };

  // GPS Location detector
  const detectGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("latitude", position.coords.latitude.toFixed(6));
          form.setValue("longitude", position.coords.longitude.toFixed(6));
          toast({ title: "Coordinates captured successfully." });
        },
        (error) => {
          toast({ title: "Geolocation error", description: error.message, variant: "destructive" });
        }
      );
    } else {
      toast({ title: "Not Supported", description: "GPS Geolocation is not supported by your browser.", variant: "destructive" });
    }
  };

  // Multi-step validation helper
  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (activeStep === 1) {
      fieldsToValidate = ["name", "tradeName", "customerType", "customerCategory", "status", "crNumber", "vatNumber"];
    } else if (activeStep === 2) {
      fieldsToValidate = ["contactPerson", "designation", "phone", "whatsappNumber", "email", "alternativeContact"];
    } else if (activeStep === 3) {
      fieldsToValidate = ["accountsContactName", "accountsEmail", "accountsContactNumber"];
    } else if (activeStep === 4) {
      fieldsToValidate = ["billingAddress", "deliveryAddress", "buildingNo", "roadStreet", "area", "city", "country"];
    } else if (activeStep === 5) {
      fieldsToValidate = ["latitude", "longitude"];
    } else if (activeStep === 6) {
      fieldsToValidate = ["currency", "paymentTerms", "creditLimit", "openingBalance", "bankName", "iban"];
    }

    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setActiveStep(prev => Math.min(totalSteps, prev + 1));
    }
  };

  const prevStep = () => {
    setActiveStep(prev => Math.max(1, prev - 1));
  };

  const onSubmit = (data: CustomerFormData) => {
    const finalData = {
      ...data,
      creditLimit: data.creditLimit || null,
      openingBalance: data.openingBalance || "0.000",
      documents: documentsState,
      isVendor: isVendorContext,
    };
    if (mode === "edit" && id) {
      updateMutation.mutate({ ...finalData, id } as any);
    } else {
      createMutation.mutate(finalData as any);
    }
  };

  // Steps headers for Wizard UI
  const stepTitles = [
    "Identification",
    "Contact Info",
    "Accounts Department",
    "Address",
    "GPS Location",
    "Financial Info",
    "Documents"
  ];

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <PageHeader
        title={mode === "edit" ? `Edit ${entityLabel} Details` : `Add New ${entityLabel}`}
        description={mode === "edit" ? `Updating details for ${entityLabel}: ${customer?.customerCode}` : `Register a new Logistics trucking and delivery ${entityLabel.toLowerCase()}`}
      />

      {/* Progress Wizard Header */}
      <div className="relative mb-8">
        <div className="absolute left-0 top-[18px] w-full h-0.5 bg-muted -translate-y-1/2 z-0" />
        <div 
          className="absolute left-0 top-[18px] h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
          style={{ width: `${((activeStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        <div className="relative flex justify-between items-start z-10">
          {stepTitles.map((title, index) => {
            const stepNum = index + 1;
            const isActive = activeStep === stepNum;
            const isDone = activeStep > stepNum;
            return (
              <div key={title} className="flex flex-col items-center gap-2 w-16 md:w-24">
                <div 
                  className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all duration-300 ${
                    isActive 
                      ? "bg-primary border-primary text-primary-foreground shadow-md scale-110" 
                      : isDone
                      ? "bg-background border-primary text-primary"
                      : "bg-background border-muted text-muted-foreground"
                  }`}
                >
                  {stepNum}
                </div>
                <span className="text-[10px] md:text-xs font-medium text-center hidden md:inline text-muted-foreground leading-tight">
                  {title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Step {activeStep}: {stepTitles[activeStep - 1]}</CardTitle>
          <CardDescription>Fill out all required customer information below.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form 
              onSubmit={(e) => {
                if (activeStep < totalSteps) {
                  e.preventDefault();
                  nextStep();
                } else {
                  form.handleSubmit(onSubmit)(e);
                }
              }} 
              className="space-y-6"
            >
              
              {/* STEP 1: Customer Identification */}
              {activeStep === 1 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="customerCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer / Outlet Code *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="e.g. 007147110" 
                            disabled={mode === "edit"} 
                            className={mode === "edit" ? "font-mono bg-muted/40" : "font-mono"} 
                            data-testid="input-customer-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-customer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tradeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trade Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-trade-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="company">Company</SelectItem>
                            <SelectItem value="individual">Individual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Category *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="trucking">Trucking</SelectItem>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
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

                  <FormField
                    control={form.control}
                    name="crNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CR Number *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-cr-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vatNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VAT Registration No.</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-vat-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* STEP 2: Contact Information */}
              {activeStep === 2 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Person *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-contact-person" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="+973 XXXXXXXX" data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" placeholder="+973 XXXXXXXX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="client@example.com" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="alternativeContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alternative Contact Number</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Additional Contacts */}
                  <div className="col-span-1 md:col-span-2 border-t pt-6 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Additional Contacts</h4>
                        <p className="text-xs text-muted-foreground">Add multiple alternative contact persons for this customer</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendContact({ name: "", designation: "", phone: "", whatsapp: "", email: "" })}
                        className="gap-1 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Contact
                      </Button>
                    </div>

                    {contactFields.length === 0 ? (
                      <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-xs bg-muted/10">
                        No additional contacts added yet. Click "Add Contact" to add more.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contactFields.map((field, index) => (
                          <Card key={field.id} className="p-4 border bg-muted/5 relative">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeContact(index)}
                              className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 items-start mt-2">
                              <FormField
                                control={form.control}
                                name={`contacts.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Contact Name *</FormLabel>
                                    <FormControl>
                                      <Input {...field} className="h-8 text-xs" placeholder="Name" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`contacts.${index}.designation`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Designation</FormLabel>
                                    <FormControl>
                                      <Input {...field} className="h-8 text-xs" placeholder="Designation" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`contacts.${index}.phone`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Phone *</FormLabel>
                                    <FormControl>
                                      <Input {...field} className="h-8 text-xs" placeholder="Phone" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`contacts.${index}.whatsapp`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">WhatsApp</FormLabel>
                                    <FormControl>
                                      <Input {...field} className="h-8 text-xs" placeholder="WhatsApp" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`contacts.${index}.email`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Email</FormLabel>
                                    <FormControl>
                                      <Input {...field} className="h-8 text-xs" placeholder="Email" />
                                    </FormControl>
                                    <FormMessage className="text-[10px]" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Accounts Department */}
              {activeStep === 3 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="accountsContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accounts Contact Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountsEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accounts Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="accounts@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountsContactNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accounts Contact Number</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* STEP 4: Address Information */}
              {activeStep === 4 && (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="billingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Address *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Full legal billing address" data-testid="input-billing-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Main warehouse/dispatch delivery address" data-testid="input-delivery-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                    <FormField
                      control={form.control}
                      name="buildingNo"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-1">
                          <FormLabel>Building No.</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="roadStreet"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-1">
                          <FormLabel>Road / Street</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="area"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-1">
                          <FormLabel>Area *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-area" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-1">
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-1">
                          <FormLabel>Country *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Bahrain">Bahrain</SelectItem>
                              <SelectItem value="Kuwait">Kuwait</SelectItem>
                              <SelectItem value="Oman">Oman</SelectItem>
                              <SelectItem value="Qatar">Qatar</SelectItem>
                              <SelectItem value="Saudi Arabia">Saudi Arabia</SelectItem>
                              <SelectItem value="United Arab Emirates">United Arab Emirates</SelectItem>
                              <SelectItem value="Egypt">Egypt</SelectItem>
                              <SelectItem value="Jordan">Jordan</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: GPS Location */}
              {activeStep === 5 && (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. 26.2285" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. 50.5860" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button type="button" variant="outline" onClick={detectGPS} className="gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Capture Current GPS Location
                    </Button>
                    {form.watch("latitude") && form.watch("longitude") && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${form.watch("latitude")},${form.watch("longitude")}`}
                        target="_blank" 
                        rel="noreferrer"
                      >
                        <Button type="button" variant="ghost" className="text-primary underline">
                          View Location on Google Maps
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 6: Financial Information */}
              {activeStep === 6 && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BHD">BHD - Bahraini Dinar</SelectItem>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                            <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment terms" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Immediate">Immediate</SelectItem>
                            <SelectItem value="15 Days">15 Days</SelectItem>
                            <SelectItem value="30 Days">30 Days</SelectItem>
                            <SelectItem value="45 Days">45 Days</SelectItem>
                            <SelectItem value="60 Days">60 Days</SelectItem>
                            <SelectItem value="90 Days">90 Days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit (BD)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="e.g. 5000" />
                        </FormControl>
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
                        <FormControl>
                          <Input {...field} type="number" placeholder="0.000" disabled={mode === "edit"} className={mode === "edit" ? "bg-muted/40" : ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>Current Outstanding Balance (BD)</Label>
                    <Input 
                      disabled 
                      placeholder={mode === "edit" ? parseFloat(customer?.currentOutstanding || "0").toFixed(3) : "Calculated from transactions"} 
                      className="font-mono bg-muted/40"
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. National Bank of Bahrain" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="iban"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="BHXX XXXX XXXX XXXX XXXX XXXX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* STEP 7: Documents */}
              {activeStep === 7 && (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* CR Certificate */}
                    <div className="border p-4 rounded-md space-y-3">
                      <Label className="font-semibold block">CR Certificate</Label>
                      {documentsState.crCertificate ? (
                        <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded-md">
                          <span className="truncate max-w-[200px] font-medium">{documentsState.crCertificate.name}</span>
                          <div className="flex items-center gap-1">
                            <a href={documentsState.crCertificate.url} target="_blank" rel="noreferrer">
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7"><Download className="h-4 w-4" /></Button>
                            </a>
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeDoc("crCertificate")} className="h-7 w-7 text-red-600"><Trash className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Input 
                            type="file" 
                            accept=".pdf,.png,.jpg,.jpeg" 
                            onChange={(e) => handleFileUpload(e, "crCertificate")} 
                            disabled={isUploading} 
                            className="cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* VAT Certificate */}
                    <div className="border p-4 rounded-md space-y-3">
                      <Label className="font-semibold block">VAT Certificate</Label>
                      {documentsState.vatCertificate ? (
                        <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded-md">
                          <span className="truncate max-w-[200px] font-medium">{documentsState.vatCertificate.name}</span>
                          <div className="flex items-center gap-1">
                            <a href={documentsState.vatCertificate.url} target="_blank" rel="noreferrer">
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7"><Download className="h-4 w-4" /></Button>
                            </a>
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeDoc("vatCertificate")} className="h-7 w-7 text-red-600"><Trash className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Input 
                            type="file" 
                            accept=".pdf,.png,.jpg,.jpeg" 
                            onChange={(e) => handleFileUpload(e, "vatCertificate")} 
                            disabled={isUploading} 
                            className="cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Customer Agreement */}
                    <div className="border p-4 rounded-md space-y-3">
                      <Label className="font-semibold block">Customer Agreement</Label>
                      {documentsState.customerAgreement ? (
                        <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded-md">
                          <span className="truncate max-w-[200px] font-medium">{documentsState.customerAgreement.name}</span>
                          <div className="flex items-center gap-1">
                            <a href={documentsState.customerAgreement.url} target="_blank" rel="noreferrer">
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7"><Download className="h-4 w-4" /></Button>
                            </a>
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeDoc("customerAgreement")} className="h-7 w-7 text-red-600"><Trash className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Input 
                            type="file" 
                            accept=".pdf,.png,.jpg,.jpeg" 
                            onChange={(e) => handleFileUpload(e, "customerAgreement")} 
                            disabled={isUploading} 
                            className="cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Other Documents */}
                    <div className="border p-4 rounded-md space-y-3">
                      <Label className="font-semibold block">Other Documents</Label>
                      <div className="space-y-2">
                        <Input 
                          type="file" 
                          multiple 
                          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" 
                          onChange={(e) => handleFileUpload(e, "otherDocuments")} 
                          disabled={isUploading} 
                          className="cursor-pointer"
                        />
                        
                        {documentsState.otherDocuments && documentsState.otherDocuments.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t">
                            {documentsState.otherDocuments.map((doc, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-muted/30 rounded border">
                                <span className="truncate max-w-[180px]">{doc.name}</span>
                                <div className="flex items-center gap-1">
                                  <a href={doc.url} target="_blank" rel="noreferrer">
                                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6 p-0"><Download className="h-3 w-3" /></Button>
                                  </a>
                                  <Button type="button" size="icon" variant="ghost" onClick={() => removeOtherDoc(idx)} className="h-6 w-6 p-0 text-red-600"><Trash className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isUploading && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading file. Please wait...
                    </div>
                  )}
                </div>
              )}

              {/* Wizard Navigations */}
              <div className="flex justify-between border-t pt-4">
                <Button 
                  key="back-button"
                  type="button" 
                  variant="outline" 
                  onClick={activeStep === 1 ? () => setLocation(listPath) : prevStep}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> {activeStep === 1 ? "Cancel" : "Back"}
                </Button>
                
                {activeStep < totalSteps ? (
                  <Button key="next-button" type="button" onClick={nextStep}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button 
                    key="save-button"
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                    className="bg-primary text-primary-foreground"
                    data-testid="button-save-customer"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                      </>
                    ) : mode === "edit" ? "Update Customer" : "Save Customer"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// CUSTOMER DETAILS PAGE VIEW
// ==========================================
interface CustomerDetailsViewProps {
  id: string;
  setLocation: (loc: string) => void;
  hasWrite: boolean;
}

function CustomerDetailsView({ id, setLocation, hasWrite }: CustomerDetailsViewProps) {
  const isVendorContext = window.location.pathname.startsWith("/logistics/vendors");
  const listPath = isVendorContext ? "/logistics/vendors" : "/logistics/outlets";
  const entityLabel = isVendorContext ? "Vendor Customer" : "Customer";

  const { data: customer, isLoading } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Users}
          title={`${entityLabel} not found`}
          description={`The requested ${entityLabel.toLowerCase()} does not exist in the database.`}
        >
          <Button onClick={() => setLocation(listPath)}>Back to List</Button>
        </EmptyState>
      </div>
    );
  }

  const docs = (customer.documents || {}) as any;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={customer.name}
        description={`${entityLabel} Code: ${customer.customerCode || "N/A"}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation(listPath)}>
            Back to List
          </Button>
          {hasWrite && (
            <Button onClick={() => setLocation(`${listPath}/${customer.id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" /> Edit {entityLabel}
            </Button>
          )}
        </div>
      </PageHeader>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
          <TabsTrigger value="transactions">Transactions Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Customer Information Column */}
            <div className="md:col-span-2 space-y-6">
              {/* Card 1: Identification */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {entityLabel} Identification</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">{entityLabel} Name</span>
                    <span className="font-semibold">{customer.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Trade Name</span>
                    <span className="font-semibold">{customer.tradeName || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">{entityLabel} Type</span>
                    <span className="capitalize font-semibold">{(customer as any).customerType || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">{entityLabel} Category</span>
                    <span className="capitalize font-semibold">{(customer as any).customerCategory || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">CR Number</span>
                    <span className="font-semibold">{(customer as any).crNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">VAT Number</span>
                    <span className="font-semibold">{(customer as any).vatNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Status</span>
                    <div className="mt-1"><StatusBadge status={customer.status} /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Contact Information */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Contact Person</span>
                    <span className="font-semibold">{customer.contactPerson || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Designation</span>
                    <span className="font-semibold">{(customer as any).designation || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Mobile Number</span>
                    <span className="font-semibold">{customer.phone || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">WhatsApp Number</span>
                    <span className="font-semibold">{(customer as any).whatsappNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Email</span>
                    <span className="font-semibold">{customer.email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Alternative Contact</span>
                    <span className="font-semibold">{(customer as any).alternativeContact || "N/A"}</span>
                  </div>
                  {(customer as any).contacts && (customer as any).contacts.length > 0 && (
                    <div className="sm:col-span-2 border-t pt-4 mt-2">
                      <span className="text-xs text-muted-foreground block font-medium uppercase mb-2">Additional Contacts</span>
                      <div className="space-y-2">
                        {(customer as any).contacts.map((c: any, i: number) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm p-2.5 bg-muted/40 rounded border border-muted/70">
                            <div>
                              <span className="font-semibold text-foreground">{c.name}</span>
                              {c.designation && <span className="text-xs text-muted-foreground ml-2">({c.designation})</span>}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1 sm:mt-0 font-mono">
                              <span>📞 {c.phone}</span>
                              {c.whatsapp && <span>💬 {c.whatsapp}</span>}
                              {c.email && <span>📧 {c.email}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Address Details */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Address & Location</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Billing Address</span>
                    <p className="font-medium">{(customer as any).billingAddress || "N/A"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Delivery Address</span>
                    <p className="font-medium">{(customer as any).deliveryAddress || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Building / Road</span>
                    <span className="font-semibold">Building {(customer as any).buildingNo || "N/A"}, Road {(customer as any).roadStreet || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Area & City</span>
                    <span className="font-semibold">{(customer as any).area || "N/A"}, {(customer as any).city || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">Country</span>
                    <span className="font-semibold">{(customer as any).country || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium uppercase">GPS Location</span>
                    {(customer as any).latitude && (customer as any).longitude ? (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${(customer as any).latitude},${(customer as any).longitude}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary underline text-sm font-semibold flex items-center gap-1.5 mt-1"
                      >
                        <MapPin className="h-4 w-4" /> View Map [{(customer as any).latitude}, {(customer as any).longitude}]
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">No GPS coordinates pinned</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial & Document Column */}
            <div className="space-y-6">
              {/* Card 4: Financial Ledger */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Financial Profile</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Currency</span>
                    <span className="font-bold">{(customer as any).currency || "BHD"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Payment Terms</span>
                    <span className="font-semibold">{(customer as any).paymentTerms || "30 Days"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Credit Limit</span>
                    <span className="font-semibold font-mono">
                      {(customer as any).creditLimit ? `${parseFloat((customer as any).creditLimit).toFixed(3)} BD` : "No Limit"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Opening Balance</span>
                    <span className="font-semibold font-mono">
                      {parseFloat((customer as any).openingBalance || "0").toFixed(3)} BD
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Current Outstanding</span>
                    <span className="font-bold text-amber-700 font-mono text-base">
                      {parseFloat(customer.currentOutstanding || "0.000").toFixed(3)} BD
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm font-medium text-muted-foreground">Bank Name</span>
                    <span className="font-semibold">{(customer as any).bankName || "N/A"}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase">IBAN</span>
                    <div className="font-mono text-xs font-semibold bg-muted/40 p-1.5 rounded truncate">{(customer as any).iban || "N/A"}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 5: Documents list */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Customer Documents</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {/* CR Certificate */}
                  <div className="border rounded-md p-2.5 space-y-1 bg-muted/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">CR Certificate</span>
                      {docs.crCertificate ? (
                        <a href={docs.crCertificate.url} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="outline" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">Missing</span>
                      )}
                    </div>
                    {docs.crCertificate && <p className="text-[10px] text-muted-foreground truncate">{docs.crCertificate.name}</p>}
                  </div>

                  {/* VAT Certificate */}
                  <div className="border rounded-md p-2.5 space-y-1 bg-muted/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">VAT Certificate</span>
                      {docs.vatCertificate ? (
                        <a href={docs.vatCertificate.url} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="outline" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">Missing</span>
                      )}
                    </div>
                    {docs.vatCertificate && <p className="text-[10px] text-muted-foreground truncate">{docs.vatCertificate.name}</p>}
                  </div>

                  {/* Customer Agreement */}
                  <div className="border rounded-md p-2.5 space-y-1 bg-muted/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold">Customer Agreement</span>
                      {docs.customerAgreement ? (
                        <a href={docs.customerAgreement.url} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="outline" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">Missing</span>
                      )}
                    </div>
                    {docs.customerAgreement && <p className="text-[10px] text-muted-foreground truncate">{docs.customerAgreement.name}</p>}
                  </div>

                  {/* Other Documents */}
                  {docs.otherDocuments && docs.otherDocuments.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <span className="text-xs font-semibold block text-muted-foreground uppercase">Other Files</span>
                      {docs.otherDocuments.map((doc: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-[11px] border p-1.5 rounded bg-muted/5">
                          <span className="truncate max-w-[180px] font-medium">{doc.name}</span>
                          <a href={doc.url} target="_blank" rel="noreferrer">
                            <Button size="icon" variant="ghost" className="h-5 w-5"><Download className="h-3.5 w-3.5" /></Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <CustomerTransactionsLedger id={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface CustomerTransactionsLedgerProps {
  id: string;
}

function CustomerTransactionsLedger({ id }: CustomerTransactionsLedgerProps) {
  // Query logistics orders for this customer
  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: [`/api/orders?customerId=${id}`],
  });

  // Query contract invoices for this customer
  const { data: contractInvoices = [], isLoading: contractsLoading } = useQuery<any[]>({
    queryKey: [`/api/contract-invoices?customerId=${id}`],
  });

  // Query brand invoices for this customer/outlet
  const { data: brandInvoices = [], isLoading: brandsLoading } = useQuery<any[]>({
    queryKey: [`/api/brand-invoices?outletId=${id}`],
  });

  const isLoading = ordersLoading || contractsLoading || brandsLoading;

  const consolidatedLedger: {
    date: Date;
    type: string;
    refNo: string;
    amount: number;
    status: string;
  }[] = [];

  // 1. Add Logistics Orders
  orders.forEach(o => {
    consolidatedLedger.push({
      date: new Date(o.orderDate || o.createdAt || Date.now()),
      type: "Logistics Order",
      refNo: o.orderNumber || "ORD",
      amount: parseFloat(o.grandTotal || "0"),
      status: o.status || "pending",
    });
  });

  // 2. Add Contract Invoices
  contractInvoices.forEach(c => {
    consolidatedLedger.push({
      date: new Date(c.invoiceDate || c.createdAt || Date.now()),
      type: "Contract Invoice",
      refNo: c.invoiceNumber || "INV",
      amount: parseFloat(c.totalAmount || "0"),
      status: c.status || "pending",
    });
  });

  // 3. Add Brand Invoices
  brandInvoices.forEach(b => {
    consolidatedLedger.push({
      date: new Date(b.periodEnd || b.createdAt || Date.now()),
      type: "Brand Invoice",
      refNo: b.invoiceNumber || "INV-BRD",
      amount: parseFloat(b.totalAmount || "0"),
      status: b.status || "pending",
    });
  });

  // Sort consolidated ledger chronologically (newest first)
  consolidatedLedger.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base">Customer Transactions Ledger</CardTitle>
        <CardDescription>Unified history of logistics orders, contract invoices, and brand invoices</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading ledger transactions...</div>
        ) : consolidatedLedger.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 opacity-20" />
            <span>No transactions recorded for this customer.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference No</TableHead>
                <TableHead className="text-right font-semibold">Amount</TableHead>
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
                    <Badge variant="outline" className={item.type === "Logistics Order" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}>
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{item.refNo}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-foreground">
                    {item.amount.toFixed(3)} BD
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        ["paid", "completed", "delivered", "confirmed"].includes(item.status)
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
