import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getAuthToken, apiRequest } from "@/lib/queryClient";
import { Project, Task, Employee, ProjectFile, TaskAttachment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { ArrowLeft, Clock, FileText, Download, Trash2, Eye, Play, Edit, Trash, Paperclip, Upload, CheckCircle, Pause, RotateCcw, StopCircle, Search, X, Printer, FilePlus, CreditCard, Check } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/auth-context";
import { useGlobalScope } from "@/contexts/global-scope";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";

type ProjectDetailsProps = {
  projectId: string;
  onBack: () => void;
};

export function ProjectDetails({ projectId, onBack }: ProjectDetailsProps) {
  const { user } = useAuth();
  const { currentCompanyId, currentShopId, currentBranchId } = useGlobalScope();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [isTaskWizardOpen, setIsTaskWizardOpen] = useState(false);
  const [taskWizardStep, setTaskWizardStep] = useState(1);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isManualHoursOpen, setIsManualHoursOpen] = useState(false);
  const [manualHoursTask, setManualHoursTask] = useState<Task | null>(null);
  const [manualHours, setManualHours] = useState("");
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isViewTaskOpen, setIsViewTaskOpen] = useState(false);
  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);
  const [confirmingTransaction, setConfirmingTransaction] = useState<any>(null);
  const [splitPayments, setSplitPayments] = useState<Array<{ bankAccountId: string; amount: string }>>([{ bankAccountId: "", amount: "" }]);
  const [paymentMeta, setPaymentMeta] = useState({ paymentDate: format(new Date(), "yyyy-MM-dd"), paymentMethod: "bank", reference: "" });
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [transactionFilter, setTransactionFilter] = useState<"all" | "pending" | "paid" | "partial">("all");

  const { data: viewingTaskAttachments = [] } = useQuery<TaskAttachment[]>({
    queryKey: [`/api/tasks/${viewingTask?.id}/attachments`],
    enabled: !!viewingTask?.id,
  });

  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [tick, setTick] = useState(0);

  const { data: activeTimerSessions = [] } = useQuery<any[]>({
    queryKey: ["/api/active-timers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tasks/all/active-timers");
      return res.json();
    },
  });

  const getActiveSessionForTask = (taskId: string) => {
    return (activeTimerSessions as any[]).find(s => s.taskId === taskId);
  };

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

  const [taskForm, setTaskForm] = useState({
    title: "",
    is_billable: true,
    description: "",
    estimated_hours: "00:00",
    attachment: null as File | null,
    emp_id: [] as string[],
    from_date_time: "",
    to_date_time: "",
  });

  const [uploadingFile, setUploadingFile] = useState(false);

  const { data: projectFiles = [], refetch: refetchFiles } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/files`],
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    const authHeaders: Record<string, string> = {};
    const token = getAuthToken();
    if (token) authHeaders["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      if (res.ok) {
        refetchFiles();
        toast({ title: "File uploaded successfully" });
      } else {
        toast({ title: "Failed to upload file", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error uploading file", variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const [isExpenseWizardOpen, setIsExpenseWizardOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "0",
    expenseType: "project" as "employee" | "project",
    description: "",
    attachment: null as File | null,
  });

  const [isCRWizardOpen, setIsCRWizardOpen] = useState(false);
  const [crForm, setCrForm] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    fromDate: "",
    toDate: "",
    amount: "0",
    attachment: null as File | null,
  });

  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [editCRId, setEditCRId] = useState<string | null>(null);

  const [timesheetFilters, setTimesheetFilters] = useState({
    fromDate: "",
    toDate: "",
    employee: "",
    status: "all",
  });

  const [reportFilters, setReportFilters] = useState({
    fromDate: "",
    toDate: "",
    employee: "",
    billableStatus: "all",
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees/minimal"],
  });

  const { data: timesheetsData = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/timesheets`],
  });

  const { data: projectExpenses = [] } = useQuery<any[]>({
    queryKey: [`/api/project-expenses`, { projectId }],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/project-expenses?projectId=${projectId}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      return res.json();
    },
  });

  const { data: projectIncome = [] } = useQuery<any[]>({
    queryKey: [`/api/project-income`, { projectId }],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/project-income?projectId=${projectId}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      return res.json();
    },
  });

  const { data: budgetSummary } = useQuery<any>({
    queryKey: [`/api/projects/${projectId}/budget-summary`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/projects/${projectId}/budget-summary`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      return res.json();
    },
  });

  const { data: shops = [] } = useQuery<any[]>({ queryKey: ["/api/shops"] });
  const currentShop = shops.find(s => s.id === currentShopId);

  const { data: bankTransactions = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-transactions"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch("/api/bank-transactions", {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      return res.json();
    },
  });

  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  const { data: allTasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: bankAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const projectTasks = allTasks?.filter(t => t.projectId === projectId) || [];
  const billableTasks = projectTasks.filter(t => t.billable);

  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ id, meta, splits }: { id: string; meta: typeof paymentMeta; splits: typeof splitPayments }) => {
      const res = await apiRequest("PATCH", `/api/project-income/${id}/confirm-payment`, {
        payments: splits.filter(p => p.bankAccountId && Number(p.amount) > 0).map(p => ({ bankAccountId: p.bankAccountId, amount: Number(p.amount) })),
        paymentDate: new Date(meta.paymentDate).toISOString(),
        paymentMethod: meta.paymentMethod,
        reference: meta.reference,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-income`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Payment confirmed & posted to chart of accounts" });
      setIsConfirmPaymentOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to confirm payment", description: error.message, variant: "destructive" });
    }
  });

  const createBaseInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!project) return;
      const data = {
        projectId,
        clientId: project.clientId,
        title: "Base Project Cost",
        amount: project.totalCost,
        paymentStatus: "pending",
        paymentDate: new Date(),
        description: `Initial base cost for project: ${project.name}`
      };
      const res = await apiRequest("POST", "/api/project-income", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-income`, { projectId }] });
      toast({ title: "Base project invoice created" });
    }
  });

  const filteredTimesheets = timesheetsData.filter(ts => {
    if (timesheetFilters.fromDate && ts.date < timesheetFilters.fromDate) return false;
    if (timesheetFilters.toDate && ts.date > timesheetFilters.toDate) return false;
    if (timesheetFilters.employee && !ts.employeeName?.toLowerCase().includes(timesheetFilters.employee.toLowerCase())) return false;
    if (timesheetFilters.status !== "all" && ts.taskStatus !== timesheetFilters.status) return false;
    return true;
  });

  const totalTimesheetSeconds = filteredTimesheets.reduce((acc, ts) => acc + (Number(ts.hours) || 0) * 3600, 0);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "HH:mm:ss");
  };

  const handleManualHoursSave = () => {
    if (manualHoursTask) {
      const parts = manualHours.split(":");
      let hrs = 0;
      if (parts.length === 2) {
        hrs = parseInt(parts[0]) + (parseInt(parts[1]) / 60);
      } else {
        hrs = Number(manualHours);
      }
      updateManualHoursMutation.mutate({ id: manualHoursTask.id, hours: hrs.toString() });
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    const authHeaders: Record<string, string> = { "Authorization": `Bearer ${getAuthToken()}` };
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (res.ok) {
        refetchFiles();
        toast({ title: "File deleted successfully" });
      }
    } catch {
      toast({ title: "Error deleting file", variant: "destructive" });
    }
  };

  const totalCost = budgetSummary?.budget || Number((project as any)?.totalCost || 0);
  const totalHours = Number((project as any)?.totalHours || 0);
  const hourlyRate = Number((project as any)?.hourlyRate || 0);

  // Combine project expenses and billable timesheet costs
  const combinedExpenses = [
    ...projectExpenses.map(e => ({
      id: `exp-${e.id}`,
      title: e.title || "Expense",
      type: e.expenseType === 'employee' ? 'Employee' : 'Project',
      date: format(new Date(e.expenseDate), "yyyy-MM-dd"),
      amount: Number(e.amount || 0),
      attachmentUrl: e.attachmentUrl
    })),
    ...filteredTimesheets.filter(ts => ts.billable).map(ts => ({
      id: `ts-${ts.id}`,
      title: ts.taskTitle || "Task",
      type: "Task Time",
      date: ts.date ? format(new Date(ts.date), "yyyy-MM-dd") : "-",
      amount: Number(ts.hours || 0) * hourlyRate,
      attachmentUrl: null
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalExpensesAmount = combinedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalCRAmount = projectIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const spentCost = budgetSummary?.spent || totalExpensesAmount;
  const remainingCost = budgetSummary?.remaining || Math.max(0, totalCost - spentCost);
  const budgetUsagePercent = totalCost > 0 ? Math.min(100, (spentCost / totalCost) * 100) : 0;

  const spentHours = billableTasks.reduce((acc, t) => acc + Number(t.actualHours || 0), 0);
  const remainingHours = Math.max(0, totalHours - spentHours);

  const getEmployeeName = (id: string) => employees?.find(e => e.id === id)?.name || id;

  const filteredReportTimesheets = timesheetsData.filter(ts => {
    if (reportFilters.fromDate && ts.date < reportFilters.fromDate) return false;
    if (reportFilters.toDate && ts.date > reportFilters.toDate) return false;
    if (reportFilters.employee && !ts.employeeName?.toLowerCase().includes(reportFilters.employee.toLowerCase())) return false;
    if (reportFilters.billableStatus !== "all") {
      const isBillable = reportFilters.billableStatus === "true";
      if (ts.billable !== isBillable) return false;
    }
    return true;
  });

  const reportTotalHours = filteredReportTimesheets.reduce((sum, ts) => sum + Number(ts.hours || 0), 0);
  const reportTotalCost = filteredReportTimesheets.filter(ts => ts.billable).reduce((sum, ts) => sum + (Number(ts.hours || 0) * hourlyRate), 0);

  const reportTaskIds = new Set(filteredReportTimesheets.map(ts => ts.taskId));
  const reportTaskCount = reportTaskIds.size;
  const projectTotalTasks = projectTasks.length;

  const employeeSummaryMap = new Map();
  filteredReportTimesheets.forEach(ts => {
    if (!employeeSummaryMap.has(ts.userId)) {
      employeeSummaryMap.set(ts.userId, {
        name: ts.employeeName || "Unknown",
        hours: 0,
        rate: hourlyRate,
        amount: 0
      });
    }
    const emp = employeeSummaryMap.get(ts.userId);
    emp.hours += Number(ts.hours || 0);
    if (ts.billable) {
      emp.amount += Number(ts.hours || 0) * hourlyRate;
    }
  });
  const employeeSummary = Array.from(employeeSummaryMap.values());

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl = "";
      if (expenseForm.attachment) {
        const formData = new FormData();
        formData.append("file", expenseForm.attachment);
        const authHeaders: Record<string, string> = { "Authorization": `Bearer ${getAuthToken()}` };
        const fileRes = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST", headers: authHeaders, body: formData,
        });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          attachmentUrl = fileData.filePath;
        }
      }

      const expenseDate = new Date(expenseForm.date);
      const projectStart = project?.startDate ? new Date(project.startDate) : null;
      
      if (projectStart && expenseDate < projectStart) {
        throw new Error(`Expense date cannot be before project start date (${format(projectStart, "dd MMM yyyy")})`);
      }

      await apiRequest("POST", "/api/project-expenses", {
        projectId,
        title: expenseForm.title,
        expenseDate: expenseDate.toISOString(),
        amount: expenseForm.amount,
        expenseType: expenseForm.expenseType,
        description: expenseForm.description,
        attachmentUrl: attachmentUrl || null,
        status: "posted"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-expenses`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/budget-summary`] });
      refetchFiles();
      toast({ title: "Expense added successfully" });
      setIsExpenseWizardOpen(false);
      setExpenseForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), amount: "0", expenseType: "project", description: "", attachment: null });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add expense", description: error.message, variant: "destructive" });
    }
  });

  const createCRMutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl = "";
      if (crForm.attachment) {
        const formData = new FormData();
        formData.append("file", crForm.attachment);
        const authHeaders: Record<string, string> = { "Authorization": `Bearer ${getAuthToken()}` };
        const fileRes = await fetch(`/api/projects/${projectId}/files`, { method: "POST", headers: authHeaders, body: formData });
        if (fileRes.ok) attachmentUrl = (await fileRes.json()).filePath;
      }
      const data: any = {
        projectId,
        companyId: project?.companyId || currentCompanyId,
        shopId: project?.shopId || currentShopId,
        branchId: project?.branchId || currentBranchId,
        title: crForm.title,
        paymentDate: new Date(crForm.date).toISOString(),
        fromDate: crForm.fromDate ? new Date(crForm.fromDate).toISOString() : null,
        toDate: crForm.toDate ? new Date(crForm.toDate).toISOString() : null,
        amount: crForm.amount,
        description: crForm.description,
        status: "posted"
      };
      if (attachmentUrl) data.attachmentUrl = attachmentUrl;

      await apiRequest("POST", "/api/project-income", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-income`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/budget-summary`] });
      toast({ title: "Client request added successfully" });
      setIsCRWizardOpen(false);
      setCrForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), description: "", fromDate: "", toDate: "", amount: "0", attachment: null });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add client request", description: error.message, variant: "destructive" });
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl = "";
      if (expenseForm.attachment) {
        const formData = new FormData();
        formData.append("file", expenseForm.attachment);
        const authHeaders: Record<string, string> = { "Authorization": `Bearer ${getAuthToken()}` };
        const fileRes = await fetch(`/api/projects/${projectId}/files`, { method: "POST", headers: authHeaders, body: formData });
        if (fileRes.ok) attachmentUrl = (await fileRes.json()).filePath;
      }
      const data: any = {
        companyId: project?.companyId || currentCompanyId,
        shopId: project?.shopId || currentShopId,
        branchId: project?.branchId || currentBranchId,
        title: expenseForm.title,
        expenseDate: new Date(expenseForm.date).toISOString(),
        amount: expenseForm.amount,
        expenseType: expenseForm.expenseType,
        description: expenseForm.description,
      };
      if (attachmentUrl) data.attachmentUrl = attachmentUrl;

      await apiRequest("PATCH", `/api/project-expenses/${editExpenseId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-expenses`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/budget-summary`] });
      toast({ title: "Expense updated" });
      setIsExpenseWizardOpen(false);
      setEditExpenseId(null);
      setExpenseForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), amount: "0", expenseType: "project", description: "", attachment: null });
    },
    onError: (error: Error) => toast({ title: "Failed to update expense", description: error.message, variant: "destructive" })
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/project-expenses/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-expenses`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/budget-summary`] });
      toast({ title: "Expense deleted" });
    },
    onError: (error: Error) => toast({ title: "Failed to delete expense", description: error.message, variant: "destructive" })
  });

  const updateCRMutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl = "";
      if (crForm.attachment) {
        const formData = new FormData();
        formData.append("file", crForm.attachment);
        const authHeaders: Record<string, string> = { "Authorization": `Bearer ${getAuthToken()}` };
        const fileRes = await fetch(`/api/projects/${projectId}/files`, { method: "POST", headers: authHeaders, body: formData });
        if (fileRes.ok) attachmentUrl = (await fileRes.json()).filePath;
      }
      const data: any = {
        companyId: project?.companyId || currentCompanyId,
        shopId: project?.shopId || currentShopId,
        branchId: project?.branchId || currentBranchId,
        title: crForm.title,
        paymentDate: new Date(crForm.date).toISOString(),
        fromDate: crForm.fromDate ? new Date(crForm.fromDate).toISOString() : null,
        toDate: crForm.toDate ? new Date(crForm.toDate).toISOString() : null,
        amount: crForm.amount,
        description: crForm.description,
      };
      if (attachmentUrl) data.attachmentUrl = attachmentUrl;

      await apiRequest("PATCH", `/api/project-income/${editCRId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-income`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/budget-summary`] });
      toast({ title: "Client request updated" });
      setIsCRWizardOpen(false);
      setEditCRId(null);
      setCrForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), description: "", fromDate: "", toDate: "", amount: "0", attachment: null });
    },
    onError: (error: Error) => toast({ title: "Failed to update CR", description: error.message, variant: "destructive" })
  });

  const deleteCRMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/project-income/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/project-income`, { projectId }] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/budget-summary`] });
      toast({ title: "Client request deleted" });
    },
    onError: (error: Error) => toast({ title: "Failed to delete CR", description: error.message, variant: "destructive" })
  });

  const handleEditExpense = (exp: any) => {
    setEditExpenseId(exp.id);
    setExpenseForm({
      title: exp.title || "",
      date: exp.date || format(new Date(), "yyyy-MM-dd"),
      amount: exp.amount?.toString() || "0",
      expenseType: (exp.type === "employee" ? "employee" : "project"),
      description: exp.description || "",
      attachment: null
    });
    setIsExpenseWizardOpen(true);
  };

  const handleEditCR = (cr: any) => {
    setEditCRId(cr.id);
    setCrForm({
      title: cr.title || "",
      date: cr.paymentDate ? format(new Date(cr.paymentDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      fromDate: cr.fromDate ? format(new Date(cr.fromDate), "yyyy-MM-dd") : "",
      toDate: cr.toDate ? format(new Date(cr.toDate), "yyyy-MM-dd") : "",
      amount: cr.amount?.toString() || "0",
      description: cr.description || "",
      attachment: null
    });
    setIsCRWizardOpen(true);
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
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task created successfully" });
      setIsTaskWizardOpen(false);
      setTaskWizardStep(1);
      setTaskForm({
        title: "", is_billable: true, description: "", estimated_hours: "00:00",
        attachment: null, emp_id: [], from_date_time: "", to_date_time: ""
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    }
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
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task updated successfully" });
      setIsTaskWizardOpen(false);
      setEditingTask(null);
      setTaskWizardStep(1);
      setTaskForm({
        title: "", is_billable: true, description: "", estimated_hours: "00:00",
        attachment: null, emp_id: [], from_date_time: "", to_date_time: ""
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    }
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    }
  });

  const updateManualHoursMutation = useMutation({
    mutationFn: async ({ id, hours, description }: { id: string; hours: string; description?: string }) => {
      await apiRequest("POST", `/api/tasks/${id}/manual-hours`, { hours, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Hours updated successfully" });
      setIsManualHoursOpen(false);
      setManualHoursTask(null);
      setManualHours("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update hours", description: error.message, variant: "destructive" });
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
    },
    onError: (error: Error) => {
      toast({ title: "Timer action failed", description: error.message, variant: "destructive" });
    }
  });

  const handleTaskWizardNext = () => setTaskWizardStep(2);
  const handleTaskWizardPrev = () => setTaskWizardStep(1);

  const handleTaskSubmit = () => {
    if (!taskForm.title.trim()) {
      toast({ title: "Task title is required", variant: "destructive" });
      return;
    }

    const tStart = taskForm.from_date_time ? new Date(taskForm.from_date_time) : null;
    const tEnd = taskForm.to_date_time ? new Date(taskForm.to_date_time) : null;
    const projectStart = project?.startDate ? new Date(project.startDate) : null;

    if (projectStart && tStart && tStart < projectStart) {
      toast({ title: `Task start date cannot be before project start date (${format(projectStart, "dd MMM yyyy")})`, variant: "destructive" });
      return;
    }

    if (tStart && tEnd && tEnd < tStart) {
      toast({ title: "Task end date cannot be before task start date", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("title", taskForm.title.trim());
    formData.append("description", taskForm.description || "");
    formData.append("project_id", projectId);
    formData.append("emp_id", JSON.stringify(taskForm.emp_id));
    formData.append("estimated_hours", taskForm.estimated_hours || "00:00");
    formData.append("from_date_time", taskForm.from_date_time || "");
    formData.append("to_date_time", taskForm.to_date_time || "");
    formData.append("is_billable", String(taskForm.is_billable));

    if (taskForm.attachment) {
      formData.append("attachment", taskForm.attachment);
    }

    if (editingTask) {
      formData.append("id", editingTask.id);
      formData.append("status", editingTask.status);
      updateTaskMutation.mutate(formData);
    } else {
      createTaskMutation.mutate(formData);
    }
  };

  const toggleEmployeeSelection = (empId: string) => {
    setTaskForm(prev => {
      const isSelected = prev.emp_id.includes(empId);
      if (isSelected) return { ...prev, emp_id: prev.emp_id.filter(id => id !== empId) };
      return { ...prev, emp_id: [...prev.emp_id, empId] };
    });
  };

  if (isProjectLoading) return <div className="p-8 text-center">Loading project details...</div>;
  if (!project) return <div className="p-8 text-center text-red-500">Project not found.</div>;

  let _taskRowIdx = 0;
  const taskColumns: any[] = [
    { key: "sno", header: "#", render: (_: any) => { _taskRowIdx++; return _taskRowIdx; } },
    {
      key: "title", header: "Tasks", render: (t: Task) => (
        <span className="font-medium text-blue-600 flex items-center gap-1">
          {t.title}
          {/* <a href={`/api/tasks/${t.id}/attachments/latest`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <Paperclip className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
          </a> */}
        </span>
      )
    },
    {
      key: "employee", header: "Employee", render: (t: Task) => {
        const empIds = t.assigneeId ? t.assigneeId.split(",") : [];
        return (
          <div className="flex items-center gap-2">
            {empIds.map(id => (
              <div key={id} className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                  {getEmployeeName(id).charAt(0)}
                </div>
                <span className="text-sm">{getEmployeeName(id)}</span>
              </div>
            ))}
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
          disabled={updateTaskStatusMutation.isPending}
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
                is_billable: t.billable ?? true,
                description: t.description || "",
                estimated_hours: t.estimatedHours?.toString() || "00:00",
                attachment: null,
                emp_id: t.assigneeId ? t.assigneeId.split(",") : [],
                from_date_time: t.startDate ? String(t.startDate).split('T')[0] : "",
                to_date_time: t.dueDate ? String(t.dueDate).split('T')[0] : "",
              });
              setTaskWizardStep(1);
              setIsTaskWizardOpen(true);
            }} title="Edit Task">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-blue-500" onClick={() => { setViewingTask(t); setIsViewTaskOpen(true); }} title="View Task Details">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-red-500" onClick={() => { if (confirm("Are you sure you want to delete this task?")) deleteTaskMutation.mutate(t.id); }} title="Delete Task">
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50/30 p-6 rounded-xl border border-gray-100 print:bg-white print:p-0 print:border-none print:shadow-none">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 print:hidden">
        <span className="cursor-pointer hover:text-blue-600 font-medium">Dashboard</span> &raquo;
        <span className="cursor-pointer hover:text-blue-600 font-medium ml-1">Projects</span> &raquo;
        <span className="ml-1">Project Management</span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={onBack} size="sm" className="bg-white print:hidden"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <h1 className="text-2xl font-bold text-gray-900 print:hidden">{project.name}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b border-gray-200 w-full justify-start rounded-none p-0 h-auto space-x-6 print:hidden">
          <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Overview</TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Tasks</TabsTrigger>
          <TabsTrigger value="timesheets" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Timesheets</TabsTrigger>
          {/* <TabsTrigger value="message_board" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Message Board</TabsTrigger> */}
          <TabsTrigger value="expenses" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Expenses</TabsTrigger>
          <TabsTrigger value="client_request" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Client Request</TabsTrigger>
          <TabsTrigger value="report" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Report</TabsTrigger>
          <TabsTrigger value="transactions" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-3 pt-2 px-1 font-semibold text-gray-600">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Financial Overview */}
            <Card className="shadow-sm border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-gray-800">Financial Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-100" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="175" strokeDashoffset={175 - (175 * (100 - budgetUsagePercent)) / 100} className="text-blue-500 transition-all duration-1000" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="text-sm font-medium text-gray-700">Remaining Amount</span></div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-semibold text-gray-800">Total Cost (BD):</span>
                  <span className="text-sm font-bold text-blue-600">{totalCost.toFixed(2)} BD</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-semibold text-gray-800">Spent:</span>
                  <span className="text-sm font-bold text-orange-500">{spentCost.toFixed(2)} BD</span>
                </div>
                {/* <Button className="w-full mt-4 bg-blue-500 hover:bg-blue-600"><Edit className="mr-2 h-4 w-4" /> Edit Project</Button> */}
              </CardContent>
            </Card>

            {/* Hours Overview */}
            <Card className="shadow-sm border-gray-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-gray-800">Hours Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-100" />
                      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="175" strokeDashoffset={175 - (175 * (totalHours > 0 ? (remainingHours / totalHours) * 100 : 0)) / 100} className="text-blue-500 transition-all duration-1000" />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="text-sm font-medium text-gray-700">Remaining hours</span></div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400"></span><span className="text-sm font-medium text-gray-700">Spent hours</span></div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-semibold text-gray-800">Total hours:</span>
                  <span className="text-sm font-bold text-gray-900">{totalHours} hrs</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-semibold text-gray-800">Spent:</span>
                  <span className="text-sm font-bold text-yellow-500">{spentHours.toFixed(2)} hrs</span>
                </div>
              </CardContent>
            </Card>

            {/* Budget Usage */}
            <Card className="shadow-sm border-gray-100 flex flex-col items-center justify-center py-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Budget Usage</h3>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * budgetUsagePercent) / 100} className="text-purple-500 transition-all duration-1000" strokeLinecap="round" />
                </svg>
                <div className="absolute flex items-center justify-center inset-0">
                  <span className="text-2xl font-bold text-blue-600">{budgetUsagePercent.toFixed(1)}%</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-6">{budgetUsagePercent.toFixed(1)}% of Budget Used</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Description */}
            <Card className="md:col-span-2 shadow-sm border-gray-100 h-full">
              <CardHeader>
                <CardTitle className="text-lg text-gray-800">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 text-sm leading-relaxed">{project.description || "No description provided."}</p>
              </CardContent>
            </Card>

            {/* Right Column: Team & Files */}
            <div className="space-y-6">
              {/* Team Members */}
              <Card className="shadow-sm border-gray-100">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800">Team Members</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-64 overflow-y-auto">
                  {String((project as any)?.team || "").split(",").filter(Boolean).map(id => (
                    <div key={id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                          {getEmployeeName(id.trim()).charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-800">{getEmployeeName(id.trim())}</span>
                          <span className="text-xs text-gray-500">Employee</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Project Files */}
              <Card className="shadow-sm border-gray-100">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-gray-800 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-500" /> Files</CardTitle>
                    <label className="cursor-pointer mb-0">
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                      <Button variant="outline" size="sm" disabled={uploadingFile} asChild className="h-8">
                        <span><Upload className="h-3 w-3 mr-1" />{uploadingFile ? "Uploading..." : "Upload"}</span>
                      </Button>
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  {projectFiles.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-100 rounded-lg">No files uploaded yet</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {projectFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-blue-50 rounded text-blue-600"><FileText className="h-4 w-4" /></div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-sm font-medium text-gray-700 truncate">{file.fileName}</span>
                              <span className="text-xs text-gray-400">{Math.round(file.fileSize / 1024)} KB</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={file.filePath} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"><Download className="h-4 w-4" /></Button>
                            </a>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteFile(file.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Tasks List</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-white"><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => { setEditingTask(null); setIsTaskWizardOpen(true); }}>Add Tasks</Button>
            </div>
          </div>
          <Card className="shadow-sm border-gray-100">
            <DataTable columns={taskColumns} data={projectTasks} getRowKey={(t) => t.id} />
          </Card>
        </TabsContent>

        <TabsContent value="timesheets" className="mt-6">
          <Card className="shadow-sm border-gray-100">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-gray-700">From</Label>
                  <Input type="date" className="h-9 text-sm" value={timesheetFilters.fromDate} onChange={(e) => setTimesheetFilters({ ...timesheetFilters, fromDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-bold text-gray-700">To</Label>
                  <Input type="date" className="h-9 text-sm" value={timesheetFilters.toDate} onChange={(e) => setTimesheetFilters({ ...timesheetFilters, toDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                  <Label className="text-xs font-bold text-gray-700">Employee</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search employee..." className="h-9 pl-9 text-sm" value={timesheetFilters.employee} onChange={(e) => setTimesheetFilters({ ...timesheetFilters, employee: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 min-w-[150px]">
                  <Label className="text-xs font-bold text-gray-700">Status</Label>
                  <Select value={timesheetFilters.status} onValueChange={(val) => setTimesheetFilters({ ...timesheetFilters, status: val })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="todo">Yet to start</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="h-9 text-gray-600 px-4" onClick={() => setTimesheetFilters({ fromDate: "", toDate: "", employee: "", status: "all" })}>Reset</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-12">#</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Tasks</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Start Time</th>
                      <th className="px-4 py-3">End Time</th>
                      <th className="px-4 py-3">Total hours</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Billable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTimesheets.length > 0 ? filteredTimesheets.map((ts, idx) => (
                      <tr key={ts.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{ts.employeeName || "N/A"}</td>
                        <td className="px-4 py-3 text-blue-600 font-medium">{ts.taskTitle || "N/A"}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{ts.date}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{formatTime(ts.startTime)}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{formatTime(ts.endTime)}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{formatDuration(Number(ts.hours) * 3600)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={
                            ts.taskStatus === "completed" ? "bg-green-100 text-green-700 border-green-200" :
                              ts.taskStatus === "in_progress" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                "bg-gray-100 text-gray-700 border-gray-200"
                          }>
                            {ts.taskStatus === "completed" ? "Completed" : ts.taskStatus === "in_progress" ? "In Progress" : "Yet to start"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className={ts.billable ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"}>
                            {ts.billable ? "Yes" : "No"}
                          </Badge>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-gray-400 italic">No timesheet entries found</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-white">
                    <tr className="border-t-2 border-gray-100">
                      <td colSpan={6} className="px-4 py-3 text-right font-bold text-gray-900">Total:</td>
                      <td colSpan={3} className="px-4 py-3 font-bold text-gray-900 text-lg tabular-nums">{formatDuration(totalTimesheetSeconds)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="message_board" className="mt-6">
          <Card className="p-8 text-center text-gray-400 italic border-dashed border-2">Message board features coming soon...</Card>
        </TabsContent>
        <TabsContent value="expenses" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Expenses</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-white"><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => setIsExpenseWizardOpen(true)}>Add Expense</Button>
            </div>
          </div>
          <Card className="shadow-sm border-gray-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Title / Task</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Attachment</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {combinedExpenses.length > 0 ? combinedExpenses.map((exp, idx) => (
                  <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-4 py-3 text-blue-600 font-medium">{exp.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={exp.type === 'Task Time' ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-orange-100 text-orange-700 border-orange-200"}>
                        {exp.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{exp.date}</td>
                    <td className="px-4 py-3 font-bold text-gray-900 text-right">{exp.amount.toFixed(2)} BD</td>
                    <td className="px-4 py-3 text-center">
                      {exp.attachmentUrl ? (
                        <a href={exp.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-500 hover:text-blue-700">
                          <Paperclip className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {exp.type !== 'Task Time' ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditExpense(exp)} className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Are you sure?")) deleteExpenseMutation.mutate(exp.id) }} className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Auto</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No expenses recorded yet</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-white">
                <tr className="border-t-2 border-gray-100">
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-900">Total Expenses:</td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-right tabular-nums text-lg">{totalExpensesAmount.toFixed(2)} BD</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="client_request" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Client Requests</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-white"><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => setIsCRWizardOpen(true)}>Add Transaction</Button>
            </div>
          </div>
          <Card className="shadow-sm border-gray-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">From Date</th>
                  <th className="px-4 py-3">To Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Attachment</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projectIncome.length > 0 ? projectIncome.map((inc, idx) => (
                  <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-4 py-3 text-blue-600 font-medium">{inc.title || "Transaction"}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{format(new Date(inc.paymentDate), "yyyy-MM-dd")}</td>
                    <td className="px-4 py-3 text-gray-600">{inc.fromDate ? format(new Date(inc.fromDate), "yyyy-MM-dd") : "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{inc.toDate ? format(new Date(inc.toDate), "yyyy-MM-dd") : "-"}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]" title={inc.description}>{inc.description || "-"}</td>
                    <td className="px-4 py-3 font-bold text-green-600 text-right">{Number(inc.amount || 0).toFixed(2)} BD</td>
                    <td className="px-4 py-3 text-center">
                      {inc.attachmentUrl ? (
                        <a href={inc.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue-500 hover:text-blue-700">
                          <Paperclip className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditCR(inc)} className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Are you sure?")) deleteCRMutation.mutate(inc.id) }} className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400 italic">No client requests recorded yet</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-white">
                <tr className="border-t-2 border-gray-100">
                  <td colSpan={6} className="px-4 py-3 text-right font-bold text-gray-900">Total Amounts:</td>
                  <td className="px-4 py-3 font-bold text-green-600 text-right tabular-nums text-lg">{totalCRAmount.toFixed(2)} BD</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-6 space-y-6 print:mt-0 print:block">
          {/* Print Only Header */}
          <div className="hidden print:block mb-8 text-center text-black border-b pb-4">
            <h1 className="text-3xl font-bold tracking-tight mb-2 uppercase">Project Report</h1>
            <h2 className="text-xl font-semibold mb-1 text-gray-800">{project.name}</h2>
            <p className="text-sm text-gray-500">
              Generated on {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100 print:hidden">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-gray-600">From Date:</Label>
                  <Input type="date" className="h-9 w-40" value={reportFilters.fromDate} onChange={e => setReportFilters({ ...reportFilters, fromDate: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-gray-600">To Date:</Label>
                  <Input type="date" className="h-9 w-40" value={reportFilters.toDate} onChange={e => setReportFilters({ ...reportFilters, toDate: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-gray-600">Employee:</Label>
                  <Select value={reportFilters.employee} onValueChange={(val) => setReportFilters({ ...reportFilters, employee: val === "all" ? "" : val })}>
                    <SelectTrigger className="w-48 h-9 bg-white"><SelectValue placeholder="All Employees" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees && Array.from(new Set(employees.map(e => e.name))).map((name, idx) => (
                        <SelectItem key={idx} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-gray-600">Billable Status:</Label>
                  <Select value={reportFilters.billableStatus} onValueChange={(val) => setReportFilters({ ...reportFilters, billableStatus: val })}>
                    <SelectTrigger className="w-40 h-9 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Billable</SelectItem>
                      <SelectItem value="false">Non-Billable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" className="bg-white"><CheckCircle className="mr-2 h-4 w-4" /> Submit</Button>
                <Button variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800"><CheckCircle className="mr-2 h-4 w-4" /> Approve</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                <Button variant="outline" onClick={() => {
                  let csv = "Employee Name,Hours,Hourly Rate,Total Amount (BD)\\n";
                  employeeSummary.forEach(emp => { csv += `"${emp.name}",${emp.hours.toFixed(2)},${emp.rate.toFixed(2)},${emp.amount.toFixed(2)}\\n`; });
                  csv += "\\nProject Name,Employee Name,Task,Billable,Date,From Time,To Time,Estimated Hours,Total Hours,Total Amount (BD)\\n";
                  filteredReportTimesheets.forEach(ts => {
                    const estHours = projectTasks.find(t => t.id === ts.taskId)?.estimatedHours || 0;
                    const amount = ts.billable ? (Number(ts.hours || 0) * hourlyRate).toFixed(2) : "0.00";
                    csv += `"${project?.name || ''}","${ts.employeeName || "-"}","${ts.taskTitle}",${ts.billable ? 'Yes' : 'No'},${ts.date ? format(new Date(ts.date), "yyyy-MM-dd") : "-"},${formatTime(ts.startTime)},${formatTime(ts.endTime)},${Number(estHours).toFixed(2)},${Number(ts.hours || 0).toFixed(2)},${amount}\\n`;
                  });
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `Project_Report_${project?.name || 'export'}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-sm border-gray-100 bg-white print:shadow-none print:border-gray-200">
                <CardContent className="p-6 flex flex-col justify-center items-center text-center">
                  <h3 className="text-gray-500 font-medium mb-2">Total Hours</h3>
                  <p className="text-4xl font-bold text-blue-600">{reportTotalHours.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-gray-100 bg-white print:shadow-none print:border-gray-200">
                <CardContent className="p-6 flex flex-col justify-center items-center text-center">
                  <h3 className="text-gray-500 font-medium mb-2">Total Cost</h3>
                  <p className="text-4xl font-bold text-red-500">{reportTotalCost.toFixed(2)} <span className="text-lg">BD</span></p>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-gray-100 bg-white print:shadow-none print:border-gray-200">
                <CardContent className="p-6 flex flex-col justify-center items-center text-center">
                  <h3 className="text-gray-500 font-medium mb-2">Tasks count</h3>
                  <p className="text-4xl font-bold text-gray-800">{reportTaskCount} <span className="text-2xl text-gray-400">/ {projectTotalTasks}</span></p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-gray-100 overflow-hidden print:shadow-none print:border-gray-200">
              <div className="p-4 bg-gray-50 border-b border-gray-200 text-black">
                <h3 className="text-lg font-bold text-gray-800">Employee Summary</h3>
              </div>
              <table className="w-full text-sm text-left print:text-xs">
                <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-12">#</th>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                    <th className="px-4 py-3 text-right">Hourly Rate</th>
                    <th className="px-4 py-3 text-right">Total Amount (BD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employeeSummary.length > 0 ? employeeSummary.map((emp, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{emp.name}</td>
                      <td className="px-4 py-3 text-right font-medium">{emp.hours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium">{emp.rate.toFixed(2)} BD</td>
                      <td className="px-4 py-3 font-bold text-gray-900 text-right">{emp.amount.toFixed(2)} BD</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400 italic">No timesheet records</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>

            {/* Project Expenses Section */}
            <Card className="shadow-sm border-gray-100 overflow-hidden mt-6 print:shadow-none print:border-gray-200 print:mt-4 print:break-inside-avoid">
              <div className="p-4 bg-red-50 border-b border-gray-200 text-black">
                <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Project Expenses
                </h3>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount (BD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {projectExpenses && projectExpenses.length > 0 ? projectExpenses.map((exp: any, idx: number) => (
                      <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{exp.title}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{exp.category || "other"}</td>
                        <td className="px-4 py-3 text-gray-600">{format(new Date(exp.expenseDate), "dd MMM yyyy")}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{Number(exp.amount).toFixed(3)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-400 italic">No expenses recorded for this project</td>
                      </tr>
                    )}
                  </tbody>
                  {projectExpenses && projectExpenses.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Total Expenses</td>
                        <td className="px-4 py-3 text-right text-red-600">{projectExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0).toFixed(3)} BD</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Project Income / Client Requests Section */}
            <Card className="shadow-sm border-gray-100 overflow-hidden mt-6 print:shadow-none print:border-gray-200 print:mt-4 print:break-inside-avoid">
              <div className="p-4 bg-green-50 border-b border-gray-200 text-black">
                <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Project Income (Client Requests)
                </h3>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">#</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Invoice No</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount (BD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {projectIncome && projectIncome.length > 0 ? projectIncome.map((inc: any, idx: number) => (
                      <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{inc.title}</td>
                        <td className="px-4 py-3 font-mono text-xs">{inc.invoiceNo || "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{format(new Date(inc.paymentDate || new Date()), "dd MMM yyyy")}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={
                            inc.paymentStatus === "paid" ? "bg-green-100 text-green-700 border-green-200" :
                            inc.paymentStatus === "partial" ? "bg-amber-100 text-amber-700 border-amber-200" :
                            "bg-yellow-50 text-yellow-700 border-yellow-200"
                          }>
                            {inc.paymentStatus === "paid" ? "Paid" : inc.paymentStatus === "partial" ? "Partial" : "Pending"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">{Number(inc.amount).toFixed(3)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No income/invoices recorded for this project</td>
                      </tr>
                    )}
                  </tbody>
                  {projectIncome && projectIncome.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right text-gray-700">Total Project Income</td>
                        <td className="px-4 py-3 text-right text-green-600">{totalCRAmount.toFixed(3)} BD</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Financial Summary Breakdown */}
            <Card className="shadow-sm border-gray-100 overflow-hidden mt-6 bg-gray-50 print:shadow-none print:border-gray-200 print:mt-4 print:break-inside-avoid">
               <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-sm font-medium mb-1">Total Project Revenue</span>
                    <span className="text-2xl font-bold text-green-600">{totalCRAmount.toFixed(3)} BD</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-sm font-medium mb-1">Total Project Costs (Exp + Labor)</span>
                    <span className="text-2xl font-bold text-red-600">{(projectExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) + reportTotalCost).toFixed(3)} BD</span>
                  </div>
                  <div className="flex flex-col border-l pl-6 border-gray-200">
                    <span className="text-gray-500 text-sm font-medium mb-1">Project Net Margin</span>
                    <span className={`text-2xl font-bold ${totalCRAmount - (projectExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) + reportTotalCost) >= 0 ? "text-blue-600" : "text-red-700"}`}>
                      {(totalCRAmount - (projectExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) + reportTotalCost)).toFixed(3)} BD
                    </span>
                  </div>
               </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="mt-6 space-y-6">
          <Card className="shadow-sm border-gray-100 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-xl text-gray-800">Project Transactions</CardTitle>
                <CardDescription>Aggregate view of project costs and client requests balances</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={transactionFilter} onValueChange={(v: any) => setTransactionFilter(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filter Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Invoices</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                {!projectIncome.some((item: any) => item.title === "Base Project Cost") && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => createBaseInvoiceMutation.mutate()}
                    disabled={createBaseInvoiceMutation.isPending}
                  >
                    <FilePlus className="h-4 w-4" />
                    Create Base Invoice
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f8f9fa] text-gray-700 font-bold border-y border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Invoice No.</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projectIncome.filter((item: any) => transactionFilter === "all" || item.paymentStatus === transactionFilter).length > 0 ? 
                    projectIncome.filter((item: any) => transactionFilter === "all" || item.paymentStatus === transactionFilter).map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-medium text-gray-900">{item.title}</td>
                      <td className="px-4 py-4 text-gray-600">{format(new Date(item.paymentDate || new Date()), "dd MMM yyyy")}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-bold text-gray-900">{Number(item.amount).toFixed(3)} BD</div>
                        {Number(item.paidAmount || 0) > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1 flex flex-col items-end gap-0.5">
                            <span className="text-green-600 font-medium">Paid: {Number(item.paidAmount).toFixed(3)}</span>
                            <span className="text-amber-600 font-medium">Rem: {(Number(item.amount) - Number(item.paidAmount)).toFixed(3)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge 
                          variant="outline"
                          className={
                            item.paymentStatus === "paid" ? "bg-green-100 text-green-700 border-green-200" :
                            item.paymentStatus === "partial" ? "bg-amber-100 text-amber-700 border-amber-200" :
                            "bg-yellow-50 text-yellow-700 border-yellow-200"
                          }
                        >
                          {item.paymentStatus === "paid" ? "Paid" : item.paymentStatus === "partial" ? "Partial" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-gray-600 font-mono">{item.invoiceNo || "-"}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {item.paymentStatus !== "paid" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                const remaining = Number(item.amount || 0) - Number(item.paidAmount || 0);
                                setConfirmingTransaction(item);
                                setSplitPayments([{ bankAccountId: "", amount: String(Math.max(0, remaining).toFixed(3)) }]);
                                setPaymentMeta({ paymentDate: format(new Date(), "yyyy-MM-dd"), paymentMethod: "bank", reference: "" });
                                setIsConfirmPaymentOpen(true);
                              }}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              Confirm Payment
                            </Button>
                          ) : (
                            <Badge variant="outline" className="h-8 flex items-center gap-1 bg-green-50 text-green-700 border-green-200">
                              <Check className="h-3 w-3" /> Confirmed
                            </Badge>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 text-gray-600"
                            onClick={() => {
                              setInvoiceData({
                                ...item,
                                clientName: (project as any)?.clientName || "Client",
                                projectName: project.name,
                              });
                              setIsInvoiceOpen(true);
                            }}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Invoice
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic">No transactions found</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-gray-800">Total Project Income (Base + CRs)</td>
                    <td className="px-4 py-3 text-right text-gray-900">{totalCRAmount.toFixed(3)} BD</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Task Wizard */}
      <Dialog open={isTaskWizardOpen} onOpenChange={(open) => { setIsTaskWizardOpen(open); if (!open) setEditingTask(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-4 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${taskWizardStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${taskWizardStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          </div>

          {taskWizardStep === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tasks</Label>
                <Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Pro Task" />
              </div>
              <div className="flex items-center gap-2">
                <Label>Is Billable:</Label>
                <Switch checked={taskForm.is_billable} onCheckedChange={v => setTaskForm({ ...taskForm, is_billable: v })} />
              </div>
              <div className="space-y-2">
                <Label>Tasks Description</Label>
                <Textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Test Description to test" className="h-24" />
              </div>
              <div className="space-y-2">
                <Label>Estimated Hours</Label>
                <Input value={taskForm.estimated_hours} onChange={e => setTaskForm({ ...taskForm, estimated_hours: e.target.value })} placeholder="10:00" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" /> Attachment <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div className="border border-blue-200 rounded-md p-2 bg-blue-50/50 flex">
                  <input type="file" onChange={e => setTaskForm({ ...taskForm, attachment: e.target.files?.[0] || null })} className="w-full text-sm" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Select Employee:</Label>
                <Select>
                  <SelectTrigger className="w-full bg-blue-500 text-white hover:bg-blue-600 border-none">
                    <SelectValue placeholder="Select employees" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <div key={emp.id} className="flex items-center p-2 cursor-pointer hover:bg-gray-100" onClick={() => toggleEmployeeSelection(emp.id)}>
                        <input type="checkbox" checked={taskForm.emp_id.includes(emp.id)} readOnly className="mr-2" />
                        <span>{emp.name}</span>
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {taskForm.emp_id.map(id => (
                    <Badge key={id} className="bg-blue-500 text-white hover:bg-blue-600">{getEmployeeName(id)}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={taskForm.from_date_time} onChange={e => setTaskForm({ ...taskForm, from_date_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={taskForm.to_date_time} onChange={e => setTaskForm({ ...taskForm, to_date_time: e.target.value })} />
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 flex justify-between w-full">
            {taskWizardStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setIsTaskWizardOpen(false)}>Cancel</Button>
                <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleTaskWizardNext}>Continue</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleTaskWizardPrev} className="bg-gray-100 text-gray-700">Previous</Button>
                <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleTaskSubmit} disabled={createTaskMutation.isPending || updateTaskMutation.isPending || !taskForm.title || taskForm.emp_id.length === 0}>
                  {createTaskMutation.isPending || updateTaskMutation.isPending ? "Saving..." : editingTask ? "Update" : "Add"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Hours Dialog */}
      <Dialog open={isManualHoursOpen} onOpenChange={setIsManualHoursOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manual Hours Adding</DialogTitle>
            <DialogDescription>Add or update the actual hours spent on this task.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Actual Hours Spent</Label>
              <Input value={manualHours} onChange={e => setManualHours(e.target.value)} type="number" step="0.5" placeholder="e.g., 5.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualHoursOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { if (manualHoursTask) updateManualHoursMutation.mutate({ id: manualHoursTask.id, hours: manualHours }); }} disabled={updateManualHoursMutation.isPending}>
              {updateManualHoursMutation.isPending ? "Saving..." : "Save Hours"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={isConfirmPaymentOpen} onOpenChange={setIsConfirmPaymentOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Invoice total: <span className="font-bold">{Number(confirmingTransaction?.amount || 0).toFixed(3)} BD</span>.
              Pay in full or partial — split across multiple bank accounts if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Split Payments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Payment Split</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSplitPayments([...splitPayments, { bankAccountId: "", amount: "" }])}
                >
                  + Add Account
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {splitPayments.map((split, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Select
                        value={split.bankAccountId}
                        onValueChange={(val) => {
                          const updated = [...splitPayments];
                          updated[idx].bankAccountId = val;
                          setSplitPayments(updated);
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map((account: any) => (
                            <SelectItem key={account.id} value={account.id.toString()}>
                              {account.bankName} ({Number(account.currentBalance || account.balance || 0).toFixed(3)} BD)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="w-28 h-9 text-xs text-right"
                      placeholder="Amount"
                      type="number"
                      step="0.001"
                      value={split.amount}
                      onChange={(e) => {
                        const updated = [...splitPayments];
                        updated[idx].amount = e.target.value;
                        setSplitPayments(updated);
                      }}
                    />
                    {splitPayments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {/* Running total vs invoice amount */}
              {(() => {
                const allocated = splitPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
                const maxPayable = Number(confirmingTransaction?.amount || 0) - Number(confirmingTransaction?.paidAmount || 0);
                const remaining = maxPayable - allocated;
                const isExact = Math.abs(remaining) < 0.001;
                const isOver = remaining < -0.001;
                return (
                  <div className="flex justify-between text-xs pt-1 border-t">
                    <span className="text-muted-foreground">
                      {isExact ? "✓ Final payment" : isOver ? "⚠ Over remaining balance" : `Partial — ${remaining.toFixed(3)} BD still pending`}
                    </span>
                    <span className={`font-bold ${isExact ? "text-green-600" : isOver ? "text-red-500" : "text-amber-600"}`}>
                      {allocated.toFixed(3)} / {maxPayable.toFixed(3)} BD
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentMeta.paymentDate}
                onChange={(e) => setPaymentMeta({ ...paymentMeta, paymentDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMeta.paymentMethod} onValueChange={(v) => setPaymentMeta({ ...paymentMeta, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference / Transaction ID (Optional)</Label>
              <Input
                placeholder="e.g. CHEQUE-123, BANK-REF"
                value={paymentMeta.reference}
                onChange={(e) => setPaymentMeta({ ...paymentMeta, reference: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmPaymentOpen(false)}>Cancel</Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => confirmPaymentMutation.mutate({
                id: confirmingTransaction?.id,
                meta: paymentMeta,
                splits: splitPayments,
              })}
              disabled={
                confirmPaymentMutation.isPending ||
                splitPayments.every(p => !p.bankAccountId || !Number(p.amount)) ||
                splitPayments.reduce((s, p) => s + Number(p.amount || 0), 0) > (Number(confirmingTransaction?.amount || 0) - Number(confirmingTransaction?.paidAmount || 0)) + 0.001
              }
            >
              {confirmPaymentMutation.isPending ? "Processing..." : "Confirm & Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice View Dialog */}
      <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto p-0 bg-white border-0 shadow-2xl">
          <div className="p-8 pb-12 overflow-hidden bg-white text-black font-sans print:p-0 print:w-full print:border-none print:shadow-none" id="printable-invoice">
            {/* Header: Sales Invoice Style */}
            <div className="flex items-center justify-between items-start mb-8 w-full border-b-2 border-gray-100 pb-6">
              <div className="space-y-4">
                {currentShop?.logoUrl ? (
                  <img src={currentShop.logoUrl} alt="Company Logo" className="max-w-[180px] max-h-[80px] object-contain" />
                ) : (
                  <div className="text-2xl font-bold flex items-center gap-2 text-primary">
                    <FileText className="w-8 h-8" />
                    <span>{currentShop?.name || "Logistics ERP"}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground max-w-[250px] leading-relaxed">
                  <p className="font-bold text-gray-900">{currentShop?.name || "YOUR COMPANY"}</p>
                  <p>{currentShop?.address || "Street PO Box Muscat, Sultanate of Oman"}</p>
                  <p>Phone: {currentShop?.contactDetails ? JSON.parse(currentShop.contactDetails)?.phone || "-" : "-"}</p>
                </div>
              </div>
              
              <div className="text-right space-y-2">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-gray-900">Project Invoice</h1>
                <div className="inline-flex flex-col items-end gap-1">
                  <Badge variant="outline" className="font-mono text-sm px-3 py-1 bg-gray-50 border-gray-200">
                    No: {invoiceData?.invoiceNo || `PRJ-INV-${invoiceData?.id ? invoiceData.id.slice(-6).toUpperCase() : 'PENDING'}`}
                  </Badge>
                  <span className="text-xs text-muted-foreground mr-1">
                    Date: {invoiceData?.paymentDate ? format(new Date(invoiceData.paymentDate), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy")}
                  </span>
                </div>
              </div>
            </div>

            {/* Billing Overview */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Bill To:</p>
                <p className="font-bold text-gray-900 text-lg">{project?.clientName || "Valued Client"}</p>
                <p className="text-sm text-gray-600 line-clamp-1">{project?.name}</p>
                <p className="text-xs text-gray-500 mt-2">Reference Project ID: <span className="font-mono">{project?.id.slice(0,8)}</span></p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-col justify-between">
                <div>
                   <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Project Details:</h3>
                   <div className="grid grid-cols-2 text-xs gap-y-2">
                     <span className="text-gray-500">Service:</span> <span className="font-bold text-right">{invoiceData?.title || "Project Work"}</span>
                     <span className="text-gray-500">Sales Person:</span> <span className="font-bold text-right">Admin</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Items Table: Clean Sales Style */}
            <div className="mb-8 border rounded-lg overflow-hidden border-gray-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f8f9fa] border-b border-gray-200 font-bold text-gray-700">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Description / Particulars</th>
                    <th className="px-4 py-3 text-center w-24">Quantity</th>
                    <th className="px-4 py-3 text-right w-32">Unit Price</th>
                    <th className="px-4 py-3 text-right w-32">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="bg-white">
                    <td className="px-4 py-4 text-center text-gray-500">1</td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-sm text-gray-900">{invoiceData?.title || "Project Milestone"}</div>
                      <div className="text-xs text-gray-500 mt-1 max-w-[400px] leading-relaxed italic">{invoiceData?.description || `Professional services for project: ${project?.name}`}</div>
                    </td>
                    <td className="px-4 py-4 text-center text-gray-700">1.00</td>
                    <td className="px-4 py-4 text-right font-mono">{Number(invoiceData?.amount || 0).toFixed(3)}</td>
                    <td className="px-4 py-4 text-right font-bold text-gray-900 border-l border-gray-50">{Number(invoiceData?.amount || 0).toFixed(3)}</td>
                  </tr>
                  {/* Visual padding rows */}
                  <tr className="h-20 bg-white"><td/><td/><td/><td/><td className="border-l border-gray-50"/></tr>
                </tbody>
              </table>
            </div>

            {/* Financials & Footer Section */}
            <div className="flex gap-12 items-start mt-6">
              <div className="flex-1 space-y-6">
                {/* Payment History Sub-table */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-3 h-3" /> Payment History
                  </h4>
                  <div className="border rounded-md border-gray-100 overflow-hidden">
                    <table className="w-full text-[10px] text-left">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-gray-600">
                        {invoiceData?.id && bankTransactions?.filter((tx: any) => tx.relatedType === 'project_income' && (tx.relatedId === invoiceData.id || tx.reference === invoiceData.invoiceNo)).length > 0 ? 
                          bankTransactions?.filter((tx: any) => tx.relatedType === 'project_income' && (tx.relatedId === invoiceData.id || tx.reference === invoiceData.invoiceNo)).map((tx: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-3 py-2">{format(new Date(tx.transactionDate), "dd MMM yyyy")}</td>
                              <td className="px-3 py-2 capitalize">{tx.paymentMethod || 'Bank'}</td>
                              <td className="px-3 py-2 text-right font-bold text-green-600">{Number(tx.amount || 0).toFixed(3)}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={3} className="px-3 py-4 text-center italic text-gray-400">Waiting for first payment</td>
                            </tr>
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Terms and Signatures */}
                <div className="grid grid-cols-1 gap-6 pt-4">
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-400 uppercase font-black">Notes / Terms:</p>
                    <p className="text-[10px] text-gray-500 leading-relaxed italic">Payment is due within 7 days. Thank you for your business!</p>
                  </div>
                  <div className="pt-8 border-t border-dashed border-gray-200">
                    <div className="flex justify-between items-end">
                      <div className="text-center space-y-2">
                        <div className="w-32 border-b border-gray-300 mx-auto"></div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Authorized Signatory</p>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="w-32 border-b border-gray-300 mx-auto"></div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Customer Signature</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Box */}
              <div className="w-72 space-y-2">
                <div className="flex justify-between p-3 border-b text-sm items-center">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="font-bold text-gray-900">{Number(invoiceData?.amount || 0).toFixed(3)}</span>
                </div>
                <div className="flex justify-between p-3 border-b text-sm items-center">
                  <span className="text-gray-500 font-medium">Tax / VAT (0%)</span>
                  <span className="font-bold text-gray-900">0.000</span>
                </div>
                <div className="flex justify-between p-4 bg-gray-900 text-white rounded-lg items-center shadow-lg mt-4 mb-2">
                  <span className="text-xs uppercase font-black tracking-widest opacity-70">Total Due</span>
                  <span className="text-xl font-black">{Number(invoiceData?.amount || 0).toFixed(3)} BD</span>
                </div>
                <div className="flex justify-between p-3 border-b text-xs items-center bg-green-50/50">
                  <span className="text-green-700 font-semibold">Total Paid</span>
                  <span className="font-bold text-green-700">{Number(invoiceData?.paidAmount || 0).toFixed(3)}</span>
                </div>
                <div className="flex justify-between p-3 text-sm items-center bg-red-50/50 rounded-b-lg">
                  <span className="text-red-700 font-black">Remaining</span>
                  <span className="font-black text-red-700">{Math.max(0, Number(invoiceData?.amount || 0) - Number(invoiceData?.paidAmount || 0)).toFixed(3)} BD</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t flex justify-end gap-2 print:hidden">
            <Button variant="outline" onClick={() => setIsInvoiceOpen(false)}>Close</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print A4
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={isExpenseWizardOpen} onOpenChange={(open) => { setIsExpenseWizardOpen(open); if (!open) setExpenseForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), amount: "0", expenseType: "project", description: "", attachment: null }); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editExpenseId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={expenseForm.title} onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })} placeholder="Expense Title" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Task Type</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="expenseType" value="employee" checked={expenseForm.expenseType === 'employee'} onChange={() => setExpenseForm({ ...expenseForm, expenseType: 'employee' })} />
                  <span className="text-sm font-medium">Employee</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="expenseType" value="project" checked={expenseForm.expenseType === 'project'} onChange={() => setExpenseForm({ ...expenseForm, expenseType: 'project' })} />
                  <span className="text-sm font-medium">Project</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Notes..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Documents Upload</Label>
              <div className="flex items-center gap-2">
                <Input type="file" onChange={e => setExpenseForm({ ...expenseForm, attachment: e.target.files?.[0] || null })} className="cursor-pointer" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsExpenseWizardOpen(false)}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => editExpenseId ? updateExpenseMutation.mutate() : createExpenseMutation.mutate()} disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending || !expenseForm.title}>
              {createExpenseMutation.isPending || updateExpenseMutation.isPending ? "Saving..." : editExpenseId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Request Dialog */}
      <Dialog open={isCRWizardOpen} onOpenChange={(open) => { setIsCRWizardOpen(open); if (!open) setCrForm({ title: "", date: format(new Date(), "yyyy-MM-dd"), description: "", fromDate: "", toDate: "", amount: "0", attachment: null }); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editCRId ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title :</Label>
                <Input value={crForm.title} onChange={e => setCrForm({ ...crForm, title: e.target.value })} placeholder="Title" />
              </div>
              <div className="space-y-2">
                <Label>Date :</Label>
                <Input type="date" value={crForm.date} onChange={e => setCrForm({ ...crForm, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description :</Label>
              <Textarea value={crForm.description} onChange={e => setCrForm({ ...crForm, description: e.target.value })} placeholder="Description details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date/Time :</Label>
                <Input type="date" value={crForm.fromDate} onChange={e => setCrForm({ ...crForm, fromDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>To Date/Time :</Label>
                <Input type="date" value={crForm.toDate} onChange={e => setCrForm({ ...crForm, toDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={crForm.amount} onChange={e => setCrForm({ ...crForm, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Documents Upload</Label>
              <div className="flex items-center gap-2">
                <Input type="file" onChange={e => setCrForm({ ...crForm, attachment: e.target.files?.[0] || null })} className="cursor-pointer" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex-col sm:flex-col items-stretch">
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => editCRId ? updateCRMutation.mutate() : createCRMutation.mutate()} disabled={createCRMutation.isPending || updateCRMutation.isPending || !crForm.title}>
              {createCRMutation.isPending || updateCRMutation.isPending ? "Submitting..." : editCRId ? "Update" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={isViewTaskOpen} onOpenChange={setIsViewTaskOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-gray-500 text-xs">Title</Label>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  {viewingTask.title}
                  {viewingTask.billable && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">Billable</span>}
                </div>
              </div>
              <div>
                <Label className="text-gray-500 text-xs">Description</Label>
                <div className="text-gray-800 bg-gray-50 p-3 rounded-md min-h-[60px] text-sm">{viewingTask.description || "No description provided."}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 text-xs">Status</Label>
                  <div className="capitalize font-medium text-gray-800">{(viewingTask.status || "todo").replace("_", " ")}</div>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Hours</Label>
                  <div className="font-medium text-gray-800">{Number(viewingTask.actualHours || 0).toFixed(2)} spent / {Number(viewingTask.estimatedHours || 0).toFixed(2)} est.</div>
                </div>
              </div>
              <div>
                <Label className="text-gray-500 text-xs">Attachments</Label>
                <div className="mt-2 space-y-2">
                  {viewingTaskAttachments.length === 0 ? (
                    <div className="text-sm text-gray-500 italic pb-2">No attachments found for this task.</div>
                  ) : (
                    viewingTaskAttachments.map(att => (
                      <a key={att.id} href={att.filePath} target="_blank" rel="noreferrer" className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                        <Paperclip className="h-4 w-4 mr-2 text-blue-500" />
                        <span className="text-sm text-blue-600 truncate flex-1">{att.fileName}</span>
                        <Download className="h-4 w-4 text-gray-400" />
                      </a>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
