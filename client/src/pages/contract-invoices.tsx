import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, Plus, FileText, Check, Send, Clock, AlertCircle, Banknote, ChevronDown, ChevronUp, Printer, Edit2, FileUp, CreditCard, Share2, Search, MoreHorizontal, Calculator, Sparkles, HelpCircle, Filter, X, RotateCcw } from "lucide-react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCustomerId, setFilterCustomerId] = useState<string>("all");
  const [filterContractId, setFilterContractId] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Payment State
  const [paymentOrder, setPaymentOrder] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [genForm, setGenForm] = useState({ 
    contractId: "", periodStart: "", periodEnd: "",
    otHours: "0", holidayDays: "0", extraTruckTrips: "0",
    emergencyTrips: "0", redeliveryTrips: "0", outsourcedTrips: "0",
    otAmount: "", holidayAmount: "", extraTruckAmount: "",
    emergencyAmount: "", redeliveryAmount: "", outsourcedAmount: ""
  });
  const [usageForm, setUsageForm] = useState({
    otHours: "0", holidayDays: "0", extraTruckTrips: "0",
    emergencyTrips: "0", redeliveryTrips: "0", outsourcedTrips: "0",
  });

  const { data: invoices = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/contract-invoices"] });
  const { data: contracts = [] } = useQuery<Contract[]>({ queryKey: ["/api/contracts"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: outlets = [] } = useQuery<any[]>({ queryKey: ["/api/outlets"] });
  const { data: bankAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/bank-accounts"] });
  const { data: pettyCashAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/petty-cash"] });

  // Fetch contract usages when contractId is selected for invoice generation
  const { data: contractUsages = [] } = useQuery<any[]>({
    queryKey: [genForm.contractId ? `/api/contracts/${genForm.contractId}/usage` : null],
    enabled: !!genForm.contractId,
  });

  // Fetch GDN Details for the currently viewed invoice
  const { data: gdnDeliveries = [], isLoading: isLoadingGdn } = useQuery<any[]>({
    queryKey: [viewDialog ? `/api/contract-invoices/${viewDialog.id}/deliveries` : null],
    enabled: !!viewDialog,
  });

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const totalOutstanding = invoices.filter(i => ["sent", "approved", "partially_paid", "overdue"].includes(i.status)).reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const selectedGenContract = contracts.find(c => c.id === genForm.contractId);

  const handleContractChange = (contractId: string) => {
    const c = contracts.find(item => item.id === contractId);
    setGenForm(prev => {
      const otRate = parseFloat(c?.otCharges || "0");
      const holRate = parseFloat(c?.holidayCharges || "0");
      const extraRate = parseFloat(c?.extraTruckCharge || "0");
      const emgRate = parseFloat(c?.emergencyDeliveryCharge || "0");
      const redelRate = parseFloat(c?.redeliveryCharge || "0");
      const outRate = parseFloat((c as any)?.outsourcedVehicleCharge || "0");

      const otH = parseFloat(prev.otHours || "0");
      const holD = parseFloat(prev.holidayDays || "0");
      const extraT = parseFloat(prev.extraTruckTrips || "0");
      const emgT = parseFloat(prev.emergencyTrips || "0");
      const redelT = parseFloat(prev.redeliveryTrips || "0");
      const outT = parseFloat(prev.outsourcedTrips || "0");

      return {
        ...prev,
        contractId,
        otAmount: otH > 0 && otRate > 0 ? (otH * otRate).toFixed(3) : (otH === 0 ? "0.000" : prev.otAmount),
        holidayAmount: holD > 0 && holRate > 0 ? (holD * holRate).toFixed(3) : (holD === 0 ? "0.000" : prev.holidayAmount),
        extraTruckAmount: extraT > 0 && extraRate > 0 ? (extraT * extraRate).toFixed(3) : (extraT === 0 ? "0.000" : prev.extraTruckAmount),
        emergencyAmount: emgT > 0 && emgRate > 0 ? (emgT * emgRate).toFixed(3) : (emgT === 0 ? "0.000" : prev.emergencyAmount),
        redeliveryAmount: redelT > 0 && redelRate > 0 ? (redelT * redelRate).toFixed(3) : (redelT === 0 ? "0.000" : prev.redeliveryAmount),
        outsourcedAmount: outT > 0 && outRate > 0 ? (outT * outRate).toFixed(3) : (outT === 0 ? "0.000" : prev.outsourcedAmount),
      };
    });
  };

  const handleGenQtyChange = (qtyField: string, amtField: string, rate: number, value: string) => {
    const num = parseFloat(value) || 0;
    const calc = num > 0 && rate > 0 ? (num * rate).toFixed(3) : (num === 0 ? "0.000" : "");
    setGenForm(prev => ({
      ...prev,
      [qtyField]: value,
      [amtField]: calc,
    }));
  };

  const handleApplyLoggedUsage = (usageRecord: any) => {
    if (!selectedGenContract) return;
    const otRate = parseFloat(selectedGenContract.otCharges || "0");
    const holRate = parseFloat(selectedGenContract.holidayCharges || "0");
    const extraRate = parseFloat(selectedGenContract.extraTruckCharge || "0");
    const emgRate = parseFloat(selectedGenContract.emergencyDeliveryCharge || "0");
    const redelRate = parseFloat(selectedGenContract.redeliveryCharge || "0");
    const outRate = parseFloat((selectedGenContract as any)?.outsourcedVehicleCharge || "0");

    const otHours = String(usageRecord.otHours || "0");
    const holidayDays = String(usageRecord.holidayDays || "0");
    const extraTruckTrips = String(usageRecord.extraTruckTrips || "0");
    const emergencyTrips = String(usageRecord.emergencyTrips || "0");
    const redeliveryTrips = String(usageRecord.redeliveryTrips || "0");
    const outsourcedTrips = String(usageRecord.outsourcedTrips || "0");

    setGenForm(prev => ({
      ...prev,
      otHours,
      holidayDays,
      extraTruckTrips,
      emergencyTrips,
      redeliveryTrips,
      outsourcedTrips,
      otAmount: (parseFloat(otHours) * otRate).toFixed(3),
      holidayAmount: (parseFloat(holidayDays) * holRate).toFixed(3),
      extraTruckAmount: (parseFloat(extraTruckTrips) * extraRate).toFixed(3),
      emergencyAmount: (parseFloat(emergencyTrips) * emgRate).toFixed(3),
      redeliveryAmount: (parseFloat(redeliveryTrips) * redelRate).toFixed(3),
      outsourcedAmount: (parseFloat(outsourcedTrips) * outRate).toFixed(3),
    }));
    toast({ title: "Applied logged monthly usage to invoice generator" });
  };

  const matchingUsage = contractUsages.find((u: any) => {
    if (!genForm.periodStart) return false;
    const mPrefix = genForm.periodStart.slice(0, 7);
    return u.periodMonth === genForm.periodStart || (u.periodMonth && u.periodMonth.slice(0, 7) === mPrefix);
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/contract-invoices/generate", genForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-invoices"] });
      toast({ title: "Invoice Generated", description: "Successfully generated contract invoice." });
      setGenerateDialog(false);
      setGenForm({ 
        contractId: "", periodStart: "", periodEnd: "",
        otHours: "0", holidayDays: "0", extraTruckTrips: "0",
        emergencyTrips: "0", redeliveryTrips: "0", outsourcedTrips: "0",
        otAmount: "", holidayAmount: "", extraTruckAmount: "",
        emergencyAmount: "", redeliveryAmount: "", outsourcedAmount: ""
      });
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

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/contract-invoices/${paymentOrder.id}/pay`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-invoices"] });
      toast({ title: "Payment recorded successfully" });
      setPaymentOrder(null);
    },
    onError: (error) => toast({ title: getErrorMessage(error), variant: "destructive" })
  });

  const handlePayClick = (e: any, invoice: any) => {
    e.stopPropagation();
    setPaymentOrder(invoice);
    const balance = Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0);
    setPaymentAmount(balance > 0 ? balance.toFixed(3) : "0.000");
    setPaymentMethod("bank_transfer");
    setPaymentAccountId("");
    setPaymentReference("");
  };

  const handlePaymentSubmit = () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if ((paymentMethod === "bank_transfer" || paymentMethod === "cheque") && !paymentAccountId) {
      toast({ title: "Please select a bank account", variant: "destructive" });
      return;
    }
    if (paymentMethod === "cash" && !paymentAccountId) {
      toast({ title: "Please select a petty cash account", variant: "destructive" });
      return;
    }
    
    paymentMutation.mutate({
      customerId: paymentOrder.customerId,
      amount: paymentAmount,
      paymentMethod,
      reference: paymentReference,
      bankAccountId: (paymentMethod === "bank_transfer" || paymentMethod === "cheque") ? paymentAccountId : null,
      pettyCashId: paymentMethod === "cash" ? paymentAccountId : null,
    });
  };

  const handleShare = (invoice: any, statusType: string) => {
    // Generate text/link to share
    const text = `Contract Invoice ${invoice.invoiceNumber}\nCustomer: ${getClientName(invoice.customerId)}\nAmount: ${invoice.totalAmount} BHD\nStatus: ${statusType}`;
    if (navigator.share) {
      navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text }).catch(console.error);
    } else {
      window.location.href = `mailto:?subject=Invoice ${invoice.invoiceNumber}&body=${encodeURIComponent(text)}`;
    }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || "Unknown";
  const getContractName = (id: string) => contracts.find(c => c.id === id)?.name || id;
  const getOutletName = (id: string) => outlets.find(o => o.id === id)?.name || id;

  const availableContracts = filterCustomerId && filterCustomerId !== "all"
    ? contracts.filter(c => c.customerId === filterCustomerId)
    : contracts;

  const statusCounts = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === "draft").length,
    approved: invoices.filter(i => i.status === "approved").length,
    sent: invoices.filter(i => i.status === "sent").length,
    paid: invoices.filter(i => i.status === "paid").length,
    partially_paid: invoices.filter(i => i.status === "partially_paid").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
  };

  const isFilterActive = 
    searchTerm !== "" || 
    filterStatus !== "all" || 
    filterCustomerId !== "all" || 
    filterContractId !== "all" || 
    filterStartDate !== "" || 
    filterEndDate !== "";

  const activeFilterCount = [
    searchTerm !== "",
    filterStatus !== "all",
    filterCustomerId !== "all",
    filterContractId !== "all",
    Boolean(filterStartDate || filterEndDate)
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterCustomerId("all");
    setFilterContractId("all");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = searchTerm === "" || 
      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      getClientName(inv.customerId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getContractName(inv.contractId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.outletId && getOutletName(inv.outletId).toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    const matchesCustomer = filterCustomerId === "all" || inv.customerId === filterCustomerId;
    const matchesContract = filterContractId === "all" || inv.contractId === filterContractId;

    let matchesStartDate = true;
    let matchesEndDate = true;
    
    if (filterStartDate) {
      matchesStartDate = new Date(inv.periodStart) >= new Date(filterStartDate);
    }
    if (filterEndDate) {
      matchesEndDate = new Date(inv.periodEnd) <= new Date(filterEndDate);
    }
    
    return matchesSearch && matchesStatus && matchesCustomer && matchesContract && matchesStartDate && matchesEndDate;
  });

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Contract Invoices Registry</CardTitle>
              <CardDescription>All invoices generated from active contracts. Click an invoice to view details or update status.</CardDescription>
            </div>
            {isFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 bg-muted/20 border-b space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoice, client, contract..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 bg-background h-9 text-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 bg-background text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Status:</span>
                    <SelectValue placeholder="All Statuses" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses ({statusCounts.all})</SelectItem>
                  <SelectItem value="draft">Draft ({statusCounts.draft})</SelectItem>
                  <SelectItem value="approved">Approved ({statusCounts.approved})</SelectItem>
                  <SelectItem value="sent">Sent ({statusCounts.sent})</SelectItem>
                  <SelectItem value="paid">Paid ({statusCounts.paid})</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid ({statusCounts.partially_paid})</SelectItem>
                  <SelectItem value="overdue">Overdue ({statusCounts.overdue})</SelectItem>
                </SelectContent>
              </Select>

              {/* Customer Filter */}
              <Select
                value={filterCustomerId}
                onValueChange={(val) => {
                  setFilterCustomerId(val);
                  setFilterContractId("all");
                }}
              >
                <SelectTrigger className="h-9 bg-background text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-muted-foreground">Customer:</span>
                    <SelectValue placeholder="All Customers" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers ({clients.length})</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Contract Filter */}
              <Select value={filterContractId} onValueChange={setFilterContractId}>
                <SelectTrigger className="h-9 bg-background text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-muted-foreground">Contract:</span>
                    <SelectValue placeholder="All Contracts" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts ({availableContracts.length})</SelectItem>
                  {availableContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || (c as any).contractNumber || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-background h-9 text-xs px-2 w-full"
                  title="Period Start From"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-background h-9 text-xs px-2 w-full"
                  title="Period End To"
                />
                {(filterStartDate || filterEndDate) && (
                  <button
                    type="button"
                    onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Clear date range"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-muted/30">
              <span className="text-xs font-medium text-muted-foreground mr-1">Quick Filter:</span>
              {[
                { key: "all", label: "All", count: statusCounts.all },
                { key: "draft", label: "Draft", count: statusCounts.draft },
                { key: "approved", label: "Approved", count: statusCounts.approved },
                { key: "sent", label: "Sent", count: statusCounts.sent },
                { key: "paid", label: "Paid", count: statusCounts.paid },
                { key: "partially_paid", label: "Partial", count: statusCounts.partially_paid },
                { key: "overdue", label: "Overdue", count: statusCounts.overdue },
              ].map((item) => {
                const isActive = filterStatus === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilterStatus(item.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"
                    }`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}

              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No contract invoices found matching the criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contract / Outlet</TableHead>
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
                  {filteredInvoices.map((inv) => {
                    const extras = parseFloat(inv.holidayAmount || "0") + parseFloat(inv.extraTruckAmount || "0") +
                      parseFloat(inv.emergencyAmount || "0") + parseFloat(inv.redeliveryAmount || "0") + parseFloat(inv.outsourcedAmount || "0");
                    return (
                      <TableRow key={inv.id} className="hover:bg-accent/40 transition-colors cursor-pointer" onClick={() => setViewDialog(inv)}>
                        <TableCell className="font-mono font-semibold text-primary">{inv.invoiceNumber}</TableCell>
                        <TableCell>{getClientName(inv.customerId)}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">{getContractName(inv.contractId)}</div>
                          {inv.outletId && <Badge variant="outline" className="mt-1 text-[10px]">{getOutletName(inv.outletId)}</Badge>}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{inv.periodStart} → {inv.periodEnd}</TableCell>
                        <TableCell className="text-right"><CurrencyDisplay amount={inv.baseAmount} /></TableCell>
                        <TableCell className="text-right text-amber-600"><CurrencyDisplay amount={inv.otAmount} /></TableCell>
                        <TableCell className="text-right text-blue-600"><CurrencyDisplay amount={extras} /></TableCell>
                        <TableCell className="text-right font-bold"><CurrencyDisplay amount={inv.totalAmount} /></TableCell>
                        <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                            {["sent", "partially_paid"].includes(inv.status) && (
                              <Button size="sm" variant="outline" className="h-8 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={(e) => handlePayClick(e, inv)}>
                                <CreditCard className="h-3.5 w-3.5" /> Pay
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); setViewDialog(inv); }}>
                              <Receipt className="h-4 w-4 mr-1" /> View
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleShare(inv, inv.status)}>
                                  <Share2 className="mr-2 h-4 w-4" /> Share with Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Receipt className="h-5 w-5 text-primary" /> Generate Contract Invoice
            </DialogTitle>
            <DialogDescription>
              Select a contract and billing period. The system automatically links contract rates, logs monthly activity, and calculates overall additional charges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Contract & Period Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label className="text-xs font-semibold">Contract *</Label>
                <Select value={genForm.contractId} onValueChange={handleContractChange}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select contract..." /></SelectTrigger>
                  <SelectContent>
                    {contracts.filter(c => c.status === "active").map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {clients.find(cl => cl.id === c.customerId)?.name || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Period Start *</Label>
                <Input type="date" value={genForm.periodStart} onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))} className="text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Period End *</Label>
                <Input type="date" value={genForm.periodEnd} onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))} className="text-xs" />
              </div>
            </div>

            {/* Selected Contract Overview & Agreed Rates Banner */}
            {selectedGenContract && (
              <div className="bg-muted/40 border rounded-lg p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{selectedGenContract.name}</span>
                    <Badge variant="outline" className="text-[10px]">{getClientName(selectedGenContract.customerId || "")}</Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">{selectedGenContract.type} Contract</Badge>
                  </div>
                  <div className="font-semibold text-primary">
                    Base: <CurrencyDisplay amount={selectedGenContract.monthlyRate || "0"} /> / mo ({selectedGenContract.numVehicles || 1} vehicle{(selectedGenContract.numVehicles || 1) > 1 ? 's' : ''})
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 text-[11px] text-muted-foreground">
                  <div className="bg-background/80 p-1.5 rounded border">
                    <span className="block text-[10px] text-muted-foreground">OT Rate:</span>
                    <span className="font-bold text-foreground">{parseFloat(selectedGenContract.otCharges || "0").toFixed(3)} BD/hr</span>
                  </div>
                  <div className="bg-background/80 p-1.5 rounded border">
                    <span className="block text-[10px] text-muted-foreground">Holiday:</span>
                    <span className="font-bold text-foreground">{parseFloat(selectedGenContract.holidayCharges || "0").toFixed(3)} BD/day</span>
                  </div>
                  <div className="bg-background/80 p-1.5 rounded border">
                    <span className="block text-[10px] text-muted-foreground">Extra Truck:</span>
                    <span className="font-bold text-foreground">{parseFloat(selectedGenContract.extraTruckCharge || "0").toFixed(3)} BD/trip</span>
                  </div>
                  <div className="bg-background/80 p-1.5 rounded border">
                    <span className="block text-[10px] text-muted-foreground">Emergency:</span>
                    <span className="font-bold text-foreground">{parseFloat(selectedGenContract.emergencyDeliveryCharge || "0").toFixed(3)} BD/trip</span>
                  </div>
                  <div className="bg-background/80 p-1.5 rounded border">
                    <span className="block text-[10px] text-muted-foreground">Redelivery:</span>
                    <span className="font-bold text-foreground">{parseFloat(selectedGenContract.redeliveryCharge || "0").toFixed(3)} BD/trip</span>
                  </div>
                  <div className="bg-background/80 p-1.5 rounded border">
                    <span className="block text-[10px] text-muted-foreground">Outsourced:</span>
                    <span className="font-bold text-foreground">{parseFloat((selectedGenContract as any)?.outsourcedVehicleCharge || "0").toFixed(3)} BD/trip</span>
                  </div>
                </div>
              </div>
            )}

            {/* Logged Monthly Usage Auto-Detection Alert */}
            {matchingUsage && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Logged Activity Detected:</span>{" "}
                    OT: {matchingUsage.otHours || 0} hrs, Holiday: {matchingUsage.holidayDays || 0} d, Extra: {matchingUsage.extraTruckTrips || 0} t, Emergency: {matchingUsage.emergencyTrips || 0} t, Redelivery: {matchingUsage.redeliveryTrips || 0} t
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-blue-300 bg-white hover:bg-blue-100 text-blue-700"
                  onClick={() => handleApplyLoggedUsage(matchingUsage)}
                >
                  Apply Usage
                </Button>
              </div>
            )}

            {/* Overall Additional Charges Breakdown Form */}
            <div className="border rounded-lg p-3 space-y-3 bg-card/60">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-primary" /> Overall Details: Additional Charges & Activity
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Enter activity hours or trips to auto-calculate amounts using contract rates, or override amounts directly.</p>
                </div>
                {selectedGenContract && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    Additional Total: {(
                      (parseFloat(genForm.otAmount || "0") || 0) +
                      (parseFloat(genForm.holidayAmount || "0") || 0) +
                      (parseFloat(genForm.extraTruckAmount || "0") || 0) +
                      (parseFloat(genForm.emergencyAmount || "0") || 0) +
                      (parseFloat(genForm.redeliveryAmount || "0") || 0) +
                      (parseFloat(genForm.outsourcedAmount || "0") || 0)
                    ).toFixed(3)} BD
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Overtime */}
                <div className="border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-foreground">Overtime (OT) Charges</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate: {parseFloat(selectedGenContract?.otCharges || "0").toFixed(3)} BD/hr
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Hours Worked</span>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="0"
                        value={genForm.otHours}
                        onChange={e => handleGenQtyChange("otHours", "otAmount", parseFloat(selectedGenContract?.otCharges || "0"), e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Amount (BD)</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={genForm.otAmount}
                        onChange={e => setGenForm(f => ({ ...f, otAmount: e.target.value }))}
                        className="h-8 text-xs font-mono text-amber-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Holiday */}
                <div className="border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-foreground">Public Holiday Charges</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate: {parseFloat(selectedGenContract?.holidayCharges || "0").toFixed(3)} BD/day
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Days Worked</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={genForm.holidayDays}
                        onChange={e => handleGenQtyChange("holidayDays", "holidayAmount", parseFloat(selectedGenContract?.holidayCharges || "0"), e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Amount (BD)</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={genForm.holidayAmount}
                        onChange={e => setGenForm(f => ({ ...f, holidayAmount: e.target.value }))}
                        className="h-8 text-xs font-mono text-blue-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Extra Truck */}
                <div className="border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-foreground">Extra Truck Charges</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate: {parseFloat(selectedGenContract?.extraTruckCharge || "0").toFixed(3)} BD/trip
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Extra Trips</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={genForm.extraTruckTrips}
                        onChange={e => handleGenQtyChange("extraTruckTrips", "extraTruckAmount", parseFloat(selectedGenContract?.extraTruckCharge || "0"), e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Amount (BD)</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={genForm.extraTruckAmount}
                        onChange={e => setGenForm(f => ({ ...f, extraTruckAmount: e.target.value }))}
                        className="h-8 text-xs font-mono text-purple-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Delivery */}
                <div className="border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-foreground">Emergency / Quick Delivery</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate: {parseFloat(selectedGenContract?.emergencyDeliveryCharge || "0").toFixed(3)} BD/trip
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Urgent Trips</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={genForm.emergencyTrips}
                        onChange={e => handleGenQtyChange("emergencyTrips", "emergencyAmount", parseFloat(selectedGenContract?.emergencyDeliveryCharge || "0"), e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Amount (BD)</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={genForm.emergencyAmount}
                        onChange={e => setGenForm(f => ({ ...f, emergencyAmount: e.target.value }))}
                        className="h-8 text-xs font-mono text-red-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Redelivery */}
                <div className="border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-foreground">Redelivery Surcharge</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate: {parseFloat(selectedGenContract?.redeliveryCharge || "0").toFixed(3)} BD/trip
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Rescheduled Trips</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={genForm.redeliveryTrips}
                        onChange={e => handleGenQtyChange("redeliveryTrips", "redeliveryAmount", parseFloat(selectedGenContract?.redeliveryCharge || "0"), e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Amount (BD)</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={genForm.redeliveryAmount}
                        onChange={e => setGenForm(f => ({ ...f, redeliveryAmount: e.target.value }))}
                        className="h-8 text-xs font-mono text-emerald-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Outsourced */}
                <div className="border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-xs text-foreground">Outsourced Vehicle Surcharge</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rate: {parseFloat((selectedGenContract as any)?.outsourcedVehicleCharge || "0").toFixed(3)} BD/trip
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">3rd-Party Trips</span>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        value={genForm.outsourcedTrips}
                        onChange={e => handleGenQtyChange("outsourcedTrips", "outsourcedAmount", parseFloat((selectedGenContract as any)?.outsourcedVehicleCharge || "0"), e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">Amount (BD)</span>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={genForm.outsourcedAmount}
                        onChange={e => setGenForm(f => ({ ...f, outsourcedAmount: e.target.value }))}
                        className="h-8 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculation & Live Invoice Summary */}
            <div className="bg-muted/40 rounded-lg p-3 border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Base Monthly Contract:</span>
                  <span className="font-mono font-medium text-foreground">
                    <CurrencyDisplay amount={selectedGenContract ? parseFloat(selectedGenContract.monthlyRate || "0") * (selectedGenContract.numVehicles || 1) : 0} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Overall Additional Charges:</span>
                  <span className="font-mono font-medium text-amber-600">
                    <CurrencyDisplay amount={(
                      (parseFloat(genForm.otAmount || "0") || 0) +
                      (parseFloat(genForm.holidayAmount || "0") || 0) +
                      (parseFloat(genForm.extraTruckAmount || "0") || 0) +
                      (parseFloat(genForm.emergencyAmount || "0") || 0) +
                      (parseFloat(genForm.redeliveryAmount || "0") || 0) +
                      (parseFloat(genForm.outsourcedAmount || "0") || 0)
                    )} />
                  </span>
                </div>
              </div>
              <div className="text-right sm:border-l sm:pl-4">
                <span className="text-[11px] text-muted-foreground block uppercase font-bold tracking-wider">Estimated Total</span>
                <span className="text-xl font-bold text-primary font-mono">
                  <CurrencyDisplay amount={(
                    (selectedGenContract ? parseFloat(selectedGenContract.monthlyRate || "0") * (selectedGenContract.numVehicles || 1) : 0) +
                    (parseFloat(genForm.otAmount || "0") || 0) +
                    (parseFloat(genForm.holidayAmount || "0") || 0) +
                    (parseFloat(genForm.extraTruckAmount || "0") || 0) +
                    (parseFloat(genForm.emergencyAmount || "0") || 0) +
                    (parseFloat(genForm.redeliveryAmount || "0") || 0) +
                    (parseFloat(genForm.outsourcedAmount || "0") || 0)
                  )} />
                </span>
              </div>
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
      {viewDialog && (() => {
        const viewContract = contracts.find(c => c.id === viewDialog.contractId);
        const otRate = Number(viewContract?.otCharges || 0);
        const holidayRate = Number(viewContract?.holidayCharges || 0);
        const extraTruckRate = Number(viewContract?.extraTruckCharge || 0);
        const emergencyRate = Number(viewContract?.emergencyDeliveryCharge || 0);
        const redeliveryRate = Number(viewContract?.redeliveryCharge || 0);
        const outsourcedRate = Number((viewContract as any)?.outsourcedVehicleCharge || 0);
        const labourRate = Number(viewContract?.additionalLabourCharges || 0);

        const otAmount = parseFloat(viewDialog.otAmount || "0");
        const holidayAmount = parseFloat(viewDialog.holidayAmount || "0");
        const extraTruckAmount = parseFloat(viewDialog.extraTruckAmount || "0");
        const emergencyAmount = parseFloat(viewDialog.emergencyAmount || "0");
        const redeliveryAmount = parseFloat(viewDialog.redeliveryAmount || "0");
        const outsourcedAmount = parseFloat(viewDialog.outsourcedAmount || "0");
        const discountAmount = parseFloat(viewDialog.discount || "0");

        const totalAdditionalCharges = (isNaN(otAmount) ? 0 : otAmount) + 
          (isNaN(holidayAmount) ? 0 : holidayAmount) + 
          (isNaN(extraTruckAmount) ? 0 : extraTruckAmount) + 
          (isNaN(emergencyAmount) ? 0 : emergencyAmount) + 
          (isNaN(redeliveryAmount) ? 0 : redeliveryAmount) + 
          (isNaN(outsourcedAmount) ? 0 : outsourcedAmount);

        return (
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
                    <p className="text-gray-500 mt-1 text-sm font-mono">Invoice #: {viewDialog.invoiceNumber}</p>
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
                  <p className="font-bold text-gray-800 text-base">{getClientName(viewDialog.customerId)}</p>
                  <p className="text-gray-600 text-sm">Contract: {getContractName(viewDialog.contractId)}</p>
                  {viewDialog.outletId && <p className="text-gray-600 text-sm font-medium">Outlet: {getOutletName(viewDialog.outletId)}</p>}
                </div>

                {/* Line Items */}
                <Table className="border text-sm">
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-bold text-gray-800">Description</TableHead>
                      <TableHead className="text-right font-bold text-gray-800">Qty / Units</TableHead>
                      <TableHead className="text-right font-bold text-gray-800">Rate (BD)</TableHead>
                      <TableHead className="text-right font-bold text-gray-800">Amount (BD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="font-medium text-gray-900">
                        <div>Base Monthly Contract Service</div>
                        <div className="text-xs text-gray-500">{viewContract?.name || "Contract Rate"} ({viewContract?.numVehicles || 1} Vehicle{(viewContract?.numVehicles || 1) > 1 ? 's' : ''})</div>
                      </TableCell>
                      <TableCell className="text-right">1 Month</TableCell>
                      <TableCell className="text-right font-mono"><CurrencyDisplay amount={viewDialog.baseAmount} /></TableCell>
                      <TableCell className="text-right font-semibold font-mono"><CurrencyDisplay amount={viewDialog.baseAmount} /></TableCell>
                    </TableRow>

                    {/* Additional Charges Section Header */}
                    <TableRow className="bg-gray-100/80">
                      <TableCell colSpan={4} className="py-2">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700">
                          <span>Overall Details: Additional Charges & Surcharges</span>
                          <span className="text-[11px] font-medium lowercase text-gray-500">
                            {totalAdditionalCharges > 0 ? `Subtotal: ${totalAdditionalCharges.toFixed(3)} BD` : "No surcharges incurred"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Overtime */}
                    <TableRow className={otAmount > 0 ? "bg-amber-50/50 hover:bg-amber-50/70" : "hover:bg-transparent"}>
                      <TableCell>
                        <div className="font-medium text-gray-800">Overtime (OT) Charges</div>
                        <div className="text-[11px] text-gray-500">Overtime work beyond daily schedule</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{Number(viewDialog.otHours || 0).toFixed(2)} hrs</TableCell>
                      <TableCell className="text-right font-mono text-gray-600">{otRate.toFixed(3)}</TableCell>
                      <TableCell className={`text-right font-mono ${otAmount > 0 ? "text-amber-700 font-semibold" : "text-gray-500"}`}>
                        <CurrencyDisplay amount={viewDialog.otAmount || "0"} />
                      </TableCell>
                    </TableRow>

                    {/* Public Holiday */}
                    <TableRow className={holidayAmount > 0 ? "bg-blue-50/50 hover:bg-blue-50/70" : "hover:bg-transparent"}>
                      <TableCell>
                        <div className="font-medium text-gray-800">Public Holiday Delivery</div>
                        <div className="text-[11px] text-gray-500">Service rendered on official public holidays</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{viewDialog.holidayDays || 0} days</TableCell>
                      <TableCell className="text-right font-mono text-gray-600">{holidayRate.toFixed(3)}</TableCell>
                      <TableCell className={`text-right font-mono ${holidayAmount > 0 ? "text-blue-700 font-semibold" : "text-gray-500"}`}>
                        <CurrencyDisplay amount={viewDialog.holidayAmount || "0"} />
                      </TableCell>
                    </TableRow>

                    {/* Extra Truck */}
                    <TableRow className={extraTruckAmount > 0 ? "bg-purple-50/50 hover:bg-purple-50/70" : "hover:bg-transparent"}>
                      <TableCell>
                        <div className="font-medium text-gray-800">Extra Truck Surcharge</div>
                        <div className="text-[11px] text-gray-500">Additional vehicles deployed above quota</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{viewDialog.extraTruckTrips || 0} trips</TableCell>
                      <TableCell className="text-right font-mono text-gray-600">{extraTruckRate.toFixed(3)}</TableCell>
                      <TableCell className={`text-right font-mono ${extraTruckAmount > 0 ? "text-purple-700 font-semibold" : "text-gray-500"}`}>
                        <CurrencyDisplay amount={viewDialog.extraTruckAmount || "0"} />
                      </TableCell>
                    </TableRow>

                    {/* Emergency Delivery */}
                    <TableRow className={emergencyAmount > 0 ? "bg-red-50/50 hover:bg-red-50/70" : "hover:bg-transparent"}>
                      <TableCell>
                        <div className="font-medium text-gray-800">Quick / Emergency Delivery</div>
                        <div className="text-[11px] text-gray-500">Urgent unscheduled priority delivery</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{viewDialog.emergencyTrips || 0} trips</TableCell>
                      <TableCell className="text-right font-mono text-gray-600">{emergencyRate.toFixed(3)}</TableCell>
                      <TableCell className={`text-right font-mono ${emergencyAmount > 0 ? "text-red-700 font-semibold" : "text-gray-500"}`}>
                        <CurrencyDisplay amount={viewDialog.emergencyAmount || "0"} />
                      </TableCell>
                    </TableRow>

                    {/* Redelivery */}
                    <TableRow className={redeliveryAmount > 0 ? "bg-emerald-50/50 hover:bg-emerald-50/70" : "hover:bg-transparent"}>
                      <TableCell>
                        <div className="font-medium text-gray-800">Redelivery Surcharge</div>
                        <div className="text-[11px] text-gray-500">Rescheduled or reattempted delivery trips</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{viewDialog.redeliveryTrips || 0} trips</TableCell>
                      <TableCell className="text-right font-mono text-gray-600">{redeliveryRate.toFixed(3)}</TableCell>
                      <TableCell className={`text-right font-mono ${redeliveryAmount > 0 ? "text-emerald-700 font-semibold" : "text-gray-500"}`}>
                        <CurrencyDisplay amount={viewDialog.redeliveryAmount || "0"} />
                      </TableCell>
                    </TableRow>

                    {/* Outsourced Vehicle */}
                    {(outsourcedAmount > 0 || (viewDialog.outsourcedTrips && Number(viewDialog.outsourcedTrips) > 0) || outsourcedRate > 0) && (
                      <TableRow className={outsourcedAmount > 0 ? "bg-slate-50 hover:bg-slate-100" : "hover:bg-transparent"}>
                        <TableCell>
                          <div className="font-medium text-gray-800">Outsourced Vehicle Surcharge</div>
                          <div className="text-[11px] text-gray-500">External 3rd-party logistics deployment</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{viewDialog.outsourcedTrips || 0} trips</TableCell>
                        <TableCell className="text-right font-mono text-gray-600">{outsourcedRate.toFixed(3)}</TableCell>
                        <TableCell className={`text-right font-mono ${outsourcedAmount > 0 ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                          <CurrencyDisplay amount={viewDialog.outsourcedAmount || "0"} />
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Additional Labour (if defined in contract) */}
                    {labourRate > 0 && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell>
                          <div className="font-medium text-gray-800">Additional Labour / Helper</div>
                          <div className="text-[11px] text-gray-500">Extra helper support fee</div>
                        </TableCell>
                        <TableCell className="text-right font-mono">—</TableCell>
                        <TableCell className="text-right font-mono text-gray-600">{labourRate.toFixed(3)}</TableCell>
                        <TableCell className="text-right font-mono text-gray-500">0.000 BD</TableCell>
                      </TableRow>
                    )}

                    {/* Discount / Credit */}
                    {discountAmount > 0 && (
                      <TableRow className="bg-rose-50/60">
                        <TableCell className="text-rose-700 font-medium">Discount / Service Credit</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right">—</TableCell>
                        <TableCell className="text-right text-rose-700 font-mono font-semibold">- <CurrencyDisplay amount={viewDialog.discount} /></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Subtotals and Total Section */}
                <div className="flex justify-end border-t pt-4">
                  <div className="w-80 space-y-2 text-sm bg-gray-50/80 p-3.5 rounded-lg border">
                    <div className="flex justify-between text-gray-600">
                      <span>Base Monthly Contract:</span>
                      <span className="font-mono font-medium"><CurrencyDisplay amount={viewDialog.baseAmount} /></span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Total Additional Charges:</span>
                      <span className={`font-mono font-medium ${totalAdditionalCharges > 0 ? "text-amber-700 font-semibold" : ""}`}>
                        <CurrencyDisplay amount={totalAdditionalCharges} />
                      </span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount / Credit:</span>
                        <span className="font-mono font-medium">- <CurrencyDisplay amount={viewDialog.discount} /></span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t-2 pt-2 border-gray-800 text-gray-900">
                      <span>Total Amount:</span>
                      <span className="font-mono text-primary"><CurrencyDisplay amount={viewDialog.totalAmount} /></span>
                    </div>
                  </div>
                </div>

                {/* Overall Additional Charges & Contract Terms Reference Summary */}
                <div className="mt-4 border rounded-lg p-4 bg-slate-50/70">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                        <Receipt className="h-4 w-4 text-primary" /> Overall Additional Charges & Contract Terms Reference
                      </h4>
                      <p className="text-xs text-gray-500">Agreed contract unit rates and operational activity recorded for this invoice period</p>
                    </div>
                    <Badge variant="outline" className={totalAdditionalCharges > 0 ? "border-amber-300 text-amber-800 bg-amber-50" : "border-slate-300 text-slate-600"}>
                      {totalAdditionalCharges > 0 ? `Total Surcharges: ${totalAdditionalCharges.toFixed(3)} BD` : "Zero Surcharges Incurred"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                    <div className="bg-white border rounded p-2.5 shadow-sm">
                      <span className="text-gray-500 block text-[11px]">OT Rate</span>
                      <span className="font-bold text-gray-800 block text-xs font-mono">{otRate.toFixed(3)} BD/hr</span>
                      <span className="text-[10px] text-amber-700 mt-1 block font-medium">Logged: {Number(viewDialog.otHours || 0).toFixed(1)} hrs</span>
                    </div>
                    <div className="bg-white border rounded p-2.5 shadow-sm">
                      <span className="text-gray-500 block text-[11px]">Holiday Rate</span>
                      <span className="font-bold text-gray-800 block text-xs font-mono">{holidayRate.toFixed(3)} BD/day</span>
                      <span className="text-[10px] text-blue-700 mt-1 block font-medium">Logged: {viewDialog.holidayDays || 0} days</span>
                    </div>
                    <div className="bg-white border rounded p-2.5 shadow-sm">
                      <span className="text-gray-500 block text-[11px]">Extra Truck</span>
                      <span className="font-bold text-gray-800 block text-xs font-mono">{extraTruckRate.toFixed(3)} BD/trip</span>
                      <span className="text-[10px] text-purple-700 mt-1 block font-medium">Logged: {viewDialog.extraTruckTrips || 0} trips</span>
                    </div>
                    <div className="bg-white border rounded p-2.5 shadow-sm">
                      <span className="text-gray-500 block text-[11px]">Emergency</span>
                      <span className="font-bold text-gray-800 block text-xs font-mono">{emergencyRate.toFixed(3)} BD/trip</span>
                      <span className="text-[10px] text-red-700 mt-1 block font-medium">Logged: {viewDialog.emergencyTrips || 0} trips</span>
                    </div>
                    <div className="bg-white border rounded p-2.5 shadow-sm">
                      <span className="text-gray-500 block text-[11px]">Redelivery</span>
                      <span className="font-bold text-gray-800 block text-xs font-mono">{redeliveryRate.toFixed(3)} BD/trip</span>
                      <span className="text-[10px] text-emerald-700 mt-1 block font-medium">Logged: {viewDialog.redeliveryTrips || 0} trips</span>
                    </div>
                    <div className="bg-white border rounded p-2.5 shadow-sm">
                      <span className="text-gray-500 block text-[11px]">Outsourced</span>
                      <span className="font-bold text-gray-800 block text-xs font-mono">{outsourcedRate.toFixed(3)} BD/trip</span>
                      <span className="text-[10px] text-gray-600 mt-1 block font-medium">Logged: {viewDialog.outsourcedTrips || 0} trips</span>
                    </div>
                  </div>
                </div>

              {/* GDN Details Table */}
              <div className="mt-8 border-t pt-4">
                <h3 className="font-bold text-lg text-gray-800 mb-3">Goods Delivery Note (GDN) Details</h3>
                {isLoadingGdn ? (
                  <p className="text-gray-500 text-sm">Loading delivery records...</p>
                ) : gdnDeliveries.length === 0 ? (
                  <p className="text-gray-500 text-sm">No delivery records found for this period.</p>
                ) : (
                  <Table className="border text-sm">
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Outlet</TableHead>
                        <TableHead>Item # / Desc</TableHead>
                        <TableHead>Storage</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gdnDeliveries.map((del: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{del.deliveredAt ? format(new Date(del.deliveredAt), 'dd/MM/yyyy') : (del.sheetDate ? format(new Date(del.sheetDate), 'dd/MM/yyyy') : 'N/A')}</TableCell>
                          <TableCell>
                            <div>{del.outletName || 'N/A'}</div>
                            <div className="text-[10px] text-gray-500">{del.outletCode}</div>
                          </TableCell>
                          <TableCell>
                            <div>{del.itemCode}</div>
                            <div className="text-xs text-gray-500">{del.description}</div>
                          </TableCell>
                          <TableCell>{del.storageType || 'N/A'}</TableCell>
                          <TableCell className="text-right font-medium">{del.deliveredQty || del.requestedQty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Delivery Attachments Section */}
              {viewDialog.deliveryAttachments && viewDialog.deliveryAttachments.length > 0 && (
                <div className="mt-8 border-t pt-4">
                  <h3 className="font-bold text-lg text-gray-800 mb-3">Delivery Attachments & Notes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewDialog.deliveryAttachments.map((att: any, idx: number) => (
                      <div key={idx} className="border rounded-md p-3 bg-gray-50 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-gray-600">{new Date(att.createdAt).toLocaleDateString()}</span>
                            <Badge variant="outline" className="text-[10px]">{att.status}</Badge>
                          </div>
                          {att.issueLog && (
                            <p className="text-xs text-gray-700 mt-2 bg-white p-2 border rounded max-h-24 overflow-y-auto">
                              <strong>Note:</strong> {att.issueLog}
                            </p>
                          )}
                        </div>
                        {att.podUrl && (
                          <div className="mt-3 text-right">
                            <a href={att.podUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <FileUp className="h-3 w-3" /> View Photo
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
      );
    })()}

      {/* Payment Dialog */}
      <Dialog open={!!paymentOrder} onOpenChange={() => setPaymentOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment for {paymentOrder?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Amount (BHD)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="col-span-3"
                min="0.001"
                step="0.001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(paymentMethod === "bank_transfer" || paymentMethod === "cheque") && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Bank Account</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>{account.bankName} - {account.accountNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {paymentMethod === "cash" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Petty Cash</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select petty cash account" />
                  </SelectTrigger>
                  <SelectContent>
                    {pettyCashAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Reference</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={paymentMethod === "cheque" ? "Cheque Number" : "Transaction ID"}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOrder(null)}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? "Processing..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
