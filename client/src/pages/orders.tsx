import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardList, Plus, FileText, Upload, Trash2, MapPin, RefreshCw, Layers, Eye, Printer } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
});

const orderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  rfqId: z.string().optional().nullable(),
  cargoDetails: z.string().min(1, "Cargo details are required"),
  weight: z.string().transform((v) => parseFloat(v) || 0),
  loadType: z.enum(["FTL", "LTL"]),
  
  orderDate: z.string().optional(),
  paymentDueDate: z.string().optional(),
  truckOwnership: z.string().optional(),
  truckType: z.string().optional(),
  truckModel: z.string().optional(),
  truckPlateNumber: z.string().optional(),
  chassisNumber: z.string().optional(),
  cargoType: z.string().optional(),
  freightType: z.string().optional(),
  detentionChargesPerDay: z.string().transform(v => parseFloat(v) || 0).or(z.number()).optional(),
  driverName: z.string().optional(),
  driverContact: z.string().optional(),
  
  routeLegs: z.array(z.object({
    originCountry: z.string().min(1, "Country required"),
    originCity: z.string().min(1, "City required"),
    destinationCountry: z.string().min(1, "Country required"),
    destinationCity: z.string().min(1, "City required"),
    loadingDate: z.string().optional(),
    offloadingDate: z.string().optional(),
    transitDays: z.number().optional(),
    status: z.string().optional(),
    deliveryDate: z.string().optional(),
    podDocuments: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  })).default([]),
  
  charges: z.array(chargeSchema).default([]),
  
  status: z.enum(["pending", "confirmed", "cancelled", "incomplete", "completed"]),
  zoneId: z.string().optional().nullable(),
  operationalZone: z.string().optional(),
});

type OrderFormData = z.input<typeof orderFormSchema>;

