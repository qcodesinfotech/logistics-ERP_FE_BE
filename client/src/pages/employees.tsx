import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserCircle, Plus, Pencil, Trash2, DollarSign, CreditCard, RotateCcw, FileText, Printer, History, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { CurrencyDisplay } from "@/components/currency-display";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAuthToken, getErrorMessage } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
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
import { Textarea } from "@/components/ui/textarea";
import type { Employee, Shop, Branch, BankAccount } from "@shared/schema";

const employeeSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  shopId: z.string().optional(),
  branchId: z.string().optional(),
  joiningDate: z.string().optional(),
  basicSalary: z.string().default("0.000"),
  allowances: z.string().default("0.000"),
  status: z.string().default("active"),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function Employees() {
  const [activeTab, setActiveTab] = useState("employees");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [employeePhotoUrl, setEmployeePhotoUrl] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [salaryForm, setSalaryForm] = useState({
    employeeId: "",
    month: currentMonth,
    year: currentYear,
    basicSalary: "0.000",
    allowances: "0.000",
    deductions: "0.000",
    advanceDeduction: "0.000",
    leaveDeduction: "0.000",
    unapprovedLeaveDays: "0",
    bankAccountId: "",
    notes: "",
  });

  const [loadingLeaveDeduction, setLoadingLeaveDeduction] = useState(false);

  const [advanceForm, setAdvanceForm] = useState({
    employeeId: "",
    amount: "",
    bankAccountId: "",
    reason: "",
  });

  const [isRepayDialogOpen, setIsRepayDialogOpen] = useState(false);
  const [repayingAdvance, setRepayingAdvance] = useState<any | null>(null);
  const [repayForm, setRepayForm] = useState({
    amount: "",
    bankAccountId: "",
    notes: "",
  });

  const [isPayslipDialogOpen, setIsPayslipDialogOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyAdvance, setHistoryAdvance] = useState<any | null>(null);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeCode: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      position: "",
      department: "",
      shopId: "",
      branchId: "",
      joiningDate: "",
      basicSalary: "0.000",
      allowances: "0.000",
      status: "active",
    },
  });

  // Helper function to get valid payable months/years for an employee
  const getValidPayablePeriods = (employee: Employee | null, paidMonths: Array<{month: number, year: number}>) => {
    if (!employee || !employee.joiningDate) return [];
    
    const joiningDate = new Date(employee.joiningDate);
    const joiningMonth = joiningDate.getMonth() + 1; // 1-12
    const joiningYear = joiningDate.getFullYear();
    
    const validPeriods: Array<{month: number, year: number, label: string}> = [];
    
    // Generate all months from joining date to current month
    let year = joiningYear;
    let month = joiningMonth;
    
    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
      // Check if this month is already paid
      const isPaid = paidMonths.some(p => p.month === month && p.year === year);
      
      if (!isPaid) {
        validPeriods.push({
          month,
          year,
          label: `${getMonthName(month)} ${year}`
        });
      }
      
      // Move to next month
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    
    return validPeriods;
  };

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: shops } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: salaryPayments, isLoading: loadingSalaries } = useQuery<any[]>({
    queryKey: ["/api/salary-payments"],
  });

  const { data: salaryAdvances, isLoading: loadingAdvances } = useQuery<any[]>({
    queryKey: ["/api/salary-advances"],
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee created successfully" });
      handleCloseDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EmployeeFormData & { id: string }) =>
      apiRequest("PATCH", `/api/employees/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee updated successfully" });
      handleCloseDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee deleted successfully" });
      setDeletingEmployee(null);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteSalaryPaymentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/salary-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-payments"] });
      toast({ title: "Salary payment deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteAdvanceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/salary-advances/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
      toast({ title: "Salary advance deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createSalaryPaymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/salary-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Salary payment recorded successfully" });
      setIsSalaryDialogOpen(false);
      setSalaryForm({
        employeeId: "",
        month: currentMonth,
        year: currentYear,
        basicSalary: "0.000",
        allowances: "0.000",
        deductions: "0.000",
        advanceDeduction: "0.000",
        leaveDeduction: "0.000",
        unapprovedLeaveDays: "0",
        bankAccountId: "",
        notes: "",
      });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createAdvanceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/salary-advances", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Advance recorded successfully" });
      setIsAdvanceDialogOpen(false);
      setAdvanceForm({ employeeId: "", amount: "", bankAccountId: "", reason: "" });
    },
    onError: async (error: any) => {
      let msg = "Failed to record advance";
      try {
        const text = await error.message;
        if (text) msg = text.replace(/^\d+:\s*/, "").replace(/^{?"error"?:\s*"?|"?}$/g, "");
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const repayAdvanceMutation = useMutation({
    mutationFn: (data: { advanceId: string; amount: string; bankAccountId: string; notes: string }) =>
      apiRequest("POST", `/api/salary-advances/${data.advanceId}/repay`, {
        amount: data.amount,
        bankAccountId: data.bankAccountId,
        notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Advance repayment recorded successfully" });
      setIsRepayDialogOpen(false);
      setRepayingAdvance(null);
      setRepayForm({ amount: "", bankAccountId: "", notes: "" });
    },
    onError: async (error: any) => {
      let msg = "Failed to record repayment";
      try {
        const text = await error.message;
        if (text) msg = text.replace(/^\d+:\s*/, "").replace(/^{?"error"?:\s*"?|"?}$/g, "");
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const handleOpenRepayDialog = (advance: any) => {
    setRepayingAdvance(advance);
    setRepayForm({
      amount: advance.remainingAmount || "",
      bankAccountId: "",
      notes: "",
    });
    setIsRepayDialogOpen(true);
  };

  const handleSubmitRepay = () => {
    if (!repayingAdvance) return;
    repayAdvanceMutation.mutate({
      advanceId: repayingAdvance.id,
      amount: repayForm.amount,
      bankAccountId: repayForm.bankAccountId,
      notes: repayForm.notes,
    });
  };

  const { data: repaymentHistory, isLoading: loadingHistory } = useQuery<any[]>({
    queryKey: ["/api/salary-advances", historyAdvance?.id, "history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/salary-advances/${historyAdvance?.id}/history`);
      return res.json();
    },
    enabled: !!historyAdvance?.id && isHistoryDialogOpen,
  });

  const handleOpenHistory = (advance: any) => {
    setHistoryAdvance(advance);
    setIsHistoryDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmployee(null);
    setEmployeePhotoUrl("");
    form.reset();
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeePhotoUrl((employee as any).photoUrl || "");
    form.reset({
      employeeCode: employee.employeeCode,
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      address: employee.address || "",
      position: employee.position || "",
      department: employee.department || "",
      shopId: employee.shopId || "",
      branchId: employee.branchId || "",
      joiningDate: employee.joiningDate || "",
      basicSalary: employee.basicSalary || "0.000",
      allowances: employee.allowances || "0.000",
      status: employee.status,
    });
    setIsDialogOpen(true);
  };

  const handleUploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload/employee-photo", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setEmployeePhotoUrl(data.url);
      } else {
        toast({ title: "Failed to upload photo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    }
    setUploadingPhoto(false);
  };

  const onSubmit = (data: EmployeeFormData) => {
    const payload = { 
      ...data, 
      photoUrl: employeePhotoUrl || undefined,
      joiningDate: data.joiningDate || null,
      branchId: data.branchId || null,
      shopId: data.shopId || null,
      email: data.email || null,
    };
    if (editingEmployee) {
      updateMutation.mutate({ ...payload, id: editingEmployee.id });
    } else {
      createMutation.mutate(payload);
    }
  };

  const fetchLeaveDeduction = async (employeeId: string, month: number, year: number) => {
    setLoadingLeaveDeduction(true);
    try {
      const authHeaders: Record<string, string> = {};
      const token = getAuthToken();
      if (token) authHeaders["Authorization"] = `Bearer ${token}`;
      
      const response = await fetch(`/api/employees/${employeeId}/unapproved-leave-deduction?month=${month}&year=${year}`, { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        setSalaryForm(prev => ({
          ...prev,
          leaveDeduction: data.leaveDeduction?.toFixed(3) || "0.000",
          unapprovedLeaveDays: data.unapprovedDays?.toString() || "0",
        }));
      }
    } catch (error) {
      console.error("Failed to fetch leave deduction");
    }
    setLoadingLeaveDeduction(false);
  };

  const handleOpenSalaryDialog = async (employee: Employee) => {
    setSelectedEmployee(employee);
    let advanceBalance = 0;
    try {
      const response = await fetch(`/api/employees/${employee.id}/advance-balance`);
      if (response.ok) {
        const data = await response.json();
        advanceBalance = parseFloat(data.balance || 0);
      }
    } catch (error) {
      console.error("Failed to fetch advance balance");
    }
    
    // Get paid months for this employee
    const paidMonths = (salaryPayments || [])
      .filter((p: any) => p.employeeId === employee.id)
      .map((p: any) => ({ month: p.month, year: p.year }));
    
    // Get valid payable periods
    const validPeriods = getValidPayablePeriods(employee, paidMonths);
    
    // Use first valid period, or fallback to current month/year
    const firstPeriod = validPeriods.length > 0 ? validPeriods[0] : { month: currentMonth, year: currentYear };
    
    setSalaryForm({
      employeeId: employee.id,
      month: firstPeriod.month,
      year: firstPeriod.year,
      basicSalary: employee.basicSalary || "0.000",
      allowances: employee.allowances || "0.000",
      deductions: "0.000",
      advanceDeduction: advanceBalance > 0 ? advanceBalance.toFixed(3) : "0.000",
      leaveDeduction: "0.000",
      unapprovedLeaveDays: "0",
      bankAccountId: "",
      notes: "",
    });
    setIsSalaryDialogOpen(true);
    
    // Fetch leave deduction
    fetchLeaveDeduction(employee.id, firstPeriod.month, firstPeriod.year);
  };

  const handleOpenAdvanceDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setAdvanceForm({
      employeeId: employee.id,
      amount: "",
      bankAccountId: "",
      reason: "",
    });
    setIsAdvanceDialogOpen(true);
  };

  const calculateNetSalary = () => {
    const basic = parseFloat(salaryForm.basicSalary) || 0;
    const allowances = parseFloat(salaryForm.allowances) || 0;
    const deductions = parseFloat(salaryForm.deductions) || 0;
    const advanceDeduction = parseFloat(salaryForm.advanceDeduction) || 0;
    const leaveDeduction = parseFloat(salaryForm.leaveDeduction) || 0;
    return basic + allowances - deductions - advanceDeduction - leaveDeduction;
  };

  const handleSubmitSalary = () => {
    const netSalary = calculateNetSalary();
    createSalaryPaymentMutation.mutate({
      ...salaryForm,
      netSalary: netSalary.toFixed(3),
      status: "paid",
    });
  };

  const handleSubmitAdvance = () => {
    createAdvanceMutation.mutate(advanceForm);
  };

  const totalSalary = (employee: Employee) => {
    return parseFloat(employee.basicSalary || "0") + parseFloat(employee.allowances || "0");
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = employees?.find(e => e.id === employeeId);
    return emp?.name || "Unknown";
  };

  const getMonthName = (month: number) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[month - 1] || "";
  };

  const employeeColumns = [
    { 
      key: "photo",
      header: "Photo",
      render: (e: Employee) => (
        e.photoUrl ? (
          <img src={e.photoUrl} alt={e.name} className="w-10 h-10 object-cover rounded-full shadow-sm" />
        ) : (
          <div className="w-10 h-10 bg-muted flex items-center justify-center rounded-full shadow-sm">
            <UserCircle className="w-6 h-6 text-muted-foreground" />
          </div>
        )
      )
    },
    { key: "employeeCode", header: "Code" },
    { key: "name", header: "Name" },
    { key: "position", header: "Position", render: (e: Employee) => e.position || "-" },
    { key: "department", header: "Department", render: (e: Employee) => e.department || "-" },
    { key: "phone", header: "Phone", render: (e: Employee) => e.phone || "-" },
    {
      key: "salary",
      header: "Total Salary",
      className: "text-right",
      render: (e: Employee) => <CurrencyDisplay amount={totalSalary(e)} />,
    },
    {
      key: "status",
      header: "Status",
      render: (e: Employee) => <StatusBadge status={e.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (employee: Employee) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleOpenSalaryDialog(employee)} title="Pay Salary">
            <DollarSign className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleOpenAdvanceDialog(employee)} title="Give Advance">
            <CreditCard className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleEdit(employee)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setDeletingEmployee(employee)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleViewPayslip = (payment: any) => {
    setSelectedPayslip(payment);
    setIsPayslipDialogOpen(true);
  };

  const handlePrintPayslip = () => {
    window.print();
  };

  const salaryColumns = [
    { key: "employee", header: "Employee", render: (p: any) => getEmployeeName(p.employeeId) },
    { key: "period", header: "Period", render: (p: any) => `${getMonthName(p.month)} ${p.year}` },
    { key: "basicSalary", header: "Basic", className: "text-right", render: (p: any) => <CurrencyDisplay amount={parseFloat(p.basicSalary || 0)} /> },
    { key: "allowances", header: "Allowances", className: "text-right", render: (p: any) => <CurrencyDisplay amount={parseFloat(p.allowances || 0)} /> },
    { key: "deductions", header: "Deductions", className: "text-right", render: (p: any) => <CurrencyDisplay amount={parseFloat(p.deductions || 0)} /> },
    { key: "advanceDeduction", header: "Advance Ded.", className: "text-right", render: (p: any) => <CurrencyDisplay amount={parseFloat(p.advanceDeduction || 0)} /> },
    { key: "leaveDeduction", header: "Leave Ded.", className: "text-right", render: (p: any) => <CurrencyDisplay amount={parseFloat(p.leaveDeduction || 0)} /> },
    { key: "netSalary", header: "Net Salary", className: "text-right font-medium", render: (p: any) => <CurrencyDisplay amount={parseFloat(p.netSalary || 0)} /> },
    { key: "status", header: "Status", render: (p: any) => <StatusBadge status={p.status} /> },
    { 
      key: "actions", 
      header: "Actions", 
      className: "text-right",
      render: (p: any) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleViewPayslip(p)} title="View Payslip">
            <FileText className="h-4 w-4 mr-1" />
            Payslip
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" size="sm" onClick={() => deleteSalaryPaymentMutation.mutate(p.id)} title="Delete Payment">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    },
  ];

  const advanceColumns = [
    { key: "employee", header: "Employee", render: (a: any) => getEmployeeName(a.employeeId) },
    { key: "date", header: "Date", render: (a: any) => new Date(a.advanceDate).toLocaleDateString() },
    { key: "amount", header: "Amount", className: "text-right", render: (a: any) => <CurrencyDisplay amount={parseFloat(a.amount || 0)} /> },
    { key: "repaid", header: "Repaid", className: "text-right", render: (a: any) => <CurrencyDisplay amount={parseFloat(a.repaidAmount || 0)} /> },
    { key: "remaining", header: "Remaining", className: "text-right font-medium", render: (a: any) => <CurrencyDisplay amount={parseFloat(a.remainingAmount || 0)} /> },
    { key: "reason", header: "Reason", render: (a: any) => a.reason || "-" },
    { key: "status", header: "Status", render: (a: any) => <StatusBadge status={a.status} /> },
    { 
      key: "actions", 
      header: "Actions", 
      className: "text-right",
      render: (a: any) => (
        <div className="flex items-center justify-end gap-1">
          {parseFloat(a.repaidAmount || 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={() => handleOpenHistory(a)} title="View Repayment History">
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          )}
          {parseFloat(a.remainingAmount || 0) > 0 && (
            <Button variant="ghost" size="sm" onClick={() => handleOpenRepayDialog(a)} title="Record Repayment">
              <RotateCcw className="h-4 w-4 mr-1" />
              Repay
            </Button>
          )}
          {isSuperAdmin && (
            <Button variant="ghost" size="sm" onClick={() => deleteAdvanceMutation.mutate(a.id)} title="Delete Advance">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Employees & Payroll"
        description="Manage employees, salary payments, and advances"
      >
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="salary-payments">Salary Payments</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <TableSkeleton rows={5} cols={8} />
              ) : !employees || employees.length === 0 ? (
                <EmptyState
                  icon={UserCircle}
                  title="No employees yet"
                  description="Add employees to manage payroll and assignments."
                >
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </EmptyState>
              ) : (
                <DataTable columns={employeeColumns} data={employees} getRowKey={(e) => e.id} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary-payments">
          <Card>
            <CardHeader>
              <CardTitle>Salary Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSalaries ? (
                <TableSkeleton rows={5} cols={8} />
              ) : !salaryPayments || salaryPayments.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="No salary payments yet"
                  description="Pay salaries from the Employees tab using the dollar icon."
                />
              ) : (
                <DataTable columns={salaryColumns} data={salaryPayments} getRowKey={(p) => p.id} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader>
              <CardTitle>Salary Advances</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAdvances ? (
                <TableSkeleton rows={5} cols={7} />
              ) : !salaryAdvances || salaryAdvances.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="No advances yet"
                  description="Give salary advances from the Employees tab using the card icon."
                />
              ) : (
                <DataTable columns={advanceColumns} data={salaryAdvances} getRowKey={(a) => a.id} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="employeeCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Code *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" placeholder="email@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Driver">Driver</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Operational">Operational</SelectItem>
                        <SelectItem value="Management">Management</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="branchId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="joiningDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date</FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="basicSalary" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic Salary (BD)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.001" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="allowances" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowances (BD)</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.001" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Employee Photo Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee Photo</label>
                <div className="flex items-center gap-3">
                  {employeePhotoUrl ? (
                    <div className="relative">
                      <img src={employeePhotoUrl} alt="Employee" className="w-20 h-20 rounded-full object-cover border" />
                      <button type="button" onClick={() => setEmployeePhotoUrl("")} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <UserCircle className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPhoto(file);
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP. Max 5MB.</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingEmployee ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Salary Payment Dialog */}
      <Dialog open={isSalaryDialogOpen} onOpenChange={setIsSalaryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pay Salary - {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          {(() => {
            // Calculate valid periods for this employee
            const paidMonths = (salaryPayments || [])
              .filter((p: any) => p.employeeId === selectedEmployee?.id)
              .map((p: any) => ({ month: p.month, year: p.year }));
            const validPeriods = getValidPayablePeriods(selectedEmployee, paidMonths);
            const hasValidPeriods = validPeriods.length > 0;
            const joiningInfo = selectedEmployee?.joiningDate 
              ? new Date(selectedEmployee.joiningDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : 'N/A';
            
            return (
              <div className="space-y-4">
                {!hasValidPeriods ? (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">
                    <p className="font-medium">No unpaid salary periods available</p>
                    <p className="text-sm mt-1">
                      Employee joined: {joiningInfo}<br />
                      All salaries from joining date to current month ({getMonthName(currentMonth)} {currentYear}) have been paid.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium">Salary Period</label>
                      <Select 
                        value={`${salaryForm.month}-${salaryForm.year}`} 
                        onValueChange={(v) => {
                          const [month, year] = v.split('-').map(Number);
                          setSalaryForm(prev => ({ ...prev, month, year, leaveDeduction: "0.000", unapprovedLeaveDays: "0" }));
                          if (selectedEmployee) {
                            fetchLeaveDeduction(selectedEmployee.id, month, year);
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                        <SelectContent>
                          {validPeriods.map(p => (
                            <SelectItem key={`${p.month}-${p.year}`} value={`${p.month}-${p.year}`}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Employee joined: {joiningInfo} | Only unpaid months from joining to current month shown
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Basic Salary</label>
                        <Input type="number" step="0.001" value={salaryForm.basicSalary} onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Allowances</label>
                        <Input type="number" step="0.001" value={salaryForm.allowances} onChange={(e) => setSalaryForm({ ...salaryForm, allowances: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Deductions</label>
                        <Input type="number" step="0.001" value={salaryForm.deductions} onChange={(e) => setSalaryForm({ ...salaryForm, deductions: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Advance Deduction</label>
                        <Input type="number" step="0.001" value={salaryForm.advanceDeduction} onChange={(e) => setSalaryForm({ ...salaryForm, advanceDeduction: e.target.value })} />
                        {parseFloat(salaryForm.advanceDeduction) > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Outstanding advance auto-filled</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Leave Deduction</label>
                        <Input type="number" step="0.001" value={salaryForm.leaveDeduction} disabled className="bg-muted" />
                        {parseFloat(salaryForm.unapprovedLeaveDays) > 0 && (
                          <p className="text-xs text-orange-600 mt-1">{salaryForm.unapprovedLeaveDays} unapproved leave days</p>
                        )}
                        {loadingLeaveDeduction && (
                          <p className="text-xs text-muted-foreground mt-1">Calculating...</p>
                        )}
                      </div>
                      <div className="flex items-end">
                        <p className="text-xs text-muted-foreground">
                          Unapproved or rejected leave in this period will be deducted from salary
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Bank Account</label>
                      <Select value={salaryForm.bankAccountId} onValueChange={(v) => setSalaryForm({ ...salaryForm, bankAccountId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                        <SelectContent>
                          {bankAccounts?.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name} - {acc.bankName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} />
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Net Salary:</span>
                        <CurrencyDisplay amount={calculateNetSalary()} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSalaryDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSubmitSalary} disabled={createSalaryPaymentMutation.isPending || !salaryForm.bankAccountId}>
                        {createSalaryPaymentMutation.isPending ? "Processing..." : "Pay Salary"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </div>
            );
          })()}
          {/* Cancel button always visible */}
          {(() => {
            const paidMonths = (salaryPayments || [])
              .filter((p: any) => p.employeeId === selectedEmployee?.id)
              .map((p: any) => ({ month: p.month, year: p.year }));
            const validPeriods = getValidPayablePeriods(selectedEmployee, paidMonths);
            return validPeriods.length === 0 ? (
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSalaryDialogOpen(false)}>Close</Button>
              </DialogFooter>
            ) : null;
          })()}
        </DialogContent>
      </Dialog>

      {/* Advance Dialog */}
      <Dialog open={isAdvanceDialogOpen} onOpenChange={setIsAdvanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Advance - {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (BD)</label>
              <Input type="number" step="0.001" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} placeholder="Enter amount" />
            </div>
            <div>
              <label className="text-sm font-medium">Bank Account</label>
              <Select value={advanceForm.bankAccountId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, bankAccountId: v })}>
                <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} - {acc.bankName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Textarea value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} placeholder="Optional reason for advance" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdvanceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitAdvance} disabled={createAdvanceMutation.isPending || !advanceForm.amount || !advanceForm.bankAccountId}>
              {createAdvanceMutation.isPending ? "Processing..." : "Give Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repay Advance Dialog */}
      <Dialog open={isRepayDialogOpen} onOpenChange={setIsRepayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repay Advance - {repayingAdvance ? getEmployeeName(repayingAdvance.employeeId) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {repayingAdvance && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>Original Amount:</span>
                  <CurrencyDisplay amount={parseFloat(repayingAdvance.amount || 0)} />
                </div>
                <div className="flex justify-between">
                  <span>Already Repaid:</span>
                  <CurrencyDisplay amount={parseFloat(repayingAdvance.repaidAmount || 0)} />
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Remaining Balance:</span>
                  <CurrencyDisplay amount={parseFloat(repayingAdvance.remainingAmount || 0)} />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Repayment Amount (BD)</label>
              <Input 
                type="number" 
                step="0.001" 
                value={repayForm.amount} 
                onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })} 
                placeholder="Enter repayment amount" 
                max={repayingAdvance?.remainingAmount}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Bank Account (to deposit)</label>
              <Select value={repayForm.bankAccountId} onValueChange={(v) => setRepayForm({ ...repayForm, bankAccountId: v })}>
                <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} - {acc.bankName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={repayForm.notes} onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRepayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitRepay} disabled={repayAdvanceMutation.isPending || !repayForm.amount || !repayForm.bankAccountId}>
              {repayAdvanceMutation.isPending ? "Processing..." : "Record Repayment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip Dialog */}
      <Dialog open={isPayslipDialogOpen} onOpenChange={setIsPayslipDialogOpen}>
        <DialogContent className="max-w-2xl print:max-w-full print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip
            </DialogTitle>
          </DialogHeader>
          
          {selectedPayslip && (() => {
            const employee = employees?.find(e => e.id === selectedPayslip.employeeId);
            const shop = shops?.find(s => s.id === employee?.shopId);
            const branch = branches?.find(b => b.id === employee?.branchId);
            
            return (
              <div className="payslip-content border rounded-lg p-6 bg-white">
                {/* Header */}
                <div className="text-center border-b pb-4 mb-4">
                  <h2 className="text-xl font-bold">{shop?.name || "Company Name"}</h2>
                  <p className="text-sm text-muted-foreground">{branch?.name || ""}</p>
                  <h3 className="text-lg font-semibold mt-2">PAYSLIP</h3>
                  <p className="text-sm">{getMonthName(selectedPayslip.month)} {selectedPayslip.year}</p>
                </div>

                {/* Employee Details */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <p><strong>Employee Name:</strong> {employee?.name || "N/A"}</p>
                    <p><strong>Employee Code:</strong> {employee?.employeeCode || "N/A"}</p>
                    <p><strong>Department:</strong> {employee?.department || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <p><strong>Position:</strong> {employee?.position || "N/A"}</p>
                    <p><strong>Joining Date:</strong> {employee?.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : "N/A"}</p>
                    <p><strong>Payment Date:</strong> {selectedPayslip.paymentDate ? new Date(selectedPayslip.paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Earnings and Deductions */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* Earnings */}
                  <div className="border rounded p-4">
                    <h4 className="font-semibold border-b pb-2 mb-2">Earnings</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Basic Salary</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.basicSalary || 0)} />
                      </div>
                      <div className="flex justify-between">
                        <span>Allowances</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.allowances || 0)} />
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                        <span>Gross Earnings</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.basicSalary || 0) + parseFloat(selectedPayslip.allowances || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="border rounded p-4">
                    <h4 className="font-semibold border-b pb-2 mb-2">Deductions</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Other Deductions</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.deductions || 0)} />
                      </div>
                      <div className="flex justify-between">
                        <span>Advance Recovery</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.advanceDeduction || 0)} />
                      </div>
                      <div className="flex justify-between">
                        <span>Leave Deduction ({selectedPayslip.unapprovedLeaveDays || 0} days)</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.leaveDeduction || 0)} />
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                        <span>Total Deductions</span>
                        <CurrencyDisplay amount={parseFloat(selectedPayslip.deductions || 0) + parseFloat(selectedPayslip.advanceDeduction || 0) + parseFloat(selectedPayslip.leaveDeduction || 0)} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Salary */}
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Net Salary Payable</span>
                    <CurrencyDisplay amount={parseFloat(selectedPayslip.netSalary || 0)} />
                  </div>
                </div>

                {/* Notes */}
                {selectedPayslip.notes && (
                  <div className="mt-4 text-sm">
                    <p><strong>Notes:</strong> {selectedPayslip.notes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
                  <p>This is a computer-generated payslip and does not require a signature.</p>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsPayslipDialogOpen(false)}>Close</Button>
            <Button onClick={handlePrintPayslip}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repayment History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Repayment History
            </DialogTitle>
          </DialogHeader>
          {historyAdvance && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Employee:</span>
                  <span className="font-medium">{getEmployeeName(historyAdvance.employeeId)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Advance Amount:</span>
                  <span className="font-medium"><CurrencyDisplay amount={parseFloat(historyAdvance.amount || 0)} /></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Repaid:</span>
                  <span className="font-medium text-green-600"><CurrencyDisplay amount={parseFloat(historyAdvance.repaidAmount || 0)} /></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Remaining:</span>
                  <span className="font-medium text-orange-600"><CurrencyDisplay amount={parseFloat(historyAdvance.remainingAmount || 0)} /></span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Payment Records</h4>
                {loadingHistory ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : !repaymentHistory || repaymentHistory.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No repayment records found</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {repaymentHistory.map((payment: any, index: number) => (
                      <div key={payment.id || index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            <CurrencyDisplay amount={parseFloat(payment.amount || 0)} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(payment.date).toLocaleDateString()} - {payment.reference}
                          </div>
                          {payment.notes && (
                            <div className="text-xs text-muted-foreground italic">{payment.notes}</div>
                          )}
                        </div>
                        <StatusBadge status="completed" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEmployee} onOpenChange={() => setDeletingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingEmployee?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingEmployee && deleteMutation.mutate(deletingEmployee.id)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
