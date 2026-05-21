import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  BarChart3, Plus, Truck, User, ArrowRight, CheckCircle2, 
  AlertTriangle, Play, Check, Eye, FileUp, XCircle, Clock, RefreshCw
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
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  
  // Selection states for new trip creation
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [tripRoute, setTripRoute] = useState("");

  // Delivery status / POD state
  const [selectedOrderIdForPOD, setSelectedOrderIdForPOD] = useState<string>("");
  const [podStatus, setPodStatus] = useState<string>("delivered");
  const [podUrl, setPodUrl] = useState<string>("");
  const [issueLog, setIssueLog] = useState<string>("");
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

  const { data: locationsList } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  // Filter orders that are not assigned to active trips
  // and have status as 'pending' or 'confirmed'
  const unassignedOrders = ordersList?.filter(o => 
    (o.status === "pending" || o.status === "confirmed" || o.status === "incomplete")
  ) || [];

  const availableVehicles = vehiclesList?.filter(v => v.status === "available") || [];

  // Mutations
  const createTripMutation = useMutation({
    mutationFn: (data: {
      vehicleId: string;
      driverId: string;
      orderIds: string[];
      route: string;
      status: string;
      startTime: Date;
    }) => apiRequest("POST", "/api/trips", data),
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
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateTripStatusMutation = useMutation({
    mutationFn: ({ id, status, endTime }: { id: string; status: string; endTime?: Date }) => 
      apiRequest("PUT", `/api/trips/${id}`, { status, endTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Trip status updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: ({ tripId, orderId, status, podUrl, issueLog }: {
      tripId: string;
      orderId: string;
      status: string;
      podUrl: string;
      issueLog?: string;
    }) => apiRequest("POST", `/api/trips/${tripId}/update-delivery`, { orderId, status, podUrl, issueLog }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deliveries"] });
      toast({ title: "Delivery POD recorded. Customer order statuses updated." });
      setIsPODDialogOpen(false);
      setSelectedOrderIdForPOD("");
      setPodUrl("");
      setIssueLog("");
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
      const res = await fetch("/api/upload/contracts", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      if (data.documents && data.documents.length > 0) {
        setPodUrl(data.documents[0].url);
        toast({ title: "POD uploaded successfully!" });
      }
    } catch (err) {
      toast({ title: "Failed to upload POD document", variant: "destructive" });
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
                                  // Fetch order list for this trip to enable POD modal selection
                                  try {
                                    const res = await fetch(`/api/trips/${trip.id}/orders`);
                                    if (res.ok) {
                                      const orderData = await res.json();
                                      setSelectedTrip({ ...trip, orderIds: orderData.map((o: any) => o.id) } as any);
                                      setIsPODDialogOpen(true);
                                    }
                                  } catch (err) {
                                    console.error(err);
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
                                onClick={() => updateTripStatusMutation.mutate({ id: trip.id, status: "in_transit" })}
                              >
                                Depart
                              </Button>
                            )}

                            {trip.status === "in_transit" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-xs text-foreground"
                                onClick={() => updateTripStatusMutation.mutate({ id: trip.id, status: "completed", endTime: new Date() })}
                              >
                                Complete Trip
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
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => createTripMutation.mutate({
                vehicleId: selectedVehicleId,
                driverId: selectedDriverId,
                orderIds: selectedOrderIds,
                route: tripRoute,
                status: "pending",
                startTime: new Date(),
              })}
              disabled={!selectedVehicleId || !selectedDriverId || !tripRoute || createTripMutation.isPending}
            >
              {createTripMutation.isPending ? "Launching..." : "Launch Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record POD Dialog */}
      <Dialog open={isPODDialogOpen} onOpenChange={setIsPODDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
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
              })}
              disabled={!selectedOrderIdForPOD || !podStatus || updateDeliveryMutation.isPending}
            >
              {updateDeliveryMutation.isPending ? "Logging POD..." : "Save Delivery Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