export default function OrdersPage() {
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [isFinalizeExpensesOpen, setIsFinalizeExpensesOpen] = useState(false);
  const [manageRoutesOrder, setManageRoutesOrder] = useState<Order | null>(null);
  const [routeLegsState, setRouteLegsState] = useState<any[]>([]);
  const [orderStatusState, setOrderStatusState] = useState("pending");
  const [orderToFinalize, setOrderToFinalize] = useState<any>(null);
  const [finalizeExpenses, setFinalizeExpenses] = useState<{ description: string; qty: number; unitRate: number }[]>([
    { description: "Driver Fee", qty: 1, unitRate: 0 },
    { description: "Outsourced Truck Fee", qty: 1, unitRate: 0 },
  ]);

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
      truckOwnership: "rented",
      truckType: "",
      truckModel: "",
      truckPlateNumber: "",
      chassisNumber: "",
      cargoType: "",
      freightType: "",
      detentionChargesPerDay: "0",
      driverName: "",
      driverContact: "",
      routeLegs: [],
      charges: [],
      status: "pending",
      zoneId: "",
      operationalZone: "",
    },
  });

  const { fields: routeFields, append: appendRoute, remove: removeRoute } = useFieldArray({
    control: form.control,
    name: "routeLegs"
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
      const processedCharges = data.charges ? data.charges.map((c: any) => ({
        ...c,
        total: (parseFloat(c.qty) * parseFloat(c.unitRate)).toFixed(3)
      })) : undefined;

      const payload: any = {
        ...data,
        orderNumber: selectedOrder ? selectedOrder.orderNumber : `ORD-${Date.now()}`,
        weight: parseFloat(data.weight || "0").toFixed(3),
        documents: uploadedFiles,
        rfqId: data.rfqId || null,
        zoneId: data.zoneId || null,
        charges: processedCharges,
        expenses: data.expenses, // Pass expenses to the backend if provided
        orderDate: data.orderDate ? new Date(data.orderDate).toISOString() : null,
        paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate).toISOString() : null,
      };

      if (data.charges !== undefined) {
        payload.grandTotal = grandTotal.toFixed(3);
        
        // Calculate any detention deductions
        let detentionDeduction = 0;
        if (payload.routeLegs && Array.isArray(payload.routeLegs)) {
          payload.routeLegs.forEach((leg: any) => {
            if (leg.status === "completed" && leg.deliveryDate && leg.offloadingDate) {
              const delivery = new Date(leg.deliveryDate);
              const offloading = new Date(leg.offloadingDate);
              if (delivery > offloading) {
                const diffTime = Math.abs(delivery.getTime() - offloading.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                detentionDeduction += (diffDays * parseFloat(payload.detentionChargesPerDay || 0));
              }
            }
          });
        }
        
        if (detentionDeduction > 0) {
          payload.grandTotal = (parseFloat(payload.grandTotal) - detentionDeduction).toFixed(3);
          toast({ title: `Detention charges of ${detentionDeduction} deducted from Grand Total.`, variant: "default" });
        }
      }

      const isUpdate = !!selectedOrder || !!payload.id;
      const endpointId = selectedOrder ? selectedOrder.id : payload.id;
      return apiRequest(isUpdate ? "PUT" : "POST", isUpdate ? `/api/orders/${endpointId}` : "/api/orders", payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: (selectedOrder || variables.id) ? "Order updated successfully" : "Order created successfully" });
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

  const handlePodUpload = async (e: React.ChangeEvent<HTMLInputElement>, legIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append("documents", files[i]);

    try {
      const res = await apiRequest("POST", "/api/upload/contracts", formData);
      const data = await res.json();
      const currentPods = form.getValues(`routeLegs.${legIndex}.podDocuments`) || [];
      form.setValue(`routeLegs.${legIndex}.podDocuments`, [...currentPods, ...data.documents]);
      toast({ title: "POD uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload POD", variant: "destructive" });
    }
  };

  const handleFormSubmit = (data: OrderFormData) => {
    if (data.status === "completed" && !data.expenses) {
      setOrderToFinalize({ ...data, id: selectedOrder?.id } as any);
      setFinalizeExpenses([
        { description: "Driver Fee", qty: 1, unitRate: 0 },
        { description: "Outsourced Truck Fee", qty: 1, unitRate: 0 },
      ]);
      setIsFinalizeExpensesOpen(true);
      return;
    }
    createOrderMutation.mutate(data as any);
  };

  const handleQuickUpdateSave = () => {
    if (!manageRoutesOrder) return;
    const payload = { ...manageRoutesOrder, status: orderStatusState, routeLegs: routeLegsState };
    
    if (orderStatusState === "completed" && !(manageRoutesOrder as any).expenses) {
      setOrderToFinalize(payload as any);
      setFinalizeExpenses([
        { description: "Driver Fee", qty: 1, unitRate: 0 },
        { description: "Outsourced Truck Fee", qty: 1, unitRate: 0 },
      ]);
      setIsFinalizeExpensesOpen(true);
      setManageRoutesOrder(null);
      return;
    }
    
    createOrderMutation.mutate(payload as any);
    setManageRoutesOrder(null);
  };
  
  const handleQuickPodUpload = async (e: React.ChangeEvent<HTMLInputElement>, legIndex: number) => {
    if (!e.target.files?.length) return;
    try {
      const formData = new FormData();
      Array.from(e.target.files).forEach(file => formData.append("files", file));
      const res = await fetch("/api/upload/multiple", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to upload files");
      const data = await res.json();
      const updatedLegs = [...routeLegsState];
      const currentPods = updatedLegs[legIndex].podDocuments || [];
      updatedLegs[legIndex] = { ...updatedLegs[legIndex], podDocuments: [...currentPods, ...data.documents] };
      setRouteLegsState(updatedLegs);
    } catch (err) {
      toast({ title: "Failed to upload PODs", variant: "destructive" });
    }
  };

  const submitFinalizeExpenses = () => {
    if (!orderToFinalize) return;
    const totalExpenses = finalizeExpenses.map(e => ({
      ...e,
      total: (e.qty * e.unitRate).toFixed(3)
    }));
    createOrderMutation.mutate({
      ...orderToFinalize,
      expenses: totalExpenses
    });
    setIsFinalizeExpensesOpen(false);
  };

  const handleRfqSelect = (rfqId: string) => {
    const rfq = rfqsList?.find(r => r.id === rfqId);
    if (rfq) {
      form.setValue("customerId", rfq.customerId);
      const origin = locationsList?.find(l => l.id === rfq.originLocationId);
      const destination = locationsList?.find(l => l.id === rfq.destinationLocationId);
      form.setValue("cargoDetails", `Transit from ${origin?.name || 'Origin'} to ${destination?.name || 'Destination'} (via ${rfq.transitRoute || 'direct'})`);

      if (rfq.cargoType) form.setValue("cargoType", rfq.cargoType);
      if (rfq.freightType) form.setValue("freightType", rfq.freightType);
      if (rfq.truckType) form.setValue("truckType", rfq.truckType);
      if (rfq.detentionChargesPerDay) form.setValue("detentionChargesPerDay", String(rfq.detentionChargesPerDay));

      if (rfq.origins && Array.isArray(rfq.origins) && rfq.origins.length > 0) {
        form.setValue("routeLegs", rfq.origins.map((o: any) => ({
          originCountry: o.originCountry || "",
          originCity: o.originCity || "",
          destinationCountry: o.destinationCountry || "",
          destinationCity: o.destinationCity || "",
          loadingDate: o.loadingDate || "",
          offloadingDate: o.offloadingDate || "",
          transitDays: o.transitDays || 0
        })));
      }

      const initialCharges = [];
      if (rfq.transportationCharges && parseFloat(String(rfq.transportationCharges)) > 0) {
        initialCharges.push({
          description: "Main Transportation Charge",
          qty: 1,
          unitRate: parseFloat(String(rfq.transportationCharges))
        });
      }
      if (rfq.extraCharges && Array.isArray(rfq.extraCharges) && rfq.extraCharges.length > 0) {
        initialCharges.push(...rfq.extraCharges.map((c: any) => ({
          description: c.name || "",
          qty: 1,
          unitRate: c.cost || 0
        })));
      }
      form.setValue("charges", initialCharges);
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
            truckOwnership: "rented",
            truckType: "",
            truckModel: "",
            truckPlateNumber: "",
            chassisNumber: "",
            cargoType: "",
            freightType: "",
            detentionChargesPerDay: "0",
            driverName: "",
            driverContact: "",
            routeLegs: [],
            charges: [],
            status: "pending",
            zoneId: "",
            operationalZone: "",
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
                            <div className="text-muted-foreground">Pickup: <span className="font-medium text-foreground">{
                              (Array.isArray(order.routeLegs) && order.routeLegs.length > 0)
                                ? `${(order.routeLegs[0] as any).originCity || ""}, ${(order.routeLegs[0] as any).originCountry || ""}`
                                : (pickup?.name || "N/A")
                            }</span></div>
                            <div className="text-muted-foreground">Deliver: <span className="font-medium text-foreground">{
                              (Array.isArray(order.routeLegs) && order.routeLegs.length > 0)
                                ? `${(order.routeLegs[order.routeLegs.length - 1] as any).destinationCity || ""}, ${(order.routeLegs[order.routeLegs.length - 1] as any).destinationCountry || ""}`
                                : (delivery?.name || "N/A")
                            }</span></div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => setViewOrder(order)}>
                              <Eye className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Update Status & Routes" onClick={() => {
                              setManageRoutesOrder(order);
                              setRouteLegsState((order.routeLegs as any[]) || []);
                              setOrderStatusState(order.status || "pending");
                            }}>
                              <MapPin className="h-4 w-4 text-emerald-500" />
                            </Button>
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
                                  truckOwnership: orderData.truckOwnership || "rented",
                                  truckType: orderData.truckType || "",
                                  truckModel: orderData.truckModel || "",
                                  truckPlateNumber: orderData.truckPlateNumber || "",
                                  chassisNumber: orderData.chassisNumber || "",
                                  cargoType: orderData.cargoType || "",
                                  freightType: orderData.freightType || "",
                                  detentionChargesPerDay: String(orderData.detentionChargesPerDay || "0"),
                                  driverName: orderData.driverName || "",
                                  driverContact: orderData.driverContact || "",
                                  routeLegs: Array.isArray(orderData.routeLegs) && orderData.routeLegs.length > 0 ? orderData.routeLegs : [],
                                  charges: chargesData.map((c: any) => ({
                                    ...c,
                                    qty: String(c.qty),
                                    unitRate: String(c.unitRate)
                                  })),
                                  status: orderData.status as any,
                                  zoneId: orderData.zoneId || "",
                                  operationalZone: orderData.operationalZone || "",
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
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
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
                          <SelectItem value="none">None - Manual Entry</SelectItem>
                          {rfqsList?.filter(r => r.status !== "rejected" && r.status !== "converted").map(r => (
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

                <div className="grid grid-cols-2 gap-4 col-span-2">
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
                    name="cargoType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Cargo</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Hazardous, Fragile" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="freightType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Freight Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Ocean, Air, Land" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <h3 className="font-semibold text-sm">Truck & Driver Info</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="truckOwnership"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Ownership</FormLabel>
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
                      name="truckType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type of Truck</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Flatbed, Reefer" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="truckModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Model</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="truckPlateNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="whitespace-nowrap truncate" title="Truck Plate Number">Truck Plate No.</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="chassisNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chassis Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional" {...field} />
                          </FormControl>
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

                <div className="grid grid-cols-2 gap-4 col-span-2">
                  <FormField
                    control={form.control}
                    name="operationalZone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operational Zone</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Zone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Inbound/Import">Inbound/Import</SelectItem>
                            <SelectItem value="Outbound">Outbound</SelectItem>
                            <SelectItem value="Local">Local</SelectItem>
                            <SelectItem value="External/Export">External/Export</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="detentionChargesPerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Detention Charges (per day)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0.000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Route Legs</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendRoute({ originCountry: "", originCity: "", destinationCountry: "", destinationCity: "", loadingDate: "", offloadingDate: "", transitDays: 0, status: "pending", podDocuments: [] })}>
                      <Plus className="h-4 w-4 mr-1" /> Add Route Leg
                    </Button>
                  </div>
                  {routeFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-1 gap-4 border p-3 rounded-md bg-muted/20 relative">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-2 top-2 h-6 w-6 text-red-500 hover:text-red-700" 
                        onClick={() => removeRoute(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pr-8">
                        <FormField control={form.control} name={`routeLegs.${index}.originCountry`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs whitespace-nowrap">Origin Country</FormLabel><FormControl><Input placeholder="Country" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.originCity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs whitespace-nowrap">Origin City</FormLabel><FormControl><Input placeholder="City" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.destinationCountry`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs whitespace-nowrap truncate" title="Destination Country">Dest. Country</FormLabel><FormControl><Input placeholder="Country" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.destinationCity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs whitespace-nowrap truncate" title="Destination City">Dest. City</FormLabel><FormControl><Input placeholder="City" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <FormField control={form.control} name={`routeLegs.${index}.loadingDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Loading Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.offloadingDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Offloading Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.transitDays`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Transit Days</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t mt-2">
                        <FormField control={form.control} name={`routeLegs.${index}.status`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || "pending"}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.deliveryDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Actual Delivery Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      <div className="pt-2 flex items-center gap-4">
                        <div className="flex-1">
                          <FormLabel className="text-xs block mb-2">Upload POD</FormLabel>
                          <Input type="file" multiple onChange={(e) => handlePodUpload(e, index)} className="text-xs" />
                        </div>
                        {form.watch(`routeLegs.${index}.podDocuments`)?.length > 0 && (
                          <div className="flex-1 space-y-1">
                            <span className="text-xs font-semibold text-slate-500">Uploaded PODs:</span>
                            {form.watch(`routeLegs.${index}.podDocuments`).map((doc: any, docIdx: number) => (
                              <div key={docIdx} className="text-xs flex items-center justify-between bg-slate-100 p-1 rounded">
                                <span className="truncate max-w-[150px]">{doc.name}</span>
                                <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0 text-red-500" onClick={() => {
                                  const pods = form.getValues(`routeLegs.${index}.podDocuments`);
                                  pods.splice(docIdx, 1);
                                  form.setValue(`routeLegs.${index}.podDocuments`, pods);
                                }}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="col-span-2 space-y-4 border p-4 rounded-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Charges & Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendCharge({ description: "", qty: 1, unitRate: 0 })}>
                      <Plus className="h-4 w-4 mr-1" /> Add Charge
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {chargeFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-2 items-end border-b pb-4 pt-2 relative">
                        <div className="col-span-2 md:col-span-5">
                          <FormField
                            control={form.control}
                            name={`charges.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Charge Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Toll">Toll</SelectItem>
                                    <SelectItem value="Port">Port</SelectItem>
                                    <SelectItem value="Border Crossing">Border Crossing</SelectItem>
                                    <SelectItem value="Customs Fee">Customs Fee</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-span-1 md:col-span-2">
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
                        <div className="col-span-1 md:col-span-2">
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
                        <div className="col-span-1 md:col-span-2">
                          <FormItem>
                            <FormLabel className="text-xs">Total</FormLabel>
                            <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30">
                              {(parseFloat((watchedCharges[index] as any)?.qty as string || "0") * parseFloat((watchedCharges[index] as any)?.unitRate as string || "0")).toFixed(3)}
                            </div>
                          </FormItem>
                        </div>
                        <div className="col-span-2 md:col-span-1 pb-1 text-right">
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

      {/* Order Document View Modal */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between border-b pb-4">
            <div>
              <DialogTitle className="text-2xl font-bold">Order Document</DialogTitle>
              <DialogDescription>Reference: {viewOrder?.orderNumber}</DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print Document
            </Button>
          </DialogHeader>
          {viewOrder && (
            <div className="p-6 space-y-8 print:p-0 print:m-0" id="print-area">
              {/* Header section */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">SHIPPING ORDER</h2>
                  <p className="text-sm text-slate-500 mt-1">Order No: <span className="font-semibold text-slate-700">{viewOrder.orderNumber}</span></p>
                  {viewOrder.rfqId && <p className="text-sm text-slate-500">Ref RFQ: <span className="font-semibold text-slate-700">{viewOrder.rfqId}</span></p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">Date: {viewOrder.orderDate ? format(new Date(viewOrder.orderDate), "PPP") : "N/A"}</p>
                  <p className="text-sm text-slate-500">Due Date: {viewOrder.paymentDueDate ? format(new Date(viewOrder.paymentDueDate), "PPP") : "N/A"}</p>
                  <StatusBadge status={viewOrder.status} />
                </div>
              </div>

              {/* Client & Cargo */}
              <div className="grid grid-cols-2 gap-8 border-t border-b py-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Customer Details</h3>
                  <div className="text-slate-800">
                    <p className="font-semibold text-lg">{clientsList?.find(c => c.id === viewOrder.customerId)?.name || "Unknown Customer"}</p>
                    <p className="text-sm text-slate-600">{clientsList?.find(c => c.id === viewOrder.customerId)?.companyName}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Cargo Information</h3>
                  <div className="space-y-1 text-sm text-slate-800">
                    <p><span className="text-slate-500">Details:</span> {viewOrder.cargoDetails}</p>
                    <p><span className="text-slate-500">Weight:</span> {viewOrder.weight ? `${parseFloat(String(viewOrder.weight)).toFixed(3)} tons` : "N/A"}</p>
                    <p><span className="text-slate-500">Type/Freight:</span> {viewOrder.cargoType || "N/A"} / {viewOrder.freightType || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Truck Details */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Vehicle & Driver</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Ownership</p>
                    <p className="font-medium">{viewOrder.truckOwnership || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Truck Details</p>
                    <p className="font-medium">{viewOrder.truckType || "N/A"} {viewOrder.truckModel ? `(${viewOrder.truckModel})` : ""}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Plate / Chassis</p>
                    <p className="font-medium">{viewOrder.truckPlateNumber || "N/A"} / {viewOrder.chassisNumber || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Driver Info</p>
                    <p className="font-medium">{viewOrder.driverName || "N/A"} {viewOrder.driverContact ? `(${viewOrder.driverContact})` : ""}</p>
                  </div>
                </div>
              </div>

              {/* Route Legs */}
              {viewOrder.routeLegs && Array.isArray(viewOrder.routeLegs) && viewOrder.routeLegs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Route Legs</h3>
                  <Table className="border">
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead>Origin</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Loading Date</TableHead>
                        <TableHead>Offloading Date</TableHead>
                        <TableHead className="text-right">Transit Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewOrder.routeLegs.map((leg: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{leg.originCity}, {leg.originCountry}</TableCell>
                          <TableCell>{leg.destinationCity}, {leg.destinationCountry}</TableCell>
                          <TableCell>{leg.loadingDate ? format(new Date(leg.loadingDate), "MMM dd, yyyy") : "N/A"}</TableCell>
                          <TableCell>{leg.offloadingDate ? format(new Date(leg.offloadingDate), "MMM dd, yyyy") : "N/A"}</TableCell>
                          <TableCell className="text-right">{leg.transitDays || 0} days</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Charges */}
              {viewOrder.charges && Array.isArray(viewOrder.charges) && viewOrder.charges.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Charges & Items</h3>
                  <Table className="border">
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Rate</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewOrder.charges.map((charge: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{charge.description || charge.name}</TableCell>
                          <TableCell className="text-right">{charge.qty}</TableCell>
                          <TableCell className="text-right">{parseFloat(charge.unitRate || "0").toFixed(3)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {(parseFloat(charge.qty || "0") * parseFloat(charge.unitRate || "0")).toFixed(3)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-end pt-4 border-t">
                <div className="w-64">
                  {viewOrder.detentionChargesPerDay && parseFloat(String(viewOrder.detentionChargesPerDay)) > 0 && (
                    <div className="flex justify-between text-sm text-slate-500 mb-2">
                      <span>Detention (Per Day):</span>
                      <span>{parseFloat(String(viewOrder.detentionChargesPerDay)).toFixed(3)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Grand Total:</span>
                    <span>
                      {viewOrder.grandTotal ? parseFloat(String(viewOrder.grandTotal)).toFixed(3) : "0.000"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Finalize Expenses Modal */}
      <Dialog open={isFinalizeExpensesOpen} onOpenChange={setIsFinalizeExpensesOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Finalize Order Expenses</DialogTitle>
            <DialogDescription>Enter actual incurred expenses (Driver fee, Truck rent, Tolls) before marking the order as completed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {finalizeExpenses.map((expense, idx) => (
              <div key={idx} className="flex items-end gap-2 border-b pb-2">
                <div className="flex-1">
                  <Label className="text-xs">Description</Label>
                  <Input 
                    value={expense.description} 
                    onChange={e => {
                      const newExp = [...finalizeExpenses];
                      newExp[idx].description = e.target.value;
                      setFinalizeExpenses(newExp);
                    }} 
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qty</Label>
                  <Input 
                    type="number" 
                    value={expense.qty} 
                    onChange={e => {
                      const newExp = [...finalizeExpenses];
                      newExp[idx].qty = parseFloat(e.target.value) || 0;
                      setFinalizeExpenses(newExp);
                    }} 
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Unit Rate</Label>
                  <Input 
                    type="number" 
                    step="0.001"
                    value={expense.unitRate} 
                    onChange={e => {
                      const newExp = [...finalizeExpenses];
                      newExp[idx].unitRate = parseFloat(e.target.value) || 0;
                      setFinalizeExpenses(newExp);
                    }} 
                  />
                </div>
                <div className="w-24 text-right">
                  <Label className="text-xs">Total</Label>
                  <div className="h-10 flex items-center justify-end font-semibold">
                    {(expense.qty * expense.unitRate).toFixed(3)}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mb-1 text-red-500"
                  onClick={() => setFinalizeExpenses(prev => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => setFinalizeExpenses(prev => [...prev, { description: "Other Toll/Charge", qty: 1, unitRate: 0 }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Expense
            </Button>
            
            <div className="flex justify-between items-center pt-4 border-t mt-4 font-bold text-lg">
              <span>Total Expenses (Actual Cost):</span>
              <span>
                {finalizeExpenses.reduce((sum, curr) => sum + (curr.qty * curr.unitRate), 0).toFixed(3)} BD
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFinalizeExpensesOpen(false)}>Cancel</Button>
            <Button onClick={submitFinalizeExpenses} disabled={createOrderMutation.isPending}>
              {createOrderMutation.isPending ? "Saving..." : "Finalize & Complete Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Status & Routes Dialog */}
      <Dialog open={!!manageRoutesOrder} onOpenChange={(open) => !open && setManageRoutesOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Status & Routes</DialogTitle>
            <DialogDescription>
              Update the overall order status and manage individual route legs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2 border-b pb-4">
              <Label className="text-base font-semibold">Overall Order Status</Label>
              <Select value={orderStatusState} onValueChange={setOrderStatusState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="incomplete">Incomplete / Partial</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Route Legs</Label>
              {routeLegsState.length === 0 ? (
                <div className="text-sm text-muted-foreground">No route legs defined.</div>
              ) : (
                routeLegsState.map((leg, index) => (
                  <div key={index} className="border rounded-md p-4 space-y-4 bg-slate-50/50">
                    <div className="font-semibold text-sm">
                      {leg.originCity || "Origin"} ({leg.originCountry}) → {leg.destinationCity || "Destination"} ({leg.destinationCountry})
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Leg Status</Label>
                        <Select value={leg.status || "pending"} onValueChange={(val) => {
                          const updated = [...routeLegsState];
                          updated[index] = { ...updated[index], status: val };
                          setRouteLegsState(updated);
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Actual Delivery Date</Label>
                        <Input 
                          type="date" 
                          value={leg.deliveryDate ? leg.deliveryDate.split('T')[0] : ""} 
                          onChange={(e) => {
                            const updated = [...routeLegsState];
                            updated[index] = { ...updated[index], deliveryDate: e.target.value };
                            setRouteLegsState(updated);
                          }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Upload POD</Label>
                      <div className="flex flex-col gap-2">
                        <Input type="file" multiple onChange={(e) => handleQuickPodUpload(e, index)} className="text-xs" />
                        {leg.podDocuments && leg.podDocuments.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Attached PODs:</span>
                            {leg.podDocuments.map((doc: any, docIdx: number) => (
                              <div key={docIdx} className="text-xs flex items-center justify-between bg-white border p-1 rounded">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="truncate max-w-[200px] text-blue-600 hover:underline">{doc.name}</a>
                                <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0 text-red-500" onClick={() => {
                                  const updated = [...routeLegsState];
                                  updated[index].podDocuments.splice(docIdx, 1);
                                  setRouteLegsState(updated);
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageRoutesOrder(null)}>Cancel</Button>
            <Button onClick={handleQuickUpdateSave} disabled={createOrderMutation.isPending}>
              {createOrderMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatCurrency(val: any) {
  const num = parseFloat(String(val)) || 0;
  return `${num.toFixed(3)} BD`;
}
