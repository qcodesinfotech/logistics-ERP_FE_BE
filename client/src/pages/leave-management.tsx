import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Check, X, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import type { LeaveType, LeaveRequest, Employee } from "@shared/schema";

export default function LeaveManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [reviewData, setReviewData] = useState({
    approvedPaidDays: "0",
    approvedUnpaidDays: "0",
    remarks: "",
  });

  const [newType, setNewType] = useState({
    name: "",
    description: "",
    daysPerYear: 0,
    isPaid: true,
    carryForward: false,
    maxCarryForward: 0,
  });
  const [newRequest, setNewRequest] = useState({
    employeeId: "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    totalDays: "1",
    reason: "",
    coveringEmployeeId: "",
    isHalfDay: false,
    halfDayPeriod: "morning",
  });
  const [coveringSearchOpen, setCoveringSearchOpen] = useState(false);

  // Calculate total days when start or end date changes
  useEffect(() => {
    if (newRequest.isHalfDay) {
      setNewRequest(prev => ({ 
        ...prev, 
        totalDays: "0.5",
        endDate: prev.startDate 
      }));
    } else if (newRequest.startDate && newRequest.endDate) {
      const start = new Date(newRequest.startDate);
      const end = new Date(newRequest.endDate);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        // Calculate difference in milliseconds
        const diffTime = Math.abs(end.getTime() - start.getTime());
        // Convert to days and add 1 (inclusive of start and end date)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setNewRequest(prev => ({ ...prev, totalDays: diffDays.toString() }));
      } else {
        setNewRequest(prev => ({ ...prev, totalDays: "0" }));
      }
    }
  }, [newRequest.startDate, newRequest.endDate, newRequest.isHalfDay]);

  const { data: leaveTypes = [], isLoading: typesLoading } = useQuery<LeaveType[]>({
    queryKey: ["/api/leave-types"],
  });

  const { data: leaveRequests = [], isLoading: requestsLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: accruedLeave } = useQuery({
    queryKey: ["/api/leave/accrual", selectedRequest?.employeeId],
    queryFn: async () => {
      if (!selectedRequest?.employeeId) return null;
      const res = await apiRequest("GET", `/api/leave/accrual/${selectedRequest.employeeId}`);
      return res.json();
    },
    enabled: !!selectedRequest?.employeeId && showReviewDialog,
  });

  const createTypeMutation = useMutation({
    mutationFn: async (data: typeof newType) => {
      return apiRequest("POST", "/api/leave-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-types"] });
      setShowTypeDialog(false);
      setNewType({ name: "", description: "", daysPerYear: 0, isPaid: true, carryForward: false, maxCarryForward: 0 });
      toast({ title: "Leave type created successfully" });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: typeof newRequest) => {
      return apiRequest("POST", "/api/leave-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      setShowRequestDialog(false);
      setNewRequest({ 
        employeeId: (user?.role === "admin" || user?.role === "super_admin") ? "" : (user?.employeeId || ""), 
        leaveTypeId: "", 
        startDate: new Date().toISOString().split('T')[0], 
        endDate: new Date().toISOString().split('T')[0], 
        totalDays: "1", 
        reason: "",
        coveringEmployeeId: "",
        isHalfDay: false,
        halfDayPeriod: "morning",
      });
      toast({ title: "Leave request created successfully" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, paidDays, unpaidDays, remarks, approvedById }: { id: string; paidDays: string; unpaidDays: string; remarks: string; approvedById: string }) => {
      return apiRequest("POST", `/api/leave-requests/${id}/approve`, { 
        approvedById,
        approvedPaidDays: paidDays,
        approvedUnpaidDays: unpaidDays,
        comments: remarks
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      setShowReviewDialog(false);
      setSelectedRequest(null);
      toast({ title: "Leave request approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/leave-requests/${id}/reject`, { comments: "Rejected" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      toast({ title: "Leave request rejected" });
    },
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp?.name || "Unknown";
  };

  const getLeaveTypeName = (id: string) => {
    const type = leaveTypes.find(t => t.id === id);
    return type?.name || "Unknown";
  };

  const handleReviewClick = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setReviewData({
      approvedPaidDays: request.totalDays.toString(),
      approvedUnpaidDays: "0",
      remarks: "",
    });
    setShowReviewDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Leave Management</h1>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-leave-type">
                <Plus className="w-4 h-4 mr-2" />
                New Leave Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Leave Type</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    data-testid="input-type-name"
                    value={newType.name}
                    onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                    placeholder="e.g., Annual Leave"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    data-testid="input-type-description"
                    value={newType.description}
                    onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Days Per Year</Label>
                  <Input
                    type="number"
                    data-testid="input-days-per-year"
                    value={newType.daysPerYear}
                    onChange={(e) => setNewType({ ...newType, daysPerYear: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newType.isPaid}
                      onChange={(e) => setNewType({ ...newType, isPaid: e.target.checked })}
                    />
                    <span>Paid Leave</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newType.carryForward}
                      onChange={(e) => setNewType({ ...newType, carryForward: e.target.checked })}
                    />
                    <span>Carry Forward</span>
                  </label>
                </div>
                <Button
                  data-testid="button-save-type"
                  onClick={() => createTypeMutation.mutate(newType)}
                  disabled={createTypeMutation.isPending || !newType.name}
                  className="w-full"
                >
                  Create Leave Type
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
            <DialogTrigger asChild>
              <Button 
                data-testid="button-add-request"
                onClick={() => {
                  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
                  setNewRequest(prev => ({
                    ...prev,
                    employeeId: isAdmin ? "" : (user?.employeeId || ""),
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0],
                  }));
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Leave Request
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Leave Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={newRequest.employeeId}
                    onValueChange={(value) => setNewRequest({ ...newRequest, employeeId: value })}
                    disabled={user?.role !== "admin" && user?.role !== "super_admin"}
                  >
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select
                    value={newRequest.leaveTypeId}
                    onValueChange={(value) => setNewRequest({ ...newRequest, leaveTypeId: value })}
                  >
                    <SelectTrigger data-testid="select-leave-type">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      data-testid="input-start-date"
                      min={new Date().toISOString().split('T')[0]}
                      value={newRequest.startDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setNewRequest(prev => {
                          const update: any = { ...prev, startDate: newStart };
                          if (prev.endDate && newStart > prev.endDate) {
                            update.endDate = newStart;
                          }
                          return update;
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      data-testid="input-end-date"
                      min={newRequest.startDate || new Date().toISOString().split('T')[0]}
                      value={newRequest.endDate}
                      onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                      disabled={newRequest.isHalfDay}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Total Days</Label>
                  <Input
                    type="number"
                    step="0.5"
                    data-testid="input-total-days"
                    value={newRequest.totalDays}
                    onChange={(e) => setNewRequest({ ...newRequest, totalDays: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    data-testid="input-reason"
                    value={newRequest.reason}
                    onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                    placeholder="Reason for leave"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Covering Employee (Optional)</Label>
                  <Popover open={coveringSearchOpen} onOpenChange={setCoveringSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={coveringSearchOpen}
                        className="w-full justify-between"
                      >
                        {newRequest.coveringEmployeeId
                          ? employees.find((emp) => emp.id === newRequest.coveringEmployeeId)?.name
                          : "Select covering employee..."}
                        <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search employee..." />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employees.map((emp) => (
                              <CommandItem
                                key={emp.id}
                                value={emp.name}
                                onSelect={() => {
                                  setNewRequest({ ...newRequest, coveringEmployeeId: emp.id });
                                  setCoveringSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    newRequest.coveringEmployeeId === emp.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {emp.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="isHalfDay" 
                      checked={newRequest.isHalfDay}
                      onCheckedChange={(checked) => {
                        const isHalfDay = !!checked;
                        setNewRequest(prev => ({ 
                          ...prev, 
                          isHalfDay,
                          endDate: isHalfDay ? prev.startDate : prev.endDate,
                          totalDays: isHalfDay ? "0.5" : prev.totalDays
                        }));
                      }}
                    />
                    <label
                      htmlFor="isHalfDay"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Half Day Leave
                    </label>
                  </div>

                  {newRequest.isHalfDay && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label>Half Day Period</Label>
                      <Select
                        value={newRequest.halfDayPeriod}
                        onValueChange={(value) => setNewRequest({ ...newRequest, halfDayPeriod: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <Button
                  data-testid="button-save-request"
                  onClick={() => createRequestMutation.mutate(newRequest)}
                  disabled={createRequestMutation.isPending || !newRequest.employeeId || !newRequest.leaveTypeId}
                  className="w-full"
                >
                  Submit Leave Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Review Leave Request</DialogTitle>
              </DialogHeader>
              {selectedRequest && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Employee</span>
                      <span className="font-medium">{getEmployeeName(selectedRequest.employeeId)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Leave Type</span>
                      <span className="font-medium">{getLeaveTypeName(selectedRequest.leaveTypeId)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Requested Days</span>
                      <span className="font-medium">{selectedRequest.totalDays}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Date Range</span>
                      <span className="font-medium">{selectedRequest.startDate} to {selectedRequest.endDate}</span>
                    </div>
                  </div>

                  {accruedLeave && (
                    <div className="bg-muted p-3 rounded-lg border">
                      <h4 className="font-medium text-sm mb-2 text-primary flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Accrual Dashboard
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-sm text-center">
                        <div>
                          <span className="block text-muted-foreground text-xs">Accrued</span>
                          <span className="font-medium">{accruedLeave.accruedDays}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground text-xs">Used (Paid)</span>
                          <span className="font-medium text-destructive">{accruedLeave.usedPaidDays}</span>
                        </div>
                        <div>
                          <span className="block text-muted-foreground text-xs">Balance</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{accruedLeave.balance}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm">Approval Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Paid Days</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={reviewData.approvedPaidDays}
                          onChange={(e) => setReviewData({ ...reviewData, approvedPaidDays: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unpaid Days</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={reviewData.approvedUnpaidDays}
                          onChange={(e) => setReviewData({ ...reviewData, approvedUnpaidDays: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg text-sm flex justify-between items-center mt-4">
                      <span className="text-blue-800 dark:text-blue-200">Total days to approve:</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100">
                        {parseFloat(reviewData.approvedPaidDays || "0") + parseFloat(reviewData.approvedUnpaidDays || "0")}
                      </span>
                    </div>

                    <div className="space-y-2 mt-4">
                      <Label>Remarks/Comments</Label>
                      <Input
                        value={reviewData.remarks}
                        onChange={(e) => setReviewData({ ...reviewData, remarks: e.target.value })}
                        placeholder="Optional remarks"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({
                        id: selectedRequest.id,
                        paidDays: reviewData.approvedPaidDays,
                        unpaidDays: reviewData.approvedUnpaidDays,
                        remarks: reviewData.remarks,
                        approvedById: user?.id || "system"
                      })}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests" data-testid="tab-requests">
            <Calendar className="w-4 h-4 mr-2" />
            Leave Requests
          </TabsTrigger>
          <TabsTrigger value="types" data-testid="tab-types">
            <Users className="w-4 h-4 mr-2" />
            Leave Types
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
              ) : leaveRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave requests found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Covering Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell>{getEmployeeName(request.employeeId)}</TableCell>
                        <TableCell>{getLeaveTypeName(request.leaveTypeId)}</TableCell>
                        <TableCell>{request.startDate}</TableCell>
                        <TableCell>{request.endDate}</TableCell>
                        <TableCell>
                          {request.totalDays}
                          {request.isHalfDay && (
                            <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                              ({request.halfDayPeriod})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {request.coveringEmployeeId 
                            ? getEmployeeName(request.coveringEmployeeId)
                            : <span className="text-muted-foreground text-xs">None</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[request.status] || ""}>
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800"
                                data-testid={`button-review-${request.id}`}
                                onClick={() => handleReviewClick(request)}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Review & Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800"
                                data-testid={`button-reject-${request.id}`}
                                onClick={() => rejectMutation.mutate(request.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leave Types</CardTitle>
            </CardHeader>
            <CardContent>
              {typesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading leave types...</div>
              ) : leaveTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave types found. Create your first leave type to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Days/Year</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Carry Forward</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveTypes.map((type) => (
                      <TableRow key={type.id} data-testid={`row-type-${type.id}`}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>{type.description || "-"}</TableCell>
                        <TableCell>{type.daysPerYear}</TableCell>
                        <TableCell>
                          {type.isPaid ? (
                            <Badge className="bg-green-100 text-green-800">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {type.carryForward ? (
                            <Badge className="bg-blue-100 text-blue-800">Yes ({type.maxCarryForward} days)</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
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
    </div>
  );
}
