import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Plus, UserCheck, Upload, AlertCircle, RefreshCw, Check, Trash2, Truck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import type { Zone, User, Vehicle } from "@shared/schema";

const zoneSchema = z.object({
  name: z.string().min(1, "Zone name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

type ZoneFormData = z.infer<typeof zoneSchema>;

interface ExcelSimRow {
  customerName: string;
  address: string;
  suggestedZoneId: string;
  suggestedZoneName: string;
  allocatedZoneId: string;
}

export default function ZonesPage() {
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isSupervisorDialogOpen, setIsSupervisorDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  
  const [isAppendOutletsDialogOpen, setIsAppendOutletsDialogOpen] = useState(false);
  const [selectedZoneIdForOutlets, setSelectedZoneIdForOutlets] = useState<string>("");
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [outletSearchQuery, setOutletSearchQuery] = useState("");

  const [isManageTrucksDialogOpen, setIsManageTrucksDialogOpen] = useState(false);
  const [selectedZoneIdForTrucks, setSelectedZoneIdForTrucks] = useState<string>("");
  
  // Excel import simulation state
  const [simulatedData, setSimulatedData] = useState<ExcelSimRow[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

  const { toast } = useToast();

  const form = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    },
  });

  const { data: zonesList, isLoading: isZonesLoading } = useQuery<Zone[]>({
    queryKey: ["/api/zones"],
  });

  const { data: usersList } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: outletsList } = useQuery<any[]>({
    queryKey: ["/api/outlets"],
  });

  const { data: vehiclesList } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: zoneOutlets } = useQuery<any[]>({
    queryKey: [`/api/zones/${selectedZoneIdForOutlets}/outlets`],
    enabled: !!selectedZoneIdForOutlets && isAppendOutletsDialogOpen,
  });

  const supervisors = usersList?.filter(u => u.role === "supervisor" || u.role === "admin") || [];

  const createZoneMutation = useMutation({
    mutationFn: (data: ZoneFormData) => apiRequest("POST", "/api/zones", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Zone created successfully" });
      setIsZoneDialogOpen(false);
      form.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ZoneFormData }) => 
      apiRequest("PUT", `/api/zones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Zone updated successfully" });
      setIsZoneDialogOpen(false);
      setEditingZoneId(null);
      form.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const assignSupervisorMutation = useMutation({
    mutationFn: (data: { supervisorId: string; zoneIds: string[] }) => 
      apiRequest("POST", "/api/zones/assign-supervisor", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Supervisor zone assignments updated successfully" });
      setIsSupervisorDialogOpen(false);
      setSelectedSupervisorId("");
      setSelectedZoneIds([]);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/zones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({ title: "Zone deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const addSingleOutletMutation = useMutation({
    mutationFn: (data: { zoneId: string; outletId: string }) => 
      apiRequest("POST", `/api/zones/${data.zoneId}/outlets`, { outletIds: [data.outletId] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/zones/${selectedZoneIdForOutlets}/outlets`] });
      toast({ title: "Outlet added to zone" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const removeOutletMutation = useMutation({
    mutationFn: (data: { zoneId: string; outletId: string }) => 
      apiRequest("DELETE", `/api/zones/${data.zoneId}/outlets/${data.outletId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/zones/${selectedZoneIdForOutlets}/outlets`] });
      toast({ title: "Outlet removed from zone" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const assignTruckMutation = useMutation({
    mutationFn: (data: { vehicleId: string; zoneId: string }) => 
      apiRequest("PATCH", `/api/vehicles/${data.vehicleId}/zone`, { zoneId: data.zoneId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Truck assigned to zone" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const removeTruckMutation = useMutation({
    mutationFn: (data: { vehicleId: string }) => 
      apiRequest("PATCH", `/api/vehicles/${data.vehicleId}/zone`, { zoneId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Truck removed from zone" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleSupervisorChange = async (supervisorId: string) => {
    setSelectedSupervisorId(supervisorId);
    try {
      const res = await fetch(`/api/zones/supervisor/${supervisorId}`);
      if (res.ok) {
        const data = await res.json();
        const activeIds = data.map((d: any) => d.zoneId);
        setSelectedZoneIds(activeIds);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleZoneToggle = (zoneId: string) => {
    setSelectedZoneIds(prev => 
      prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleOutletToggle = (outletId: string) => {
    setSelectedOutletIds(prev => 
      prev.includes(outletId) ? prev.filter(id => id !== outletId) : [...prev, outletId]
    );
  };

  const triggerExcelSimulation = () => {
    setIsProcessingExcel(true);
    setSimulatedData([]);
    
    // Simulating call to auto-allocate endpoint for 3 customer address rows
    setTimeout(async () => {
      const mockRows = [
        { customerName: "Muscat Traders LLC", address: "Al Khuwair, Muscat, Oman" },
        { customerName: "Salalah Agri-Products", address: "Industrial Area, Salalah, Dhofar" },
        { customerName: "Sohar Logistics Hub", address: "Port of Sohar, Sohar, Al Batinah" },
        { customerName: "Nizwa Trading Co", address: "Main Souq Road, Nizwa, Ad Dakhiliyah" },
      ];

      const processed: ExcelSimRow[] = [];
      for (const row of mockRows) {
        try {
          const res = await apiRequest("POST", "/api/zones/auto-allocate", { address: row.address });
          const result = await res.json();
          processed.push({
            customerName: row.customerName,
            address: row.address,
            suggestedZoneId: result.zone?.id || "",
            suggestedZoneName: result.zone?.name || "Unallocated / Fallback",
            allocatedZoneId: result.zone?.id || "unallocated",
          });
        } catch (e) {
          processed.push({
            customerName: row.customerName,
            address: row.address,
            suggestedZoneId: "",
            suggestedZoneName: "Unallocated / Fallback",
            allocatedZoneId: "unallocated",
          });
        }
      }
      setSimulatedData(processed);
      setIsProcessingExcel(false);
    }, 1500);
  };

  const saveSimulatedAllocations = () => {
    toast({
      title: "Excel Data Allocated Successfully",
      description: `Mapped ${simulatedData.length} records to operational zones.`,
    });
    setIsImportDialogOpen(false);
    setSimulatedData([]);
  };

  const currentZoneForOutlets = zonesList?.find(z => z.id === selectedZoneIdForOutlets);

  const filteredZoneOutlets = zoneOutlets?.filter(outlet => 
    outlet.name.toLowerCase().includes(outletSearchQuery.toLowerCase()) ||
    (outlet.address && outlet.address.toLowerCase().includes(outletSearchQuery.toLowerCase()))
  ) || [];

  const availableOutlets = outletsList?.filter(outlet => {
    // Exclude if already in zoneOutlets
    const isAssigned = zoneOutlets?.some(zo => zo.id === outlet.id);
    if (isAssigned) return false;
    
    // Filter by query
    return outlet.name.toLowerCase().includes(outletSearchQuery.toLowerCase()) ||
      (outlet.address && outlet.address.toLowerCase().includes(outletSearchQuery.toLowerCase()));
  }) || [];

  const currentZoneForTrucks = zonesList?.find(z => z.id === selectedZoneIdForTrucks);
  const zoneTrucks = vehiclesList?.filter(v => v.currentZoneId === selectedZoneIdForTrucks) || [];
  const availableTrucks = vehiclesList?.filter(v => {
    const isAssignedToValidZone = zonesList?.some(z => z.id === v.currentZoneId);
    return !isAssignedToValidZone && v.status === "available";
  }) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Routes & Zonal Configuration" 
        description="Define operational routes & zones, map multiple supervisors, and manage excel-based auto-allocation of client locations."
      >
        <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Simulate Excel Import
        </Button>
        <Button onClick={() => setIsSupervisorDialogOpen(true)} variant="secondary" className="gap-2">
          <UserCheck className="h-4 w-4" /> Assign Supervisors
        </Button>
        <Button 
          onClick={() => {
            setEditingZoneId(null);
            form.reset({
              name: "",
              description: "",
              status: "active",
            });
            setIsZoneDialogOpen(true);
          }} 
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Add Zone
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary animate-pulse" /> Active Operational Routes & Zones
              </CardTitle>
              <CardDescription>
                Overview of current logistics routes, hubs, terminals, and sub-regions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isZonesLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading zones...</div>
              ) : !zonesList || zonesList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <MapPin className="h-8 w-8 text-muted-foreground/50" />
                  <span>No operational zones created yet.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route / Zone Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zonesList.map((zone) => (
                      <TableRow key={zone.id} className="hover:bg-accent/40 transition-colors">
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => {
                                setSelectedZoneIdForOutlets(zone.id);
                                setOutletSearchQuery("");
                                setIsAppendOutletsDialogOpen(true);
                              }}
                              className="hover:underline text-left text-primary cursor-pointer font-bold text-base"
                            >
                              {zone.name}
                            </button>
                            {(() => {
                              const zoneOutletsList = outletsList?.filter(o => o.routeId === zone.id) || [];
                              const displayedOutlets = zoneOutletsList.slice(0, 5).map(o => o.name).join(", ");
                              const outletsText = zoneOutletsList.length > 5 ? `${displayedOutlets} and ${zoneOutletsList.length - 5} more` : displayedOutlets || "None assigned";
                              
                              const zoneTrucksList = vehiclesList?.filter(v => v.currentZoneId === zone.id) || [];
                              const displayedTrucks = zoneTrucksList.slice(0, 5).map(v => v.name).join(", ");
                              const trucksText = zoneTrucksList.length > 5 ? `${displayedTrucks} and ${zoneTrucksList.length - 5} more` : displayedTrucks || "None assigned";

                              return (
                                <div className="flex flex-col gap-1.5 text-xs font-normal text-muted-foreground mt-1">
                                  <div className="flex items-start gap-1.5">
                                    <Truck className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                    <span className="leading-tight max-w-[250px] truncate" title={zoneTrucksList.map(v => v.name).join(", ")}>
                                      <span className="font-medium text-foreground/80">Trucks: </span>
                                      {trucksText}
                                    </span>
                                  </div>
                                  <div className="flex items-start gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                                    <span className="leading-tight max-w-[250px] truncate" title={zoneOutletsList.map(o => o.name).join(", ")}>
                                      <span className="font-medium text-foreground/80">Outlets: </span>
                                      {outletsText}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{zone.description || "N/A"}</TableCell>
                        <TableCell>
                          <StatusBadge status={zone.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setEditingZoneId(zone.id);
                              form.reset({
                                name: zone.name,
                                description: zone.description || "",
                                status: zone.status as "active" | "inactive",
                              });
                              setIsZoneDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-amber-600 hover:text-amber-700" 
                            onClick={() => {
                              setSelectedZoneIdForTrucks(zone.id);
                              setIsManageTrucksDialogOpen(true);
                            }}
                          >
                            Manage Trucks
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-700" 
                            onClick={() => {
                              setSelectedZoneIdForOutlets(zone.id);
                              setOutletSearchQuery("");
                              setIsAppendOutletsDialogOpen(true);
                            }}
                          >
                            Manage Outlets
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => {
                            if (confirm("Are you sure you want to delete this zone?")) {
                              deleteZoneMutation.mutate(zone.id);
                            }
                          }}>
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>


      </div>

      {/* Create / Edit Zone Dialog */}
      <Dialog 
        open={isZoneDialogOpen} 
        onOpenChange={(open) => {
          setIsZoneDialogOpen(open);
          if (!open) {
            setEditingZoneId(null);
            form.reset({
              name: "",
              description: "",
              status: "active",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingZoneId ? "Edit Zone" : "Configure Zone"}</DialogTitle>
            <DialogDescription>
              Specify logistics parameters for the zone. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit(d => {
                if (editingZoneId) {
                  updateZoneMutation.mutate({ id: editingZoneId, data: d });
                } else {
                  createZoneMutation.mutate(d);
                }
              })} 
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Muscat North, Dhofar South" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description / Keywords</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. Muscat, Seeb, Muttrah, Ruwi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsZoneDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createZoneMutation.isPending || updateZoneMutation.isPending}>
                  {createZoneMutation.isPending || updateZoneMutation.isPending ? "Saving..." : editingZoneId ? "Update Zone" : "Save Zone"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Supervisor Allocation Dialog */}
      <Dialog open={isSupervisorDialogOpen} onOpenChange={setIsSupervisorDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Map Supervisor to Zones</DialogTitle>
            <DialogDescription>
              Supervisors can manage drivers and fleet operations across one or more assigned zones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Supervisor *</label>
              <Select onValueChange={handleSupervisorChange} value={selectedSupervisorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee / supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.username})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSupervisorId && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium">Select Accessible Zones</label>
                <div className="grid grid-cols-2 gap-2 border p-3 rounded-lg max-h-48 overflow-y-auto">
                  {zonesList?.map(zone => (
                    <div 
                      key={zone.id} 
                      onClick={() => handleZoneToggle(zone.id)}
                      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-all ${
                        selectedZoneIds.includes(zone.id) 
                          ? "bg-primary/10 border-primary text-primary font-medium" 
                          : "hover:bg-accent/50 text-muted-foreground border-transparent"
                      }`}
                    >
                      <span className="text-xs">{zone.name}</span>
                      {selectedZoneIds.includes(zone.id) && <Check className="h-3 w-3" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsSupervisorDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => assignSupervisorMutation.mutate({ supervisorId: selectedSupervisorId, zoneIds: selectedZoneIds })}
              disabled={!selectedSupervisorId || assignSupervisorMutation.isPending}
            >
              {assignSupervisorMutation.isPending ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Simulation Importer Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Simulate Zonal Excel Upload</DialogTitle>
            <DialogDescription>
              Simulate uploading a sheet of customer delivery locations. The system matches addresses against configured zone keywords automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {simulatedData.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-center flex flex-col items-center gap-4 bg-muted/20">
                <Upload className="h-10 w-10 text-muted-foreground/60 animate-bounce" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Drag and drop customer_locations.xlsx</p>
                  <p className="text-xs text-muted-foreground">Accepts typical ERP/CRM customer location sheets</p>
                </div>
                <Button onClick={triggerExcelSimulation} disabled={isProcessingExcel} className="gap-2 mt-2">
                  {isProcessingExcel ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Processing Addresses...
                    </>
                  ) : (
                    "Load Sample File (4 Rows)"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md max-h-72 overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Auto-Suggested Zone</TableHead>
                        <TableHead>Manual Overrides</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulatedData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-xs font-semibold">{row.customerName}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground" title={row.address}>
                            {row.address}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              row.suggestedZoneId ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            }`}>
                              {row.suggestedZoneName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={row.allocatedZoneId || "unallocated"}
                              onValueChange={(val) => {
                                const updated = [...simulatedData];
                                updated[index].allocatedZoneId = val;
                                setSimulatedData(updated);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-[140px]">
                                <SelectValue placeholder="Override Zone" />
                              </SelectTrigger>
                              <SelectContent>
                                {zonesList?.map(z => (
                                  <SelectItem key={z.id} value={z.id} className="text-xs">{z.name}</SelectItem>
                                ))}
                                <SelectItem value="unallocated" className="text-xs">Unallocated</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 text-xs text-blue-800 dark:text-blue-300">
                  <span>* Manual overrides will bypass auto-allocated zones and persist to the order database.</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setSimulatedData([]); }}>
              Cancel
            </Button>
            <Button onClick={saveSimulatedAllocations} disabled={simulatedData.length === 0}>
              Apply & Save Allocations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Outlets Dialog */}
      <Dialog open={isAppendOutletsDialogOpen} onOpenChange={setIsAppendOutletsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Outlets for {currentZoneForOutlets?.name || "Zone"}</DialogTitle>
            <DialogDescription>
              View currently appended outlets, remove them, or assign new available outlets to this zone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <Input
              placeholder="Search outlets by name or address..."
              value={outletSearchQuery}
              onChange={(e) => setOutletSearchQuery(e.target.value)}
              className="mb-4"
            />

            <Tabs defaultValue="appended" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="appended" className="relative">
                  Appended Outlets
                  {zoneOutlets && zoneOutlets.length > 0 && (
                    <span className="ml-2 bg-primary/25 text-primary font-bold rounded-full px-2.5 py-0.5 text-xs">
                      {zoneOutlets.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="available">
                  Add Outlets
                  {availableOutlets.length > 0 && (
                    <span className="ml-2 bg-muted text-muted-foreground font-semibold rounded-full px-2.5 py-0.5 text-xs">
                      {availableOutlets.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="appended" className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {filteredZoneOutlets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {outletSearchQuery ? "No matching appended outlets." : "No outlets appended to this zone yet."}
                  </div>
                ) : (
                  filteredZoneOutlets.map(outlet => (
                    <div key={outlet.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/40 hover:bg-accent/30 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-semibold text-foreground truncate">{outlet.name}</span>
                        {outlet.address && <span className="text-xs text-muted-foreground truncate">{outlet.address}</span>}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 h-8 w-8 shrink-0"
                        onClick={() => removeOutletMutation.mutate({ zoneId: selectedZoneIdForOutlets, outletId: outlet.id })}
                        disabled={removeOutletMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="available" className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {availableOutlets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {outletSearchQuery ? "No matching unassigned outlets." : "All available outlets have been assigned to this zone."}
                  </div>
                ) : (
                  availableOutlets.map(outlet => (
                    <div key={outlet.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-semibold text-foreground truncate">{outlet.name}</span>
                        {outlet.address && <span className="text-xs text-muted-foreground truncate">{outlet.address}</span>}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1 shrink-0 text-xs hover:bg-primary hover:text-white transition-colors"
                        onClick={() => addSingleOutletMutation.mutate({ zoneId: selectedZoneIdForOutlets, outletId: outlet.id })}
                        disabled={addSingleOutletMutation.isPending}
                      >
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" onClick={() => setIsAppendOutletsDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Trucks Dialog */}
      <Dialog open={isManageTrucksDialogOpen} onOpenChange={setIsManageTrucksDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Trucks for {currentZoneForTrucks?.name || "Zone"}</DialogTitle>
            <DialogDescription>
              Assign available trucks to this zone. They will be auto-allocated during daily dispatch.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <Tabs defaultValue="appended" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="appended" className="relative">
                  Zone Trucks
                  {zoneTrucks.length > 0 && (
                    <span className="ml-2 bg-primary/25 text-primary font-bold rounded-full px-2.5 py-0.5 text-xs">
                      {zoneTrucks.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="available">
                  Available Fleet
                  {availableTrucks.length > 0 && (
                    <span className="ml-2 bg-muted text-muted-foreground font-semibold rounded-full px-2.5 py-0.5 text-xs">
                      {availableTrucks.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="appended" className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {zoneTrucks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No trucks assigned to this zone yet.
                  </div>
                ) : (
                  zoneTrucks.map(truck => (
                    <div key={truck.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/40 hover:bg-accent/30 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-semibold text-foreground truncate">{truck.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{truck.plateNumber}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 h-8 w-8 shrink-0"
                        onClick={() => removeTruckMutation.mutate({ vehicleId: truck.id })}
                        disabled={removeTruckMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="available" className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {availableTrucks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No available trucks found in the fleet.
                  </div>
                ) : (
                  availableTrucks.map(truck => (
                    <div key={truck.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-sm font-semibold text-foreground truncate">{truck.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{truck.plateNumber}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1 shrink-0 text-xs hover:bg-primary hover:text-white transition-colors"
                        onClick={() => assignTruckMutation.mutate({ vehicleId: truck.id, zoneId: selectedZoneIdForTrucks })}
                        disabled={assignTruckMutation.isPending}
                      >
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" onClick={() => setIsManageTrucksDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
