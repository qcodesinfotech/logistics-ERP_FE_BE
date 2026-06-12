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
  customerId: z.string().min(1, "Customer is required"),
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
  endDate: z.string().optional(),
  includedDeliveriesPerDay: z.coerce.number().default(0),
  workingHoursPerDay: z.coerce.number().default(10),
  graceHours: z.string().default("0"),
  otStartsAfterHours: z.string().default("10"),
  // Additional Charges
  extraTruckCharge: z.string().default("0"),
  emergencyDeliveryCharge: z.string().default("0"),
  redeliveryCharge: z.string().default("0"),
  outsourcedVehicleCharge: z.string().default("0"),
  breakdownCharge: z.string().default("0"),
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function ContractsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; version?: number; uploadedAt?: string }[]>([]);
  const [showServiceTerms, setShowServiceTerms] = useState(false);
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      customerId: "", name: "", type: "lease", monthlyRate: "0", numVehicles: 0,
      otCharges: "0", holidayCharges: "0", status: "active", documents: [],
      startDate: "", endDate: "", includedDeliveriesPerDay: 0, workingHoursPerDay: 10,
      graceHours: "0", otStartsAfterHours: "10",
      extraTruckCharge: "0", emergencyDeliveryCharge: "0", redeliveryCharge: "0",
      outsourcedVehicleCharge: "0", breakdownCharge: "0",
    },
  });

  const watchType = useWatch({ control: form.control, name: "type" });
  const watchNumVehicles = useWatch({ control: form.control, name: "numVehicles" }) || 0;
  const watchMonthlyRate = useWatch({ control: form.control, name: "monthlyRate" }) || "0";

  const { data: contractsList, isLoading } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const saveMutation = useMutation({
    mutationFn: (data: ContractFormData) => {
      const payload = { ...data, documents: uploadedFiles };
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
        headers: { "Authorization": `Bearer ${localStorage.getItem("accessToken") || ""}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      const newDocs = result.documents.map((d: any) => ({
        ...d,
        version: uploadedFiles.length + 1,
        uploadedAt: new Date().toISOString(),
      }));
      setUploadedFiles(prev => [...prev, ...newDocs]);
      toast({ title: `Uploaded ${result.documents.length} document(s)` });
    } catch {
      toast({ title: "Document upload failed", variant: "destructive" });
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
      endDate: contract.endDate || "",
      includedDeliveriesPerDay: contract.includedDeliveriesPerDay || 0,
      workingHoursPerDay: contract.workingHoursPerDay || 10,
      graceHours: contract.graceHours || "0",
      otStartsAfterHours: contract.otStartsAfterHours || "10",
      extraTruckCharge: contract.extraTruckCharge || "0",
      emergencyDeliveryCharge: contract.emergencyDeliveryCharge || "0",
      redeliveryCharge: contract.redeliveryCharge || "0",
      outsourcedVehicleCharge: contract.outsourcedVehicleCharge || "0",
      breakdownCharge: contract.breakdownCharge || "0",
    });
    setUploadedFiles((contract.documents as any[]) || []);
    setIsDialogOpen(true);
  };

  const getClientName = (id: string) => clientsList?.find(c => c.id === id)?.name || "Unknown Customer";

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
                      <TableCell>{getClientName(contract.customerId)}</TableCell>
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
                        <Button variant="ghost" size="sm" onClick={() => openEdit(contract)}>Edit</Button>
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
              </div>

              {/* ── SERVICE TERMS (collapsible) ── */}
              <div className="border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowServiceTerms(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-semibold">
                  <span>📋 Service Terms</span>
                  {showServiceTerms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showServiceTerms && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Start Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
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
                    <FormField control={form.control} name="outsourcedVehicleCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outsourced Vehicle Charge (BD/Trip)</FormLabel>
                        <FormControl><Input placeholder="0.000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="breakdownCharge" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Breakdown Replacement Charge (BD)</FormLabel>
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
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
