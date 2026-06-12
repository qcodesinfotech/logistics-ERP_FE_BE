import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, Plus, FileText, Check, Send, Clock, AlertCircle, Banknote, ChevronDown, ChevronUp, Printer, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyDisplay } from "@/components/currency-display";
import { MetricCard } from "@/components/metric-card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Contract, Client } from "@shared/schema";
import { format } from "date-fns";

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

export default function ContractInvoicesPage() {
  const { toast } = useToast();
  const [generateDialog, setGenerateDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const [editUsageDialog, setEditUsageDialog] = useState<any | null>(null);
  const [genForm, setGenForm] = useState({ contractId: "", periodStart: "", periodEnd: "" });
  const [usageForm, setUsageForm] = useState({
    otHours: "0", holidayDays: "0", extraTruckTrips: "0",
    emergencyTrips: "0", redeliveryTrips: "0", outsourcedTrips: "0",
  });

  const { data: invoices = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/contract-invoices"] });
  const { data: contracts = [] } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const totalOutstanding = invoices.filter(i => ["sent", "approved", "partially_paid", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/contract-invoices/generate", genForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-invoices"] });
      toast({ title: "Invoice generated as Draft!" });
      setGenerateDialog(false);
      setGenForm({ contractId: "", periodStart: "", periodEnd: "" });
    },
    onError: (e: unknown) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/contract-invoices/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-invoices"] });
      toast({ title: "Invoice status updated!" });
      setViewDialog(null);
    },
    onError: (e: unknown) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const saveUsageMutation = useMutation({
    mutationFn: ({ contractId, month }: { contractId: string; month: string }) =>
      apiRequest("PUT", `/api/contracts/${contractId}/usage`, { month, ...usageForm }),
    onSuccess: () => {
      toast({ title: "Usage data saved! You can now generate the invoice." });
      setEditUsageDialog(null);
    },
    onError: (e: unknown) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || "Unknown";
  const getContractName = (id: string) => contracts.find(c => c.id === id)?.name || id;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Contract Invoices"
        description="Generate and manage invoices based on contract terms, monthly usage, overtime, holiday, and additional charges."
      >
        <Button onClick={() => setEditUsageDialog({})} variant="outline" className="gap-2">
          <Edit2 className="h-4 w-4" /> Log Monthly Usage
        </Button>
        <Button onClick={() => setGenerateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Generate Invoice
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard title="Total Paid" value={totalPaid} isCurrency icon={Banknote} description="Settled contract invoices" />
        <MetricCard title="Outstanding" value={totalOutstanding} isCurrency icon={Clock} description="Pending + sent invoices" />
        <MetricCard title="Overdue" value={overdueCount} icon={AlertCircle} description="Invoices past due date" />
      </div>

      <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
        <CardHeader className="border-b">
          <CardTitle>Contract Invoices Registry</CardTitle>
          <CardDescription>All invoices generated from active contracts. Click an invoice to view details or update status.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No contract invoices yet. Click 'Generate Invoice' to create one from a contract.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Extras</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const extras = parseFloat(inv.holidayAmount || "0") + parseFloat(inv.extraTruckAmount || "0") +
                      parseFloat(inv.emergencyAmount || "0") + parseFloat(inv.redeliveryAmount || "0") + parseFloat(inv.outsourcedAmount || "0");
                    return (
                      <TableRow key={inv.id} className="hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => setViewDialog(inv)}>
                        <TableCell className="font-mono font-semibold text-primary">{inv.invoiceNumber}</TableCell>
                        <TableCell>{getClientName(inv.customerId)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getContractName(inv.contractId)}</TableCell>
                        <TableCell className="text-xs font-mono">{inv.periodStart} → {inv.periodEnd}</TableCell>
                        <TableCell className="text-right"><CurrencyDisplay amount={inv.baseAmount} /></TableCell>
                        <TableCell className="text-right text-amber-600"><CurrencyDisplay amount={inv.otAmount} /></TableCell>
                        <TableCell className="text-right text-blue-600"><CurrencyDisplay amount={extras} /></TableCell>
                        <TableCell className="text-right font-bold"><CurrencyDisplay amount={inv.totalAmount} /></TableCell>
                        <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewDialog(inv); }}>
                            <Receipt className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Generate Contract Invoice</DialogTitle>
            <DialogDescription>Select a contract and billing period. The system calculates all charges from contract terms and logged monthly usage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Contract *</Label>
              <Select value={genForm.contractId} onValueChange={v => setGenForm(f => ({ ...f, contractId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select contract..." /></SelectTrigger>
                <SelectContent>
                  {contracts.filter(c => c.status === "active").map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {clients.find(cl => cl.id === c.customerId)?.name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Period Start *</Label>
                <Input type="date" value={genForm.periodStart} onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Period End *</Label>
                <Input type="date" value={genForm.periodEnd} onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>The invoice will automatically include:</p>
              <p>• Base monthly contract amount</p>
              <p>• OT hours × OT rate from monthly usage log</p>
              <p>• Holiday days × holiday rate</p>
              <p>• Extra truck / emergency / redelivery / outsourced trips</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>Cancel</Button>
            <Button
              disabled={!genForm.contractId || !genForm.periodStart || !genForm.periodEnd || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Monthly Usage Dialog */}
      <Dialog open={!!editUsageDialog} onOpenChange={() => setEditUsageDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="h-5 w-5 text-primary" /> Log Monthly Usage</DialogTitle>
            <DialogDescription>Enter actual usage for a contract-month. This data is used when generating the invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contract</Label>
                <Select value={editUsageDialog?.contractId || ""} onValueChange={v => setEditUsageDialog((f: any) => ({ ...f, contractId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select contract..." /></SelectTrigger>
                  <SelectContent>
                    {contracts.filter(c => c.status === "active").map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period Month (YYYY-MM-01)</Label>
                <Input type="date" value={editUsageDialog?.month || ""} onChange={e => setEditUsageDialog((f: any) => ({ ...f, month: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: "otHours", label: "OT Hours" },
                { key: "holidayDays", label: "Holiday Days" },
                { key: "extraTruckTrips", label: "Extra Truck Trips" },
                { key: "emergencyTrips", label: "Emergency Trips" },
                { key: "redeliveryTrips", label: "Redelivery Trips" },
                { key: "outsourcedTrips", label: "Outsourced Trips" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" min="0" step="0.5" value={(usageForm as any)[key]}
                    onChange={e => setUsageForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUsageDialog(null)}>Cancel</Button>
            <Button
              disabled={!editUsageDialog?.contractId || !editUsageDialog?.month || saveUsageMutation.isPending}
              onClick={() => saveUsageMutation.mutate({ contractId: editUsageDialog.contractId, month: editUsageDialog.month })}
            >
              {saveUsageMutation.isPending ? "Saving..." : "Save Usage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail / Print Dialog */}
      {viewDialog && (
        <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invoice {viewDialog.invoiceNumber}</DialogTitle>
            </DialogHeader>
            <div id="invoice-print" className="space-y-6 bg-white text-black p-6 border rounded-md">
              {/* Header */}
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h1 className="text-2xl font-bold uppercase text-gray-800">Contract Invoice</h1>
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
                <p className="font-bold text-gray-800">{getClientName(viewDialog.customerId)}</p>
                <p className="text-gray-600 text-sm">Contract: {getContractName(viewDialog.contractId)}</p>
              </div>

              {/* Line Items */}
              <Table className="border">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-bold text-gray-800">Description</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Qty / Hrs</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Rate</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Amount (BD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Base Monthly Contract Amount</TableCell>
                    <TableCell className="text-right">1</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right font-semibold"><CurrencyDisplay amount={viewDialog.baseAmount} /></TableCell>
                  </TableRow>
                  {parseFloat(viewDialog.otAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Overtime Charges</TableCell>
                      <TableCell className="text-right">{viewDialog.otHours} hrs</TableCell>
                      <TableCell className="text-right">per hour</TableCell>
                      <TableCell className="text-right text-amber-600"><CurrencyDisplay amount={viewDialog.otAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.holidayAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Holiday Charges</TableCell>
                      <TableCell className="text-right">{viewDialog.holidayDays} days</TableCell>
                      <TableCell className="text-right">per day</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.holidayAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.extraTruckAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Extra Truck Charges</TableCell>
                      <TableCell className="text-right">{viewDialog.extraTruckTrips} trips</TableCell>
                      <TableCell className="text-right">per trip</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.extraTruckAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.emergencyAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Emergency Delivery Charges</TableCell>
                      <TableCell className="text-right">{viewDialog.emergencyTrips} trips</TableCell>
                      <TableCell className="text-right">per trip</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.emergencyAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.redeliveryAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Redelivery Charges</TableCell>
                      <TableCell className="text-right">{viewDialog.redeliveryTrips} trips</TableCell>
                      <TableCell className="text-right">per trip</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.redeliveryAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.outsourcedAmount || "0") > 0 && (
                    <TableRow>
                      <TableCell>Outsourced Vehicle Charges</TableCell>
                      <TableCell className="text-right">{viewDialog.outsourcedTrips} trips</TableCell>
                      <TableCell className="text-right">per trip</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={viewDialog.outsourcedAmount} /></TableCell>
                    </TableRow>
                  )}
                  {parseFloat(viewDialog.discount || "0") > 0 && (
                    <TableRow>
                      <TableCell className="text-red-600">Discount / Credit</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right text-red-600">- <CurrencyDisplay amount={viewDialog.discount} /></TableCell>
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

            {/* Status Actions */}
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
                {["sent", "partially_paid"].includes(viewDialog.status) && (
                  <Button size="sm" onClick={() => statusMutation.mutate({ id: viewDialog.id, status: "paid" })} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                    <Banknote className="h-3.5 w-3.5" /> Mark as Paid
                  </Button>
                )}
                {viewDialog.status === "sent" && (
                  <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: viewDialog.id, status: "overdue" })} className="text-red-600 border-red-200 gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Mark Overdue
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
