import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, UserCheck, Target, Phone, Mail, Calendar, TrendingUp, Users, DollarSign, Bell, CheckSquare, Clock, MessageSquare } from "lucide-react";
import type { CrmLead, CrmDeal, CrmActivity, CrmTask, CrmReminder, CrmLeadNote, CrmCalendarEvent, Employee } from "@shared/schema";

const formatCurrency = (value: string | number | null | undefined) => {
  const num = parseFloat(String(value || "0"));
  return `${num.toFixed(3)} BD`;
};

const leadStatusColors: Record<string, string> = {
  new: "bg-blue-500",
  contacted: "bg-yellow-500",
  qualified: "bg-green-500",
  disqualified: "bg-red-500",
};

const dealStageColors: Record<string, string> = {
  prospecting: "bg-gray-500",
  proposal: "bg-blue-500",
  negotiation: "bg-yellow-500",
  won: "bg-green-500",
  lost: "bg-red-500",
};

const activityTypeIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: Target,
};

export default function CRM() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("leads");
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [leadForm, setLeadForm] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    source: "",
    assignedTo: "",
    notes: "",
  });

  const [dealForm, setDealForm] = useState({
    leadId: "",
    customerId: "",
    title: "",
    estimatedValue: "0",
    expectedCloseDate: "",
    stage: "prospecting",
    probability: "25",
    assignedTo: "",
    notes: "",
  });

  const [activityForm, setActivityForm] = useState({
    leadId: "",
    dealId: "",
    customerId: "",
    type: "call",
    subject: "",
    description: "",
    outcome: "",
    nextFollowUpDate: "",
  });

  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    leadId: "",
    dealId: "",
    customerId: "",
    assignedTo: "",
    dueDate: "",
    priority: "medium",
    status: "pending",
  });

  const [reminderForm, setReminderForm] = useState({
    title: "",
    description: "",
    reminderType: "follow_up",
    reminderDate: "",
    leadId: "",
    dealId: "",
    customerId: "",
    assignedTo: "",
    status: "pending",
  });

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    eventType: "meeting",
    startTime: "",
    endTime: "",
    allDay: false,
    location: "",
    leadId: "",
    dealId: "",
    customerId: "",
    assignedTo: "",
    status: "scheduled",
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<CrmLead[]>({
    queryKey: ["/api/crm/leads"],
  });

  const { data: deals = [], isLoading: dealsLoading } = useQuery<CrmDeal[]>({
    queryKey: ["/api/crm/deals"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<CrmActivity[]>({
    queryKey: ["/api/crm/activities"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/crm/stats"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<CrmTask[]>({
    queryKey: ["/api/crm/tasks"],
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery<CrmReminder[]>({
    queryKey: ["/api/crm/reminders"],
  });

  const { data: calendarEvents = [], isLoading: eventsLoading } = useQuery<CrmCalendarEvent[]>({
    queryKey: ["/api/crm/calendar-events"],
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) => {
      return apiRequest("POST", "/api/crm/calendar-events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar-events"] });
      toast({ title: "Event created successfully" });
      resetEventForm();
      setShowEventDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof eventForm> }) => {
      return apiRequest("PATCH", `/api/crm/calendar-events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar-events"] });
      toast({ title: "Event updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/crm/calendar-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar-events"] });
      toast({ title: "Event deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskForm) => {
      return apiRequest("POST", "/api/crm/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({ title: "Task created successfully" });
      resetTaskForm();
      setShowTaskDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof taskForm> }) => {
      return apiRequest("PATCH", `/api/crm/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({ title: "Task updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/crm/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: typeof reminderForm) => {
      return apiRequest("POST", "/api/crm/reminders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/reminders"] });
      toast({ title: "Reminder created successfully" });
      resetReminderForm();
      setShowReminderDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof reminderForm> }) => {
      return apiRequest("PATCH", `/api/crm/reminders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/reminders"] });
      toast({ title: "Reminder updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/crm/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/reminders"] });
      toast({ title: "Reminder deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: typeof leadForm) => {
      return apiRequest("POST", "/api/crm/leads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Lead created successfully" });
      resetLeadForm();
      setShowLeadDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof leadForm }) => {
      return apiRequest("PATCH", `/api/crm/leads/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Lead updated successfully" });
      resetLeadForm();
      setShowLeadDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/crm/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Lead deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const convertLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/crm/leads/${id}/convert`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Lead converted to customer successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to convert lead", variant: "destructive" });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: typeof dealForm) => {
      return apiRequest("POST", "/api/crm/deals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Deal created successfully" });
      resetDealForm();
      setShowDealDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof dealForm }) => {
      return apiRequest("PATCH", `/api/crm/deals/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Deal updated successfully" });
      resetDealForm();
      setShowDealDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/crm/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Deal deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: typeof activityForm) => {
      return apiRequest("POST", "/api/crm/activities", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Activity logged successfully" });
      resetActivityForm();
      setShowActivityDialog(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/crm/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Activity deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const resetLeadForm = () => {
    setLeadForm({
      name: "",
      companyName: "",
      email: "",
      phone: "",
      source: "",
      assignedTo: "",
      notes: "",
    });
    setSelectedLead(null);
    setIsEditMode(false);
  };

  const resetDealForm = () => {
    setDealForm({
      leadId: "",
      customerId: "",
      title: "",
      estimatedValue: "0",
      expectedCloseDate: "",
      stage: "prospecting",
      probability: "25",
      assignedTo: "",
      notes: "",
    });
    setSelectedDeal(null);
    setIsEditMode(false);
  };

  const resetActivityForm = () => {
    setActivityForm({
      leadId: "",
      dealId: "",
      customerId: "",
      type: "call",
      subject: "",
      description: "",
      outcome: "",
      nextFollowUpDate: "",
    });
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      leadId: "",
      dealId: "",
      customerId: "",
      assignedTo: "",
      dueDate: "",
      priority: "medium",
      status: "pending",
    });
  };

  const resetReminderForm = () => {
    setReminderForm({
      title: "",
      description: "",
      reminderType: "follow_up",
      reminderDate: "",
      leadId: "",
      dealId: "",
      customerId: "",
      assignedTo: "",
      status: "pending",
    });
  };

  const resetEventForm = () => {
    setEventForm({
      title: "",
      description: "",
      eventType: "meeting",
      startTime: "",
      endTime: "",
      allDay: false,
      location: "",
      leadId: "",
      dealId: "",
      customerId: "",
      assignedTo: "",
      status: "scheduled",
    });
  };

  const openEditLead = (lead: CrmLead) => {
    setSelectedLead(lead);
    setLeadForm({
      name: lead.name,
      companyName: lead.companyName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "",
      assignedTo: lead.assignedTo || "",
      notes: lead.notes || "",
    });
    setIsEditMode(true);
    setShowLeadDialog(true);
  };

  const openEditDeal = (deal: CrmDeal) => {
    setSelectedDeal(deal);
    setDealForm({
      leadId: deal.leadId || "",
      customerId: deal.customerId || "",
      title: deal.title,
      estimatedValue: deal.estimatedValue || "0",
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split("T")[0] : "",
      stage: deal.stage,
      probability: String(deal.probability || 25),
      assignedTo: deal.assignedTo || "",
      notes: deal.notes || "",
    });
    setIsEditMode(true);
    setShowDealDialog(true);
  };

  const handleSubmitLead = () => {
    if (isEditMode && selectedLead) {
      updateLeadMutation.mutate({ id: selectedLead.id, data: leadForm });
    } else {
      createLeadMutation.mutate(leadForm);
    }
  };

  const handleSubmitDeal = () => {
    const submitData = {
      ...dealForm,
      probability: parseInt(dealForm.probability) || 25,
      expectedCloseDate: dealForm.expectedCloseDate || undefined,
    };
    if (isEditMode && selectedDeal) {
      updateDealMutation.mutate({ id: selectedDeal.id, data: submitData as any });
    } else {
      createDealMutation.mutate(submitData as any);
    }
  };

  const handleSubmitActivity = () => {
    const submitData = {
      ...activityForm,
      nextFollowUpDate: activityForm.nextFollowUpDate || undefined,
      leadId: activityForm.leadId || undefined,
      dealId: activityForm.dealId || undefined,
      customerId: activityForm.customerId || undefined,
    };
    createActivityMutation.mutate(submitData as any);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground">Manage leads, deals, and customer relationships</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.convertedLeads || 0} converted ({stats?.conversionRate || 0}%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDeals || 0}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(stats?.pipelineValue)}</div>
            <p className="text-xs text-muted-foreground">Potential revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatCurrency(stats?.wonValue)}</div>
            <p className="text-xs text-muted-foreground">Closed deals</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showLeadDialog} onOpenChange={(open) => { setShowLeadDialog(open); if (!open) resetLeadForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Edit Lead" : "Add New Lead"}</DialogTitle>
                  <DialogDescription>Enter lead contact information</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Contact Name *</Label>
                    <Input
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Company Name</Label>
                    <Input
                      value={leadForm.companyName}
                      onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })}
                      placeholder="ABC Company"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Phone</Label>
                      <Input
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                        placeholder="+968 1234 5678"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Source</Label>
                      <Select value={leadForm.source} onValueChange={(v) => setLeadForm({ ...leadForm, source: v })}>
                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="advertisement">Advertisement</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Assigned To</Label>
                      <Select value={leadForm.assignedTo} onValueChange={(v) => setLeadForm({ ...leadForm, assignedTo: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={leadForm.notes}
                      onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowLeadDialog(false); resetLeadForm(); }}>Cancel</Button>
                  <Button onClick={handleSubmitLead} disabled={!leadForm.name}>
                    {isEditMode ? "Update" : "Create"} Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No leads yet</TableCell></TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.companyName || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lead.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</div>}
                          {lead.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{lead.source?.replace("_", " ") || "-"}</TableCell>
                      <TableCell>
                        <Badge className={leadStatusColors[lead.status || "new"]}>{lead.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!lead.convertedToCustomerId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => convertLeadMutation.mutate(lead.id)}
                              title="Convert to Customer"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openEditLead(lead)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteLeadMutation.mutate(lead.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showDealDialog} onOpenChange={(open) => { setShowDealDialog(open); if (!open) resetDealForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Deal</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Edit Deal" : "Add New Deal"}</DialogTitle>
                  <DialogDescription>Track a sales opportunity</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Deal Title *</Label>
                    <Input
                      value={dealForm.title}
                      onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
                      placeholder="New software implementation"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Estimated Value (BD)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={dealForm.estimatedValue}
                        onChange={(e) => setDealForm({ ...dealForm, estimatedValue: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Expected Close Date</Label>
                      <Input
                        type="date"
                        value={dealForm.expectedCloseDate}
                        onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Stage</Label>
                      <Select value={dealForm.stage} onValueChange={(v) => setDealForm({ ...dealForm, stage: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prospecting">Prospecting</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Probability (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={dealForm.probability}
                        onChange={(e) => setDealForm({ ...dealForm, probability: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Related Lead</Label>
                    <Select value={dealForm.leadId} onValueChange={(v) => setDealForm({ ...dealForm, leadId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select lead (optional)" /></SelectTrigger>
                      <SelectContent>
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>{lead.name} {lead.companyName ? `(${lead.companyName})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Assigned To</Label>
                    <Select value={dealForm.assignedTo} onValueChange={(v) => setDealForm({ ...dealForm, assignedTo: v })}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={dealForm.notes}
                      onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })}
                      placeholder="Deal notes..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowDealDialog(false); resetDealForm(); }}>Cancel</Button>
                  <Button onClick={handleSubmitDeal} disabled={!dealForm.title}>
                    {isEditMode ? "Update" : "Create"} Deal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Expected Close</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                ) : deals.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No deals yet</TableCell></TableRow>
                ) : (
                  deals.map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium">{deal.title}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(deal.estimatedValue)}</TableCell>
                      <TableCell>
                        <Badge className={dealStageColors[deal.stage]}>{deal.stage}</Badge>
                      </TableCell>
                      <TableCell>{deal.probability}%</TableCell>
                      <TableCell>
                        {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditDeal(deal)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteDealMutation.mutate(deal.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Log Activity</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Log Activity</DialogTitle>
                  <DialogDescription>Record a call, email, meeting, or note</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Activity Type *</Label>
                    <Select value={activityForm.type} onValueChange={(v) => setActivityForm({ ...activityForm, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Subject *</Label>
                    <Input
                      value={activityForm.subject}
                      onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                      placeholder="Activity subject"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Related Lead</Label>
                      <Select value={activityForm.leadId} onValueChange={(v) => setActivityForm({ ...activityForm, leadId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Related Deal</Label>
                      <Select value={activityForm.dealId} onValueChange={(v) => setActivityForm({ ...activityForm, dealId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select deal" /></SelectTrigger>
                        <SelectContent>
                          {deals.map((deal) => (
                            <SelectItem key={deal.id} value={deal.id}>{deal.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                      placeholder="Activity details..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Outcome</Label>
                      <Input
                        value={activityForm.outcome}
                        onChange={(e) => setActivityForm({ ...activityForm, outcome: e.target.value })}
                        placeholder="Result of activity"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Next Follow-up</Label>
                      <Input
                        type="date"
                        value={activityForm.nextFollowUpDate}
                        onChange={(e) => setActivityForm({ ...activityForm, nextFollowUpDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowActivityDialog(false); resetActivityForm(); }}>Cancel</Button>
                  <Button onClick={handleSubmitActivity} disabled={!activityForm.subject || !activityForm.type}>
                    Log Activity
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activitiesLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                ) : activities.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No activities yet</TableCell></TableRow>
                ) : (
                  activities.map((activity) => {
                    const Icon = activityTypeIcons[activity.type] || Target;
                    return (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="capitalize">{activity.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{activity.subject}</TableCell>
                        <TableCell className="max-w-xs truncate">{activity.description || "-"}</TableCell>
                        <TableCell>
                          {activity.activityDate ? new Date(activity.activityDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>{activity.outcome || "-"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => deleteActivityMutation.mutate(activity.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showTaskDialog} onOpenChange={(open) => { setShowTaskDialog(open); if (!open) resetTaskForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Task</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>Add a new CRM task</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Title *</Label>
                    <Input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      placeholder="Task title"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={taskForm.description}
                      onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      placeholder="Task details..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Priority</Label>
                      <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Assigned To</Label>
                      <Select value={taskForm.assignedTo} onValueChange={(v) => setTaskForm({ ...taskForm, assignedTo: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Related Lead</Label>
                      <Select value={taskForm.leadId} onValueChange={(v) => setTaskForm({ ...taskForm, leadId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowTaskDialog(false); resetTaskForm(); }}>Cancel</Button>
                  <Button onClick={() => createTaskMutation.mutate(taskForm)} disabled={!taskForm.title}>
                    Create Task
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No tasks yet</TableCell></TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge className={task.priority === "urgent" ? "bg-red-500" : task.priority === "high" ? "bg-orange-500" : task.priority === "medium" ? "bg-yellow-500" : "bg-gray-500"}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={task.status} 
                          onValueChange={(v) => updateTaskMutation.mutate({ id: task.id, data: { status: v } })}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{employees.find(e => e.id === task.assignedTo)?.name || "-"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteTaskMutation.mutate(task.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showEventDialog} onOpenChange={(open) => { setShowEventDialog(open); if (!open) resetEventForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Event</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Event</DialogTitle>
                  <DialogDescription>Schedule a new calendar event</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Title *</Label>
                    <Input
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      placeholder="Event title"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Event Type</Label>
                      <Select value={eventForm.eventType} onValueChange={(v) => setEventForm({ ...eventForm, eventType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Location</Label>
                      <Input
                        value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                        placeholder="Event location"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Start Time *</Label>
                      <Input
                        type="datetime-local"
                        value={eventForm.startTime}
                        onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>End Time</Label>
                      <Input
                        type="datetime-local"
                        value={eventForm.endTime}
                        onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      placeholder="Event details..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Assigned To</Label>
                      <Select value={eventForm.assignedTo} onValueChange={(v) => setEventForm({ ...eventForm, assignedTo: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Related Lead</Label>
                      <Select value={eventForm.leadId} onValueChange={(v) => setEventForm({ ...eventForm, leadId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowEventDialog(false); resetEventForm(); }}>Cancel</Button>
                  <Button onClick={() => createEventMutation.mutate(eventForm)} disabled={!eventForm.title || !eventForm.startTime}>
                    Create Event
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>View and manage your scheduled events, meetings, and follow-ups</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
                  ) : calendarEvents.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No events scheduled</TableCell></TableRow>
                  ) : (
                    calendarEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.title}</TableCell>
                        <TableCell className="capitalize">{event.eventType?.replace("_", " ")}</TableCell>
                        <TableCell>{event.startTime ? new Date(event.startTime).toLocaleString() : "-"}</TableCell>
                        <TableCell>{event.location || "-"}</TableCell>
                        <TableCell>
                          <Select 
                            value={event.status} 
                            onValueChange={(v) => updateEventMutation.mutate({ id: event.id, data: { status: v } })}
                          >
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                              <SelectItem value="missed">Missed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{employees.find(e => e.id === event.assignedTo)?.name || "-"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => deleteEventMutation.mutate(event.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showReminderDialog} onOpenChange={(open) => { setShowReminderDialog(open); if (!open) resetReminderForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Reminder</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Reminder</DialogTitle>
                  <DialogDescription>Set a reminder for yourself</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Title *</Label>
                    <Input
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                      placeholder="Reminder title"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={reminderForm.description}
                      onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                      placeholder="Reminder details..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Type</Label>
                      <Select value={reminderForm.reminderType} onValueChange={(v) => setReminderForm({ ...reminderForm, reminderType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Reminder Date *</Label>
                      <Input
                        type="datetime-local"
                        value={reminderForm.reminderDate}
                        onChange={(e) => setReminderForm({ ...reminderForm, reminderDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Assigned To</Label>
                      <Select value={reminderForm.assignedTo} onValueChange={(v) => setReminderForm({ ...reminderForm, assignedTo: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Related Lead</Label>
                      <Select value={reminderForm.leadId} onValueChange={(v) => setReminderForm({ ...reminderForm, leadId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowReminderDialog(false); resetReminderForm(); }}>Cancel</Button>
                  <Button onClick={() => createReminderMutation.mutate(reminderForm)} disabled={!reminderForm.title || !reminderForm.reminderDate}>
                    Create Reminder
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remindersLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
                ) : reminders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No reminders yet</TableCell></TableRow>
                ) : (
                  reminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell className="font-medium">{reminder.title}</TableCell>
                      <TableCell className="capitalize">{reminder.reminderType?.replace("_", " ")}</TableCell>
                      <TableCell>{reminder.reminderDate ? new Date(reminder.reminderDate).toLocaleString() : "-"}</TableCell>
                      <TableCell>
                        <Select 
                          value={reminder.status} 
                          onValueChange={(v) => updateReminderMutation.mutate({ id: reminder.id, data: { status: v } })}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="acknowledged">Acknowledged</SelectItem>
                            <SelectItem value="dismissed">Dismissed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{employees.find(e => e.id === reminder.assignedTo)?.name || "-"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => deleteReminderMutation.mutate(reminder.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
