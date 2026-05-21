import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Clock, Edit, Eye, Trash, Play, Pause, StopCircle, RotateCcw, Download, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X as CloseX } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAuthToken } from "@/lib/queryClient";
import type { Task, Project, Employee, TaskAttachment } from "@shared/schema";

export default function Tasks() {
  const { toast } = useToast();
  
  const [isTaskWizardOpen, setIsTaskWizardOpen] = useState(false);
  const [taskWizardStep, setTaskWizardStep] = useState(1);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const [isManualHoursOpen, setIsManualHoursOpen] = useState(false);
  const [manualHoursTask, setManualHoursTask] = useState<Task | null>(null);
  const [manualHours, setManualHours] = useState("");
  
  const [isViewTaskOpen, setIsViewTaskOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [tick, setTick] = useState(0);

  const [taskForm, setTaskForm] = useState({
    title: "",
    project_id: "none",
    is_billable: true,
    description: "",
    estimated_hours: "00:00",
    attachment: null as File | null,
    emp_id: [] as string[],
    from_date_time: "",
    to_date_time: "",
  });

  const [isTeamPopoverOpen, setIsTeamPopoverOpen] = useState(false);

  const { data: activeTimerSessions = [] } = useQuery<any[]>({
    queryKey: ["/api/active-timers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tasks/all/active-timers");
      return res.json();
    },
  });

  const { data: viewingTaskAttachments = [] } = useQuery<TaskAttachment[]>({
    queryKey: [`/api/tasks/${viewingTask?.id}/attachments`],
    enabled: !!viewingTask?.id,
  });

  useEffect(() => {
    apiRequest("GET", "/api/server-time")
      .then(res => res.json())
      .then(data => {
        const serverTime = new Date(data.time).getTime();
        const clientTime = Date.now();
        setServerTimeOffset(serverTime - clientTime);
      });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees/minimal"],
  });

  const getActiveSessionForTask = (taskId: string) => {
    return (activeTimerSessions as any[]).find(s => s.taskId === taskId);
  };

  const getEmployeeName = (id: string) => employees?.find(e => e.id === id)?.name || id;
  const getProjectName = (id: string) => projects?.find(p => p.id === id)?.name || "Standalone";

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDisplayTime = (t: Task) => {
    const session = getActiveSessionForTask(t.id);
    const baseSeconds = (Number(t.actualHours) || 0) * 3600;

    if (!session) return formatDuration(baseSeconds);

    const now = Date.now() + serverTimeOffset;
    const start = new Date(session.startTime).getTime();
    let elapsed = Math.round((now - start) / 1000) - (session.totalPauseDuration || 0);

    if (session.status === "paused") {
      const pauseStart = new Date(session.lastPauseTime).getTime();
      const currentPause = Math.round((now - pauseStart) / 1000);
      elapsed -= currentPause;
    }

    return formatDuration(baseSeconds + elapsed);
  };

  const createTaskMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const authHeaders: Record<string, string> = {};
      const token = getAuthToken();
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task created successfully" });
      setIsTaskWizardOpen(false);
      setTaskWizardStep(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const taskId = formData.get("id") as string;
      const authHeaders: Record<string, string> = {};
      const token = getAuthToken();
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task updated successfully" });
      setIsTaskWizardOpen(false);
      setTaskWizardStep(1);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/tasks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" })
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] })
  });

  const updateManualHoursMutation = useMutation({
    mutationFn: async ({ id, hours }: { id: string; hours: string }) => {
      await apiRequest("POST", `/api/tasks/${id}/manual-hours`, { hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Hours updated successfully" });
      setIsManualHoursOpen(false);
      setManualHours("");
    }
  });

  const timerMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'pause' | 'resume' | 'stop' }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/timer/${action}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/active-timers"] });
    }
  });

  const handleTaskSubmit = () => {
    if (!taskForm.title.trim()) {
      toast({ title: "Task title is required", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("title", taskForm.title.trim());
    formData.append("description", taskForm.description || "");
    if (taskForm.project_id && taskForm.project_id !== "none") {
      formData.append("project_id", taskForm.project_id);
    }
    formData.append("emp_id", JSON.stringify(taskForm.emp_id));
    formData.append("estimated_hours", taskForm.estimated_hours || "00:00");
    formData.append("from_date_time", taskForm.from_date_time || "");
    formData.append("to_date_time", taskForm.to_date_time || "");
    formData.append("is_billable", String(taskForm.is_billable));

    if (taskForm.attachment) formData.append("attachment", taskForm.attachment);

    if (editingTask) {
      formData.append("id", editingTask.id);
      formData.append("status", editingTask.status);
      updateTaskMutation.mutate(formData);
    } else {
      createTaskMutation.mutate(formData);
    }
  };

  let _taskRowIdx = 0;
  const taskColumns: any[] = [
    { key: "sno", header: "#", render: (_: any) => { _taskRowIdx++; return _taskRowIdx; } },
    {
      key: "title", header: "Tasks", render: (t: Task) => (
        <div className="flex flex-col">
          <span className="font-medium text-blue-600 flex items-center gap-1">{t.title}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{t.projectId ? getProjectName(t.projectId) : 'Standalone'}</span>
        </div>
      )
    },
    {
      key: "employee", header: "Employee", render: (t: Task) => {
        const empIds = t.assigneeId ? t.assigneeId.split(",") : [];
        return (
          <div className="flex items-center gap-2">
            {empIds.length > 0 ? empIds.map(id => (
              <div key={id} className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                  {getEmployeeName(id).charAt(0)}
                </div>
                <span className="text-sm">{getEmployeeName(id)}</span>
              </div>
            )) : <span className="text-gray-400 text-xs italic">Unassigned</span>}
          </div>
        );
      }
    },
    {
      key: "hours", header: "Hours", render: (t: Task) => (
        <div className="flex flex-col">
          <span className="font-bold text-lg tabular-nums">{getDisplayTime(t)}</span>
          <span className="text-[10px] text-gray-400">Est: {Number(t.estimatedHours || 0).toFixed(2)}</span>
        </div>
      )
    },
    {
      key: "status", header: "Status", render: (t: Task) => (
        <Select
          value={t.status || "todo"}
          onValueChange={(val) => updateTaskStatusMutation.mutate({ id: t.id, status: val })}
        >
          <SelectTrigger className="w-32 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">Yet to start</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      )
    },
    {
      key: "action", header: "Action", render: (t: Task) => {
        const session = getActiveSessionForTask(t.id);
        const isStopped = t.status === "completed" || t.status === "cancelled";

        return (
          <div className="flex items-center gap-1">
            {!isStopped && (
              <>
                {!session && (
                  <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => timerMutation.mutate({ id: t.id, action: 'start' })}>
                    <Play className="h-3 w-3 mr-1" /> Start
                  </Button>
                )}
                {session?.status === "running" && (
                  <>
                    <Button variant="default" size="sm" className="bg-orange-500 hover:bg-orange-600 h-8 text-xs" onClick={() => timerMutation.mutate({ id: t.id, action: 'pause' })}>
                      <Pause className="h-3 w-3 mr-1" /> Pause
                    </Button>
                    <Button variant="default" size="sm" className="bg-red-600 hover:bg-red-700 h-8 text-xs" onClick={() => timerMutation.mutate({ id: t.id, action: 'stop' })}>
                      <StopCircle className="h-3 w-3 mr-1" /> Stop
                    </Button>
                  </>
                )}
                {session?.status === "paused" && (
                  <>
                    <Button variant="default" size="sm" className="bg-blue-500 hover:bg-blue-600 h-8 text-xs" onClick={() => timerMutation.mutate({ id: t.id, action: 'resume' })}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Resume
                    </Button>
                    <Button variant="default" size="sm" className="bg-red-600 hover:bg-red-700 h-8 text-xs" onClick={() => timerMutation.mutate({ id: t.id, action: 'stop' })}>
                      <StopCircle className="h-3 w-3 mr-1" /> Stop
                    </Button>
                  </>
                )}
              </>
            )}
            {!isStopped && (
              <Button variant="outline" size="sm" className="h-8 text-xs text-gray-600" onClick={() => { setManualHoursTask(t); setManualHours(""); setIsManualHoursOpen(true); }}>
                <Clock className="h-3 w-3 mr-1" /> Manual
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8 text-orange-500" onClick={() => {
              setEditingTask(t);
              setTaskForm({
                title: t.title,
                project_id: t.projectId || "none",
                is_billable: t.billable ?? true,
                description: t.description || "",
                estimated_hours: t.estimatedHours?.toString() || "00:00",
                attachment: null,
                emp_id: t.assigneeId ? t.assigneeId.split(",") : [],
                from_date_time: t.startDate ? new Date(t.startDate).toISOString().slice(0, 16) : "",
                to_date_time: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : "",
              });
              setTaskWizardStep(1);
              setIsTaskWizardOpen(true);
            }}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-blue-500" onClick={() => { setViewingTask(t); setIsViewTaskOpen(true); }}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-red-500" onClick={() => { if (confirm("Are you sure?")) deleteTaskMutation.mutate(t.id); }}>
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Tasks List" description="Manage all standalone and project-related tasks">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
          setEditingTask(null);
          setTaskForm({ title: "", project_id: "none", is_billable: true, description: "", estimated_hours: "00:00", attachment: null, emp_id: [], from_date_time: "", to_date_time: "" });
          setTaskWizardStep(1);
          setIsTaskWizardOpen(true);
        }}>
          Add Tasks
        </Button>
      </PageHeader>

      <Card className="shadow-sm border-gray-100">
        <DataTable columns={taskColumns} data={tasks || []} getRowKey={(t) => t.id} />
      </Card>

      {/* Task Wizard Dialog */}
      <Dialog open={isTaskWizardOpen} onOpenChange={(open) => { setIsTaskWizardOpen(open); if (!open) setTaskWizardStep(1); }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white">
          <DialogHeader className="p-4 sm:p-6 pb-2 border-b bg-gray-50 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
              <DialogDescription className="text-gray-500 text-sm mt-1 leading-relaxed">Fill in the details for this task. Required fields are marked with an asterisk (*).</DialogDescription>
            </div>
          </DialogHeader>
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto w-full custom-scrollbar">
            {taskWizardStep === 1 ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 w-full">
                <div className="space-y-2 max-w-full">
                  <Label>Project <span className="text-gray-400 text-xs">(Optional)</span></Label>
                  <Select value={taskForm.project_id} onValueChange={v => setTaskForm({ ...taskForm, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Standalone Task (No Project)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Standalone Task --</SelectItem>
                      {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 max-w-full">
                  <Label>Task Title *</Label>
                  <Input placeholder="Enter a descriptive title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
                </div>
                <div className="space-y-2 max-w-full">
                  <Label>Task Team Member</Label>
                  <Popover open={isTeamPopoverOpen} onOpenChange={setIsTeamPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isTeamPopoverOpen}
                        className="w-full justify-between font-normal h-auto min-h-10 py-2"
                      >
                        <div className="flex flex-wrap gap-1">
                          {taskForm.emp_id.length > 0 ? (
                            taskForm.emp_id.map((id) => (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="mr-1 mb-1 font-normal bg-blue-50 text-blue-700 border-blue-100"
                              >
                                {getEmployeeName(id)}
                                <button
                                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setTaskForm(prev => ({ ...prev, emp_id: prev.emp_id.filter(i => i !== id) }));
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={() => setTaskForm(prev => ({ ...prev, emp_id: prev.emp_id.filter(i => i !== id) }))}
                                >
                                  <CloseX className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground">Select team members...</span>
                          )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search employee..." />
                        <CommandEmpty>No employee found.</CommandEmpty>
                        <CommandGroup>
                          <CommandList>
                            {employees?.map((emp) => (
                              <CommandItem
                                key={emp.id}
                                value={emp.name}
                                onSelect={() => {
                                  setTaskForm(prev => {
                                    const isSelected = prev.emp_id.includes(emp.id);
                                    if (isSelected) {
                                      return { ...prev, emp_id: prev.emp_id.filter(id => id !== emp.id) };
                                    }
                                    return { ...prev, emp_id: [...prev.emp_id, emp.id] };
                                  });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    taskForm.emp_id.includes(emp.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {emp.name}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 max-w-full">
                  <Label>Estimated Time (HH:MM)</Label>
                  <Input type="time" value={taskForm.estimated_hours} onChange={e => setTaskForm({ ...taskForm, estimated_hours: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-full">
                  <div className="space-y-2">
                    <Label>Start Date & Time</Label>
                    <Input type="datetime-local" value={taskForm.from_date_time} onChange={e => setTaskForm({ ...taskForm, from_date_time: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date & Time</Label>
                    <Input type="datetime-local" value={taskForm.to_date_time} onChange={e => setTaskForm({ ...taskForm, to_date_time: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2 max-w-full">
                  <Label>Description</Label>
                  <Textarea placeholder="Provide detailed instructions or documentation" className="min-h-[100px] resize-y" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
                <div className="space-y-2 max-w-full">
                  <Label>Attachments</Label>
                  <Input type="file" onChange={e => setTaskForm({ ...taskForm, attachment: e.target.files?.[0] || null })} />
                </div>
                <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded-lg border border-blue-100 max-w-full">
                  <Switch id="is_billable" checked={taskForm.is_billable} onCheckedChange={c => setTaskForm({ ...taskForm, is_billable: c })} />
                  <div><Label htmlFor="is_billable" className="font-semibold text-blue-900 cursor-pointer">Billable Task</Label></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 sm:p-6 border-t bg-gray-50 flex items-center justify-between w-full">
            <div className="flex gap-1">
              <div className={`h-2 w-8 rounded-full ${taskWizardStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`h-2 w-8 rounded-full ${taskWizardStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            </div>
            <div className="flex gap-2">
              {taskWizardStep > 1 && <Button variant="outline" onClick={() => setTaskWizardStep(1)}>Back</Button>}
              {taskWizardStep === 1 ? <Button onClick={() => setTaskWizardStep(2)}>Next Step</Button> : <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleTaskSubmit} disabled={createTaskMutation.isPending || updateTaskMutation.isPending}>{createTaskMutation.isPending || updateTaskMutation.isPending ? "Submitting..." : editingTask ? "Update" : "Submit"}</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Hours Dialog */}
      <Dialog open={isManualHoursOpen} onOpenChange={setIsManualHoursOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Update Manual Hours</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">How many hours did you spend on this task?</p>
            <div className="space-y-2">
              <Label>Time format (e.g. 1.5 for 1h 30m, or 01:30)</Label>
              <Input placeholder="HH:MM or Decimal" value={manualHours} onChange={e => setManualHours(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualHoursOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (manualHoursTask) {
                const parts = manualHours.split(":");
                let hrs = 0;
                if (parts.length === 2) hrs = parseInt(parts[0]) + (parseInt(parts[1]) / 60);
                else hrs = Number(manualHours);
                updateManualHoursMutation.mutate({ id: manualHoursTask.id, hours: hrs.toString() });
              }
            }}>Save Hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={isViewTaskOpen} onOpenChange={setIsViewTaskOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6 py-4">
            {viewingTask && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Title</Label>
                  <div className="text-lg font-bold text-gray-900 flex items-center flex-wrap gap-2">
                    {viewingTask.title}
                    {viewingTask.billable && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                        Billable
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {viewingTask.projectId ? getProjectName(viewingTask.projectId) : 'Standalone Task'}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Description</Label>
                  <div className="text-sm text-gray-700 bg-gray-50/80 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                    {viewingTask.description || "No description provided."}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px] uppercase font-bold">Status</Label>
                    <Badge className={cn(
                      "capitalize w-fit block",
                      viewingTask.status === "completed" ? "bg-green-100 text-green-700" :
                        viewingTask.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                    )}>
                      {(viewingTask.status || "todo").replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px] uppercase font-bold">Time Spent</Label>
                    <div className="text-sm font-mono font-bold text-gray-900">
                      {Number(viewingTask.actualHours || 0).toFixed(2)} hrs
                    </div>
                    <div className="text-[10px] text-gray-500">Est: {Number(viewingTask.estimatedHours || 0).toFixed(2)} hrs</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px] uppercase font-bold">Priority</Label>
                    <div className="text-sm font-medium text-gray-800">Normal</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px] uppercase font-bold">Start Date & Time</Label>
                    <div className="text-sm text-gray-900 font-medium">
                      {viewingTask.startDate ? new Date(viewingTask.startDate).toLocaleString() : "Not set"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px] uppercase font-bold">Due Date & Time</Label>
                    <div className="text-sm text-gray-900 font-medium">
                      {viewingTask.dueDate ? new Date(viewingTask.dueDate).toLocaleString() : "Not set"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Assignees</Label>
                  <div className="flex flex-wrap gap-2">
                    {viewingTask.assigneeId ? viewingTask.assigneeId.split(",").map(id => (
                      <Badge key={id} variant="outline" className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white">
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                          {getEmployeeName(id).charAt(0)}
                        </div>
                        <span className="text-xs">{getEmployeeName(id)}</span>
                      </Badge>
                    )) : <span className="text-sm text-muted-foreground italic">No assignees</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Attachments</Label>
                  {viewingTaskAttachments.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic bg-gray-50/50 p-3 rounded border border-dashed">
                      No attachments found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {viewingTaskAttachments.map(att => (
                        <a
                          key={att.id}
                          href={att.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
                        >
                          <Paperclip className="h-4 w-4 mr-3 text-blue-500 group-hover:scale-110 transition-transform" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                          </div>
                          <Download className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t bg-gray-50/50">
            <Button variant="secondary" onClick={() => setIsViewTaskOpen(false)} className="w-full sm:w-auto">
              Close Detail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
