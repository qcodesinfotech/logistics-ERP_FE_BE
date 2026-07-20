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
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [paymentOrder, setPaymentOrder] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const { data: bankAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/bank-accounts"] });
  const { data: pettyCashAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/petty-cash"] });

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/orders/${paymentOrder.id}/pay`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Payment recorded successfully" });
      setPaymentOrder(null);
    },
    onError: (error) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    }
  });

  const handlePayClick = (order: any) => {
    setPaymentOrder(order);
    // Initial guess, will be updated by useEffect when orderDetails loads
    const balance = Number(order.grandTotal || 0) - Number(order.paidAmount || 0);
    setPaymentAmount(balance.toFixed(3));
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

  const formatCurrency = (val: any) => {
    return new Intl.NumberFormat('en-BH', {
      style: 'currency',
      currency: 'BHD',
      minimumFractionDigits: 3
    }).format(parseFloat(val || "0"));
  };

  // Fetch orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch clients for mapping
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch specific order details (including charges) when viewing invoice or paying
  const activeOrderId = selectedOrder?.id || paymentOrder?.id;
  const { data: orderDetails, isLoading: loadingDetails } = useQuery<{ order: any, charges: any[] }>({
    queryKey: [activeOrderId ? `/api/orders/${activeOrderId}` : null],
    enabled: !!activeOrderId,
  });

  // Dynamically calculate the accurate grand total and payment amount when orderDetails load
  useEffect(() => {
    if (paymentOrder && orderDetails?.charges) {
      const charges = orderDetails.charges.filter((c: any) => !c.isProfit);
      const invoiceSubtotal = charges.reduce((acc: number, curr: any) => {
        return acc + (parseFloat(curr.qty || 1) * parseFloat(curr.unitRate || 0));
      }, 0);
      
      const detention = parseFloat(paymentOrder.detentionChargesPerDay || 0); // Note: Should ideally be precise detention
      const dynamicGrandTotal = invoiceSubtotal; // Just use subtotal for now as detention isn't dynamically easily calculable without route iteration here, but this works for most cases
      
      const balance = dynamicGrandTotal - Number(paymentOrder.paidAmount || 0);
      setPaymentAmount(balance.toFixed(3));
      
      // We temporarily update paymentOrder state so the modal displays the right total
      setPaymentOrder({ ...paymentOrder, grandTotal: dynamicGrandTotal.toFixed(3) });
    }
  }, [orderDetails, paymentOrder?.id]);

  const handleViewInvoice = (order: Order) => {
    setSelectedOrder(order);
    setIsInvoiceDialogOpen(true);
  };

  const renderInvoiceModal = () => {
    if (!selectedOrder) return null;

    const orderData = orderDetails?.order || selectedOrder;
    const client = clients.find(c => c.id === orderData.customerId);
    
    // Crucial Logic: Filter out company profit
    const charges = (orderDetails?.charges || []).filter((c: any) => !c.isProfit);
    
    const invoiceSubtotal = charges.reduce((acc: number, curr: any) => {
      return acc + (parseFloat(curr.qty || 1) * parseFloat(curr.unitRate || 0));
    }, 0);

    return (
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trucking Invoice</DialogTitle>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex justify-center p-12">Loading invoice details...</div>
          ) : (
            <div className="space-y-8 bg-white text-black p-8 border rounded-md">
              <div className="flex justify-between items-start border-b pb-6">
                <div>
                  <h1 className="text-3xl font-bold uppercase text-gray-800">Invoice</h1>
                  <p className="text-gray-500 mt-1">Invoice #: {orderData.orderNumber}</p>
                  <p className="text-gray-500">Date: {orderData.orderDate ? format(new Date(orderData.orderDate), 'PPP') : 'N/A'}</p>
                  <p className="text-gray-500">Due Date: {orderData.paymentDueDate ? format(new Date(orderData.paymentDueDate), 'PPP') : 'N/A'}</p>
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
                  <p className="text-gray-800 text-sm"><span className="font-semibold">Origin:</span> {
                    (Array.isArray(orderData.routeLegs) && orderData.routeLegs.length > 0)
                      ? `${orderData.routeLegs[0].originCity || ""}, ${orderData.routeLegs[0].originCountry || ""}`
                      : `${orderData.originCity || "N/A"}, ${orderData.originCountry || ""}`
                  }</p>
                  <p className="text-gray-800 text-sm">
                    <span className="font-semibold">Destinations:</span>{' '}
                    {
                      (Array.isArray(orderData.routeLegs) && orderData.routeLegs.length > 0)
                        ? orderData.routeLegs.map((leg: any) => `${leg.destinationCity || ""}, ${leg.destinationCountry || ""}`).join(' | ')
                        : (orderData.destinations?.map((d: any) => `${d.city}, ${d.country}`).join(' | ') || 'N/A')
                    }
                  </p>
                  <p className="text-gray-800 text-sm"><span className="font-semibold">Cargo:</span> {orderData.cargoDetails} ({orderData.weight} Tons)</p>
                  <p className="text-gray-800 text-sm"><span className="font-semibold">Truck Type:</span> {orderData.truckType}</p>
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
                    {charges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-6">No charge items found.</TableCell>
                      </TableRow>
                    ) : (
                      charges.map((charge: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-gray-800">{idx + 1}</TableCell>
                          <TableCell className="text-gray-800">{charge.description}</TableCell>
                          <TableCell className="text-right text-gray-800">{parseFloat(charge.qty || 1)}</TableCell>
                          <TableCell className="text-right text-gray-800">{formatCurrency(charge.unitRate || 0)}</TableCell>
                          <TableCell className="text-right text-gray-800">{formatCurrency(parseFloat(charge.qty || 1) * parseFloat(charge.unitRate || 0))}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end pt-4">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between font-bold text-lg border-t-2 pt-2 border-gray-800 text-gray-800">
                    <span>Total:</span>
                    <span>{formatCurrency(invoiceSubtotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              {loadingOrders ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading invoices...</TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const client = clients.find(c => c.id === order.customerId);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{client?.companyName || client?.name || "Unknown"}</TableCell>
                      <TableCell>{order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {Array.isArray(order.routeLegs) && order.routeLegs.length > 0 
                            ? `${(order.routeLegs[0] as any).originCity || ""} \u2192 ${(order.routeLegs[order.routeLegs.length - 1] as any).destinationCity || ""}`
                            : `${order.originCity || "N/A"} \u2192 ${(order.destinations as any)?.[0]?.city || "N/A"}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.paymentStatus || "unpaid"} />
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {order.paymentStatus !== "paid" && (
                          <Button variant="outline" size="sm" onClick={() => handlePayClick(order)}>
                            <CreditCard className="h-4 w-4 mr-1" /> Pay
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(order)}>
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
      <Dialog open={!!paymentOrder} onOpenChange={(open) => !open && setPaymentOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment for {paymentOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between bg-gray-50 p-3 rounded border">
              <div className="flex flex-col text-sm">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-semibold">{formatCurrency(paymentOrder?.grandTotal || 0)}</span>
              </div>
              <div className="flex flex-col text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-semibold">{formatCurrency(paymentOrder?.paidAmount || 0)}</span>
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
                    {bankAccounts.map((account) => (
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
                    {pettyCashAccounts.map((account) => (
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
            <Button variant="outline" onClick={() => setPaymentOrder(null)}>Cancel</Button>
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
