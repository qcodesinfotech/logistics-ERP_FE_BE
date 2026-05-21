import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardList, Plus, FileText, Upload, Trash2, MapPin, RefreshCw, Layers } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import type { Order, Location, Client, Rfq, Zone } from "@shared/schema";

const orderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  rfqId: z.string().optional().nullable(),
  cargoDetails: z.string().min(1, "Cargo details are required"),
  weight: z.string().transform((v) => parseFloat(v) || 0),
  loadType: z.enum(["FTL", "LTL"]),
  pickupLocationId: z.string().min(1, "Pickup location is required"),
  deliveryLocationId: z.string().min(1, "Delivery location is required"),
  status: z.enum(["pending", "confirmed", "cancelled", "incomplete", "completed"]),
  zoneId: z.string().optional().nullable(),
});

type OrderFormData = z.input<typeof orderFormSchema>;

export default function OrdersPage() {
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);

  const { toast } = useToast();

  // Queries
  const { data: ordersList, isLoading: isOrdersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: locationsList } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: rfqsList } = useQuery<Rfq[]>({
    queryKey: ["/api/rfqs"],
  });

  const { data: zonesList } = useQuery<Zone[]>({
    queryKey: ["/api/zones"],
  });

  // Form
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerId: "",
      rfqId: "",
      cargoDetails: "",
      weight: "0",
      loadType: "FTL",
      pickupLocationId: "",
      deliveryLocationId: "",
      status: "pending",
      zoneId: "",
    },
  });

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        orderNumber: selectedOrder ? selectedOrder.orderNumber : `ORD-${Date.now()}`,
        weight: parseFloat(data.weight).toFixed(3),
        documents: uploadedFiles,
        rfqId: data.rfqId || null,
        zoneId: data.zoneId || null,
      };
      return apiRequest(selectedOrder ? "PUT" : "POST", selectedOrder ? `/api/orders/${selectedOrder.id}` : "/api/orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: selectedOrder ? "Order updated successfully" : "Order created successfully" });
      setIsOrderDialogOpen(false);
      setSelectedOrder(null);
      setUploadedFiles([]);
      form.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const autoAllocateZoneMutation = useMutation({
    mutationFn: async (order: Order) => {
      const deliveryLoc = locationsList?.find(l => l.id === order.deliveryLocationId);
      if (!deliveryLoc) throw new Error("Delivery location not found to allocate zone.");
      
      const res = await apiRequest("POST", "/api/zones/auto-allocate", { address: deliveryLoc.address });
      const result = await res.json();
      if (!result.zone) {
        throw new Error("Unable to auto-allocate zone. Address didn't match any zone key terms.");
      }
      
      return apiRequest("PUT", `/api/orders/${order.id}`, { zoneId: result.zone.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Zone auto-allocated and updated successfully!" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("documents", files[i]);
    }

    try {
      const res = await fetch("/api/upload/contracts", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      setUploadedFiles(prev => [...prev, ...data.documents]);
      toast({ title: "Documents uploaded successfully" });
    } catch (err) {
      toast({ title: "Failed to upload documents", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRfqSelect = (rfqId: string) => {
    const rfq = rfqsList?.find(r => r.id === rfqId);
    if (rfq) {
      form.setValue("customerId", rfq.customerId);
      form.setValue("pickupLocationId", rfq.originLocationId || "");
      form.setValue("deliveryLocationId", rfq.destinationLocationId || "");
      const origin = locationsList?.find(l => l.id === rfq.originLocationId);
      const destination = locationsList?.find(l => l.id === rfq.destinationLocationId);
      form.setValue("cargoDetails", `Transit from ${origin?.name || 'Origin'} to ${destination?.name || 'Destination'} (via ${rfq.transitRoute || 'direct'})`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Order Book" 
        description="Manage shipping bookings, upload freight sheets, check cargo volumes and trigger auto-zonal routing."
      >
        <Button onClick={() => {
          setSelectedOrder(null);
          setUploadedFiles([]);
          form.reset({
            customerId: "",
            rfqId: "",
            cargoDetails: "",
            weight: "0",
            loadType: "FTL",
            pickupLocationId: "",
            deliveryLocationId: "",
            status: "pending",
            zoneId: "",
          });
          setIsOrderDialogOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" /> Create Order Booking
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Active Logistics Orders
              </CardTitle>
              <CardDescription>
                Live registry of all customer freight requests, dispatch statuses and physical deliveries.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isOrdersLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
              ) : !ordersList || ordersList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
                  <span>No shipping orders in registry.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Info</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Cargo Details</TableHead>
                      <TableHead>Route Details</TableHead>
                      <TableHead>Operational Zone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersList.map((order) => {
                      const client = clientsList?.find(c => c.id === order.customerId);
                      const pickup = locationsList?.find(l => l.id === order.pickupLocationId);
                      const delivery = locationsList?.find(l => l.id === order.deliveryLocationId);
                      const zone = zonesList?.find(z => z.id === order.zoneId);

                      return (
                        <TableRow key={order.id} className="hover:bg-accent/40 transition-colors">
                          <TableCell className="font-semibold text-foreground">
                            <div>{order.orderNumber}</div>
                            {order.rfqId && (
                              <div className="text-[10px] text-muted-foreground">Via RFQ Ref</div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{client?.name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{client?.companyName}</div>
                          </TableCell>
                          <TableCell className="text-xs space-y-0.5 max-w-[200px]">
                            <div className="font-medium text-foreground truncate" title={order.cargoDetails}>
                              {order.cargoDetails}
                            </div>
                            <div className="text-muted-foreground">
                              {order.weight ? `${parseFloat(String(order.weight)).toFixed(3)} tons` : "0.000 tons"} • {order.loadType}
                            </div>
                            {order.documents && (order.documents as any).length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                                <FileText className="h-3 w-3" /> {(order.documents as any).length} attachments
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="text-muted-foreground">Pickup: <span className="font-medium text-foreground">{pickup?.name || "N/A"}</span></div>
                            <div className="text-muted-foreground">Deliver: <span className="font-medium text-foreground">{delivery?.name || "N/A"}</span></div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {zone ? (
                              <span className="font-semibold text-foreground">{zone.name}</span>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-amber-600 dark:text-amber-400 font-medium">Unallocated</span>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-[10px] w-full px-1 py-0"
                                  onClick={() => autoAllocateZoneMutation.mutate(order)}
                                  disabled={autoAllocateZoneMutation.isPending}
                                >
                                  Auto Assign
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSelectedOrder(order);
                              setUploadedFiles((order.documents as any) || []);
                              form.reset({
                                customerId: order.customerId,
                                rfqId: order.rfqId || "",
                                cargoDetails: order.cargoDetails,
                                weight: String(order.weight),
                                loadType: order.loadType as any,
                                pickupLocationId: order.pickupLocationId || "",
                                deliveryLocationId: order.deliveryLocationId || "",
                                status: order.status as any,
                                zoneId: order.zoneId || "",
                              });
                              setIsOrderDialogOpen(true);
                            }}>
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-600"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this order?")) {
                                  deleteOrderMutation.mutate(order.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="shadow-md bg-accent/10 border-accent/20 sticky top-6">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Partial Deliveries
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3">
              <p>
                Orders can possess the status of **Incomplete** or **Completed**.
              </p>
              <p className="font-semibold text-foreground">ERP Status Lifecycle:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li>**Incomplete:** Occurs when one or more deliveries of a trip are flagged as `partial` or `failed`.</li>
                <li>**Completed:** Achieved only once the driver registers successful Proof-of-Delivery (POD) for every single item linked to the booking.</li>
              </ul>
              <p>
                Use the **Auto-Assign** button to analyze customer geocodes and automatically classify orders under active operational regions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Booking Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOrder ? "Modify Order Booking" : "New Shipping Order"}</DialogTitle>
            <DialogDescription>
              Register cargo descriptions, weight profiles, and pickup/delivery nodes.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createOrderMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rfqId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Reference RFQ (Optional)</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); handleRfqSelect(val); }} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select RFQ to pre-fill" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No RFQ Reference</SelectItem>
                          {rfqsList?.filter(r => r.status === "approved" || r.status === "converted").map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.rfqNumber} ({formatCurrency(r.totalCharges)})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientsList?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.companyName || "No Company"})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cargoDetails"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Cargo details / Manifest *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 500 Bags of Oman Portland Cement" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo Weight (Tons) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="loadType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Load Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FTL">FTL (Full Truck Load)</SelectItem>
                          <SelectItem value="LTL">LTL (Less than Truck Load)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pickupLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Location *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pickup" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locationsList?.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deliveryLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Location *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select delivery" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locationsList?.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operational Zone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Manual zone select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Zone Assigned</SelectItem>
                          {zonesList?.map(z => (
                            <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="incomplete">Incomplete / Partial</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Document Upload Area */}
              <div className="space-y-2 border-t pt-4">
                <FormLabel>Shipping Documents / Manifest Files</FormLabel>
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    multiple 
                    className="cursor-pointer"
                    onChange={handleFileUpload} 
                    disabled={isUploading}
                  />
                  {isUploading && <Button disabled variant="outline"><RefreshCw className="h-4 w-4 animate-spin" /></Button>}
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between border p-2 rounded-md bg-muted/30 text-xs">
                        <span className="truncate max-w-[150px]" title={file.name}>{file.name}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                          onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrderMutation.isPending}>
                  {createOrderMutation.isPending ? "Creating..." : "Save Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatCurrency(val: any) {
  const num = parseFloat(String(val)) || 0;
  return `${num.toFixed(3)} RO`;
}
