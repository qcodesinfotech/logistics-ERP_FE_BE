import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Clock, DollarSign, FileText, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { CurrencyDisplay } from "@/components/currency-display";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DriverManagementPage() {
  const [activeTab, setActiveTab] = useState("profiles");
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const { toast } = useToast();

  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddDriverOpen(false);
    toast({
      title: "Driver Profile Created",
      description: "The new driver profile has been successfully added to the system.",
    });
  };

  // Mock data for UI development before backend endpoints are fully integrated
  const drivers = [
    { id: "1", name: "Ahmed Al Balushi", packageType: "standard", status: "active", holidayPayRate: "1.5x", baseSalary: "450" },
    { id: "2", name: "John Doe", packageType: "premium", status: "on_leave", holidayPayRate: "2.0x", baseSalary: "500" }
  ];

  const attendance = [
    { id: "1", driverName: "Ahmed Al Balushi", date: "2026-05-22", checkInTime: "08:00 AM", checkOutTime: "06:30 PM", shiftHours: "10.5", overtimeHours: "0.5", autoVerified: true },
    { id: "2", driverName: "John Doe", date: "2026-05-22", checkInTime: "07:00 AM", checkOutTime: "05:00 PM", shiftHours: "10.0", overtimeHours: "0.0", autoVerified: true }
  ];

  const earnings = [
    { id: "1", driverName: "Ahmed Al Balushi", tripId: "TRP-1001", basePay: "15.000", allowances: "5.000", overtimePay: "2.500", holidayPay: "0", totalEarnings: "22.500", status: "pending" },
    { id: "2", driverName: "John Doe", tripId: "TRP-1002", basePay: "20.000", allowances: "10.000", overtimePay: "0", holidayPay: "0", totalEarnings: "30.000", status: "paid" }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Driver Management" 
        description="Advanced tracking for driver profiles, automated attendance, shift rules, and earnings."
      >
        <Dialog open={isAddDriverOpen} onOpenChange={setIsAddDriverOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Users className="h-4 w-4" /> Add Driver Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Driver</DialogTitle>
              <DialogDescription>Create a new driver profile with package rules.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Driver's full name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="package">Package Type</Label>
                <Select defaultValue="standard">
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Package</SelectItem>
                    <SelectItem value="premium">Premium Package</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">Base Salary / Trip Rate</Label>
                  <Input id="salary" type="number" placeholder="0.000" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holiday">Holiday Pay Rate</Label>
                  <Select defaultValue="1.5x">
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0x">1.0x (Standard)</SelectItem>
                      <SelectItem value="1.5x">1.5x (Time and a half)</SelectItem>
                      <SelectItem value="2.0x">2.0x (Double time)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDriverOpen(false)}>Cancel</Button>
                <Button type="submit">Create Profile</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <MetricCard
          title="Active Drivers"
          value="42"
          icon={Users}
          description="Drivers currently on shift"
        />
        <MetricCard
          title="Total Overtime"
          value="128 Hrs"
          icon={Clock}
          description="Cumulative OT this month"
        />
        <MetricCard
          title="Avg Shift Duration"
          value="10.2 Hrs"
          icon={CheckCircle}
          description="Default target: 10 Hours"
        />
        <MetricCard
          title="Pending Allowances"
          value="1450"
          isCurrency
          icon={DollarSign}
          description="To be paid this cycle"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border rounded-lg flex flex-wrap">
          <TabsTrigger value="profiles" className="px-4 py-2">Driver Profiles</TabsTrigger>
          <TabsTrigger value="attendance" className="px-4 py-2">Attendance & Hours</TabsTrigger>
          <TabsTrigger value="earnings" className="px-4 py-2">Salary & Allowances</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle>Driver Profiles & Compliance</CardTitle>
              <CardDescription>Manage driver contracts, documents, and special condition rules (like holiday pay).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Package Type</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Holiday Pay Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-semibold">{driver.name}</TableCell>
                      <TableCell className="capitalize text-xs font-mono">{driver.packageType}</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={driver.baseSalary} /></TableCell>
                      <TableCell className="font-mono text-xs">{driver.holidayPayRate}</TableCell>
                      <TableCell><StatusBadge status={driver.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle>Automated Attendance Tracker</CardTitle>
              <CardDescription>Mobile-verified check-ins with geo-location validation and shift-based OT calculation.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead className="text-right">Shift Hours</TableHead>
                    <TableHead className="text-right">OT Hours</TableHead>
                    <TableHead>Verification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((log) => (
                    <TableRow key={log.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-semibold">{log.driverName}</TableCell>
                      <TableCell className="text-xs font-mono">{log.date}</TableCell>
                      <TableCell className="text-xs font-mono">{log.checkInTime}</TableCell>
                      <TableCell className="text-xs font-mono">{log.checkOutTime}</TableCell>
                      <TableCell className="text-right font-mono">{log.shiftHours}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600">{log.overtimeHours}</TableCell>
                      <TableCell>
                        {log.autoVerified ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <MapPin className="h-3 w-3" /> GPS Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-xs">
                            <AlertCircle className="h-3 w-3" /> Manual
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle>Trip Earnings & Zone Allowances</CardTitle>
              <CardDescription>Calculated pay including base trips, zone allowances, OT, and special conditions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Trip Ref</TableHead>
                    <TableHead className="text-right">Base Pay</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">OT Pay</TableHead>
                    <TableHead className="text-right">Holiday Pay</TableHead>
                    <TableHead className="text-right font-bold">Total Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((earn) => (
                    <TableRow key={earn.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-semibold">{earn.driverName}</TableCell>
                      <TableCell className="text-xs font-mono">{earn.tripId}</TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={earn.basePay} /></TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={earn.allowances} /></TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={earn.overtimePay} /></TableCell>
                      <TableCell className="text-right"><CurrencyDisplay amount={earn.holidayPay} /></TableCell>
                      <TableCell className="text-right font-bold text-primary"><CurrencyDisplay amount={earn.totalEarnings} /></TableCell>
                      <TableCell><StatusBadge status={earn.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
