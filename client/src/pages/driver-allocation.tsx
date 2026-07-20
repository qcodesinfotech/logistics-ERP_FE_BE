import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Truck, User } from "lucide-react";

interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  type: string;
  assignedDriverId: string | null;
  currentZoneId: string | null;
}

interface Driver {
  id: string;
  name: string;
}

interface Zone {
  id: string;
  name: string;
}

export default function DriverAllocation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: vehicles = [], isLoading: isVehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: drivers = [], isLoading: isDriversLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["/api/routes"], // The system seems to use /api/routes as zones
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ vehicleId, driverId }: { vehicleId: string; driverId: string | null }) => {
      return apiRequest("PUT", `/api/vehicles/${vehicleId}`, { assignedDriverId: driverId });
    },
    onSuccess: () => {
      toast({ title: "Driver assigned successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
    },
    onError: (err) => {
      toast({ title: getErrorMessage(err), variant: "destructive" });
    },
  });

  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getZoneName = (zoneId: string | null) => {
    if (!zoneId) return "Unassigned";
    return zones.find(z => z.id === zoneId)?.name || "Unknown Zone";
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <User className="h-8 w-8 text-primary" />
          Driver Allocation
        </h1>
        <p className="text-muted-foreground">
          Permanently assign drivers to vehicles for automatic scheduling.
        </p>
      </div>

      <Card className="border-primary/10 shadow-sm">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Fleet Assignments</CardTitle>
              <CardDescription>Select a primary driver for each truck</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trucks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Truck Name & Plate</TableHead>
                <TableHead>Default Route / Zone</TableHead>
                <TableHead>Primary Driver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isVehiclesLoading || isDriversLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Loading fleet data...</TableCell>
                </TableRow>
              ) : filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No trucks found.</TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map(vehicle => {
                  const assignedDriverIds = new Set(vehicles.map(v => v.assignedDriverId).filter(Boolean));
                  return (
                    <TableRow key={vehicle.id} className="hover:bg-accent/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Truck className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">{vehicle.name}</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">{vehicle.plateNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                          {getZoneName(vehicle.currentZoneId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={vehicle.assignedDriverId || "unassigned"}
                          onValueChange={(val) => {
                            assignDriverMutation.mutate({
                              vehicleId: vehicle.id,
                              driverId: val === "unassigned" ? null : val,
                            });
                          }}
                        >
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder="Select a driver..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" className="text-muted-foreground italic">None (Unassigned)</SelectItem>
                            {drivers.map(driver => {
                              const isAssignedToOther = assignedDriverIds.has(driver.id) && vehicle.assignedDriverId !== driver.id;
                              return (
                                <SelectItem key={driver.id} value={driver.id} disabled={isAssignedToOther}>
                                  {driver.name} {isAssignedToOther ? "(Assigned)" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
