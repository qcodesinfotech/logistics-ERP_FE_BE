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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";

const chargeSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Required"),
  qty: z.string().transform(v => parseFloat(v) || 1).or(z.number()),
  unitRate: z.string().transform(v => parseFloat(v) || 0).or(z.number()),
  isProfit: z.boolean().default(false),
});

const orderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  rfqId: z.string().optional().nullable(),
  cargoDetails: z.string().min(1, "Cargo details are required"),
  weight: z.string().transform((v) => parseFloat(v) || 0),
  loadType: z.enum(["FTL", "LTL"]),
  
  orderDate: z.string().optional(),
  paymentDueDate: z.string().optional(),
  truckType: z.string().optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  originCountry: z.string().optional(),
  originCity: z.string().optional(),
  
  destinations: z.array(z.object({
    country: z.string(),
    city: z.string()
  })).default([]),
  
  charges: z.array(chargeSchema).default([]),
  
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
      orderDate: new Date().toISOString().substring(0, 10),
      paymentDueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().substring(0, 10),
      truckType: "rented",
      driverName: "",
      driverContact: "",
      originCountry: "",
      originCity: "",
      destinations: [{ country: "", city: "" }],
      charges: [],
      status: "pending",
      zoneId: "",
    },
  });

  const { fields: destFields, append: appendDest, remove: removeDest } = useFieldArray({
    control: form.control,
    name: "destinations"
  });

  const { fields: chargeFields, append: appendCharge, remove: removeCharge } = useFieldArray({
    control: form.control,
    name: "charges"
  });

  // Calculate grand total dynamically based on charges array
  const watchedCharges = form.watch("charges") || [];
  const grandTotal = watchedCharges.reduce((acc, curr) => acc + (parseFloat((curr as any).qty as string || "0") * parseFloat((curr as any).unitRate as string || "0")), 0);

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: (data: any) => {
      // Calculate total for each charge before sending
      const processedCharges = data.charges.map((c: any) => ({
        ...c,
        total: (parseFloat(c.qty) * parseFloat(c.unitRate)).toFixed(3)
      }));

      const payload = {
        ...data,
        orderNumber: selectedOrder ? selectedOrder.orderNumber : `ORD-${Date.now()}`,
        weight: parseFloat(data.weight).toFixed(3),
        grandTotal: grandTotal.toFixed(3),
        documents: uploadedFiles,
        rfqId: data.rfqId || null,
        zoneId: data.zoneId || null,
        charges: processedCharges,
        orderDate: data.orderDate ? new Date(data.orderDate).toISOString() : null,
        paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate).toISOString() : null,
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
      const res = await apiRequest("POST", "/api/upload/contracts", formData);

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
            orderDate: new Date().toISOString().substring(0, 10),
            paymentDueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().substring(0, 10),
            truckType: "rented",
            driverName: "",
            driverContact: "",
            originCountry: "",
            originCity: "",
            destinations: [{ country: "", city: "" }],
            charges: [],
            status: "pending",
            zoneId: "",
          });
          setIsOrderDialogOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" /> Create Order Booking
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6">
        <div className="col-span-1">
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
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                                    <FileText className="h-3 w-3" /> {(order.documents as any).length} attachments
                                  </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(order.documents as {name: string, url: string}[]).map((doc, idx) => (
                                    <DropdownMenuItem key={idx} asChild>
                                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                        <FileText className="mr-2 h-4 w-4" />
                                        <span>{doc.name}</span>
                                      </a>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                            <Button variant="ghost" size="sm" onClick={async () => {
                              setSelectedOrder(order);
                              setUploadedFiles((order.documents as any) || []);
                              
                              // Fetch order details with charges
                              try {
                                const res = await apiRequest("GET", `/api/orders/${order.id}`);
                                const data = await res.json();
                                const orderData = data.order || data;
                                const chargesData = data.charges || [];
                                
                                form.reset({
                                  customerId: orderData.customerId,
                                  rfqId: orderData.rfqId || "",
                                  cargoDetails: orderData.cargoDetails,
                                  weight: String(orderData.weight),
                                  loadType: orderData.loadType as any,
                                  orderDate: orderData.orderDate ? new Date(orderData.orderDate).toISOString().substring(0, 10) : "",
                                  paymentDueDate: orderData.paymentDueDate ? new Date(orderData.paymentDueDate).toISOString().substring(0, 10) : "",
                                  truckType: orderData.truckType || "rented",
                                  driverName: orderData.driverName || "",
                                  driverContact: orderData.driverContact || "",
                                  originCountry: orderData.originCountry || "",
                                  originCity: orderData.originCity || "",
                                  destinations: Array.isArray(orderData.destinations) && orderData.destinations.length > 0 ? orderData.destinations : [{ country: "", city: "" }],
                                  charges: chargesData.map((c: any) => ({
                                    ...c,
                                    qty: String(c.qty),
                                    unitRate: String(c.unitRate)
                                  })),
                                  status: orderData.status as any,
                                  zoneId: orderData.zoneId || "",
                                });
                                setIsOrderDialogOpen(true);
                              } catch (e) {
                                toast({ title: "Failed to load order details", variant: "destructive" });
                              }
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
                      <Select onValueChange={(val) => { const v = val === "none" ? "" : val; field.onChange(v); handleRfqSelect(v); }} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select RFQ to pre-fill" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No RFQ Reference</SelectItem>
                          {rfqsList?.filter(r => r.status !== "rejected").map(r => (
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

                
                <div className="grid grid-cols-2 gap-4 col-span-2">
                  <FormField
                    control={form.control}
                    name="orderDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentDueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <h3 className="font-semibold text-sm">Truck & Driver Info</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="truckType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="own">Own Truck</SelectItem>
                              <SelectItem value="rented">Rented Truck</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="driverName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="driverContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver Contact</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <h3 className="font-semibold text-sm">Origin</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="originCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origin Country</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Bahrain" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="originCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origin City</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Manama" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Destinations</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendDest({ country: "", city: "" })}>
                      <Plus className="h-4 w-4 mr-1" /> Add Destination
                    </Button>
                  </div>
                  {destFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <FormField
                          control={form.control}
                          name={`destinations.${index}.country`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Destination Country</FormLabel>
                              <FormControl>
                                <Input placeholder="Country" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6">
                        <FormField
                          control={form.control}
                          name={`destinations.${index}.city`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Destination City</FormLabel>
                              <FormControl>
                                <Input placeholder="City" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-1 pb-2 text-right">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDest(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Charges & Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendCharge({ description: "", qty: 1, unitRate: 0, isProfit: false })}>
                      <Plus className="h-4 w-4 mr-1" /> Add Charge
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {chargeFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-12 gap-2 items-end border-b pb-2">
                        <div className="col-span-4">
                          <FormField
                            control={form.control}
                            name={`charges.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Description</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Toll Charges" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`charges.${index}.qty`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Qty</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`charges.${index}.unitRate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Unit Rate</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.01" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-2">
                          <FormItem>
                            <FormLabel className="text-xs">Total</FormLabel>
                            <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30">
                              {(parseFloat((watchedCharges[index] as any)?.qty as string || "0") * parseFloat((watchedCharges[index] as any)?.unitRate as string || "0")).toFixed(3)}
                            </div>
                          </FormItem>
                        </div>
                        <div className="col-span-1 pb-3 text-center flex flex-col items-center">
                          <FormLabel className="text-xs mb-2">Profit?</FormLabel>
                          <FormField
                            control={form.control}
                            name={`charges.${index}.isProfit`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1 pb-2 text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeCharge(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2 pr-12">
                      <div className="font-bold">Grand Total: {grandTotal.toFixed(3)}</div>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="zoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operational Zone</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Manual zone select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Zone Assigned</SelectItem>
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
  return `${num.toFixed(3)} BD`;
}
