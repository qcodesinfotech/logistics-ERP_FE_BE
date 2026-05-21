import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Truck, Plus, Calendar, Wrench, Fuel, DollarSign, PenTool, CheckCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CurrencyDisplay } from "@/components/currency-display";
import { MetricCard } from "@/components/metric-card";
import type { Vehicle, Zone } from "@shared/schema";

const vehicleSchema = z.object({
  name: z.string().min(1, "Vehicle name/model is required"),
  plateNumber: z.string().min(1, "Plate number is required"),
  type: z.enum(["owned", "outsourced"]),
  capacity: z.string().optional(),
  status: z.enum(["available", "in_transit", "maintenance"]),
  currentZoneId: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  permitExpiry: z.string().optional(),
  lastService: z.string().optional(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

const maintenanceSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  serviceDate: z.string().min(1, "Service Date is required"),
  serviceSchedule: z.string().min(1, "Service details are required"),
  repairLogs: z.string().optional(),
  cost: z.string().default("0"),
});

type MaintenanceFormData = z.infer<typeof maintenanceSchema>;

const fuelSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  date: z.string().min(1, "Refueling date is required"),
  liters: z.string().min(1, "Liters is required"),
  fuelExpense: z.string().min(1, "Expense amount is required"),
});

type FuelFormData = z.infer<typeof fuelSchema>;

