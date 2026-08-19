import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, FileText, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import type { Order, Client } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard } from "lucide-react";

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const { data: bankAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/bank-accounts"] });
  const { data: pettyCashAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/petty-cash"] });

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/invoices/${paymentInvoice.id}/pay`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment recorded successfully and accounting ledger entries posted!" });
      setPaymentInvoice(null);
    },
    onError: (error) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    }
  });

  const handlePayClick = (invoice: any) => {
    setPaymentInvoice(invoice);
    setPaymentAmount(parseFloat(invoice.outstandingAmount || "0").toFixed(3));
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
      amount: paymentAmount,
      paymentMethod,
      reference: paymentReference,
      bankAccountId: (paymentMethod === "bank_transfer" || paymentMethod === "cheque") ? paymentAccountId : null,
      pettyCashId: paymentMethod === "cash" ? paymentAccountId : null,
    });
  };

  const formatCurrency = (val: any) => {
    return new Intl.NumberFormat('en-BH', {
      style: 'currency',
      currency: 'BHD',
      minimumFractionDigits: 3
    }).format(parseFloat(val || "0"));
  };

  // Fetch invoices
  const { data: invoicesList = [], isLoading: loadingInvoices } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
  });

  // Fetch clients for mapping
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch trips for description lookup
  const { data: tripsList = [] } = useQuery<any[]>({
    queryKey: ["/api/trips"],
  });

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDialogOpen(true);
  };

  const renderInvoiceModal = () => {
    if (!selectedInvoice) return null;

    const client = clients.find(c => c.id === selectedInvoice.customerId);
    const trip = tripsList.find(t => t.id === selectedInvoice.tripId);
    
    return (
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trucking Invoice</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8 bg-white text-black p-8 border rounded-md">
            <div className="flex justify-between items-start border-b pb-6">
              <div>
                <h1 className="text-3xl font-bold uppercase text-gray-800">Invoice</h1>
                <p className="text-gray-500 mt-1">Invoice #: {selectedInvoice.invoiceNumber}</p>
                <p className="text-gray-500">Date: {selectedInvoice.createdAt ? format(new Date(selectedInvoice.createdAt), 'PPP') : 'N/A'}</p>
                <p className="text-gray-500">Due Date: {selectedInvoice.paymentDueDate ? format(new Date(selectedInvoice.paymentDueDate), 'PPP') : 'N/A'}</p>
              </div>
              <div className="text-right">
                <h2 className="font-semibold text-lg text-gray-800">Logistics ERP</h2>
                <p className="text-gray-600 text-sm">Bahrain</p>
              </div>
            </div>

            <div className="flex justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-gray-600 uppercase text-xs">Bill To</p>
                <p className="font-bold text-gray-800">{client?.companyName || client?.name}</p>
                <p className="text-gray-600 text-sm">{client?.address}</p>
                <p className="text-gray-600 text-sm">{client?.phone}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="font-semibold text-gray-600 uppercase text-xs">Trip Details</p>
                {trip ? (
                  <>
                    <p className="text-gray-800 text-sm"><span className="font-semibold">Route:</span> {trip.route}</p>
                    <p className="text-gray-800 text-sm"><span className="font-semibold">Truck Model/Plates:</span> {trip.truckPlateNumber || "N/A"}</p>
                    <p className="text-gray-800 text-sm"><span className="font-semibold">Driver:</span> {trip.driverName || "N/A"}</p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">Trip ID: {selectedInvoice.tripId}</p>
                )}
              </div>
            </div>

            <div className="pt-4">
              <Table className="border">
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[50px] font-bold text-gray-800">#</TableHead>
                    <TableHead className="font-bold text-gray-800">Description</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Qty</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Unit Price</TableHead>
                    <TableHead className="text-right font-bold text-gray-800">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-gray-800">1</TableCell>
                    <TableCell className="text-gray-800">
                      Freight Transportation Service
                      {trip && <span className="text-xs text-muted-foreground block">Route: {trip.route}</span>}
                    </TableCell>
                    <TableCell className="text-right text-gray-800">1</TableCell>
                    <TableCell className="text-right text-gray-800">{formatCurrency(selectedInvoice.total)}</TableCell>
                    <TableCell className="text-right text-gray-800">{formatCurrency(selectedInvoice.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4">
              <div className="w-64 space-y-3">
                <div className="flex justify-between font-bold text-lg border-t-2 pt-2 border-gray-800 text-gray-800">
                  <span>Total Invoice Amount:</span>
                  <span>{formatCurrency(selectedInvoice.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Outstanding Balance:</span>
                  <span>{formatCurrency(selectedInvoice.outstandingAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>Close</Button>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Print Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Trucking Invoices" 
        description="View and manage client invoices for completed orders. Company margins are automatically filtered out."
      >
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>All generated invoices from orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice / Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Origin / Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingInvoices ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading invoices...</TableCell>
                </TableRow>
              ) : invoicesList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell>
                </TableRow>
              ) : (
                invoicesList.map((invoice) => {
                  const client = clients.find(c => c.id === invoice.customerId);
                  const trip = tripsList.find(t => t.id === invoice.tripId);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{client?.companyName || client?.name || "Unknown"}</TableCell>
                      <TableCell>{invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {trip?.route || "Freight service charges"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.paymentStatus || "unpaid"} />
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {invoice.paymentStatus !== "paid" && (
                          <Button variant="outline" size="sm" onClick={() => handlePayClick(invoice)}>
                            <CreditCard className="h-4 w-4 mr-1" /> Pay
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)}>
                          <Receipt className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {renderInvoiceModal()}

      {/* Payment Modal */}
      <Dialog open={!!paymentInvoice} onOpenChange={(open) => !open && setPaymentInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment for {paymentInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between bg-gray-50 p-3 rounded border">
              <div className="flex flex-col text-sm">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-semibold">{formatCurrency(paymentInvoice?.total || 0)}</span>
              </div>
              <div className="flex flex-col text-sm">
                <span className="text-muted-foreground">Outstanding Balance</span>
                <span className="font-semibold">{formatCurrency(paymentInvoice?.outstandingAmount || 0)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Amount (BHD)</Label>
              <Input 
                type="number" 
                step="0.001" 
                value={paymentAmount} 
                onChange={(e) => setPaymentAmount(e.target.value)} 
                placeholder="0.000"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(paymentMethod === "bank_transfer" || paymentMethod === "cheque") && (
              <div className="space-y-2">
                <Label>Select Bank Account</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account: any) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <Label>Select Petty Cash Account</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {pettyCashAccounts.map((account: any) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reference / Cheque Number (Optional)</Label>
              <Input 
                value={paymentReference} 
                onChange={(e) => setPaymentReference(e.target.value)} 
                placeholder="e.g. TRN-1234"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentInvoice(null)}>Cancel</Button>
            <Button 
              onClick={handlePaymentSubmit} 
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? "Processing..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
