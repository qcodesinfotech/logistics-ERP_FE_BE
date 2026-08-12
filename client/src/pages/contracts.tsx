import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Download, Upload, Trash, Eye, Wallet, ShieldAlert, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
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

const contractSchema = z.object({
  customerId: z.string().optional(),
  brandId: z.string().optional(),
  outletId: z.string().optional(),
  name: z.string().min(1, "Contract Name/Ref is required"),
  type: z.enum(["daily", "lease"]),
  monthlyRate: z.string().default("0"),
  numVehicles: z.coerce.number().default(0),
  otCharges: z.string().default("0"),
  holidayCharges: z.string().default("0"),
  status: z.enum(["active", "inactive"]),
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
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; version?: number; uploadedAt?: string }[]>([]);
  const [showServiceTerms, setShowServiceTerms] = useState(false);
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false);
  const [selectedOutletForConfig, setSelectedOutletForConfig] = useState<any | null>(null);
  const { toast } = useToast();

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      customerId: "", name: "", type: "lease", monthlyRate: "0", numVehicles: 0,
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
  const watchInvoiceGenerationType = useWatch({ control: form.control, name: "invoiceGenerationType" });
  const watchCustomerId = useWatch({ control: form.control, name: "customerId" });

  const { data: contractsList, isLoading } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: brandsList } = useQuery<any[]>({ queryKey: ["/api/brands"] });
  const { data: outletsList } = useQuery<any[]>({ queryKey: ["/api/outlets"] });

  const saveMutation = useMutation({
    mutationFn: (data: ContractFormData) => {
      const { contractDurationYears, ...rest } = data;
      const payload = { ...rest, documents: uploadedFiles };
      if (editingId) return apiRequest("PUT", `/api/contracts/${editingId}`, payload);
      return apiRequest("POST", "/api/contracts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: editingId ? "Contract updated successfully" : "Contract saved successfully" });
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
    form.reset();
    setUploadedFiles([]);
    setShowServiceTerms(false);
    setShowAdditionalCharges(false);
    setSelectedOutletForConfig(null);
    setIsDialogOpen(true);
  };

  const openEdit = (contract: any) => {
    setEditingId(contract.id);
    form.reset({
      customerId: contract.customerId,
      name: contract.name,
      type: contract.type as "daily" | "lease",
      monthlyRate: contract.monthlyRate || "0",
      numVehicles: contract.numVehicles || 0,
      otCharges: contract.otCharges || "0",
      holidayCharges: contract.holidayCharges || "0",
      status: contract.status as "active" | "inactive",
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
      invoiceGenerationType: contract.invoiceGenerationType as "brand" | "outlet" || "brand",
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
        description="Manage customer logistics agreements, lease structures, variable fuel/OT charges, additional charge rules, and contract documents."
      >
        <Button onClick={() => downloadTemplate("Daily_Basis")} variant="outline" className="gap-2">
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
          <CardDescription>Comprehensive list of operational contracts with associated rates and documents.</CardDescription>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="text-right">Vehicles</TableHead>
                    <TableHead className="text-right">Base / Monthly Rate</TableHead>
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
                        {contract.brandId ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{getOutletName(contract.outletId)}</span>
                            <span className="text-xs text-muted-foreground">{getBrandName(contract.brandId)}</span>
                          </div>
                        ) : (
                          getClientName(contract.customerId)
                        )}
                      </TableCell>
                      <TableCell className="capitalize text-xs font-medium text-muted-foreground">
                        {contract.type === "lease" ? "Monthly Lease" : "Daily Rate"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {(contract as any).startDate ? (
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            <span>{(contract as any).startDate} → {(contract as any).endDate || "Open"}</span>
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{contract.numVehicles || 0}</TableCell>
                      <TableCell className="text-right">
                        {contract.type === "lease" ? (
                          <div className="flex flex-col items-end">
                            <CurrencyDisplay amount={contract.monthlyRate} />
                            <span className="text-[10px] text-muted-foreground">Total: <CurrencyDisplay amount={(contract.numVehicles || 0) * parseFloat(contract.monthlyRate || "0")} /></span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Daily variable</span>}
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
                          <Button variant="ghost" size="sm" onClick={() => setViewingContract(contract)}>
                            <Eye className="h-4 w-4 mr-1" /> View
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

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Contract Agreement" : "Configure Contract Agreement"}</DialogTitle>
            <DialogDescription>Set customer service level parameters. All currency amounts are in Bahraini Dinar (BD).</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">

              {/* ── BASIC INFO ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="brandId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand (Optional)</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      if (val) form.setValue("customerId", "");
                      setSelectedOutletForConfig(null);
                    }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Brand</SelectItem>
                        {brandsList?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {(!form.watch("brandId") || form.watch("brandId") === "none") && (
                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client / Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                        <SelectContent>{clientsList?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              {form.watch("brandId") && form.watch("brandId") !== "none" && !selectedOutletForConfig ? (
                <div className="space-y-4 pt-4 border-t mt-4">
                  <h3 className="text-sm font-medium">Select an Outlet to Configure Contract</h3>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                    {outletsList?.filter(o => o.brandId === form.watch("brandId")).length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 text-center">No outlets found for this brand.</div>
                    ) : (
                      outletsList?.filter(o => o.brandId === form.watch("brandId")).map(outlet => {
                        const hasContract = contractsList?.some(c => c.outletId === outlet.id);
                        return (
                          <div key={outlet.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30 transition-colors">
                            <div>
                              <div className="font-medium">{outlet.name}</div>
                              <div className="text-xs text-muted-foreground">{hasContract ? "Contract Configured" : "No Contract"}</div>
                            </div>
                            <Button type="button" size="sm" variant={hasContract ? "outline" : "default"} onClick={() => {
                               const existing = contractsList?.find(c => c.outletId === outlet.id);
                               if (existing) {
                                 openEdit(existing);
                               } else {
                                 form.reset({
                                   ...form.getValues(),
                                   name: `Contract - ${outlet.name}`, type: "lease", monthlyRate: "0", numVehicles: 0,
                                   customerId: "", brandId: form.watch("brandId"), outletId: outlet.id,
                                 });
                                 setSelectedOutletForConfig(outlet);
                               }
                            }}>
                              {hasContract ? "Edit Contract" : "Configure Contract"}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mt-4">
                  {selectedOutletForConfig && (
                    <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/20">
                       <span className="text-sm font-semibold text-primary">Configuring Contract for Outlet: {selectedOutletForConfig.name}</span>
                       <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOutletForConfig(null)}>Cancel</Button>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Reference *</FormLabel>
                        <FormControl><Input placeholder="e.g. C-2026-KFC-01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Cycle</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily Variable</SelectItem>
                            <SelectItem value="lease">Monthly Lease</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                <FormField control={form.control} name="numVehicles" render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. of Leased Trucks</FormLabel>
                    <FormControl><Input type="number" min="0" placeholder="0" {...field} disabled={watchType !== "lease"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="monthlyRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate / Truck (BD/Mo)</FormLabel>
                    <FormControl><Input placeholder="0.000" {...field} disabled={watchType !== "lease"} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchType === "lease" && (
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex justify-between items-center text-sm font-semibold text-primary">
                  <span>Estimated Monthly Revenue:</span>
                  <span><CurrencyDisplay amount={currentLeaseTotal} size="lg" /></span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <FormField control={form.control} name="otCharges" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Rate (BD / Hour)</FormLabel>
                    <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                    <FormDescription>Applied after standard shift hours.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="holidayCharges" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Holiday Rate (BD / Day)</FormLabel>
                    <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                    <FormDescription>Applied for Friday/Holiday duties.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="invoiceGenerationType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Generation Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="brand">Brand-wise (Single Invoice)</SelectItem>
                        <SelectItem value="outlet">Outlet-wise (Multiple Invoices)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchInvoiceGenerationType === "outlet" && (
                <div className="grid grid-cols-1 gap-4">
                  <FormField control={form.control} name="linkedOutlets" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Linked Outlets</FormLabel>
                      <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                        {outletsList?.filter(o => !watchCustomerId || o.clientId === watchCustomerId).length === 0 ? (
                          <div className="text-sm text-muted-foreground">No outlets found for this client.</div>
                        ) : (
                          outletsList?.filter(o => !watchCustomerId || o.clientId === watchCustomerId).map((outlet: any) => (
                            <div key={outlet.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`outlet-${outlet.id}`}
                                checked={field.value.includes(outlet.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  if (checked) {
                                    field.onChange([...field.value, outlet.id]);
                                  } else {
                                    field.onChange(field.value.filter((id) => id !== outlet.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <label htmlFor={`outlet-${outlet.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {outlet.name} {outlet.code ? `(${outlet.code})` : ""}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      <FormDescription>Select which outlets should have individual invoices generated.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}

              {/* ── SERVICE TERMS (collapsible) ── */}
              <div className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowServiceTerms(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold">
                  <span>📋 Service Terms</span>
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
                            value={field.value}
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
                      <FormField control={form.control} name="includedDeliveriesPerDay" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deliveries / Day</FormLabel>
                          <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                          <FormDescription>Deliveries included per day</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="workingHoursPerDay" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Hours / Day</FormLabel>
                          <FormControl><Input type="number" min="1" max="24" placeholder="10" {...field} /></FormControl>
                          <FormDescription>Default: 10 hours</FormDescription>
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
                    </div>
                    <FormField control={form.control} name="otStartsAfterHours" render={({ field }) => (
                      <FormItem>
                        <FormLabel>OT Starts After X Hours</FormLabel>
                        <FormControl><Input placeholder="10" {...field} className="max-w-xs" /></FormControl>
                        <FormDescription>OT kicks in after this many hours of daily operation.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              {/* ── ADDITIONAL CHARGES (collapsible) ── */}
              <div className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowAdditionalCharges(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold">
                  <span>💰 Additional Charge Rules</span>
                  {showAdditionalCharges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showAdditionalCharges && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="extraTruckCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extra Truck Charge (BD/Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="emergencyDeliveryCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency Delivery Charge (BD/Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="redeliveryCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Redelivery Charge (BD/Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="additionalLabourCharges" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Labour charges per hour (BD)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </div>

              {/* ── DOCUMENTS ── */}
              <div className="border-t pt-4 space-y-2">
                <FormLabel>Contract Documents (PDFs / Docs)</FormLabel>
                <p className="text-xs text-muted-foreground">Documents are versioned automatically on each upload.</p>
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
                          {file.uploadedAt && <span className="text-muted-foreground hidden sm:inline">{new Date(file.uploadedAt).toLocaleDateString()}</span>}
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
            </div>
            )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* View Dialog */}
      <Dialog open={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details: {viewingContract?.name}</DialogTitle>
            <DialogDescription>Customer: {viewingContract ? getClientName(viewingContract.customerId) : ""}</DialogDescription>
          </DialogHeader>

          {viewingContract && (
            <div className="space-y-6 mt-2">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="font-medium capitalize">{viewingContract.type === "lease" ? "Monthly Lease" : "Daily Rate"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1"><StatusBadge status={viewingContract.status} /></div>
                </div>
                {viewingContract.type === "lease" && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Vehicles</div>
                      <div className="font-medium">{viewingContract.numVehicles || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Monthly Rate</div>
                      <div className="font-medium"><CurrencyDisplay amount={viewingContract.monthlyRate || "0"} /></div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">OT Rate</div>
                  <div className="font-medium"><CurrencyDisplay amount={viewingContract.otCharges || "0"} /> <span className="text-[10px] text-muted-foreground">/ Hour</span></div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Holiday Rate</div>
                  <div className="font-medium"><CurrencyDisplay amount={viewingContract.holidayCharges || "0"} /> <span className="text-[10px] text-muted-foreground">/ Day</span></div>
                </div>
              </div>

              {/* Service Terms */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 border-b text-sm font-semibold">Service Terms</div>
                <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Term:</span>
                    <span className="font-medium">{(viewingContract as any).startDate || "—"} to {(viewingContract as any).endDate || "Open"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Deliveries/Day:</span>
                    <span className="font-medium">{viewingContract.includedDeliveriesPerDay || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Working Hours:</span>
                    <span className="font-medium">{viewingContract.workingHoursPerDay || 10} hours</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Grace Hours:</span>
                    <span className="font-medium">{viewingContract.graceHours || 0} hours</span>
                  </div>
                </div>
              </div>

              {/* Additional Charges */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 border-b text-sm font-semibold">Additional Charges</div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Extra Truck:</span>
                    <span className="font-medium"><CurrencyDisplay amount={viewingContract.extraTruckCharge || "0"} /></span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Emergency:</span>
                    <span className="font-medium"><CurrencyDisplay amount={viewingContract.emergencyDeliveryCharge || "0"} /></span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Redelivery:</span>
                    <span className="font-medium"><CurrencyDisplay amount={viewingContract.redeliveryCharge || "0"} /></span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Add. Labour/Hr:</span>
                    <span className="font-medium"><CurrencyDisplay amount={viewingContract.additionalLabourCharges || "0"} /></span>
                  </div>
                </div>
              </div>

              {/* Attached Documents */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 border-b text-sm font-semibold">Attached Documents</div>
                <div className="p-4">
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
                            <Eye className="h-4 w-4" /> View Document
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">No documents attached to this contract.</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setViewingContract(null)}>Close</Button>
            <Button onClick={() => {
              const contractToEdit = viewingContract;
              setViewingContract(null);
              if (contractToEdit) openEdit(contractToEdit);
            }}>Edit Contract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
