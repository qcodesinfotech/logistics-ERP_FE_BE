import { useState } from "react";
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

export default function InvoicesPage() {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);

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

  // Fetch specific order details (including charges) when viewing invoice
  const { data: orderDetails, isLoading: loadingDetails } = useQuery<{ order: any, charges: any[] }>({
    queryKey: [selectedOrder?.id ? `/api/orders/${selectedOrder.id}` : null],
    enabled: !!selectedOrder?.id,
  });

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
                  <p className="text-gray-800 text-sm"><span className="font-semibold">Origin:</span> {orderData.originCity}, {orderData.originCountry}</p>
                  <p className="text-gray-800 text-sm">
                    <span className="font-semibold">Destinations:</span>{' '}
                    {orderData.destinations?.map((d: any) => `${d.city}, ${d.country}`).join(' | ') || 'N/A'}
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
                        <span className="text-xs">{order.originCity} &rarr; {(order.destinations as any)?.[0]?.city || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(order)}>
                          <Receipt className="h-4 w-4 mr-1" /> View Invoice
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
    </div>
  );
}
