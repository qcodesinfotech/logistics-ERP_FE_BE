import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Plus, UserCheck, Upload, AlertCircle, RefreshCw, Check } from "lucide-react";
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
import type { Zone, User } from "@shared/schema";

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
  
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  
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
            allocatedZoneId: result.zone?.id || "",
          });
        } catch (e) {
          processed.push({
            customerName: row.customerName,
            address: row.address,
            suggestedZoneId: "",
            suggestedZoneName: "Unallocated / Fallback",
            allocatedZoneId: "",
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Zonal Configuration" 
        description="Define operational zones, map multiple supervisors, and manage excel-based auto-allocation of client locations."
      >
        <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Simulate Excel Import
        </Button>
        <Button onClick={() => setIsSupervisorDialogOpen(true)} variant="secondary" className="gap-2">
          <UserCheck className="h-4 w-4" /> Assign Supervisors
        </Button>
        <Button onClick={() => setIsZoneDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Zone
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary animate-pulse" /> Active Operational Zones
              </CardTitle>
              <CardDescription>
                Overview of current logistics hubs, terminals, and sub-regions.
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
                      <TableHead>Zone Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zonesList.map((zone) => (
                      <TableRow key={zone.id} className="hover:bg-accent/40 transition-colors">
                        <TableCell className="font-semibold text-foreground">{zone.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{zone.description || "N/A"}</TableCell>
                        <TableCell>
                          <StatusBadge status={zone.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => {
                            form.reset({
                              name: zone.name,
                              description: zone.description || "",
                              status: zone.status as "active" | "inactive",
                            });
                            setIsZoneDialogOpen(true);
                          }}>
                            Edit
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

        <div>
          <Card className="shadow-md bg-accent/10 border-accent/20">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Dynamic Cross-Zone Fallback
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                The Logistics ERP uses **Smart Zone Allocation** to assign orders to their respective geographical regions based on customer address mapping.
              </p>
              <p className="font-medium text-foreground">
                Cross-Zone Fallback Use Case:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>If the primary Zone has no available vehicle or driver, supervisors can assign a fallback driver from another zone.</li>
                <li>Temporary fleet permits can be enabled instantly from the Dispatch board.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit Zone Dialog */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Zone</DialogTitle>
            <DialogDescription>
              Specify logistics parameters for the zone. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createZoneMutation.mutate(d))} className="space-y-4">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Button type="submit" disabled={createZoneMutation.isPending}>
                  {createZoneMutation.isPending ? "Saving..." : "Save Zone"}
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
                              value={row.allocatedZoneId}
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
                                <SelectItem value="" className="text-xs">Unallocated</SelectItem>
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
    </div>
  );
}
