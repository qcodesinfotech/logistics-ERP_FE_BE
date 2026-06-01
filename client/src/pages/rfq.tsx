import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Calculator, MapPin, RefreshCw, Trash2, ArrowRight } from "lucide-react";
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
import type { Rfq, Location, Client } from "@shared/schema";

// Form Schema
const rfqFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  originLocationId: z.string().min(1, "Origin location is required"),
  destinationLocationId: z.string().min(1, "Destination location is required"),
  transitRoute: z.string().min(1, "Transit route summary is required"),
  transportationCharges: z.string().transform((v) => parseFloat(v) || 0),
  outsourcedTruckCost: z.string().transform((v) => parseFloat(v) || 0),
  tollTransitCharges: z.string().transform((v) => parseFloat(v) || 0),
  clearanceAgentCharges: z.string().transform((v) => parseFloat(v) || 0),
  status: z.enum(["pending", "approved", "rejected", "converted"]),
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
      originLocationId: "",
      destinationLocationId: "",
      transitRoute: "",
      transportationCharges: "0",
      outsourcedTruckCost: "0",
      tollTransitCharges: "0",
      clearanceAgentCharges: "0",
      status: "pending",
    },
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
  const watchedToll = form.watch("tollTransitCharges");
  const watchedClearance = form.watch("clearanceAgentCharges");
  const watchedOutsourced = form.watch("outsourcedTruckCost");

  const calcTotal = () => {
    const t = parseFloat(String(watchedTransportation)) || 0;
    const toll = parseFloat(String(watchedToll)) || 0;
    const cl = parseFloat(String(watchedClearance)) || 0;
    return t + toll + cl;
  };

  const calcMargin = () => {
    const total = calcTotal();
    const out = parseFloat(String(watchedOutsourced)) || 0;
    return total - out;
  };

  // Mutations
  const createRfqMutation = useMutation({
    mutationFn: (data: any) => {
      const total = parseFloat(data.transportationCharges) + 
                    parseFloat(data.tollTransitCharges) + 
                    parseFloat(data.clearanceAgentCharges);
      const payload = {
        ...data,
        rfqNumber: `RFQ-${Date.now()}`,
        totalCharges: total.toFixed(3),
        transportationCharges: parseFloat(data.transportationCharges).toFixed(3),
        outsourcedTruckCost: parseFloat(data.outsourcedTruckCost).toFixed(3),
        tollTransitCharges: parseFloat(data.tollTransitCharges).toFixed(3),
        clearanceAgentCharges: parseFloat(data.clearanceAgentCharges).toFixed(3),
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
            originLocationId: "",
            destinationLocationId: "",
            transitRoute: "",
            transportationCharges: "0",
            outsourcedTruckCost: "0",
            tollTransitCharges: "0",
            clearanceAgentCharges: "0",
            status: "pending",
          });
          setIsRfqDialogOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" /> Create RFQ
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
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
                      const origin = locationsList?.find(l => l.id === rfq.originLocationId);
                      const dest = locationsList?.find(l => l.id === rfq.destinationLocationId);
                      const trans = parseFloat(String(rfq.transportationCharges)) || 0;
                      const toll = parseFloat(String(rfq.tollTransitCharges)) || 0;
                      const cl = parseFloat(String(rfq.clearanceAgentCharges)) || 0;
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
                              <span className="text-blue-600 dark:text-blue-400">{origin?.name || "Start"}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-emerald-600 dark:text-emerald-400">{dest?.name || "End"}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={rfq.transitRoute || ""}>
                              Route: {rfq.transitRoute || "Direct"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs space-y-0.5">
                            <div>Base: <span className="font-semibold">{formatCurrency(trans)}</span></div>
                            <div>Clearance & Tolls: <span className="text-muted-foreground">{formatCurrency(cl + toll)}</span></div>
                            <div className="font-bold border-t pt-0.5">Total: {formatCurrency(total)}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>Outsourced Cost: <span className="text-red-500 font-semibold">{formatCurrency(out)}</span></div>
                            <div className={`font-bold mt-0.5 ${margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600"}`}>
                              Margin: {formatCurrency(margin)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={rfq.status} />
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
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSelectedRfq(rfq);
                              form.reset({
                                customerId: rfq.customerId,
                                originLocationId: rfq.originLocationId || "",
                                destinationLocationId: rfq.destinationLocationId || "",
                                transitRoute: rfq.transitRoute || "",
                                transportationCharges: String(rfq.transportationCharges),
                                outsourcedTruckCost: String(rfq.outsourcedTruckCost),
                                tollTransitCharges: String(rfq.tollTransitCharges),
                                clearanceAgentCharges: String(rfq.clearanceAgentCharges),
                                status: rfq.status as any,
                              });
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

        <div>
          <Card className="shadow-md bg-accent/10 border-accent/20 sticky top-6">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" /> Margin Guideline
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3">
              <p>
                In Logistics RFQs, billing is strictly computed using the Bahraini Dinar (**BD**).
              </p>
              <p className="font-semibold text-foreground">Formula:</p>
              <div className="bg-muted p-2 rounded-md font-mono text-[10px] text-foreground">
                Total Charges = Base Transport + Toll Charges + Clearance Fees
              </div>
              <div className="bg-muted p-2 rounded-md font-mono text-[10px] text-foreground mt-1">
                Net Profit Margin = Total Charges - Outsourced Vehicle Cost
              </div>
              <p>
                Approved RFQs can be converted directly into the Order Book with a single click. Ensure location coordinates are accurate for auto-zonal mappings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RFQ Creation / Modification Dialog */}
      <Dialog open={isRfqDialogOpen} onOpenChange={setIsRfqDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRfq ? "Modify RFQ Worksheet" : "Calculate Logistics RFQ"}</DialogTitle>
            <DialogDescription>
              Build a comprehensive freight costing worksheet for transit routes.
            </DialogDescription>
          </DialogHeader>
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
                  name="originLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origin Hub *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select origin" />
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
                  name="destinationLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Terminal *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination" />
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
                  name="tollTransitCharges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Toll & Port Charges (BD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clearanceAgentCharges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clearance/Customs Fees (BD)</FormLabel>
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
                <div className="flex justify-between text-muted-foreground">
                  <span>Clearance + Tolls</span>
                  <span>{formatCurrency(parseFloat(String(watchedClearance)) + parseFloat(String(watchedToll)))}</span>
                </div>
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

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsRfqDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRfqMutation.isPending}>
                  {createRfqMutation.isPending ? "Calculating..." : "Save RFQ Worksheet"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
