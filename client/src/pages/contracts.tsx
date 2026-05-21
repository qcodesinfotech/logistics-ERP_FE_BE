import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Download, Upload, Trash, Eye, Wallet, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  documents: z.array(z.object({
    name: z.string(),
    url: z.string()
  })).default([]),
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function ContractsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);
  const { toast } = useToast();

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      customerId: "",
      name: "",
      type: "lease",
      monthlyRate: "0",
      numVehicles: 0,
      otCharges: "0",
      holidayCharges: "0",
      status: "active",
      documents: [],
    },
  });

  // Watch the fields to calculate totals on the fly
  const watchType = useWatch({ control: form.control, name: "type" });
  const watchNumVehicles = useWatch({ control: form.control, name: "numVehicles" }) || 0;
  const watchMonthlyRate = useWatch({ control: form.control, name: "monthlyRate" }) || "0";

  const { data: contractsList, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: (data: ContractFormData) => apiRequest("POST", "/api/contracts", {
      ...data,
      documents: uploadedFiles
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contract saved successfully" });
      setIsDialogOpen(false);
      form.reset();
      setUploadedFiles([]);
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
        headers: {
          // Token is fetched via auth-context but routes handle authentication
          "Authorization": `Bearer ${localStorage.getItem("accessToken") || ""}`
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      setUploadedFiles(prev => [...prev, ...result.documents]);
      toast({ title: `Uploaded ${result.documents.length} document(s)` });
    } catch (err) {
      toast({ title: "Document upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Mock template generator
  const downloadTemplate = (type: string) => {
    const templateContent = `TT LOGISTICS ERP CONTRACT TEMPLATE\nType: ${type}\nTerms and conditions of transport services.`;
    const blob = new Blob([templateContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Logistics_Contract_Template_${type}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `${type} contract template downloaded.` });
  };

  const getClientName = (id: string) => {
    return clientsList?.find(c => c.id === id)?.name || "Unknown Customer";
  };

  // Calculations for dashboard
  const activeContractsCount = contractsList?.filter(c => c.status === "active").length || 0;
  const totalContractMonthlyVal = contractsList?.reduce((sum, c) => {
    if (c.type === "lease") {
      const vehicles = c.numVehicles || 0;
      const rate = parseFloat(c.monthlyRate || "0");
      return sum + (vehicles * rate);
    }
    return sum;
  }, 0) || 0;

  const currentLeaseTotal = watchType === "lease" 
    ? (watchNumVehicles * parseFloat(watchMonthlyRate || "0")) 
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Contracts & Rate Management" 
        description="Manage customer logistics agreements, lease structures, variable fuel/OT charges, and contract documents."
      >
        <Button onClick={() => downloadTemplate("Daily_Basis")} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Daily Temp. Template
        </Button>
        <Button onClick={() => downloadTemplate("Monthly_Lease")} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Monthly Lease Template
        </Button>
        <Button onClick={() => {
          form.reset();
          setUploadedFiles([]);
          setIsDialogOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" /> Create Contract
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard
          title="Active Agreements"
          value={activeContractsCount}
          icon={FileText}
          description="Legally active vendor contracts"
        />
        <MetricCard
          title="Monthly Lease Billing"
          value={totalContractMonthlyVal}
          isCurrency
          icon={Wallet}
          description="Accrued monthly lease revenue"
        />
        <MetricCard
          title="Avg. Contract Term"
          value="12 Months"
          icon={ShieldAlert}
          description="Standard compliance duration"
        />
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
            <div className="p-12 text-center text-muted-foreground">
              No contracts found. Click 'Create Contract' to add one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Ref / Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Vehicles</TableHead>
                  <TableHead className="text-right">Base / Monthly Rate</TableHead>
                  <TableHead className="text-right">OT Rate (RO/Hr)</TableHead>
                  <TableHead className="text-right">Holiday (RO/Day)</TableHead>
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
                    <TableCell className="text-right font-mono">{contract.numVehicles || 0}</TableCell>
                    <TableCell className="text-right">
                      {contract.type === "lease" ? (
                        <div className="flex flex-col items-end">
                          <CurrencyDisplay amount={contract.monthlyRate} />
                          <span className="text-[10px] text-muted-foreground">
                            Total: <CurrencyDisplay amount={(contract.numVehicles || 0) * parseFloat(contract.monthlyRate || "0")} />
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Daily variable</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={contract.otCharges} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={contract.holidayCharges} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contract.status} />
                    </TableCell>
                    <TableCell>
                      {contract.documents && (contract.documents as any[]).length > 0 ? (
                        <div className="flex gap-1">
                          {(contract.documents as any[]).map((doc, idx) => (
                            <a 
                              key={idx} 
                              href={doc.url} 
                              target="_blank" 
                              rel="noreferrer"
                              title={doc.name}
                              className="p-1 rounded bg-secondary hover:bg-primary/20 transition-colors text-primary flex items-center justify-center"
                            >
                              <Eye className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No docs</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => {
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
                        });
                        setUploadedFiles((contract.documents as any[]) || []);
                        setIsDialogOpen(true);
                      }}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Contract Agreement</DialogTitle>
            <DialogDescription>
              Set customer service level parameters. All currency amounts are in Omani Rial (RO).
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client / Customer *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientsList?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Reference *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. C-2026-MUSCAT-01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Cycle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily variable</SelectItem>
                          <SelectItem value="lease">Monthly Lease</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numVehicles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. of Leased Trucks</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0" {...field} disabled={watchType !== "lease"} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate / Truck (RO/Mo)</FormLabel>
                      <FormControl>
                        <Input placeholder="0.000" {...field} disabled={watchType !== "lease"} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {watchType === "lease" && (
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex justify-between items-center text-sm font-semibold text-primary">
                  <span>Estimated Monthly Revenue:</span>
                  <span><CurrencyDisplay amount={currentLeaseTotal} size="lg" /></span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <FormField
                  control={form.control}
                  name="otCharges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Rate (RO / Hour)</FormLabel>
                      <FormControl>
                        <Input placeholder="0.000" {...field} />
                      </FormControl>
                      <FormDescription>Applied after standard shift hours.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="holidayCharges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Holiday Rate (RO / Day)</FormLabel>
                      <FormControl>
                        <Input placeholder="0.000" {...field} />
                      </FormControl>
                      <FormDescription>Applied for Friday/Holiday duties.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4 space-y-2">
                <FormLabel>Contract Documents (PDFs / Docs)</FormLabel>
                <div className="flex items-center gap-4">
                  <Input 
                    type="file" 
                    multiple 
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleFileUpload} 
                    disabled={isUploading}
                    className="cursor-pointer" 
                  />
                  {isUploading && <span className="text-xs text-muted-foreground animate-pulse">Uploading docs...</span>}
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/50 p-2 rounded text-xs">
                        <span className="font-medium truncate max-w-[400px]">{file.name}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeUploadedFile(idx)} className="h-6 w-6 p-0 text-red-600 hover:text-red-800">
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save Contract"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
