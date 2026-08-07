import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Printer, Check, CreditCard, RefreshCw } from "lucide-react";
import { FmcgInvoice, FmcgInvoiceItem } from "@shared/schema";
import { format } from "date-fns";

export default function DeliveryInvoicesPage() {
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<(FmcgInvoice & { items: FmcgInvoiceItem[] }) | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: invoices = [], isLoading, refetch } = useQuery<(FmcgInvoice & { items: FmcgInvoiceItem[] })[]>({
    queryKey: ["/api/fmcg-invoices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/fmcg-invoices");
      return res.json();
    },
    refetchOnMount: true,
    staleTime: 0,
  });


  const updateInvoiceMutation = useMutation({
    mutationFn: async (payload: { id: string, data: any }) => {
      const res = await apiRequest("PUT", `/api/fmcg-invoices/${payload.id}`, payload.data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fmcg-invoices"] });
      toast({ title: "Invoice updated successfully" });
      setIsModalOpen(false);
    }
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fmcg-invoices/backfill");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fmcg-invoices"] });
      refetch();
      toast({ 
        title: "Invoices Generated", 
        description: `Created ${data.invoicesCreated} invoices, linked ${data.itemsLinked} items from ${data.total} deliveries.` 
      });
    },
    onError: () => {
      toast({ title: "Generation failed", description: "Could not generate invoices from deliveries.", variant: "destructive" });
    }
  });

  const handleApprove = (invoice: FmcgInvoice & { items: FmcgInvoiceItem[] }) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved": return <Badge variant="outline" className="bg-blue-100 text-blue-800">Approved</Badge>;
      case "paid": return <Badge variant="outline" className="bg-green-100 text-green-800">Paid</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Invoices</h1>
          <p className="text-muted-foreground">Auto-generated invoices from driver deliveries.</p>
        </div>
        <div className="flex items-center gap-2">
          {invoices.length === 0 && (
            <Button 
              onClick={() => backfillMutation.mutate()} 
              disabled={backfillMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${backfillMutation.isPending ? "animate-spin" : ""}`} />
              {backfillMutation.isPending ? "Generating..." : "Generate from Deliveries"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>TO / Outlet</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={inv.toNo}>
                  {inv.toNo?.startsWith("OUTLET-") ? `Outlet: ${inv.toNo.split("-")[1]?.slice(0, 8)}…` : inv.toNo}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{inv.items?.length || 0} items</Badge>
                </TableCell>
                <TableCell>{format(new Date(inv.createdAt || new Date()), "dd/MM/yyyy")}</TableCell>
                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                <TableCell>{inv.totalAmount || "0.000"} BD</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleApprove(inv)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View / Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No delivery invoices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <InvoiceModal 
        invoice={selectedInvoice} 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
        onSave={(data) => {
          if (selectedInvoice) {
             updateInvoiceMutation.mutate({ id: selectedInvoice.id, data });
          }
        }}
      />
    </div>
  );
}

function InvoiceModal({ invoice, open, onOpenChange, onSave }: any) {
  const [formData, setFormData] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);

  React.useEffect(() => {
    if (invoice) {
      setFormData({
        gdnNumber: invoice.gdnNumber || "",
        gdnDate: invoice.gdnDate ? invoice.gdnDate.substring(0, 10) : "",
        orderNumber: invoice.orderNumber || "",
        orderDate: invoice.orderDate ? invoice.orderDate.substring(0, 10) : "",
        vehicleNumber: invoice.vehicleNumber || "",
        warehouseNo: invoice.warehouseNo || "",
        gatePassNo: invoice.gatePassNo || "",
        containerNo: invoice.containerNo || "",
        subtotal: invoice.subtotal || "0",
        vatAmount: invoice.vatAmount || "0",
        discount: invoice.discount || "0",
        totalAmount: invoice.totalAmount || "0",
        note: invoice.note || "",
      });
      setItems(invoice.items || []);
    }
  }, [invoice]);

  if (!invoice) return null;

  const handleSave = (status: string = invoice.status) => {
    onSave({ ...formData, items, status });
  };

  const calculateTotals = (newItems: any[]) => {
    const sub = newItems.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0);
    const vat = parseFloat(formData.vatAmount) || 0;
    const disc = parseFloat(formData.discount) || 0;
    setFormData(prev => ({
      ...prev,
      subtotal: sub.toFixed(3),
      totalAmount: (sub + vat - disc).toFixed(3)
    }));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'unitPrice' || field === 'deliveredQty') {
       const qty = parseFloat(newItems[index].deliveredQty) || 0;
       const price = parseFloat(newItems[index].unitPrice) || 0;
       newItems[index].totalPrice = (qty * price).toFixed(3);
    }
    
    setItems(newItems);
    calculateTotals(newItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Details - {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
          <div>
            <Label>GDN #</Label>
            <Input value={formData.gdnNumber} onChange={e => setFormData({...formData, gdnNumber: e.target.value})} />
          </div>
          <div>
            <Label>GDN Date</Label>
            <Input type="date" value={formData.gdnDate} onChange={e => setFormData({...formData, gdnDate: e.target.value})} />
          </div>
          <div>
            <Label>Order #</Label>
            <Input value={formData.orderNumber} onChange={e => setFormData({...formData, orderNumber: e.target.value})} />
          </div>
          <div>
            <Label>Order Date</Label>
            <Input type="date" value={formData.orderDate} onChange={e => setFormData({...formData, orderDate: e.target.value})} />
          </div>
          <div>
            <Label>Vehicle #</Label>
            <Input value={formData.vehicleNumber} onChange={e => setFormData({...formData, vehicleNumber: e.target.value})} />
          </div>
          <div>
            <Label>Warehouse No</Label>
            <Input value={formData.warehouseNo} onChange={e => setFormData({...formData, warehouseNo: e.target.value})} />
          </div>
          <div>
            <Label>Gate Pass No</Label>
            <Input value={formData.gatePassNo} onChange={e => setFormData({...formData, gatePassNo: e.target.value})} />
          </div>
          <div>
            <Label>Container No</Label>
            <Input value={formData.containerNo} onChange={e => setFormData({...formData, containerNo: e.target.value})} />
          </div>
        </div>

        <h3 className="font-semibold mt-4 mb-2">Delivered Items</h3>
        <Table className="mb-4">
          <TableHeader>
            <TableRow>
              <TableHead>Stock No</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Pack Size</TableHead>
              <TableHead>Req Qty</TableHead>
              <TableHead>Del Qty</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.stockNo}</TableCell>
                <TableCell>{item.itemName}</TableCell>
                <TableCell>{item.packSize}</TableCell>
                <TableCell>{item.requestedQty}</TableCell>
                <TableCell>
                  <Input className="w-20" type="number" value={item.deliveredQty} onChange={e => handleItemChange(idx, 'deliveredQty', e.target.value)} />
                </TableCell>
                <TableCell>
                  <Input className="w-24" type="number" step="0.001" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)} />
                </TableCell>
                <TableCell>{item.totalPrice}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <Label>Notes (2-3 lines)</Label>
            <textarea 
              className="w-full flex min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              value={formData.note}
              onChange={e => setFormData({...formData, note: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Subtotal</Label>
              <span>{formData.subtotal} BD</span>
            </div>
            <div className="flex justify-between items-center">
              <Label>VAT Amount</Label>
              <Input type="number" className="w-24 text-right" value={formData.vatAmount} onChange={e => {
                setFormData(p => ({...p, vatAmount: e.target.value}));
                setTimeout(() => calculateTotals(items), 50);
              }} />
            </div>
            <div className="flex justify-between items-center font-bold text-lg border-t pt-2 mt-2">
              <Label>Total Amount</Label>
              <span>{formData.totalAmount} BD</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="secondary" onClick={() => handleSave()}>
            Save Draft
          </Button>
          {invoice.status === "pending" && (
            <Button onClick={() => handleSave("approved")}>
              <Check className="w-4 h-4 mr-2" />
              Approve Invoice
            </Button>
          )}
          {invoice.status === "approved" && (
            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("paid")}>
              <CreditCard className="w-4 h-4 mr-2" />
              Receive Payment
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