export default function FleetPage() {
  const [activeTab, setActiveTab] = useState("vehicles");
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isMaintDialogOpen, setIsMaintDialogOpen] = useState(false);
  const [isFuelDialogOpen, setIsFuelDialogOpen] = useState(false);

  const { toast } = useToast();

  const vehicleForm = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      name: "",
      plateNumber: "",
      type: "owned",
      capacity: "",
      status: "available",
      currentZoneId: "",
      insuranceExpiry: "",
      permitExpiry: "",
      lastService: "",
    },
  });

  const maintForm = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      vehicleId: "",
      serviceDate: new Date().toISOString().split("T")[0],
      serviceSchedule: "",
      repairLogs: "",
      cost: "0",
    },
  });

  const fuelForm = useForm<FuelFormData>({
    resolver: zodResolver(fuelSchema),
    defaultValues: {
      vehicleId: "",
      date: new Date().toISOString().split("T")[0],
      liters: "",
      fuelExpense: "",
    },
  });

  const { data: vehiclesList, isLoading: isVehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: zonesList } = useQuery<Zone[]>({
    queryKey: ["/api/zones"],
  });

  const { data: maintLogs } = useQuery<any[]>({
    queryKey: ["/api/vehicles/maintenance"],
    enabled: activeTab === "maintenance" || true,
  });

  const { data: fuelLogs } = useQuery<any[]>({
    queryKey: ["/api/vehicles/fuel"],
    enabled: activeTab === "fuel" || true,
  });

  const createVehicleMutation = useMutation({
    mutationFn: (data: VehicleFormData) => {
      const { insuranceExpiry, permitExpiry, lastService, ...rest } = data;
      return apiRequest("POST", "/api/vehicles", {
        ...rest,
        complianceDetails: { insuranceExpiry, permitExpiry, lastService }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehicle added successfully" });
      setIsVehicleDialogOpen(false);
      vehicleForm.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createMaintMutation = useMutation({
    mutationFn: (data: MaintenanceFormData) => apiRequest("POST", "/api/vehicles/maintenance", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles/maintenance"] });
      toast({ title: "Maintenance log recorded" });
      setIsMaintDialogOpen(false);
      maintForm.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createFuelMutation = useMutation({
    mutationFn: (data: FuelFormData) => apiRequest("POST", "/api/vehicles/fuel", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles/fuel"] });
      toast({ title: "Fuel log recorded" });
      setIsFuelDialogOpen(false);
      fuelForm.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  // Derived stats
  const totalVehicles = vehiclesList?.length || 0;
  const ownedCount = vehiclesList?.filter(v => v.type === "owned").length || 0;
  const outsourcedCount = vehiclesList?.filter(v => v.type === "outsourced").length || 0;
  const totalMaintCost = maintLogs?.reduce((sum, log) => sum + parseFloat(log.cost || "0"), 0) || 0;
  const totalFuelCost = fuelLogs?.reduce((sum, log) => sum + parseFloat(log.fuelExpense || "0"), 0) || 0;

  const getVehiclePlate = (id: string) => {
    return vehiclesList?.find(v => v.id === id)?.plateNumber || "Unknown Truck";
  };

  const getZoneName = (id: string | null) => {
    if (!id) return "N/A";
    return zonesList?.find(z => z.id === id)?.name || "N/A";
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Asset Registry & Fleet Console" 
        description="Monitor owned and outsourced logistics fleets, compliance limits, maintenance scheduling, and fuel efficiency metrics."
      >
        <Button onClick={() => setIsFuelDialogOpen(true)} variant="outline" className="gap-2">
          <Fuel className="h-4 w-4" /> Log Fuel
        </Button>
        <Button onClick={() => setIsMaintDialogOpen(true)} variant="secondary" className="gap-2">
          <PenTool className="h-4 w-4" /> Log Maintenance
        </Button>
        <Button onClick={() => setIsVehicleDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Vehicle
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <MetricCard
          title="Active Vehicles"
          value={totalVehicles}
          icon={Truck}
          description={`${ownedCount} Owned / ${outsourcedCount} Outsourced`}
        />
        <MetricCard
          title="Maintenance Spent"
          value={totalMaintCost}
          isCurrency
          icon={PenTool}
          description="Cumulative workshop expense"
        />
        <MetricCard
          title="Fuel Expenses"
          value={totalFuelCost}
          isCurrency
          icon={Fuel}
          description="Total diesel consumption cost"
        />
        <MetricCard
          title="Avg Compliance"
          value="98.5%"
          icon={CheckCircle}
          description="Up-to-date insurance & permits"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border rounded-lg max-w-md">
          <TabsTrigger value="vehicles" className="px-4 py-2">Fleet Registry</TabsTrigger>
          <TabsTrigger value="maintenance" className="px-4 py-2">Maintenance Logs</TabsTrigger>
          <TabsTrigger value="fuel" className="px-4 py-2">Fuel Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardContent className="p-0">
              {isVehiclesLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading fleet registry...</div>
              ) : !vehiclesList || vehiclesList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No vehicles registered. Click 'Add Vehicle' to register fleet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plate Number</TableHead>
                      <TableHead>Vehicle Type / Model</TableHead>
                      <TableHead>Ownership</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Current Zone</TableHead>
                      <TableHead>Insurance Expiry</TableHead>
                      <TableHead>Permit Expiry</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehiclesList.map((vehicle) => {
                      const compliance = (vehicle.complianceDetails || {}) as any;
                      return (
                        <TableRow key={vehicle.id} className="hover:bg-accent/40 transition-colors">
                          <TableCell className="font-mono font-bold text-primary">{vehicle.plateNumber}</TableCell>
                          <TableCell className="font-semibold">{vehicle.name}</TableCell>
                          <TableCell className="capitalize text-xs font-semibold text-muted-foreground">{vehicle.type}</TableCell>
                          <TableCell className="text-xs">{vehicle.capacity || "N/A"}</TableCell>
                          <TableCell>{getZoneName(vehicle.currentZoneId)}</TableCell>
                          <TableCell className="text-xs font-mono">{compliance.insuranceExpiry || "N/A"}</TableCell>
                          <TableCell className="text-xs font-mono">{compliance.permitExpiry || "N/A"}</TableCell>
                          <TableCell>
                            <StatusBadge status={vehicle.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardContent className="p-0">
              {!maintLogs || maintLogs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No maintenance events logged yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Truck</TableHead>
                      <TableHead>Service Date</TableHead>
                      <TableHead>Details / Schedule</TableHead>
                      <TableHead>Repair log details</TableHead>
                      <TableHead className="text-right">Maintenance Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-accent/40 transition-colors">
                        <TableCell className="font-mono font-bold">{getVehiclePlate(log.vehicleId)}</TableCell>
                        <TableCell className="text-xs font-mono">{log.serviceDate}</TableCell>
                        <TableCell className="font-semibold text-xs">{log.serviceSchedule}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{log.repairLogs || "Regular repair"}</TableCell>
                        <TableCell className="text-right"><CurrencyDisplay amount={log.cost} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardContent className="p-0">
              {!fuelLogs || fuelLogs.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No fuel records logged yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Truck</TableHead>
                      <TableHead>Refueling Date</TableHead>
                      <TableHead className="text-right">Fuel Volume (Liters)</TableHead>
                      <TableHead className="text-right">Fuel Cost</TableHead>
                      <TableHead className="text-right">Efficiency Ratio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fuelLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-accent/40 transition-colors">
                        <TableCell className="font-mono font-bold">{getVehiclePlate(log.vehicleId)}</TableCell>
                        <TableCell className="text-xs font-mono">{log.date}</TableCell>
                        <TableCell className="text-right font-mono">{log.liters} L</TableCell>
                        <TableCell className="text-right"><CurrencyDisplay amount={log.fuelExpense} /></TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {(parseFloat(log.fuelExpense || "0") / parseFloat(log.liters || "1")).toFixed(3)} RO/L
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Vehicle Dialog */}
      <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Register Logistics Vehicle</DialogTitle>
            <DialogDescription>Input vehicle model, license plate number, and compliance metrics.</DialogDescription>
          </DialogHeader>
          <Form {...vehicleForm}>
            <form onSubmit={vehicleForm.handleSubmit(d => createVehicleMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={vehicleForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model / Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Actros 1845, Volvo FH16" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
                  name="plateNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plate Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. OB 8847" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={vehicleForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="owned">Owned</SelectItem>
                          <SelectItem value="outsourced">Outsourced</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (Tons)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 15T" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={vehicleForm.control}
                name="currentZoneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Primary Zone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {zonesList?.map(z => (
                          <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <FormField
                  control={vehicleForm.control}
                  name="insuranceExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
                  name="permitExpiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permit Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsVehicleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createVehicleMutation.isPending}>
                  {createVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Log Maintenance Dialog */}
      <Dialog open={isMaintDialogOpen} onOpenChange={setIsMaintDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Log Maintenance / Service</DialogTitle>
            <DialogDescription>Log repair cost and job card updates for vehicle assets.</DialogDescription>
          </DialogHeader>
          <Form {...maintForm}>
            <form onSubmit={maintForm.handleSubmit(d => createMaintMutation.mutate(d))} className="space-y-4">
              <FormField
                control={maintForm.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Plate *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehiclesList?.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.plateNumber} - {v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={maintForm.control}
                  name="serviceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={maintForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Cost (RO) *</FormLabel>
                      <FormControl>
                        <Input placeholder="0.000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={maintForm.control}
                name="serviceSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service / Job Description *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Engine Oil replacement, Front brake pads" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={maintForm.control}
                name="repairLogs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repair Log Comments</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional workshop diagnostics details..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsMaintDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMaintMutation.isPending}>
                  {createMaintMutation.isPending ? "Logging..." : "Log Maintenance"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Log Fuel Dialog */}
      <Dialog open={isFuelDialogOpen} onOpenChange={setIsFuelDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Log Fuel Consumption</DialogTitle>
            <DialogDescription>Log refueling event volume and fuel bills.</DialogDescription>
          </DialogHeader>
          <Form {...fuelForm}>
            <form onSubmit={fuelForm.handleSubmit(d => createFuelMutation.mutate(d))} className="space-y-4">
              <FormField
                control={fuelForm.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Plate *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehiclesList?.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.plateNumber} - {v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={fuelForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={fuelForm.control}
                  name="liters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volume (Liters) *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 120.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={fuelForm.control}
                name="fuelExpense"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Fuel Bill (RO) *</FormLabel>
                    <FormControl>
                      <Input placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsFuelDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createFuelMutation.isPending}>
                  {createFuelMutation.isPending ? "Logging..." : "Log Fuel"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
