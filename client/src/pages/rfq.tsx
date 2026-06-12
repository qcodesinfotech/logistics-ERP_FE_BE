import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Calculator, MapPin, RefreshCw, Trash2, ArrowRight, Eye, Printer } from "lucide-react";
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
import { useForm, useFieldArray } from "react-hook-form";
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
import type { Rfq, Location, Client } from "@shared/schema";

// Form Schema
const rfqFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  transitRoute: z.string().min(1, "Transit route summary is required"),
  transportationCharges: z.string().transform((v) => parseFloat(v) || 0),
  outsourcedTruckCost: z.string().transform((v) => parseFloat(v) || 0),
  status: z.enum(["pending", "approved", "rejected", "converted"]),
  cargoType: z.string().optional(),
  truckType: z.string().optional(),
  freightType: z.string().optional(),
  routeLegs: z.array(z.object({
    originCountry: z.string().min(1, "Country required"),
    originCity: z.string().min(1, "City required"),
    destinationCountry: z.string().min(1, "Country required"),
    destinationCity: z.string().min(1, "City required"),
    loadingDate: z.string().optional(),
    offloadingDate: z.string().optional(),
    transitDays: z.number().optional()
  })).default([]),
  detentionChargesPerDay: z.string().transform((v) => parseFloat(v) || 0).optional(),
  extraCharges: z.array(z.object({
    name: z.string().min(1, "Name required"),
    qty: z.number().min(0).default(1),
    unitRate: z.number().min(0).default(0),
    cost: z.number().min(0)
  })).default([])
});

type RfqFormData = z.input<typeof rfqFormSchema>;

const locationSchema = z.object({
  code: z.string().min(1, "Location code is required"),
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  latitude: z.string().optional().transform(v => v ? parseFloat(v) : null),
  longitude: z.string().optional().transform(v => v ? parseFloat(v) : null),
});

