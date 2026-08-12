import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, Plus, FileText, Check, Send, AlertCircle, Banknote, Clock, Printer, CreditCard, Share2, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyDisplay } from "@/components/currency-display";
import { MetricCard } from "@/components/metric-card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:         { label: "Draft",          color: "bg-slate-100 text-slate-700 border-slate-200",   icon: FileText },
  approved:      { label: "Approved",       color: "bg-blue-100 text-blue-700 border-blue-200",      icon: Check },
  sent:          { label: "Sent",           color: "bg-purple-100 text-purple-700 border-purple-200", icon: Send },
  paid:          { label: "Paid",           color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Banknote },
  partially_paid:{ label: "Partial",        color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock },
  overdue:       { label: "Overdue",        color: "bg-red-100 text-red-700 border-red-200",         icon: AlertCircle },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

export default function BrandInvoicesPage() {
  const { toast } = useToast();
  const [generateDialog, setGenerateDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [genForm, setGenForm] = useState<{ generationLevel: "brand"|"outlet", brandId: string, periodStart: string, periodEnd: string }>({ 
    generationLevel: "brand", 
    brandId: "", 
    periodStart: "", 
    periodEnd: "" 
  });

  const { data: invoices = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/brand-invoices"] });
  const { data: brands = [] } = useQuery<any[]>({ queryKey: ["/api/brands"] });
  const { data: outlets = [] } = useQuery<any[]>({ queryKey: ["/api/outlets"] });

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const totalOutstanding = invoices.filter(i => ["sent", "approved", "partially_paid", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/brand-invoices/generate", genForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-invoices"] });
      toast({ title: "Invoice generated successfully!" });
      setGenerateDialog(false);
      setGenForm({ generationLevel: "brand", brandId: "", periodStart: "", periodEnd: "" });
    },
    onError: (e: unknown) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/brand-invoices/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brand-invoices"] });
      toast({ title: "Invoice status updated!" });
      setViewDialog(null);
    },
    onError: (e: unknown) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const getBrandName = (id: string) => brands.find(b => b.id === id)?.name || id;
  const getOutletName = (id: string) => outlets.find(o => o.id === id)?.name || id;

  const filteredInvoices = invoices.filter(inv => {
    const brandOrOutletName = inv.generationLevel === "brand" ? getBrandName(inv.brandId) : getOutletName(inv.outletId || inv.brandId);
    const matchesSearch = searchTerm === "" || 
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      brandOrOutletName.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStartDate = true;
    let matchesEndDate = true;
    
    if (filterStartDate) matchesStartDate = new Date(inv.periodStart) >= new Date(filterStartDate);
    if (filterEndDate) matchesEndDate = new Date(inv.periodEnd) <= new Date(filterEndDate);
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Brand & Outlet Invoices"
        description="Generate invoices for brands or individual outlets based on delivery schedules and additional charges."
      >
        <Button onClick={() => setGenerateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Generate Invoice
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard title="Total Paid" value={totalPaid} isCurrency icon={Banknote} description="Settled brand/outlet invoices" />
        <MetricCard title="Outstanding" value={totalOutstanding} isCurrency icon={Clock} description="Pending + sent invoices" />
        <MetricCard title="Overdue" value={overdueCount} icon={AlertCircle} description="Invoices past due date" />
      </div>

      <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
        <CardHeader className="border-b">
          <CardTitle>Invoices Registry</CardTitle>
          <CardDescription>View and manage all generated invoices for your brands and outlets.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 bg-muted/20 border-b flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or invoice #"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-background w-36 text-xs"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-background w-36 text-xs"
                />
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No invoices found matching the criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Target Entity</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => setViewDialog(inv)}>
                      <TableCell className="font-mono font-semibold text-primary">{inv.invoiceNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{inv.generationLevel === "brand" ? getBrandName(inv.brandId) : getOutletName(inv.outletId || inv.brandId)}</div>
                        <Badge variant="outline" className="mt-1 text-[10px] uppercase">{inv.generationLevel}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{inv.periodStart} → {inv.periodEnd}</TableCell>
                      <TableCell className="text-right font-bold"><CurrencyDisplay amount={inv.totalAmount} /></TableCell>
                      <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); setViewDialog(inv); }}>
                          <Receipt className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Generate Invoice</DialogTitle>
            <DialogDescription>Generate an invoice for a brand (consolidated) or a specific outlet over a date range. It automatically calculates delivery amounts and extra charges.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RadioGroup 
              value={genForm.generationLevel} 
              onValueChange={(val: any) => setGenForm({ ...genForm, generationLevel: val, brandId: "" })} 
              className="flex gap-4 mb-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="brand" id="gen-brand" />
                <Label htmlFor="gen-brand">By Brand</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="outlet" id="gen-outlet" />
                <Label htmlFor="gen-outlet">By Outlet</Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label>{genForm.generationLevel === "brand" ? "Select Brand *" : "Select Outlet *"}</Label>
              <Select value={genForm.brandId} onValueChange={v => setGenForm(f => ({ ...f, brandId: v }))}>
                <SelectTrigger><SelectValue placeholder={`Select ${genForm.generationLevel}...`} /></SelectTrigger>
                <SelectContent>
                  {genForm.generationLevel === "brand" 
                    ? brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
                    : outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name} ({getBrandName(o.brandId)})</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From Date *</Label>
                <Input type="date" value={genForm.periodStart} onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>To Date *</Label>
                <Input type="date" value={genForm.periodEnd} onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>Cancel</Button>
            <Button
              disabled={!genForm.brandId || !genForm.periodStart || !genForm.periodEnd || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Invoice Detail Dialog */}
      {viewDialog && (
        <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice {viewDialog.invoiceNumber}</DialogTitle>
            </DialogHeader>
            <div id="invoice-print" className="space-y-6 bg-white text-black p-6 border rounded-md">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h1 className="text-2xl font-bold uppercase text-gray-800">Invoice</h1>
                  <p className="text-gray-500 mt-1 text-sm">Invoice #: {viewDialog.invoiceNumber}</p>
                  <p className="text-gray-500 text-sm">Period: {viewDialog.periodStart} to {viewDialog.periodEnd}</p>
                </div>
                <div className="text-right">
                  <h2 className="font-semibold text-lg text-gray-800">QC Logistic Management</h2>
                  <p className="text-gray-600 text-sm">Bahrain</p>
                  <InvoiceStatusBadge status={viewDialog.status} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Bill To</p>
                <p className="font-bold text-gray-800">{viewDialog.generationLevel === "brand" ? getBrandName(viewDialog.brandId) : getOutletName(viewDialog.outletId || viewDialog.brandId)}</p>
                {viewDialog.generationLevel === "outlet" && <p className="text-gray-600 text-sm">Brand: {getBrandName(outlets.find(o => o.id === viewDialog.outletId || viewDialog.brandId)?.brandId)}</p>}
              </div>

              <Table className="border">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-bold text-gray-800">Description</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Amount (BD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Base Delivery Charges ({viewDialog.deliveryCount} Deliveries)</TableCell>
                    <TableCell className="text-right font-semibold"><CurrencyDisplay amount={viewDialog.baseDeliveryAmount} /></TableCell>
                  </TableRow>
                  {parseFloat(viewDialog.extraLabourAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Extra Labour Charges</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.extraLabourAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.emergencyDeliveryAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Emergency Delivery Charges</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.emergencyDeliveryAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.redeliveryAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Redelivery Charges</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.redeliveryAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.otherChargesAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Other Charges</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.otherChargesAmount} /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between font-bold text-xl border-t-2 pt-2 border-gray-800 text-gray-800">
                    <span>Total:</span>
                    <span><CurrencyDisplay amount={viewDialog.totalAmount} /></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2 flex-wrap">
                {viewDialog.status === "draft" && (
                  <Button size="sm" onClick={() => statusMutation.mutate({ id: viewDialog.id, status: "approved" })} className="gap-1">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                )}
                {viewDialog.status === "approved" && (
                  <Button size="sm" onClick={() => statusMutation.mutate({ id: viewDialog.id, status: "sent" })} variant="outline" className="gap-1">
                    <Send className="h-3.5 w-3.5" /> Mark as Sent
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
