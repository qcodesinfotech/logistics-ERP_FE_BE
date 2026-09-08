import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, Plus, Download, Upload, Trash, Eye, Wallet, ShieldAlert,
  ChevronDown, ChevronUp, CalendarDays, Zap, Truck, CheckCircle2, Clock,
  AlertCircle, Building2, Store, Users, Filter, Calendar, Receipt, ExternalLink
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { CurrencyDisplay } from "@/components/currency-display";
import { MetricCard } from "@/components/metric-card";
import type { Contract, Client } from "@shared/schema";
import { format } from "date-fns";

const contractSchema = z.object({
  customerId: z.string().optional(),
  brandId: z.string().optional(),
  outletId: z.string().optional(),
  name: z.string().min(1, "Contract Name/Ref is required"),
  type: z.enum(["daily", "lease"]),
  monthlyRate: z.string().default("0"),
  dailyRate: z.string().default("0"),
  numVehicles: z.coerce.number().default(0),
  otCharges: z.string().default("0"),
  holidayCharges: z.string().default("0"),
  status: z.enum(["active", "inactive"]).default("active"),
  documents: z.array(z.object({ name: z.string(), url: z.string(), version: z.number().optional(), uploadedAt: z.string().optional() })).default([]),
  // Service Terms
  startDate: z.string().optional(),
  contractDurationYears: z.string().optional(),
  endDate: z.string().optional(),
  includedDeliveriesPerDay: z.coerce.number().default(0),
  workingHoursPerDay: z.coerce.number().default(10),
  graceHours: z.string().default("0"),
  otStartsAfterHours: z.string().default("10"),
  // Additional Charges
  extraTruckCharge: z.string().default("0"),
  emergencyDeliveryCharge: z.string().default("0"),
  redeliveryCharge: z.string().default("0"),
  additionalLabourCharges: z.string().default("0"),
  // Multi-Mode Billing & Automation
  invoiceGenerationType: z.enum(["brand", "outlet"]).default("brand"),
  linkedOutlets: z.array(z.string()).default([]),
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function ContractsPage() {
  const { user, accessToken } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // View & Record Filters
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<"deliveries" | "payments" | "terms">("deliveries");
  const [recordsStartDate, setRecordsStartDate] = useState("");
  const [recordsEndDate, setRecordsEndDate] = useState("");
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<"all" | "regular" | "quick">("all");
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>("all");
  const [previewPodUrl, setPreviewPodUrl] = useState<string | null>(null);
  const [outletSearchTerm, setOutletSearchTerm] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; version?: number; uploadedAt?: string }[]>([]);
  const [showServiceTerms, setShowServiceTerms] = useState(false);
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false);
  const [selectedOutletForConfig, setSelectedOutletForConfig] = useState<any | null>(null);
  const { toast } = useToast();

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      customerId: "", name: "", type: "daily", monthlyRate: "0", dailyRate: "0", numVehicles: 0,
      otCharges: "0", holidayCharges: "0", status: "active", documents: [],
      startDate: "", contractDurationYears: "", endDate: "", includedDeliveriesPerDay: 0, workingHoursPerDay: 10,
      graceHours: "0", otStartsAfterHours: "10",
      extraTruckCharge: "0", emergencyDeliveryCharge: "0", redeliveryCharge: "0",
      additionalLabourCharges: "0",
      invoiceGenerationType: "brand", linkedOutlets: [],
      brandId: "", outletId: "",
    },
  });

  const watchType = useWatch({ control: form.control, name: "type" });
  const watchNumVehicles = useWatch({ control: form.control, name: "numVehicles" }) || 0;
  const watchMonthlyRate = useWatch({ control: form.control, name: "monthlyRate" }) || "0";
  const watchDailyRate = useWatch({ control: form.control, name: "dailyRate" }) || "0";
  const watchInvoiceGenerationType = useWatch({ control: form.control, name: "invoiceGenerationType" });
  const watchCustomerId = useWatch({ control: form.control, name: "customerId" });

  const { data: contractsList, isLoading } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: brandsList } = useQuery<any[]>({ queryKey: ["/api/brands"] });
  const { data: outletsList } = useQuery<any[]>({ queryKey: ["/api/outlets"] });

  // Query contract records (Deliveries & Payments) when viewing a contract
  const { data: contractRecords, isLoading: isLoadingRecords, refetch: refetchRecords } = useQuery({
    queryKey: [
      viewingContract ? `/api/contracts/${viewingContract.id}/records` : null,
      recordsStartDate,
      recordsEndDate,
      deliveryTypeFilter
    ],
    queryFn: async () => {
      if (!viewingContract) return null;
      const params = new URLSearchParams();
      if (recordsStartDate) params.append("startDate", recordsStartDate);
      if (recordsEndDate) params.append("endDate", recordsEndDate);
      if (deliveryTypeFilter && deliveryTypeFilter !== "all") {
        params.append("deliveryType", deliveryTypeFilter);
      }
      const res = await apiRequest("GET", `/api/contracts/${viewingContract.id}/records?${params.toString()}`);
      return res.json();
    },
    enabled: !!viewingContract,
  });

  // When opening a contract view, set default 1-month range
  const openViewRecords = (contract: Contract) => {
    setViewingContract(contract);
    setActiveViewTab("deliveries");
    setDeliveryTypeFilter("all");

    // Default to 1-month range from contract start date or current month
    if (contract.startDate) {
      const start = new Date(contract.startDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      setRecordsStartDate(contract.startDate);
      setRecordsEndDate(end.toISOString().split("T")[0]);
    } else {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setRecordsStartDate(start.toISOString().split("T")[0]);
      setRecordsEndDate(end.toISOString().split("T")[0]);
    }
  };

  const apply1MonthPreset = () => {
    if (viewingContract?.startDate) {
      const start = new Date(viewingContract.startDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      setRecordsStartDate(viewingContract.startDate);
      setRecordsEndDate(end.toISOString().split("T")[0]);
    } else {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setRecordsStartDate(start.toISOString().split("T")[0]);
      setRecordsEndDate(end.toISOString().split("T")[0]);
    }
  };

  const applyContractTermPreset = () => {
    if (viewingContract?.startDate) {
      setRecordsStartDate(viewingContract.startDate);
      setRecordsEndDate(viewingContract.endDate || new Date().toISOString().split("T")[0]);
    }
  };

  const applyLast30DaysPreset = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setRecordsStartDate(start.toISOString().split("T")[0]);
    setRecordsEndDate(end.toISOString().split("T")[0]);
  };

  const saveMutation = useMutation({
    mutationFn: (data: ContractFormData) => {
      const { contractDurationYears, ...rest } = data;
      const payload = {
        ...rest,
        documents: uploadedFiles,
        status: rest.status || "active",
      };
      if (editingId) return apiRequest("PUT", `/api/contracts/${editingId}`, payload);
      return apiRequest("POST", "/api/contracts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: editingId ? "Contract updated successfully" : "Contract created successfully" });
      setIsDialogOpen(false);
      form.reset();
      setUploadedFiles([]);
      setEditingId(null);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Upload failed");
      }
      const result = await res.json();
      const newDocs = result.documents.map((d: any) => ({
        ...d,
        version: uploadedFiles.length + 1,
        uploadedAt: new Date().toISOString(),
      }));
      setUploadedFiles(prev => [...prev, ...newDocs]);
      toast({ title: `Uploaded ${result.documents.length} document(s)` });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Document upload failed", description: error?.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadTemplate = (type: string) => {
    const content = `TT LOGISTICS ERP CONTRACT TEMPLATE\nType: ${type}\nTerms and conditions of transport services.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Logistics_Contract_Template_${type}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `${type} contract template downloaded.` });
  };

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      customerId: "", name: "", type: "daily", monthlyRate: "0", dailyRate: "0", numVehicles: 0,
      otCharges: "0", holidayCharges: "0", status: "active", documents: [],
      startDate: "", contractDurationYears: "", endDate: "", includedDeliveriesPerDay: 0, workingHoursPerDay: 10,
      graceHours: "0", otStartsAfterHours: "10",
      extraTruckCharge: "0", emergencyDeliveryCharge: "0", redeliveryCharge: "0",
      additionalLabourCharges: "0",
      invoiceGenerationType: "brand", linkedOutlets: [],
      brandId: "", outletId: "",
    });
    setUploadedFiles([]);
    setShowServiceTerms(false);
    setShowAdditionalCharges(false);
    setSelectedOutletForConfig(null);
    setIsDialogOpen(true);
  };

  const openEdit = (contract: any) => {
    setEditingId(contract.id);
    form.reset({
      customerId: contract.customerId || "",
      name: contract.name,
      type: (contract.type as "daily" | "lease") || "daily",
      monthlyRate: contract.monthlyRate || "0",
      dailyRate: contract.dailyRate || "0",
      numVehicles: contract.numVehicles || 0,
      otCharges: contract.otCharges || "0",
      holidayCharges: contract.holidayCharges || "0",
      status: contract.status || "active",
      documents: (contract.documents as any[]) || [],
      startDate: contract.startDate || "",
      contractDurationYears: "",
      endDate: contract.endDate || "",
      includedDeliveriesPerDay: contract.includedDeliveriesPerDay || 0,
      workingHoursPerDay: contract.workingHoursPerDay || 10,
      graceHours: contract.graceHours || "0",
      otStartsAfterHours: contract.otStartsAfterHours || "10",
      extraTruckCharge: contract.extraTruckCharge || "0",
      emergencyDeliveryCharge: contract.emergencyDeliveryCharge || "0",
      redeliveryCharge: contract.redeliveryCharge || "0",
      additionalLabourCharges: contract.additionalLabourCharges || "0",
      invoiceGenerationType: (contract.invoiceGenerationType as "brand" | "outlet") || "brand",
      linkedOutlets: contract.linkedOutlets || [],
      brandId: contract.brandId || "",
      outletId: contract.outletId || "",
    });
    setUploadedFiles((contract.documents as any[]) || []);
    if (contract.outletId) {
      setSelectedOutletForConfig(outletsList?.find(o => o.id === contract.outletId) || { id: contract.outletId, name: "Outlet" });
    } else {
      setSelectedOutletForConfig(null);
    }
    setIsDialogOpen(true);
  };

  const getClientName = (id: string | null) => {
    if (!id) return "";
    return clientsList?.find(c => c.id === id)?.name || "Unknown Customer";
  };
  const getOutletName = (id: string | null) => {
    if (!id) return "";
    return outletsList?.find(o => o.id === id)?.name || "Unknown Outlet";
  };
  const getBrandName = (id: string | null) => {
    if (!id) return "";
    return brandsList?.find(b => b.id === id)?.name || "Unknown Brand";
  };

  const activeContractsCount = contractsList?.filter(c => c.status === "active").length || 0;
  const totalContractMonthlyVal = contractsList?.reduce((sum, c) => {
    if (c.type === "lease") return sum + ((c.numVehicles || 0) * parseFloat(c.monthlyRate || "0"));
    return sum;
  }, 0) || 0;
  const currentLeaseTotal = watchType === "lease" ? watchNumVehicles * parseFloat(watchMonthlyRate || "0") : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Contracts & Rate Management"
        description="Manage customer logistics agreements, lease structures, daily delivery rates, variable surcharges, and contract documents."
      >
        <Button onClick={() => downloadTemplate("Daily_Delivery")} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Daily Template
        </Button>
        <Button onClick={() => downloadTemplate("Monthly_Lease")} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Monthly Template
        </Button>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Create Contract
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard title="Active Agreements" value={activeContractsCount} icon={FileText} description="Legally active vendor contracts" />
        <MetricCard title="Monthly Lease Billing" value={totalContractMonthlyVal} isCurrency icon={Wallet} description="Accrued monthly lease revenue" />
        <MetricCard title="Avg. Contract Term" value="12 Months" icon={ShieldAlert} description="Standard compliance duration" />
      </div>

      <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Contracts Registry</CardTitle>
          <CardDescription>Comprehensive list of operational contracts with associated rates, deliveries, and payment logs.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading contracts...</div>
          ) : !contractsList || contractsList.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No contracts found. Click 'Create Contract' to add one.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract Ref / Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Billing Option</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="text-right">Vehicles / Daily</TableHead>
                    <TableHead className="text-right">Base Rate</TableHead>
                    <TableHead className="text-right">OT Rate</TableHead>
                    <TableHead className="text-right">Holiday</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractsList.map((contract) => (
                    <TableRow key={contract.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-semibold text-foreground">{contract.name}</TableCell>
                      <TableCell>
                        {contract.brandId || contract.outletId ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{getOutletName(contract.outletId) || "All Outlets"}</span>
                            <span className="text-xs text-muted-foreground">{getBrandName(contract.brandId)}</span>
                          </div>
                        ) : (
                          <div className="font-medium">{getClientName(contract.customerId)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {contract.type === "lease" ? (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Monthly Lease</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-sky-50 text-sky-700 border-sky-200">Daily Delivery</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {(contract as any).startDate ? (
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            <span>{(contract as any).startDate} → {(contract as any).endDate || "Open"}</span>
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {contract.type === "lease" ? (
                          <span>{contract.numVehicles || 0} Trucks</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{contract.includedDeliveriesPerDay || 0} deliv/day</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {contract.type === "lease" ? (
                          <div className="flex flex-col items-end">
                            <CurrencyDisplay amount={contract.monthlyRate} />
                            <span className="text-[10px] text-muted-foreground">
                              Total: <CurrencyDisplay amount={(contract.numVehicles || 0) * parseFloat(contract.monthlyRate || "0")} />
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <CurrencyDisplay amount={(contract as any).dailyRate || contract.monthlyRate || "0"} />
                            <span className="text-[10px] text-muted-foreground">/ day</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={contract.otCharges} /></TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={contract.holidayCharges} /></TableCell>
                      <TableCell><StatusBadge status={contract.status} /></TableCell>
                      <TableCell>
                        {contract.documents && (contract.documents as any[]).length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {(contract.documents as any[]).map((doc, idx) => (
                              <a key={idx} href={doc.url} target="_blank" rel="noreferrer" title={`${doc.name}${doc.version ? ` v${doc.version}` : ""}`}
                                className="p-1 rounded bg-secondary hover:bg-primary/20 transition-colors text-primary flex items-center justify-center">
                                <Eye className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        ) : <span className="text-[10px] text-muted-foreground">No docs</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openViewRecords(contract)} className="gap-1 text-primary border-primary/30 hover:bg-primary/10">
                            <Eye className="h-4 w-4" /> View Records
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(contract)}>Edit</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREATE / EDIT CONTRACT MODAL ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Contract Agreement" : "Create New Contract Agreement"}</DialogTitle>
            <DialogDescription>
              Configure customer logistics terms, delivery rates, and operational parameters. All currency amounts are in Bahraini Dinar (BD).
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">

              {/* ── BASIC INFO: BRAND (OPTIONAL) & CLIENT / CUSTOMER ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="brandId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand (Optional)</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val === "none" ? "" : val);
                      if (val && val !== "none") {
                        form.setValue("customerId", "");
                      }
                      form.setValue("outletId", "");
                      setSelectedOutletForConfig(null);
                    }} value={field.value || "none"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Brand (Client Direct)</SelectItem>
                        {brandsList?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormDescription>Select brand for brand/outlet dispatches.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {(!form.watch("brandId") || form.watch("brandId") === "none") ? (
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client / Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select client / customer" /></SelectTrigger></FormControl>
                        <SelectContent>{clientsList?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormDescription>The contracting client company.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <FormField control={form.control} name="outletId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Outlet (Optional)</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                        <FormControl><SelectTrigger><SelectValue placeholder="All Outlets under Brand" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">All Outlets under Brand</SelectItem>
                          {outletsList?.filter(o => o.brandId === form.watch("brandId")).map(o => (
                            <SelectItem key={o.id} value={o.id}>{o.name} ({o.code || "No code"})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Leave as 'All Outlets' or target one specific branch.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              {/* CONTRACT REFERENCE & BILLING OPTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Reference / Title *</FormLabel>
                    <FormControl><Input placeholder="e.g. C-2026-DELIVERY-01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Option *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select billing option" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily Delivery</SelectItem>
                        <SelectItem value="lease">Monthly Lease</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* DYNAMIC RATE INPUTS BASED ON BILLING OPTION */}
              {watchType === "daily" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-sky-50/60 rounded-lg border border-sky-200">
                  <FormField control={form.control} name="dailyRate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Delivery Rate (BD / Day)</FormLabel>
                      <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                      <FormDescription>Standard charge per operational delivery day.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="includedDeliveriesPerDay" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deliveries Included / Day</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                      <FormDescription>Number of included trips per day before extra charges.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="numVehicles" render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. of Leased Trucks</FormLabel>
                        <FormControl><Input type="number" min="1" placeholder="1" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="monthlyRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate / Truck (BD / Mo)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="flex justify-between items-center text-sm font-semibold text-emerald-800 pt-1 border-t border-emerald-200">
                    <span>Estimated Monthly Lease Revenue:</span>
                    <CurrencyDisplay amount={currentLeaseTotal} size="lg" />
                  </div>
                </div>
              )}

              {/* OVERTIME & HOLIDAY CHARGES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <FormField control={form.control} name="otCharges" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Rate (BD / Hour)</FormLabel>
                    <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                    <FormDescription>Applied after shift hours.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="holidayCharges" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Holiday Rate (BD / Day)</FormLabel>
                    <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                    <FormDescription>Applied for Friday/Holiday shifts.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* MULTI-MODE INVOICING (CONSOLIDATED VS OUTLET) */}
              <div className="grid grid-cols-1 gap-4">
                <FormField control={form.control} name="invoiceGenerationType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Generation Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="brand">Consolidated (Single Invoice)</SelectItem>
                        <SelectItem value="outlet">Outlet-wise (Multiple Invoices)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === "outlet"
                        ? "Generates separate individual invoices for each selected outlet."
                        : "Generates one single invoice covering all operational deliveries."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchInvoiceGenerationType === "outlet" && (
                <FormField control={form.control} name="linkedOutlets" render={({ field }) => {
                  const availableOutlets = outletsList?.filter((o: any) => {
                    const brandId = form.watch("brandId");
                    if (brandId && brandId !== "none") {
                      return o.brandId === brandId;
                    }
                    if (watchCustomerId) {
                      return o.clientId === watchCustomerId;
                    }
                    return true;
                  }) || [];

                  const filteredOutlets = availableOutlets.filter((o: any) =>
                    !outletSearchTerm ||
                    o.name?.toLowerCase().includes(outletSearchTerm.toLowerCase()) ||
                    o.code?.toLowerCase().includes(outletSearchTerm.toLowerCase())
                  );

                  const allSelected = availableOutlets.length > 0 && availableOutlets.every((o: any) => field.value?.includes(o.id));

                  return (
                    <FormItem className="space-y-2 border rounded-lg p-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="font-semibold text-sm">Linked Outlets for Multiple Invoices</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {field.value?.length || 0} of {availableOutlets.length} outlet(s) selected. A separate invoice will be created for each selected outlet.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (allSelected) {
                              field.onChange([]);
                            } else {
                              field.onChange(availableOutlets.map((o: any) => o.id));
                            }
                          }}
                        >
                          {allSelected ? "Deselect All" : "Select All"}
                        </Button>
                      </div>

                      {availableOutlets.length > 5 && (
                        <div className="pt-1">
                          <Input
                            placeholder="Search outlets by name or code..."
                            value={outletSearchTerm}
                            onChange={(e) => setOutletSearchTerm(e.target.value)}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      )}

                      <div className="border rounded-md p-3 max-h-52 overflow-y-auto space-y-2 bg-background">
                        {filteredOutlets.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-4">
                            {availableOutlets.length === 0 ? "No outlets found for this selection." : "No matching outlets found."}
                          </div>
                        ) : (
                          filteredOutlets.map((outlet: any) => (
                            <div key={outlet.id} className="flex items-center space-x-2 py-0.5 hover:bg-muted/40 px-1.5 rounded">
                              <input
                                type="checkbox"
                                id={`linked-outlet-${outlet.id}`}
                                checked={field.value?.includes(outlet.id) || false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  if (checked) {
                                    field.onChange([...(field.value || []), outlet.id]);
                                  } else {
                                    field.onChange((field.value || []).filter((id: string) => id !== outlet.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              />
                              <label htmlFor={`linked-outlet-${outlet.id}`} className="text-xs font-medium cursor-pointer flex-1 flex justify-between items-center">
                                <span>{outlet.name}</span>
                                {outlet.code && <span className="text-[10px] text-muted-foreground font-mono">({outlet.code})</span>}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }} />
              )}

              {/* SERVICE TERMS (collapsible) */}
              <div className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowServiceTerms(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold">
                  <span>📋 Contract Term & Shift Hours</span>
                  {showServiceTerms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showServiceTerms && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Start Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                const duration = form.getValues("contractDurationYears");
                                if (duration && e.target.value) {
                                  const d = new Date(e.target.value);
                                  if (!isNaN(d.getTime())) {
                                    d.setFullYear(d.getFullYear() + parseInt(duration, 10));
                                    d.setDate(d.getDate() - 1);
                                    form.setValue("endDate", d.toISOString().split("T")[0]);
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="contractDurationYears" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Duration</FormLabel>
                          <Select 
                            onValueChange={(val) => {
                              field.onChange(val);
                              const start = form.getValues("startDate");
                              if (start && val) {
                                const d = new Date(start);
                                if (!isNaN(d.getTime())) {
                                  d.setFullYear(d.getFullYear() + parseInt(val, 10));
                                  d.setDate(d.getDate() - 1);
                                  form.setValue("endDate", d.toISOString().split("T")[0]);
                                }
                              }
                            }} 
                            value={field.value || ""}
                          >
                            <FormControl><SelectTrigger><SelectValue placeholder="Years" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Array.from({ length: 25 }, (_, i) => i + 1).map(y => (
                                <SelectItem key={y} value={y.toString()}>{y} Year{y > 1 ? 's' : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="endDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract End Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField control={form.control} name="workingHoursPerDay" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Hours / Day</FormLabel>
                          <FormControl><Input type="number" min="1" max="24" placeholder="10" {...field} /></FormControl>
                          <FormDescription>Standard shift: 10 hrs</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="graceHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grace Hours Before OT</FormLabel>
                          <FormControl><Input placeholder="0" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="otStartsAfterHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel>OT Starts After X Hours</FormLabel>
                          <FormControl><Input placeholder="10" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}
              </div>

              {/* ADDITIONAL CHARGES & SURCHARGES (collapsible) */}
              <div className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowAdditionalCharges(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold">
                  <span>💰 Quick Delivery & Additional Charges</span>
                  {showAdditionalCharges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showAdditionalCharges && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="emergencyDeliveryCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quick / Emergency Delivery (BD / Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormDescription>Applied for urgent / unscheduled quick deliveries.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="extraTruckCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extra Truck Charge (BD / Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="redeliveryCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Redelivery Charge (BD / Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="additionalLabourCharges" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Labour (BD / Hour)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              {/* DOCUMENTS UPLOAD */}
              <div className="border-t pt-4 space-y-2">
                <FormLabel>Contract Documents (PDFs / Docs)</FormLabel>
                <div className="flex items-center gap-4">
                  <Input type="file" multiple accept=".pdf,.doc,.docx,image/*" onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
                  {isUploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading docs...</span>}
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/50 p-2 rounded text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="font-medium truncate max-w-[350px]">{file.name}</span>
                          {file.version && <Badge variant="outline" className="text-[10px] px-1">v{file.version}</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={file.url} target="_blank" rel="noreferrer" className="p-1 text-primary hover:underline"><Eye className="h-3 w-3" /></a>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeUploadedFile(idx)} className="h-6 w-6 p-0 text-red-600 hover:text-red-800">
                            <Trash className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingId ? "Update Contract" : "Save Contract"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── VIEW CONTRACT & OPERATIONS & FINANCIAL RECORDS MODAL ── */}
      <Dialog open={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <DialogContent className="sm:max-w-[950px] max-h-[92vh] overflow-y-auto">
          {viewingContract && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      {viewingContract.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 flex items-center gap-2">
                      <span>Target:</span>
                      <strong>
                        {viewingContract.brandId || viewingContract.outletId
                          ? `${getOutletName(viewingContract.outletId)} (${getBrandName(viewingContract.brandId)})`
                          : getClientName(viewingContract.customerId)}
                      </strong>
                      <span className="text-muted-foreground/60">•</span>
                      <Badge variant="outline" className="capitalize">
                        {viewingContract.type === "lease" ? "Monthly Lease" : "Daily Delivery"}
                      </Badge>
                    </DialogDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    const c = viewingContract;
                    setViewingContract(null);
                    openEdit(c);
                  }}>
                    Edit Contract
                  </Button>
                </div>
              </DialogHeader>

              {/* DATE RANGE & TYPE FILTER BAR */}
              <div className="p-4 bg-muted/40 rounded-xl border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter Records & Activity</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={apply1MonthPreset}>
                      1 Month
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyContractTermPreset}>
                      Full Term
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyLast30DaysPreset}>
                      Last 30 Days
                    </Button>
                  </div>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-${viewingContract?.linkedOutlets && viewingContract.linkedOutlets.length > 0 ? "4" : "3"} gap-3`}>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">From Date</label>
                    <Input
                      type="date"
                      value={recordsStartDate}
                      onChange={(e) => setRecordsStartDate(e.target.value)}
                      className="h-9 bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">To Date</label>
                    <Input
                      type="date"
                      value={recordsEndDate}
                      onChange={(e) => setRecordsEndDate(e.target.value)}
                      className="h-9 bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Delivery Category</label>
                    <Select value={deliveryTypeFilter} onValueChange={(val: any) => setDeliveryTypeFilter(val)}>
                      <SelectTrigger className="h-9 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Deliveries</SelectItem>
                        <SelectItem value="regular">Regular Deliveries Only</SelectItem>
                        <SelectItem value="quick">Quick / Emergency Deliveries Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {viewingContract?.linkedOutlets && viewingContract.linkedOutlets.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Filter by Outlet</label>
                      <Select value={selectedOutletFilter} onValueChange={setSelectedOutletFilter}>
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue placeholder="All Outlets" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Linked Outlets ({viewingContract.linkedOutlets.length})</SelectItem>
                          {viewingContract.linkedOutlets.map((oid: string) => (
                            <SelectItem key={oid} value={oid}>
                              {getOutletName(oid)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* KPI SUMMARY CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="p-3 bg-card border shadow-sm">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">Regular Deliveries</div>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    {contractRecords?.summary?.regularDeliveries ?? 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Scheduled duty</div>
                </Card>

                <Card className="p-3 bg-amber-500/10 border border-amber-500/30 shadow-sm">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-600" /> Quick Deliveries
                  </div>
                  <div className="text-xl font-bold mt-1 text-amber-700">
                    {contractRecords?.summary?.quickDeliveries ?? 0}
                  </div>
                  <div className="text-[10px] text-amber-600">Urgent / Emergency</div>
                </Card>

                <Card className="p-3 bg-card border shadow-sm">
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">Total Invoiced</div>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    <CurrencyDisplay amount={contractRecords?.summary?.totalBilled ?? 0} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{contractRecords?.invoices?.length || 0} invoice(s)</div>
                </Card>

                <Card className="p-3 bg-emerald-500/10 border border-emerald-500/30 shadow-sm">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase">Paid Amount</div>
                  <div className="text-xl font-bold mt-1 text-emerald-700">
                    <CurrencyDisplay amount={contractRecords?.summary?.totalPaid ?? 0} />
                  </div>
                  <div className="text-[10px] text-emerald-600">Reconciled payments</div>
                </Card>

                <Card className="p-3 bg-rose-500/10 border border-rose-500/30 shadow-sm col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-semibold text-rose-700 uppercase">Outstanding</div>
                  <div className="text-xl font-bold mt-1 text-rose-700">
                    <CurrencyDisplay amount={contractRecords?.summary?.totalOutstanding ?? 0} />
                  </div>
                  <div className="text-[10px] text-rose-600">Due balance</div>
                </Card>
              </div>

              {/* TABS: DELIVERIES vs PAYMENTS vs TERMS */}
              {(() => {
                const displayedDeliveries = (contractRecords?.deliveries || []).filter((del: any) => {
                  if (selectedOutletFilter !== "all" && del.outletId && del.outletId !== selectedOutletFilter) {
                    return false;
                  }
                  return true;
                });

                const displayedInvoices = (contractRecords?.invoices || []).filter((inv: any) => {
                  if (selectedOutletFilter !== "all" && inv.outletId && inv.outletId !== selectedOutletFilter) {
                    return false;
                  }
                  return true;
                });

                return (
                  <Tabs value={activeViewTab} onValueChange={(v: any) => setActiveViewTab(v)}>
                    <TabsList className="grid grid-cols-3 w-full max-w-md">
                      <TabsTrigger value="deliveries" className="gap-1.5">
                        <Truck className="h-4 w-4" />
                        Deliveries ({displayedDeliveries.length})
                      </TabsTrigger>
                      <TabsTrigger value="payments" className="gap-1.5">
                        <Receipt className="h-4 w-4" />
                        Invoices ({displayedInvoices.length})
                      </TabsTrigger>
                      <TabsTrigger value="terms" className="gap-1.5">
                        <FileText className="h-4 w-4" />
                        Terms & Docs
                      </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: ALL DELIVERIES (REGULAR & QUICK) */}
                    <TabsContent value="deliveries" className="mt-4 space-y-3">
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Outlet / Destination</TableHead>
                              <TableHead>Item / Cargo Details</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">POD</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isLoadingRecords ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  Loading delivery records...
                                </TableCell>
                              </TableRow>
                            ) : displayedDeliveries.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  No deliveries recorded for this contract in the selected period.
                                </TableCell>
                              </TableRow>
                            ) : (
                              displayedDeliveries.map((del: any, idx: number) => (
                                <TableRow key={del.id || idx} className="hover:bg-muted/30">
                                  <TableCell className="text-xs font-medium">
                                    {del.deliveryDate ? format(new Date(del.deliveryDate), "dd/MM/yyyy") : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {del.type === "quick" ? (
                                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-[11px] font-semibold">
                                        <Zap className="h-3 w-3 fill-white" /> Quick Delivery
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-[11px]">
                                        Regular Delivery
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium text-xs">{del.outletName || "Outlet Direct"}</div>
                                    {del.outletCode && <div className="text-[10px] text-muted-foreground">{del.outletCode}</div>}
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-xs font-medium">{del.itemCode || "Cargo"}</div>
                                    <div className="text-[11px] text-muted-foreground truncate max-w-xs">{del.itemDescription || "General delivery"}</div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-semibold">
                                    {del.deliveredQty || del.requestedQty || 1} {del.uom || ""}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      del.status === "completed" || del.status === "delivered"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}>
                                      {del.status || "Completed"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {del.podUrl ? (
                                      <a href={del.podUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                                        <Eye className="h-3.5 w-3.5" /> POD
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    {/* TAB 2: PAYMENTS & INVOICES */}
                    <TabsContent value="payments" className="mt-4 space-y-4">
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Contract Invoices</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Outlet</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead className="text-right">Base Amount</TableHead>
                                <TableHead className="text-right">Surcharges / OT</TableHead>
                                <TableHead className="text-right">Total Invoiced</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {displayedInvoices.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                                    No invoices generated for this contract yet.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                displayedInvoices.map((inv: any) => {
                                  const surcharges = parseFloat(inv.otAmount || "0") +
                                    parseFloat(inv.holidayAmount || "0") +
                                    parseFloat(inv.emergencyAmount || "0") +
                                    parseFloat(inv.extraTruckAmount || "0");
                                  return (
                                    <TableRow key={inv.id}>
                                      <TableCell className="font-semibold text-xs">{inv.invoiceNumber}</TableCell>
                                      <TableCell className="text-xs">{getOutletName(inv.outletId) || "Consolidated"}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {inv.periodStart} → {inv.periodEnd}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-xs"><CurrencyDisplay amount={inv.baseAmount} /></TableCell>
                                      <TableCell className="text-right font-mono text-xs"><CurrencyDisplay amount={surcharges} /></TableCell>
                                      <TableCell className="text-right font-mono text-xs font-bold"><CurrencyDisplay amount={inv.totalAmount} /></TableCell>
                                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-semibold"><CurrencyDisplay amount={inv.paidAmount || "0"} /></TableCell>
                                      <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                                          inv.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                                          inv.status === "sent" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-800"
                                        }`}>
                                          {inv.status}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Payment Transactions</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Reference / Note</TableHead>
                                <TableHead className="text-right">Amount Received</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {!contractRecords?.payments || contractRecords.payments.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                    No payment records logged for this contract.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                contractRecords.payments.map((pmt: any) => (
                                  <TableRow key={pmt.id}>
                                    <TableCell className="text-xs">
                                      {pmt.paymentDate ? format(new Date(pmt.paymentDate), "dd/MM/yyyy") : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs capitalize font-medium">
                                      {pmt.paymentMethod?.replace("_", " ") || "Bank Transfer"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {pmt.reference || pmt.notes || "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-bold text-emerald-600">
                                      <CurrencyDisplay amount={pmt.amount} />
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>

                    {/* TAB 3: CONTRACT TERMS & DOCS */}
                    <TabsContent value="terms" className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
                        <div>
                          <div className="text-xs text-muted-foreground">Billing Option</div>
                          <div className="font-semibold text-sm capitalize">{viewingContract.type === "lease" ? "Monthly Lease" : "Daily Delivery"}</div>
                        </div>
                        {viewingContract.type === "lease" ? (
                          <>
                            <div>
                              <div className="text-xs text-muted-foreground">Leased Trucks</div>
                              <div className="font-semibold text-sm">{viewingContract.numVehicles || 0}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Monthly Rate / Truck</div>
                              <div className="font-semibold text-sm"><CurrencyDisplay amount={viewingContract.monthlyRate || "0"} /></div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <div className="text-xs text-muted-foreground">Daily Delivery Rate</div>
                              <div className="font-semibold text-sm"><CurrencyDisplay amount={(viewingContract as any).dailyRate || viewingContract.monthlyRate || "0"} /></div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Included Deliveries / Day</div>
                              <div className="font-semibold text-sm">{viewingContract.includedDeliveriesPerDay || 0}</div>
                            </div>
                          </>
                        )}
                        <div>
                          <div className="text-xs text-muted-foreground">Shift Hours / Day</div>
                          <div className="font-semibold text-sm">{viewingContract.workingHoursPerDay || 10} Hours</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
                        <div>
                          <div className="text-xs text-muted-foreground">Overtime Rate</div>
                          <div className="font-semibold text-sm"><CurrencyDisplay amount={viewingContract.otCharges || "0"} /> / hr</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Holiday Rate</div>
                          <div className="font-semibold text-sm"><CurrencyDisplay amount={viewingContract.holidayCharges || "0"} /> / day</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Quick Delivery Surcharge</div>
                          <div className="font-semibold text-sm text-amber-700"><CurrencyDisplay amount={viewingContract.emergencyDeliveryCharge || "0"} /></div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Extra Truck Charge</div>
                          <div className="font-semibold text-sm"><CurrencyDisplay amount={viewingContract.extraTruckCharge || "0"} /></div>
                        </div>
                      </div>

                      {/* Attached Documents */}
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Attached Contract Documents</h4>
                        {viewingContract.documents && (viewingContract.documents as any[]).length > 0 ? (
                          <div className="space-y-2">
                            {(viewingContract.documents as any[]).map((doc, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border text-sm">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-primary" />
                                  <div>
                                    <div className="font-medium">{doc.name} {doc.version ? `(v${doc.version})` : ""}</div>
                                    {doc.uploadedAt && <div className="text-xs text-muted-foreground">Uploaded on {new Date(doc.uploadedAt).toLocaleDateString()}</div>}
                                  </div>
                                </div>
                                <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:bg-primary/10 px-3 py-1.5 rounded-md transition-colors font-medium text-xs">
                                  <ExternalLink className="h-4 w-4" /> View Document
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">No documents attached to this contract.</div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                );
              })()}

              <DialogFooter className="mt-4 pt-3 border-t">
                <Button variant="outline" onClick={() => setViewingContract(null)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