export default function RfqPage() {
  const [isRfqDialogOpen, setIsRfqDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);

  const { toast } = useToast();

  // Queries
  const { data: rfqsList, isLoading: isRfqsLoading } = useQuery<Rfq[]>({
    queryKey: ["/api/rfqs"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: locationsList } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  // Forms
  const form = useForm<RfqFormData>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      customerId: "",
      transitRoute: "",
      transportationCharges: "0",
      outsourcedTruckCost: "0",
      status: "pending",
      cargoType: "",
      truckType: "",
      freightType: "",
      routeLegs: [],
      detentionChargesPerDay: "0",
      extraCharges: [],
    },
  });

  const { fields: routeFields, append: appendRoute, remove: removeRoute } = useFieldArray({
    control: form.control,
    name: "routeLegs",
  });

  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control: form.control,
    name: "extraCharges",
  });

  const locationForm = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: "",
      name: "",
      address: "",
      latitude: "",
      longitude: "",
    },
  });

  // Watch fields for live calculations
  const watchedTransportation = form.watch("transportationCharges");
  const watchedOutsourced = form.watch("outsourcedTruckCost");
  const watchedExtraCharges = form.watch("extraCharges");

  const calcTotal = () => {
    const t = parseFloat(String(watchedTransportation)) || 0;
    const extra = watchedExtraCharges?.reduce((sum, item) => sum + (Number(item.cost) || 0), 0) || 0;
    return t + extra;
  };

  const calcMargin = () => {
    const total = calcTotal();
    const out = parseFloat(String(watchedOutsourced)) || 0;
    return total - out;
  };

  // Mutations
  const createRfqMutation = useMutation({
    mutationFn: (data: any) => {
      const extraTotal = data.extraCharges?.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0) || 0;
      const total = parseFloat(data.transportationCharges) + extraTotal;
      const payload = {
        ...data,
        origins: data.routeLegs,
        rfqNumber: `RFQ-${Date.now()}`,
        totalCharges: total.toFixed(3),
        transportationCharges: parseFloat(data.transportationCharges).toFixed(3),
        outsourcedTruckCost: parseFloat(data.outsourcedTruckCost).toFixed(3),
        detentionChargesPerDay: parseFloat(data.detentionChargesPerDay || 0).toFixed(3),
      };
      return apiRequest(selectedRfq ? "PUT" : "POST", selectedRfq ? `/api/rfqs/${selectedRfq.id}` : "/api/rfqs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      toast({ title: selectedRfq ? "RFQ updated successfully" : "RFQ created successfully" });
      setIsRfqDialogOpen(false);
      setSelectedRfq(null);
      form.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteRfqMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/rfqs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      toast({ title: "RFQ deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/rfqs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      toast({ title: "Status updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location created successfully" });
      setIsLocationDialogOpen(false);
      locationForm.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const convertToOrderMutation = useMutation({
    mutationFn: (rfq: Rfq) => {
      // Find origin and destination location details to populate cargo route
      const origin = locationsList?.find(l => l.id === rfq.originLocationId);
      const destination = locationsList?.find(l => l.id === rfq.destinationLocationId);
      
      const payload = {
        orderNumber: `ORD-${Date.now()}`,
        customerId: rfq.customerId,
        rfqId: rfq.id,
        cargoDetails: `Cargo transit from ${origin?.name || 'Origin'} to ${destination?.name || 'Destination'} (via ${rfq.transitRoute || 'direct'})`,
        weight: "0.000",
        loadType: "FTL",
        documents: [],
        pickupLocationId: rfq.originLocationId,
        deliveryLocationId: rfq.destinationLocationId,
        status: "pending",
        zoneId: null,
      };
      return apiRequest("POST", "/api/orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "RFQ converted to Order successfully! Go to Order Book to dispatch." });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const formatCurrency = (val: any) => {
    const num = parseFloat(String(val)) || 0;
    return `${num.toFixed(3)} BD`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="RFQ System" 
        description="Calculate pre-order transit margins, clearance charges, toll fees, and request client quotes."
      >
        <Button onClick={() => setIsLocationDialogOpen(true)} variant="outline" className="gap-2">
          <MapPin className="h-4 w-4" /> Quick Add Location
        </Button>
        <Button onClick={() => {
          setSelectedRfq(null);
          form.reset({
            customerId: "",
            transitRoute: "",
            transportationCharges: "0",
            outsourcedTruckCost: "0",
            status: "pending",
            cargoType: "",
            truckType: "",
            freightType: "",
            routeLegs: [],
            detentionChargesPerDay: "0",
            extraCharges: [],
          });
          setIsViewOnly(false);
          setIsRfqDialogOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" /> Create RFQ
        </Button>
      </PageHeader>

      <div>
        <div className="space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" /> Active Rate Quotations
                </CardTitle>
                <CardDescription>
                  Transit costing worksheets for active sales/bidding pipelines.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isRfqsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading RFQs...</div>
              ) : !rfqsList || rfqsList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                  <span>No RFQs created yet. Create one to begin rate worksheets.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFQ Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Charges Summary</TableHead>
                      <TableHead>Profit Margin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfqsList.map((rfq) => {
                      const client = clientsList?.find(c => c.id === rfq.customerId);
                      const trans = parseFloat(String(rfq.transportationCharges)) || 0;
                      const extraTotal = (rfq.extraCharges as any[])?.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0) || 0;
                      const out = parseFloat(String(rfq.outsourcedTruckCost)) || 0;
                      const total = parseFloat(String(rfq.totalCharges)) || 0;
                      const margin = total - out;

                      return (
                        <TableRow key={rfq.id} className="hover:bg-accent/40 transition-colors">
                          <TableCell className="font-semibold text-foreground">{rfq.rfqNumber}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{client?.name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{client?.companyName}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1 font-medium">
                              <span className="text-blue-600 dark:text-blue-400">
                                {rfq.origins && (rfq.origins as any[]).length > 0 ? `${(rfq.origins as any[])[0].originCity}, ${(rfq.origins as any[])[0].originCountry}` + ((rfq.origins as any[]).length > 1 ? ` (+${(rfq.origins as any[]).length - 1})` : '') : "Start"}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {rfq.origins && (rfq.origins as any[]).length > 0 ? `${(rfq.origins as any[])[0].destinationCity}, ${(rfq.origins as any[])[0].destinationCountry}` + ((rfq.origins as any[]).length > 1 ? ` (+${(rfq.origins as any[]).length - 1})` : '') : "End"}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={rfq.transitRoute || ""}>
                              Route: {rfq.transitRoute || "Direct"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs space-y-0.5">
                            <div>Base: <span className="font-semibold">{formatCurrency(trans)}</span></div>
                            <div>Extra Charges: <span className="text-muted-foreground">{formatCurrency(extraTotal)}</span></div>
                            <div className="font-bold border-t pt-0.5">Total: {formatCurrency(total)}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>Outsourced Cost: <span className="text-red-500 font-semibold">{formatCurrency(out)}</span></div>
                            <div className={`font-bold mt-0.5 ${margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600"}`}>
                              Margin: {formatCurrency(margin)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select 
                              defaultValue={rfq.status} 
                              onValueChange={(val) => updateStatusMutation.mutate({ id: rfq.id, status: val })}
                            >
                              <SelectTrigger className={`h-8 w-[130px] text-xs ${rfq.status === 'approved' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : rfq.status === 'rejected' ? 'text-red-600 bg-red-50 border-red-200' : rfq.status === 'converted' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending Review</SelectItem>
                                <SelectItem value="approved">Approved / Won</SelectItem>
                                <SelectItem value="rejected">Rejected / Lost</SelectItem>
                                <SelectItem value="converted">Converted to Order</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {rfq.status === "approved" && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                onClick={() => convertToOrderMutation.mutate(rfq)}
                              >
                                Convert to Order
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" title="View Details" onClick={() => {
                              setSelectedRfq(rfq);
                              form.reset({
                                customerId: rfq.customerId,
                                transitRoute: rfq.transitRoute || "",
                                transportationCharges: String(rfq.transportationCharges),
                                outsourcedTruckCost: String(rfq.outsourcedTruckCost),
                                status: rfq.status as any,
                                cargoType: rfq.cargoType || "",
                                truckType: rfq.truckType || "",
                                freightType: rfq.freightType || "",
                                routeLegs: (rfq.origins as any[]) || [],
                                detentionChargesPerDay: String(rfq.detentionChargesPerDay || "0"),
                                extraCharges: (rfq.extraCharges as any[]) || [],
                              });
                              setIsViewOnly(true);
                              setIsRfqDialogOpen(true);
                            }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSelectedRfq(rfq);
                              form.reset({
                                customerId: rfq.customerId,
                                transitRoute: rfq.transitRoute || "",
                                transportationCharges: String(rfq.transportationCharges),
                                outsourcedTruckCost: String(rfq.outsourcedTruckCost),
                                status: rfq.status as any,
                                cargoType: rfq.cargoType || "",
                                truckType: rfq.truckType || "",
                                freightType: rfq.freightType || "",
                                routeLegs: (rfq.origins as any[]) || [],
                                detentionChargesPerDay: String(rfq.detentionChargesPerDay || "0"),
                                extraCharges: (rfq.extraCharges as any[]) || [],
                              });
                              setIsViewOnly(false);
                              setIsRfqDialogOpen(true);
                            }}>
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-600"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this RFQ?")) {
                                  deleteRfqMutation.mutate(rfq.id);
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

      {/* RFQ Creation / Modification Dialog */}
      <Dialog open={isRfqDialogOpen} onOpenChange={setIsRfqDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle>{isViewOnly ? "View Quotation Document" : selectedRfq ? "Modify RFQ Worksheet" : "Calculate Logistics RFQ"}</DialogTitle>
            <DialogDescription>
              Build a comprehensive freight costing worksheet for transit routes.
            </DialogDescription>
          </DialogHeader>
          {!isViewOnly ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createRfqMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Client / Customer *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
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
                  name="transitRoute"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Transit Route / Border Crossings *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Muscat - Haima - Salalah Highway Route" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transportationCharges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transportation Charges (BD) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="outsourcedTruckCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outsourced Cost (BD) (Optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Quotation Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending Review</SelectItem>
                          <SelectItem value="approved">Approved / Bidding Won</SelectItem>
                          <SelectItem value="rejected">Rejected / Lost</SelectItem>
                          <SelectItem value="converted">Converted to Order</SelectItem>
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
                      <FormLabel>Cargo Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. General, Hazardous" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="truckType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Flatbed, Reefer" {...field} />
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
                        <Input placeholder="e.g. FTL, LTL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="detentionChargesPerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detention Charges / Day (BD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dynamic Lists */}
              <div className="space-y-4 pt-4 border-t">
                {/* Route Legs */}
                <div className="p-4 border rounded-md bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <FormLabel className="text-base font-semibold">Origin & Destination Routes</FormLabel>
                      <p className="text-xs text-muted-foreground">Add multiple transit legs with loading and offloading dates.</p>
                    </div>
                    {!isViewOnly && (
                      <Button type="button" variant="outline" size="sm" onClick={() => appendRoute({ originCountry: "", originCity: "", destinationCountry: "", destinationCity: "", loadingDate: "", offloadingDate: "", transitDays: 0 })}>
                        <Plus className="h-3 w-3 mr-1" /> Add Route Leg
                      </Button>
                    )}
                  </div>
                  {routeFields.map((field, index) => (
                    <div key={field.id} className="mb-4 p-4 border rounded-md relative bg-background/50">
                      <Button type="button" variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-100 text-red-500 hover:bg-red-200 border shadow-sm z-10" onClick={() => removeRoute(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <FormField control={form.control} name={`routeLegs.${index}.originCountry`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Origin Country</FormLabel><FormControl><Input placeholder="Country" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.originCity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Origin City</FormLabel><FormControl><Input placeholder="City" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.destinationCountry`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Dest. Country</FormLabel><FormControl><Input placeholder="Country" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.destinationCity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Dest. City</FormLabel><FormControl><Input placeholder="City" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
                        <FormField control={form.control} name={`routeLegs.${index}.loadingDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Loading</FormLabel><FormControl><Input type="date" className="h-8 text-xs" {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const offload = form.getValues(`routeLegs.${index}.offloadingDate`);
                              if (e.target.value && offload) {
                                const days = Math.ceil((new Date(offload).getTime() - new Date(e.target.value).getTime()) / (1000 * 3600 * 24));
                                form.setValue(`routeLegs.${index}.transitDays`, days > 0 ? days : 0);
                              }
                            }}
                          /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.offloadingDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Offloading</FormLabel><FormControl><Input type="date" className="h-8 text-xs" {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const load = form.getValues(`routeLegs.${index}.loadingDate`);
                              if (e.target.value && load) {
                                const days = Math.ceil((new Date(e.target.value).getTime() - new Date(load).getTime()) / (1000 * 3600 * 24));
                                form.setValue(`routeLegs.${index}.transitDays`, days > 0 ? days : 0);
                              }
                            }}
                          /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.transitDays`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Transit Days</FormLabel><FormControl><Input type="number" className="h-8 text-xs" {...field} readOnly /></FormControl></FormItem>
                        )} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Extra Charges */}
                <div className="p-4 border rounded-md bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <FormLabel className="text-base font-semibold">Extra Charges</FormLabel>
                      <p className="text-xs text-muted-foreground">Add specific operational costs.</p>
                    </div>
                    {!isViewOnly && (
                      <Button type="button" variant="outline" size="sm" onClick={() => appendExtra({ name: "Toll", qty: 1, unitRate: 0, cost: 0 })}>
                        <Plus className="h-3 w-3 mr-1" /> Add Charge
                      </Button>
                    )}
                  </div>
                  {extraFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-3 items-end mb-3 bg-background/50 p-2 rounded-md border">
                      <FormField control={form.control} name={`extraCharges.${index}.name`} render={({ field }) => (
                        <FormItem className="col-span-12 sm:col-span-4">
                          <FormLabel className="text-xs">Charge Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Toll">Toll</SelectItem>
                              <SelectItem value="Port">Port</SelectItem>
                              <SelectItem value="Border Crossing">Border Crossing</SelectItem>
                              <SelectItem value="Customs Fee">Customs Fee</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`extraCharges.${index}.qty`} render={({ field }) => (
                        <FormItem className="col-span-4 sm:col-span-2">
                          <FormLabel className="text-xs">Qty</FormLabel>
                          <FormControl><Input type="number" step="0.01" className="h-8 text-xs" {...field} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            field.onChange(val);
                            const rate = form.getValues(`extraCharges.${index}.unitRate`) || 0;
                            form.setValue(`extraCharges.${index}.cost`, val * rate);
                          }} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`extraCharges.${index}.unitRate`} render={({ field }) => (
                        <FormItem className="col-span-4 sm:col-span-3">
                          <FormLabel className="text-xs">Unit Rate (BD)</FormLabel>
                          <FormControl><Input type="number" step="0.001" className="h-8 text-xs" {...field} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            field.onChange(val);
                            const qty = form.getValues(`extraCharges.${index}.qty`) || 0;
                            form.setValue(`extraCharges.${index}.cost`, val * qty);
                          }} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`extraCharges.${index}.cost`} render={({ field }) => (
                        <FormItem className="col-span-3 sm:col-span-2">
                          <FormLabel className="text-xs">Total (BD)</FormLabel>
                          <FormControl><Input type="number" step="0.001" className="h-8 text-xs bg-slate-50 font-semibold" readOnly {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <div className="col-span-1 sm:col-span-1 flex justify-end pb-0.5">
                        <Button type="button" variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0 border bg-white hover:bg-red-50" onClick={() => removeExtra(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Worksheet Card */}
              <div className="border rounded-lg p-4 bg-muted/40 space-y-2 text-xs">
                <div className="font-semibold text-sm border-b pb-1.5 text-foreground flex justify-between">
                  <span>Financial Statement</span>
                  <span>Currency: BD</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Transportation</span>
                  <span>{formatCurrency(watchedTransportation)}</span>
                </div>

                {watchedExtraCharges && watchedExtraCharges.length > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Extra Charges ({watchedExtraCharges.length})</span>
                    <span>{formatCurrency(watchedExtraCharges.reduce((sum, item) => sum + (Number(item.cost) || 0), 0))}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-bold text-foreground">
                  <span>Customer Billing (Total)</span>
                  <span>{formatCurrency(calcTotal())}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Outsourced Logistics Cost</span>
                  <span>- {formatCurrency(watchedOutsourced)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-foreground text-sm">
                  <span>Estimated Net Profit</span>
                  <span className={calcMargin() >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>
                    {formatCurrency(calcMargin())}
                  </span>
                </div>
              </div>

              <DialogFooter className="pt-4 print:hidden">
                <Button type="button" variant="outline" onClick={() => setIsRfqDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRfqMutation.isPending}>
                  {createRfqMutation.isPending ? "Calculating..." : "Save RFQ Worksheet"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          ) : (
            <div className="space-y-6">
              {/* Professional RFQ View */}
              <div className="border p-6 sm:p-8 rounded-md bg-white text-black text-sm relative print:border-none print:p-0 print:w-full">
                <div className="text-center border-b-2 border-slate-200 pb-4 mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-800">Request For Quotation</h2>
                  <p className="text-slate-500 mt-1">Ref: {selectedRfq?.id ? `RFQ-${selectedRfq.id}` : 'DRAFT'} | Date: {new Date().toLocaleDateString()}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Customer Information</h3>
                    <p className="mb-1"><span className="font-semibold inline-block w-20">Client:</span> {clientsList?.find(c => c.id === form.getValues().customerId)?.name || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-20">Company:</span> {clientsList?.find(c => c.id === form.getValues().customerId)?.companyName || "N/A"}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Cargo Specifications</h3>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Cargo Type:</span> {form.getValues().cargoType || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Truck Type:</span> {form.getValues().truckType || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Freight Type:</span> {form.getValues().freightType || "N/A"}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Transit Route & Legs</h3>
                  <p className="mb-3"><span className="font-semibold">Main Route Summary:</span> {form.getValues().transitRoute}</p>
                  
                  {form.getValues().routeLegs && form.getValues().routeLegs.length > 0 && (
                    <table className="w-full border-collapse text-xs mt-2">
                      <thead>
                        <tr className="bg-slate-100 border-y-2 border-slate-200 text-left text-slate-700">
                          <th className="p-2 font-bold">Origin</th>
                          <th className="p-2 font-bold">Destination</th>
                          <th className="p-2 font-bold">Loading Date</th>
                          <th className="p-2 font-bold">Offloading Date</th>
                          <th className="p-2 font-bold text-center">Transit Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.getValues().routeLegs.map((leg: any, idx: number) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2">{leg.originCity}, {leg.originCountry}</td>
                            <td className="p-2">{leg.destinationCity}, {leg.destinationCountry}</td>
                            <td className="p-2">{leg.loadingDate ? new Date(leg.loadingDate).toLocaleDateString() : 'N/A'}</td>
                            <td className="p-2">{leg.offloadingDate ? new Date(leg.offloadingDate).toLocaleDateString() : 'N/A'}</td>
                            <td className="p-2 text-center">{leg.transitDays || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Quotation Breakdown (BD)</h3>
                  <table className="w-full border-collapse mt-2">
                    <tbody>
                      <tr className="border-b bg-slate-100 text-slate-700 text-xs uppercase tracking-wider">
                        <th className="p-2 text-left font-bold">Description</th>
                        <th className="p-2 text-right font-bold">Qty</th>
                        <th className="p-2 text-right font-bold">Unit Rate</th>
                        <th className="p-2 text-right font-bold">Total (BD)</th>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Base Transportation Cost</td>
                        <td className="p-3 text-right text-slate-500">-</td>
                        <td className="p-3 text-right text-slate-500">-</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(parseFloat(String(form.getValues().transportationCharges)) || 0)}</td>
                      </tr>
                      {form.getValues().extraCharges && form.getValues().extraCharges.map((charge: any, idx: number) => (
                        <tr key={idx} className="border-b text-slate-600 bg-slate-50/50">
                          <td className="p-3 pl-6">+ {charge.name}</td>
                          <td className="p-3 text-right text-sm">{charge.qty || 1}</td>
                          <td className="p-3 text-right text-sm">{formatCurrency(parseFloat(String(charge.unitRate)) || 0)}</td>
                          <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(parseFloat(String(charge.cost)) || 0)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold text-lg border-y-2 border-slate-200">
                        <td className="p-4 uppercase text-slate-800">Total Estimated Amount</td>
                        <td className="p-4 text-right text-emerald-700">{formatCurrency(calcTotal())}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  {form.getValues().detentionChargesPerDay && parseFloat(String(form.getValues().detentionChargesPerDay)) > 0 && (
                    <p className="text-xs text-red-600 mt-4 italic font-medium">* Note: Detention charges apply at {formatCurrency(parseFloat(String(form.getValues().detentionChargesPerDay)))} per day after allowed free time.</p>
                  )}
                </div>
              </div>
              <DialogFooter className="print:hidden border-t pt-4">
                <Button type="button" onClick={() => window.print()} className="mr-auto" variant="outline">
                  <Printer className="h-4 w-4 mr-2" /> Print Document
                </Button>
                <Button type="button" onClick={() => setIsRfqDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Quick Add Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Register Location</DialogTitle>
            <DialogDescription>
              Register terminal hubs, distribution points or custom client addresses.
            </DialogDescription>
          </DialogHeader>
          <Form {...locationForm}>
            <form onSubmit={locationForm.handleSubmit(d => createLocationMutation.mutate(d))} className="space-y-4">
              <FormField
                control={locationForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. MCT-WHSE-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={locationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Muscat Central Warehouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={locationForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Road 23, Al Ghubrah, Muscat, Oman" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={locationForm.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="23.5859" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={locationForm.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="58.4059" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLocationMutation.isPending}>
                  {createLocationMutation.isPending ? "Creating..." : "Save Location"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
