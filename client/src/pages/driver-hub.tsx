import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  UserCircle, Navigation, MapPin, ShieldAlert, CheckCircle2, 
  Map, History, Gauge, AlertCircle, RefreshCw, Key, Plus
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
import type { Trip, Location, DriverAttendance, DriverActivity } from "@shared/schema";

interface MinimalEmployee {
  id: string;
  name: string;
}

export default function DriverHubPage() {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [deviceToken, setDeviceToken] = useState<string>("SIM_DEV_OMAN_778");
  const [isLocating, setIsLocating] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);

  // Activity log states
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [kmBefore, setKmBefore] = useState<string>("0");
  const [kmAfter, setKmAfter] = useState<string>("0");
  const [activityNotes, setActivityNotes] = useState<string>("");

  const { toast } = useToast();

  // Queries
  const { data: driversList } = useQuery<MinimalEmployee[]>({
    queryKey: ["/api/employees/minimal"],
  });

  const { data: locationsList } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  // Fetch attendance logs for selected driver
  const { data: attendanceList, isLoading: isAttendanceLoading } = useQuery<DriverAttendance[]>({
    queryKey: ["/api/drivers/attendance", selectedDriverId],
    enabled: !!selectedDriverId,
    queryFn: async () => {
      const res = await fetch(`/api/drivers/attendance?driverId=${selectedDriverId}`);
      if (!res.ok) throw new Error("Failed to fetch driver attendance");
      return res.json();
    }
  });

  // Fetch driver active trips
  const { data: driverTrips } = useQuery<Trip[]>({
    queryKey: ["/api/trips", selectedDriverId],
    enabled: !!selectedDriverId,
    queryFn: async () => {
      const res = await fetch(`/api/trips?driverId=${selectedDriverId}`);
      if (!res.ok) throw new Error("Failed to fetch driver trips");
      return res.json();
    }
  });

  // Fetch driver activities / mileage logs
  const { data: activitiesList } = useQuery<DriverActivity[]>({
    queryKey: ["/api/drivers/activities", selectedDriverId],
    enabled: !!selectedDriverId,
    queryFn: async () => {
      const res = await fetch(`/api/drivers/activities?driverId=${selectedDriverId}`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    }
  });

  // Get current geolocation from browser
  const triggerGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ 
        title: "Geolocation is not supported by your browser", 
        variant: "destructive" 
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
        toast({ title: "Coordinates retrieved successfully!" });
      },
      (error) => {
        setIsLocating(false);
        toast({ 
          title: "Failed to get location. Using default Oman HQ coordinates.", 
          description: error.message,
          variant: "destructive" 
        });
        // Default to Muscat warehouse coordinates for simulator ease
        setLatitude(23.5859);
        setLongitude(58.4059);
      },
      { enableHighAccuracy: true }
    );
  };

  // Automatically request location on load or driver change
  useEffect(() => {
    triggerGetLocation();
  }, [selectedDriverId]);

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: async (data: { 
      driverId: string; 
      latitude: string; 
      longitude: string; 
      deviceToken: string; 
    }) => {
      const res = await apiRequest("POST", "/api/drivers/attendance", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/attendance", selectedDriverId] });
      toast({ 
        title: `Attendance Registered: ${data.attendance.status.toUpperCase()}`,
        description: `Geofence validation: ${data.geofenceValid ? "VALID (within terminal 100m radius)" : "INVALID (outside terminal boundary)"}. Nearest terminal: ${data.distanceToNearest}`,
        variant: data.geofenceValid ? "default" : "destructive"
      });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const recordActivityMutation = useMutation({
    mutationFn: (data: {
      driverId: string;
      tripId: string;
      kmBefore: number;
      kmAfter: number;
      notes: string;
    }) => apiRequest("POST", "/api/drivers/activities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/activities", selectedDriverId] });
      toast({ title: "Mileage & trip activity logged successfully!" });
      setIsActivityDialogOpen(false);
      setKmBefore("0");
      setKmAfter("0");
      setActivityNotes("");
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Driver Geo-Hub" 
        description="Simulate dual-attendance checks (radius geofence) and submit odometer mileage worksheets."
      >
        {selectedDriverId && (
          <Button onClick={() => setIsActivityDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Log Mileage activity
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Driver Selection & Geofence Simulator console */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary" /> Geofence Check-in Console
              </CardTitle>
              <CardDescription>
                Test dual-attendance validation (verifies location matches authorized warehouse geofence coordinates).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Driver Simulator Context</label>
                <Select onValueChange={setSelectedDriverId} value={selectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose active driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {driversList?.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/20">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Simulated Latitude</div>
                  <Input 
                    type="number" 
                    step="0.000001"
                    value={latitude || ""} 
                    onChange={(e) => setLatitude(parseFloat(e.target.value) || null)}
                    placeholder="e.g. 23.5859"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Simulated Longitude</div>
                  <Input 
                    type="number" 
                    step="0.000001"
                    value={longitude || ""} 
                    onChange={(e) => setLongitude(parseFloat(e.target.value) || null)}
                    placeholder="e.g. 58.4059"
                  />
                </div>
                <div className="col-span-2 flex justify-between items-center pt-2">
                  <span className="text-[10px] text-muted-foreground">Use browser's GPS or input coordinates</span>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5"
                    onClick={triggerGetLocation}
                    disabled={isLocating}
                  >
                    <RefreshCw className={`h-3 w-3 ${isLocating ? "animate-spin" : ""}`} /> Fetch GPS
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Key className="h-4 w-4 text-muted-foreground" /> Device Token
                </label>
                <Input 
                  value={deviceToken} 
                  onChange={(e) => setDeviceToken(e.target.value)} 
                  placeholder="Simulated hardware device token" 
                />
              </div>

              <Button 
                onClick={() => checkInMutation.mutate({
                  driverId: selectedDriverId,
                  latitude: String(latitude),
                  longitude: String(longitude),
                  deviceToken: deviceToken,
                })}
                disabled={!selectedDriverId || !latitude || !longitude || checkInMutation.isPending}
                className="w-full h-11 gap-2 text-md"
              >
                {checkInMutation.isPending ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" /> Enforcing geofence checks...
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5" /> Check-in Driver Attendance
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Geofence Guidelines */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-md bg-accent/10 border-accent/20 h-full">
            <CardHeader>
              <CardTitle className="text-md flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" /> Geofence Boundaries
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-4">
              <p>
                Driver check-ins require dual-attendance validation:
              </p>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                <li>
                  <strong className="text-foreground">Geolocation Boundary:</strong> Driver must check-in within a **100-meter radius** of any registered warehouse or client location.
                </li>
                <li>
                  <strong className="text-foreground">Authorized Hardware Device:</strong> Login session must contain a valid hardware device token.
                </li>
              </ol>
              <div className="bg-muted p-3 rounded-lg border">
                <div className="font-semibold text-foreground mb-1">Active Terminals Geocodes:</div>
                {locationsList && locationsList.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[10px]">
                    {locationsList.map(loc => (
                      <div key={loc.id} className="flex justify-between">
                        <span>{loc.name} ({loc.code})</span>
                        <span>{parseFloat(String(loc.latitude)).toFixed(4)}, {parseFloat(String(loc.longitude)).toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-600">No terminal locations registered. Geofence check-in will mark check-ins as absent.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History Tabs */}
        {selectedDriverId && (
          <div className="col-span-1 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Attendance Logs */}
            <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-md flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Attendance Records
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-72 overflow-y-auto">
                {isAttendanceLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading attendance logs...</div>
                ) : !attendanceList || attendanceList.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No attendance records found.</div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead>Check-in Time</TableHead>
                        <TableHead>Coordinates</TableHead>
                        <TableHead>Device Auth</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceList.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">{new Date(log.checkInTime!).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-mono">{parseFloat(String(log.latitude)).toFixed(4)}, {parseFloat(String(log.longitude)).toFixed(4)}</TableCell>
                          <TableCell className="text-xs">
                            {log.isAuthorizedDevice ? (
                              <span className="text-green-600">Authorized</span>
                            ) : (
                              <span className="text-red-500">Unrecognized</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${log.status === "present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {log.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Mileage Activities */}
            <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-md flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" /> Mileage & Activity Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-72 overflow-y-auto">
                {!activitiesList || activitiesList.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No mileage records found.</div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead>Log Date</TableHead>
                        <TableHead>Trip Ref</TableHead>
                        <TableHead>Odometer (Start / End)</TableHead>
                        <TableHead>Run KM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activitiesList.map((log) => {
                        const runKm = (log.kmAfter || 0) - (log.kmBefore || 0);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">{new Date(log.createdAt!).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs font-mono">{log.tripId?.substring(0, 8)}...</TableCell>
                            <TableCell className="text-xs">{log.kmBefore} KM / {log.kmAfter} KM</TableCell>
                            <TableCell className="text-xs font-bold">{runKm} KM</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </div>
        )}

      </div>

      {/* Mileage Form Dialog */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Log Mileage & Trip Activity</DialogTitle>
            <DialogDescription>
              Record odometer readings before and after completion of transit runs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Completed Trip *</label>
              <Select onValueChange={setSelectedTripId} value={selectedTripId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose dispatch run" />
                </SelectTrigger>
                <SelectContent>
                  {driverTrips?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.tripNumber} ({t.route})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">KM Before Run *</label>
                <Input 
                  type="number" 
                  value={kmBefore} 
                  onChange={(e) => setKmBefore(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">KM After Run *</label>
                <Input 
                  type="number" 
                  value={kmAfter} 
                  onChange={(e) => setKmAfter(e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Route/Activity Notes</label>
              <Textarea 
                value={activityNotes} 
                onChange={(e) => setActivityNotes(e.target.value)} 
                placeholder="Log refueling, tire changes or other trip notes..."
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsActivityDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => recordActivityMutation.mutate({
                driverId: selectedDriverId,
                tripId: selectedTripId,
                kmBefore: parseInt(kmBefore) || 0,
                kmAfter: parseInt(kmAfter) || 0,
                notes: activityNotes,
              })}
              disabled={!selectedTripId || !kmBefore || !kmAfter || recordActivityMutation.isPending}
            >
              {recordActivityMutation.isPending ? "Submitting..." : "Save Mileage Logs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
