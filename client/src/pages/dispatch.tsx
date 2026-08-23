import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  BarChart3, Plus, Truck, User, ArrowRight, CheckCircle2, 
  AlertTriangle, Play, Check, Eye, FileUp, XCircle, Clock, RefreshCw, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import type { Trip, Order, Vehicle, Delivery, Client, Location } from "@shared/schema";

interface MinimalEmployee {
  id: string;
  name: string;
}

export default function DispatchPage() {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isPODDialogOpen, setIsPODDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedOutletIdForHistory, setSelectedOutletIdForHistory] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [tripRoute, setTripRoute] = useState("");
  const [selectedTrailerNumber, setSelectedTrailerNumber] = useState("");
  const [tripPrice, setTripPrice] = useState("0.000");

  const [truckSource, setTruckSource] = useState<"owned" | "rented">("owned");
  const [rentedTruckType, setRentedTruckType] = useState("");
  const [rentedTruckNumber, setRentedTruckNumber] = useState("");
  const [rentedCapacity, setRentedCapacity] = useState("");
  const [rentedTruckPrice, setRentedTruckPrice] = useState("0.000");

  // Depart / Pickup Loading States
  const [isDepartDialogOpen, setIsDepartDialogOpen] = useState(false);
  const [departTrip, setDepartTrip] = useState<Trip | null>(null);
  const [departPickupDate, setDepartPickupDate] = useState(new Date().toISOString().substring(0, 10));
  const [departPickupTime, setDepartPickupTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5));
  const [departLoadedQty, setDepartLoadedQty] = useState("0");
  const [departCargoCondition, setDepartCargoCondition] = useState("Good");
  const [departLoadingNotes, setDepartLoadingNotes] = useState("");

  // In Transit Log States
  const [isTransitDialogOpen, setIsTransitDialogOpen] = useState(false);
  const [transitTrip, setTransitTrip] = useState<Trip | null>(null);
  const [transitLocation, setTransitLocation] = useState("");
  const [transitGps, setTransitGps] = useState("");
  const [transitDelays, setTransitDelays] = useState<{reason: string; durationHours: string}[]>([{reason: "", durationHours: ""}]);
  const [transitIncidents, setTransitIncidents] = useState<{description: string; cost: string}[]>([{description: "", cost: ""}]);
  const [transitExpenses, setTransitExpenses] = useState<{name: string; cost: string}[]>([{name: "", cost: ""}]);
  const [selectedOrderIdForPOD, setSelectedOrderIdForPOD] = useState<string>("");
  const [podStatus, setPodStatus] = useState<string>("delivered");
  const [podUrl, setPodUrl] = useState<string>("");
  const [issueLog, setIssueLog] = useState<string>("");
  const [podDeliveryDate, setPodDeliveryDate] = useState(new Date().toISOString().substring(0, 10));
  const [podDeliveryTime, setPodDeliveryTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5));
  const [podReceivedQty, setPodReceivedQty] = useState("0");
  const [podShortageQty, setPodShortageQty] = useState("0");
  const [podDamagedQty, setPodDamagedQty] = useState("0");
  const [podDamageReason, setPodDamageReason] = useState("");
  const [podReceiverName, setPodReceiverName] = useState("");
  const [podReceiverContact, setPodReceiverContact] = useState("");

  // Driver Settlement States
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false);
  const [settlementTrip, setSettlementTrip] = useState<any | null>(null);
  const [settlementEntitlement, setSettlementEntitlement] = useState("0");
  const [settlementAdvance, setSettlementAdvance] = useState("0");
  const [settlementTolls, setSettlementTolls] = useState("0");
  const [settlementFuel, setSettlementFuel] = useState("0");
  const [settlementOther, setSettlementOther] = useState("0");
  const [settlementDeductions, setSettlementDeductions] = useState("0");
  const [settlementStatus, setSettlementStatus] = useState("pending");
  const [isUploading, setIsUploading] = useState(false);

  const { toast } = useToast();

  // Queries
  const { data: tripsList, isLoading: isTripsLoading } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  const { data: ordersList } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: vehiclesList } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: driversList } = useQuery<MinimalEmployee[]>({
    queryKey: ["/api/employees/minimal"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: outletsList } = useQuery<any[]>({
    queryKey: ["/api/outlets"],
  });

  const { data: locationsList } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: outletHistory, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/api/outlets/${selectedOutletIdForHistory}/attachments`],
    enabled: !!selectedOutletIdForHistory && isHistoryDialogOpen,
  });

  const activeTrips = tripsList?.filter(t => t.status === "pending" || t.status === "in_transit") || [];
  const activeAssignedOrderIds = activeTrips.flatMap((t: any) => [...(t.orderIds || []), t.orderId].filter(Boolean));
  const allAssignedOrderIds = tripsList?.flatMap((t: any) => [...(t.orderIds || []), t.orderId].filter(Boolean)) || [];

  // Filter orders that are not assigned to active trips
  // and have status as 'pending' or 'confirmed'
  const unassignedOrders = ordersList?.filter(o => {
    if (o.status === "pending" || o.status === "confirmed") {
      return !allAssignedOrderIds.includes(o.id);
    }
    if (o.status === "incomplete") {
      return !activeAssignedOrderIds.includes(o.id);
    }
    return false;
  }) || [];

  const activeVehicleIds = tripsList?.filter(t => t.status === "pending" || t.status === "in_transit").map(t => t.vehicleId) || [];
  const availableVehicles = vehiclesList?.filter(v => v.status === "available" && !activeVehicleIds.includes(v.id)) || [];

  // Mutations
  const createTripMutation = useMutation({
    mutationFn: async (data: {
      vehicleId: string;
      driverId: string;
      orderIds: string[];
      route: string;
      status: string;
      startTime: Date;
      trailerNumber?: string;
      sellingRate?: string;
      isRented?: boolean;
    }) => {
      let finalVehicleId = data.vehicleId;
      let additionalExpenses = [];
      let otherTripExpenses = "0.000";

      if (data.isRented) {
        const vehicleRes = await apiRequest("POST", "/api/vehicles", {
          name: rentedTruckType || "Rented Truck",
          plateNumber: rentedTruckNumber || "N/A",
          type: "outsourced",
          capacity: rentedCapacity || "0",
          status: "in_transit"
        });
        const newVehicle = await vehicleRes.json();
        finalVehicleId = newVehicle.id;

        if (rentedTruckPrice && parseFloat(rentedTruckPrice) > 0) {
          additionalExpenses.push({
            name: "Rented Truck Cost",
            cost: parseFloat(rentedTruckPrice)
          });
          otherTripExpenses = rentedTruckPrice;
        }
      }

      return apiRequest("POST", "/api/trips", {
        ...data,
        vehicleId: finalVehicleId,
        additionalExpenses,
        otherTripExpenses
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Trip launched successfully! Vehicles and Drivers dispatched." });
      setIsAssignDialogOpen(false);
      // Reset
      setSelectedOrderIds([]);
      setSelectedVehicleId("");
      setSelectedDriverId("");
      setTripRoute("");
      setSelectedTrailerNumber("");
      setTripPrice("0.000");
      setTruckSource("owned");
      setRentedTruckType("");
      setRentedTruckNumber("");
      setRentedCapacity("");
      setRentedTruckPrice("0.000");
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) => 
      apiRequest("PUT", `/api/trips/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Trip updated successfully" });
      setIsDepartDialogOpen(false);
      setIsTransitDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: (data: {
      tripId: string;
      orderId: string;
      status: string;
      podUrl: string;
      issueLog?: string;
      actualDeliveryDate?: string;
      actualDeliveryTime?: string;
      receivedQuantity?: number | string;
      shortageQuantity?: number | string;
      damagedQuantity?: number | string;
      damageReason?: string;
      receiverName?: string;
      receiverContact?: string;
    }) => {
      const { tripId, ...payload } = data;
      return apiRequest("POST", `/api/trips/${tripId}/update-delivery`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
      toast({ title: "Delivery POD recorded. Customer order statuses updated." });
      setIsPODDialogOpen(false);
      setSelectedOrderIdForPOD("");
      setPodUrl("");
      setIssueLog("");
      setPodDeliveryDate(new Date().toISOString().substring(0, 10));
      setPodDeliveryTime(new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5));
      setPodReceivedQty("0");
      setPodShortageQty("0");
      setPodDamagedQty("0");
      setPodDamageReason("");
      setPodReceiverName("");
      setPodReceiverContact("");
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const verifyPODMutation = useMutation({
    mutationFn: (tripId: string) => apiRequest("POST", `/api/trips/${tripId}/verify-pod`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "POD verified successfully! Status marked as Completed." });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const saveDriverSettlementMutation = useMutation({
    mutationFn: ({ tripId, data }: { tripId: string; data: any }) => 
      apiRequest("POST", `/api/trips/${tripId}/settlement`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({ title: "Driver settlement recorded and trip costing calculated successfully!" });
      setIsSettlementDialogOpen(false);
      setSettlementTrip(null);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: (tripId: string) => apiRequest("POST", `/api/invoices`, { tripId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice generated successfully! Go to Trucking Invoices to view/collect payment." });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("documents", file);

    try {
      const res = await apiRequest("POST", "/api/upload/contracts", formData);
      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        setPodUrl(data.documents[0].url);
        toast({ title: "POD uploaded successfully!" });
      }
    } catch (err: any) {
      console.error(err);
      toast({ 
        title: "Failed to upload POD document", 
        description: getErrorMessage(err) || "An unexpected error occurred",
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOrderToggle = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // Helper to fetch orders linked to a trip from the local ordersList
  const getTripOrders = (tripId: string) => {
    // If we want to check trip_orders, since we can't do nested loads easily on client,
    // let's check if the server is tracking deliveries for this trip
    // and match order ids. Wait, the server endpoints `/api/trips/:id/orders` returns orders.
    // However, we can also query it or fetch it. Let's make an inline expansion or list them.
    return ordersList?.filter(o => {
      // In this system, orders can be linked via tripOrders.
      // But we can also look at the active deliveries list or show which ones are active.
      return false; // we will load them dynamically if needed or show a fallback
    }) || [];
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Dispatch Console" 
        description="Monitor physical assets, assign available trucks/drivers, and log Proof-of-Delivery status."
      >
        <Button variant="outline" onClick={() => setIsHistoryDialogOpen(true)} className="gap-2 mr-2">
          <Eye className="h-4 w-4" /> Outlet History
        </Button>
        <Button 
          disabled={selectedOrderIds.length === 0} 
          onClick={() => {
            // Suggest a route based on selected orders
            const routes = selectedOrderIds.map(oid => {
              const ord = ordersList?.find(o => o.id === oid);
              if (ord) {
                const pick = ordersList?.find(o => o.pickupLocationId === ord.pickupLocationId);
                return `${ord.orderNumber}`;
              }
              return "";
            }).filter(Boolean);
            setTripRoute(routes.join(" + ") + " Consolidated Route");
            setIsAssignDialogOpen(true);
          }}
          className="gap-2"
        >
          <Play className="h-4 w-4" /> Create Trip ({selectedOrderIds.length} orders)
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Orders Queue Card */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Pending Cargo Queue
                </CardTitle>
                <CardDescription>
                  Select one or more orders to merge into a single dispatch trip.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {unassignedOrders.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <span>All orders are currently dispatched or completed!</span>
                </div>
              ) : (
                <div className="divide-y">
                  {unassignedOrders.map((order) => {
                    const client = clientsList?.find((c: Client) => c.id === order.customerId);
                    const pickup = locationsList?.find((l: Location) => l.id === order.pickupLocationId);
                    const delivery = locationsList?.find((l: Location) => l.id === order.deliveryLocationId);
                    const isSelected = selectedOrderIds.includes(order.id);

                    return (
                      <div 
                        key={order.id} 
                        onClick={() => handleOrderToggle(order.id)}
                        className={`p-4 cursor-pointer transition-all hover:bg-accent/40 flex items-start gap-3 ${
                          isSelected ? "bg-primary/5 border-l-4 border-primary" : ""
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => {}} // handled by div click
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-xs text-foreground">{order.orderNumber}</span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate font-medium">{client?.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{order.cargoDetails}</p>
                          <div className="flex items-center gap-1 text-[10px] pt-1 text-muted-foreground">
                            <span className="font-semibold text-blue-600">{pickup?.code}</span>
                            <ArrowRight className="h-2 w-2" />
                            <span className="font-semibold text-emerald-600">{delivery?.code}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trips Console Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Dispatched Trips Pipeline
              </CardTitle>
              <CardDescription>
                Overview of ongoing logistics runs, truck drivers, and real-time delivery logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isTripsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading trips...</div>
              ) : !tripsList || tripsList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Truck className="h-8 w-8 text-muted-foreground/50" />
                  <span>No active trips running. Dispatch a pending order.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trip Ref</TableHead>
                      <TableHead>Vehicle & Driver</TableHead>
                      <TableHead>Execution Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tripsList.map((trip) => {
                      const vehicle = vehiclesList?.find(v => v.id === trip.vehicleId);
                      const driver = driversList?.find(d => d.id === trip.driverId);

                      return (
                        <TableRow key={trip.id} className="hover:bg-accent/40 transition-colors">
                          <TableCell className="font-semibold text-foreground">
                            {trip.tripNumber}
                          </TableCell>
                          <TableCell className="text-xs space-y-0.5">
                            <div className="font-medium flex items-center gap-1 text-foreground">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              {vehicle?.name} ({vehicle?.plateNumber})
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {driver?.name || "Unassigned"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium text-foreground truncate max-w-[180px]" title={trip.route || ""}>
                              Route: {trip.route || "Direct"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Start: {trip.startTime ? new Date(trip.startTime).toLocaleString() : "Pending"}
                            </div>
                            {trip.endTime && (
                              <div className="text-[10px] text-muted-foreground">
                                End: {new Date(trip.endTime).toLocaleString()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={trip.status} />
                          </TableCell>
                           <TableCell className="text-right space-x-1">
                            {trip.status === "in_transit" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                onClick={async () => {
                                  try {
                                    const res = await apiRequest("GET", `/api/trips/${trip.id}/orders`);
                                    const orderData = await res.json();
                                    setSelectedTrip({ ...trip, orderIds: orderData.map((o: any) => o.id) } as any);
                                    if (orderData.length > 0) {
                                      setSelectedOrderIdForPOD(orderData[0].id);
                                    }
                                    setIsPODDialogOpen(true);
                                  } catch (err: any) {
                                    console.error(err);
                                    toast({
                                      title: "Error opening dialog",
                                      description: getErrorMessage(err) || "An unexpected error occurred",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                Record POD
                              </Button>
                            )}

                             {trip.status === "pending" && (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 className="h-8 text-xs border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                                 onClick={() => {
                                   setDepartTrip(trip);
                                   setDepartPickupDate(new Date().toISOString().substring(0, 10));
                                   setDepartPickupTime(new Date().toLocaleTimeString('en-US', { hour12: false }).substring(0, 5));
                                   setDepartLoadedQty("0");
                                   setDepartCargoCondition("Good");
                                   setDepartLoadingNotes("");
                                   setIsDepartDialogOpen(true);
                                 }}
                               >
                                 Depart
                               </Button>
                             )}

                             {trip.status === "in_transit" && (
                               <div className="inline-flex gap-1">
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   className="h-8 text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                                   onClick={() => {
                                     setTransitTrip(trip);
                                     setTransitLocation(trip.currentLocation || "");
                                     setTransitGps(trip.gpsLocation || "");
                                     setTransitDelays([{reason: "", durationHours: ""}]);
                                     setTransitIncidents([{description: "", cost: ""}]);
                                     setTransitExpenses([{name: "", cost: ""}]);
                                     setIsTransitDialogOpen(true);
                                   }}
                                 >
                                   Update Log
                                 </Button>
                                 <Button
                                   size="sm"
                                   variant="secondary"
                                   className="h-8 text-xs text-foreground"
                                   onClick={() => updateTripMutation.mutate({ id: trip.id, status: "completed", endTime: new Date() })}
                                 >
                                   Complete Trip
                                 </Button>
                               </div>
                             )}

                            {trip.podVerificationStatus === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => verifyPODMutation.mutate(trip.id)}
                              >
                                Verify POD
                              </Button>
                            )}

                            {trip.status === "completed" && trip.podVerificationStatus === "verified" && trip.driverSettlementStatus !== "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-amber-200 text-amber-600 hover:bg-amber-50"
                                onClick={() => {
                                  setSettlementTrip(trip);
                                  setSettlementEntitlement(trip.driverEntitlement || "0");
                                  setSettlementAdvance(trip.driverAdvance || "0");
                                  setSettlementTolls(trip.driverTolls || "0");
                                  setSettlementFuel(trip.driverFuel || "0");
                                  setSettlementOther(trip.driverOtherExpenses || "0");
                                  setSettlementDeductions(trip.driverDeductions || "0");
                                  setSettlementStatus(trip.driverSettlementStatus || "pending");
                                  setIsSettlementDialogOpen(true);
                                }}
                              >
                                Settle Driver
                              </Button>
                            )}

                            {trip.status === "completed" && trip.podVerificationStatus === "verified" && !trip.invoiceGenerated && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                onClick={() => generateInvoiceMutation.mutate(trip.id)}
                              >
                                Generate Invoice
                              </Button>
                            )}
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

      {/* Assign Trip Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Launch Dispatch Run</DialogTitle>
            <DialogDescription>
              Assign a truck and driver to execute transit routes for the {selectedOrderIds.length} selected orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Truck Source *</label>
              <Select onValueChange={(val: any) => setTruckSource(val)} value={truckSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select truck source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owned">Owned / Internal</SelectItem>
                  <SelectItem value="rented">Rented / Outsourced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {truckSource === 'owned' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Vehicle / Truck *</label>
                <Select onValueChange={setSelectedVehicleId} value={selectedVehicleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNumber}) - Cap: {v.capacity || "N/A"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Truck Type *</label>
                  <Input 
                    value={rentedTruckType} 
                    onChange={(e) => setRentedTruckType(e.target.value)} 
                    placeholder="e.g. Flatbed, Reefer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plate Number *</label>
                  <Input 
                    value={rentedTruckNumber} 
                    onChange={(e) => setRentedTruckNumber(e.target.value)} 
                    placeholder="e.g. 12345"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Capacity (Tons) *</label>
                  <Input 
                    type="number"
                    value={rentedCapacity} 
                    onChange={(e) => setRentedCapacity(e.target.value)} 
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Truck Price (BD) *</label>
                  <Input 
                    type="number"
                    step="0.001"
                    value={rentedTruckPrice} 
                    onChange={(e) => setRentedTruckPrice(e.target.value)} 
                    placeholder="0.000"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Authorized Driver *</label>
              <Select onValueChange={setSelectedDriverId} value={selectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select active driver" />
                </SelectTrigger>
                <SelectContent>
                  {driversList?.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Consolidated Route Summary *</label>
              <Input 
                value={tripRoute} 
                onChange={(e) => setTripRoute(e.target.value)} 
                placeholder="Transit nodes summary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Trailer Number</label>
                <Input 
                  value={selectedTrailerNumber} 
                  onChange={(e) => setSelectedTrailerNumber(e.target.value)} 
                  placeholder="e.g. TR-890"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Trip Price / Revenue (BD)</label>
                <Input 
                  type="number"
                  step="0.001"
                  value={tripPrice} 
                  onChange={(e) => setTripPrice(e.target.value)} 
                  placeholder="0.000"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => createTripMutation.mutate({
                vehicleId: truckSource === 'owned' ? selectedVehicleId : "temp-rented",
                driverId: selectedDriverId,
                orderIds: selectedOrderIds,
                route: tripRoute,
                status: "pending",
                startTime: new Date(),
                trailerNumber: selectedTrailerNumber || undefined,
                sellingRate: tripPrice,
                isRented: truckSource === 'rented',
              })}
              disabled={
                truckSource === 'owned'
                  ? (!selectedVehicleId || !selectedDriverId || !tripRoute || createTripMutation.isPending)
                  : (!rentedTruckType || !rentedTruckNumber || !rentedCapacity || !selectedDriverId || !tripRoute || createTripMutation.isPending)
              }
            >
              {createTripMutation.isPending ? "Launching..." : "Launch Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPODDialogOpen} onOpenChange={setIsPODDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Order Proof-of-Delivery (POD)</DialogTitle>
            <DialogDescription>
              Validate POD parameters and log any exceptions (e.g. damages or partial volumes).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Order *</label>
              <Select onValueChange={setSelectedOrderIdForPOD} value={selectedOrderIdForPOD}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose order inside trip" />
                </SelectTrigger>
                <SelectContent>
                  {ordersList?.filter(o => (selectedTrip as any)?.orderIds?.includes(o.id)).map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.orderNumber} ({o.cargoDetails})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Delivery Status *</label>
              <Select onValueChange={setPodStatus} value={podStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivered">Fully Delivered</SelectItem>
                  <SelectItem value="partial">Partial Delivery (Incomplete)</SelectItem>
                  <SelectItem value="failed">Failed Delivery (Reject/Return)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Actual Delivery Date *</label>
                <Input 
                  type="date"
                  value={podDeliveryDate}
                  onChange={(e) => setPodDeliveryDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Actual Delivery Time *</label>
                <Input 
                  type="time"
                  value={podDeliveryTime}
                  onChange={(e) => setPodDeliveryTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">Received Qty</label>
                <Input 
                  type="number"
                  step="0.001"
                  value={podReceivedQty}
                  onChange={(e) => setPodReceivedQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Shortage Qty</label>
                <Input 
                  type="number"
                  step="0.001"
                  value={podShortageQty}
                  onChange={(e) => setPodShortageQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Damaged Qty</label>
                <Input 
                  type="number"
                  step="0.001"
                  value={podDamagedQty}
                  onChange={(e) => setPodDamagedQty(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Damage / Shortage Reason</label>
              <Input 
                value={podDamageReason}
                onChange={(e) => setPodDamageReason(e.target.value)}
                placeholder="e.g. Wet bags, torn packaging, rough driving"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Receiver Name</label>
                <Input 
                  value={podReceiverName}
                  onChange={(e) => setPodReceiverName(e.target.value)}
                  placeholder="e.g. Zakaria Ali"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Receiver Contact</label>
                <Input 
                  value={podReceiverContact}
                  onChange={(e) => setPodReceiverContact(e.target.value)}
                  placeholder="e.g. +973 33445566"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Proof-of-Delivery Attachment (Image/PDF)</label>
              <div className="flex gap-2">
                <Input 
                  type="file" 
                  className="cursor-pointer"
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                />
                {isUploading && <Button disabled variant="outline"><RefreshCw className="h-4 w-4 animate-spin" /></Button>}
              </div>
              {podUrl && (
                <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                  File uploaded: {podUrl.split("/").pop()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Issue Log / Exceptions Notes</label>
              <Textarea 
                value={issueLog} 
                onChange={(e) => setIssueLog(e.target.value)} 
                placeholder="Log damages, returned bags, or warehouse delays here..."
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsPODDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => updateDeliveryMutation.mutate({
                tripId: selectedTrip?.id || "",
                orderId: selectedOrderIdForPOD,
                status: podStatus,
                podUrl: podUrl,
                issueLog: issueLog,
                actualDeliveryDate: podDeliveryDate,
                actualDeliveryTime: podDeliveryTime,
                receivedQuantity: podReceivedQty,
                shortageQuantity: podShortageQty,
                damagedQuantity: podDamagedQty,
                damageReason: podDamageReason,
                receiverName: podReceiverName,
                receiverContact: podReceiverContact,
              })}
              disabled={!selectedOrderIdForPOD || !podStatus || updateDeliveryMutation.isPending}
            >
              {updateDeliveryMutation.isPending ? "Logging POD..." : "Save Delivery Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outlet History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Outlet Delivery History</DialogTitle>
            <DialogDescription>
              View chronological delivery records, photos, and partial delivery notes for an outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Outlet</label>
              <Select onValueChange={setSelectedOutletIdForHistory} value={selectedOutletIdForHistory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an outlet..." />
                </SelectTrigger>
                <SelectContent>
                  {outletsList?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedOutletIdForHistory && (
              <div className="mt-4 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order / Trip</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingHistory ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4">Loading...</TableCell></TableRow>
                    ) : !outletHistory || outletHistory.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4">No delivery attachments found.</TableCell></TableRow>
                    ) : (
                      outletHistory.map((h, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(h.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">{h.orderNumber}</div>
                            <div className="text-muted-foreground">{h.tripNumber}</div>
                          </TableCell>
                          <TableCell><StatusBadge status={h.status} /></TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={h.issueLog || ""}>{h.issueLog || "-"}</TableCell>
                          <TableCell>
                            {h.podUrl && (
                              <a href={h.podUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs flex items-center gap-1">
                                <FileUp className="h-3 w-3" /> View
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t mt-auto">
            <Button type="button" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Driver Settlement Dialog */}
      <Dialog open={isSettlementDialogOpen} onOpenChange={setIsSettlementDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Driver Settlement & Trip Costing</DialogTitle>
            <DialogDescription>
              Record payouts, advances, fuel/toll expenses, and calculate profitability margins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Driver Entitlement *</label>
                <Input 
                  type="number" 
                  value={settlementEntitlement} 
                  onChange={(e) => setSettlementEntitlement(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Driver Advance Paid</label>
                <Input 
                  type="number" 
                  value={settlementAdvance} 
                  onChange={(e) => setSettlementAdvance(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-[11px] font-medium">Fuel Expenses</label>
                <Input 
                  type="number" 
                  value={settlementFuel} 
                  onChange={(e) => setSettlementFuel(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium">Tolls / Border Fees</label>
                <Input 
                  type="number" 
                  value={settlementTolls} 
                  onChange={(e) => setSettlementTolls(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium">Other Expenses</label>
                <Input 
                  type="number" 
                  value={settlementOther} 
                  onChange={(e) => setSettlementOther(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Deductions / Fines</label>
                <Input 
                  type="number" 
                  value={settlementDeductions} 
                  onChange={(e) => setSettlementDeductions(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Settlement Status</label>
                <Select onValueChange={setSettlementStatus} value={settlementStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="paid">Settled / Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-md border text-xs space-y-1">
              <div className="flex justify-between">
                <span>Total Expenses:</span>
                <span className="font-semibold">{(parseFloat(settlementFuel || "0") + parseFloat(settlementTolls || "0") + parseFloat(settlementOther || "0")).toFixed(3)} BD</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-medium text-primary">
                <span>Net Balance Payable:</span>
                <span>{(parseFloat(settlementEntitlement || "0") + parseFloat(settlementFuel || "0") + parseFloat(settlementTolls || "0") + parseFloat(settlementOther || "0") - parseFloat(settlementAdvance || "0") - parseFloat(settlementDeductions || "0")).toFixed(3)} BD</span>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsSettlementDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                const totalExp = parseFloat(settlementFuel || "0") + parseFloat(settlementTolls || "0") + parseFloat(settlementOther || "0");
                const balance = parseFloat(settlementEntitlement || "0") + totalExp - parseFloat(settlementAdvance || "0") - parseFloat(settlementDeductions || "0");

                saveDriverSettlementMutation.mutate({
                  tripId: settlementTrip?.id || "",
                  data: {
                    driverEntitlement: settlementEntitlement,
                    driverAdvance: settlementAdvance,
                    driverFuel: settlementFuel,
                    driverTolls: settlementTolls,
                    driverOtherExpenses: settlementOther,
                    driverTotalExpenses: totalExp.toString(),
                    driverDeductions: settlementDeductions,
                    driverBalancePayable: balance.toString(),
                    driverSettlementStatus: settlementStatus,
                  }
                });
              }}
              disabled={saveDriverSettlementMutation.isPending}
            >
              {saveDriverSettlementMutation.isPending ? "Saving..." : "Save & Cost Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Depart / Loading Details Dialog */}
      <Dialog open={isDepartDialogOpen} onOpenChange={setIsDepartDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Depart Run & Loading Details</DialogTitle>
            <DialogDescription>
              Record cargo loading conditions, loaded quantities, and documents before dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Actual Pickup Date *</label>
                <Input 
                  type="date"
                  value={departPickupDate}
                  onChange={(e) => setDepartPickupDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Actual Pickup Time *</label>
                <Input 
                  type="time"
                  value={departPickupTime}
                  onChange={(e) => setDepartPickupTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Loaded Quantity</label>
                <Input 
                  type="number"
                  step="0.001"
                  value={departLoadedQty}
                  onChange={(e) => setDepartLoadedQty(e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cargo Condition</label>
                <Select value={departCargoCondition} onValueChange={setDepartCargoCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Good">Good / Intact</SelectItem>
                    <SelectItem value="Damaged">Damaged</SelectItem>
                    <SelectItem value="Wet">Wet / Leakage</SelectItem>
                    <SelectItem value="N/A">Not Inspected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Loading Notes</label>
              <Textarea 
                value={departLoadingNotes}
                onChange={(e) => setDepartLoadingNotes(e.target.value)}
                placeholder="Log any seals, temperature readings, or packaging observations..."
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsDepartDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                if (departTrip) {
                  updateTripMutation.mutate({
                    id: departTrip.id,
                    status: "in_transit",
                    actualPickupDate: departPickupDate,
                    actualPickupTime: departPickupTime,
                    loadedQuantity: departLoadedQty,
                    cargoCondition: departCargoCondition,
                    loadingNotes: departLoadingNotes,
                  });
                }
              }}
              disabled={updateTripMutation.isPending}
            >
              {updateTripMutation.isPending ? "Starting Run..." : "Confirm Departure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Transit Log Dialog */}
      <Dialog open={isTransitDialogOpen} onOpenChange={setIsTransitDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Transit Logs for {transitTrip?.tripNumber}</DialogTitle>
            <DialogDescription>
              Log current run details, delays, incidents, or expenses incurred during transit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* GPS & Location */}
            <div className="p-4 border rounded-md bg-muted/30 space-y-3">
              <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">Current Location & Tracking</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Current Location (City/Hub)</label>
                  <datalist id="route-leg-cities">
                    {Array.from(new Set(
                      (ordersList?.filter(o => transitTrip?.orderIds?.includes(o.id)) || [])
                        .flatMap(o => (o.routeLegs as any[] || []).flatMap(leg => [leg.originCity, leg.destinationCity]))
                    )).filter(Boolean).map(city => <option key={city} value={city} />)}
                  </datalist>
                  <Input 
                    list="route-leg-cities"
                    value={transitLocation}
                    onChange={(e) => setTransitLocation(e.target.value)}
                    placeholder="e.g. Haima City Hub"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">GPS Coordinates</label>
                  <Input 
                    value={transitGps}
                    onChange={(e) => setTransitGps(e.target.value)}
                    placeholder="e.g. 22.012, 56.124"
                  />
                </div>
              </div>
            </div>

            {/* Delay log */}
            <div className="p-4 border rounded-md bg-muted/30 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">Log Transit Delays (Optional)</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTransitDelays([...transitDelays, {reason: "", durationHours: ""}])}>
                  <Plus className="h-3 w-3 mr-1"/> Add Delay
                </Button>
              </div>
              {transitDelays.map((delay, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Delay Reason</label>
                    <Input 
                      value={delay.reason}
                      onChange={(e) => {
                        const newDelays = [...transitDelays];
                        newDelays[index].reason = e.target.value;
                        setTransitDelays(newDelays);
                      }}
                      placeholder="e.g. Border Custom Delay"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Duration (Hours)</label>
                    <Input 
                      type="number"
                      value={delay.durationHours}
                      onChange={(e) => {
                        const newDelays = [...transitDelays];
                        newDelays[index].durationHours = e.target.value;
                        setTransitDelays(newDelays);
                      }}
                      placeholder="0"
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 mb-[2px]" onClick={() => {
                    const newDelays = [...transitDelays];
                    newDelays.splice(index, 1);
                    setTransitDelays(newDelays);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Incident log */}
            <div className="p-4 border rounded-md bg-muted/30 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">Log Transit Incidents (Optional)</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTransitIncidents([...transitIncidents, {description: "", cost: ""}])}>
                  <Plus className="h-3 w-3 mr-1"/> Add Incident
                </Button>
              </div>
              {transitIncidents.map((incident, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Incident Description</label>
                    <Input 
                      value={incident.description}
                      onChange={(e) => {
                        const newIncidents = [...transitIncidents];
                        newIncidents[index].description = e.target.value;
                        setTransitIncidents(newIncidents);
                      }}
                      placeholder="e.g. Flat tire"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Estimated Cost (BD)</label>
                    <Input 
                      type="number"
                      step="0.001"
                      value={incident.cost}
                      onChange={(e) => {
                        const newIncidents = [...transitIncidents];
                        newIncidents[index].cost = e.target.value;
                        setTransitIncidents(newIncidents);
                      }}
                      placeholder="0.000"
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 mb-[2px]" onClick={() => {
                    const newIncidents = [...transitIncidents];
                    newIncidents.splice(index, 1);
                    setTransitIncidents(newIncidents);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Expense log */}
            <div className="p-4 border rounded-md bg-muted/30 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-xs text-primary uppercase tracking-wider">Log Additional Expenses (Optional)</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTransitExpenses([...transitExpenses, {name: "", cost: ""}])}>
                  <Plus className="h-3 w-3 mr-1"/> Add Expense
                </Button>
              </div>
              {transitExpenses.map((expense, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Expense Title</label>
                    <Input 
                      value={expense.name}
                      onChange={(e) => {
                        const newExpenses = [...transitExpenses];
                        newExpenses[index].name = e.target.value;
                        setTransitExpenses(newExpenses);
                      }}
                      placeholder="e.g. Road Tolls"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Cost Amount (BD)</label>
                    <Input 
                      type="number"
                      step="0.001"
                      value={expense.cost}
                      onChange={(e) => {
                        const newExpenses = [...transitExpenses];
                        newExpenses[index].cost = e.target.value;
                        setTransitExpenses(newExpenses);
                      }}
                      placeholder="0.000"
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 mb-[2px]" onClick={() => {
                    const newExpenses = [...transitExpenses];
                    newExpenses.splice(index, 1);
                    setTransitExpenses(newExpenses);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsTransitDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                if (transitTrip) {
                  // Merge/append delays
                  const newDelays = [...(transitTrip.delays as any[] || [])];
                  transitDelays.forEach(d => {
                    if (d.reason && parseFloat(d.durationHours) > 0) {
                      newDelays.push({
                        reason: d.reason,
                        durationHours: parseFloat(d.durationHours),
                        date: new Date().toISOString(),
                      });
                    }
                  });

                  // Merge/append incidents
                  const newIncidents = [...(transitTrip.incidents as any[] || [])];
                  transitIncidents.forEach(i => {
                    if (i.description) {
                      newIncidents.push({
                        description: i.description,
                        cost: parseFloat(i.cost) || 0,
                        date: new Date().toISOString(),
                      });
                    }
                  });

                  // Merge/append expenses
                  const newExpenses = [...(transitTrip.additionalExpenses as any[] || [])];
                  transitExpenses.forEach(e => {
                    if (e.name && parseFloat(e.cost) > 0) {
                      newExpenses.push({
                        name: e.name,
                        cost: parseFloat(e.cost),
                      });
                    }
                  });

                  updateTripMutation.mutate({
                    id: transitTrip.id,
                    currentLocation: transitLocation,
                    gpsLocation: transitGps,
                    delays: newDelays,
                    incidents: newIncidents,
                    additionalExpenses: newExpenses,
                  });
                }
              }}
              disabled={updateTripMutation.isPending}
            >
              {updateTripMutation.isPending ? "Logging Updates..." : "Save Transit Logs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
