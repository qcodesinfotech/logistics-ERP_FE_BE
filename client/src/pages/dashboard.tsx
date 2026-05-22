import { useQuery } from "@tanstack/react-query";
import { 
  Banknote, 
  Users,
  ListTodo,
  Calendar,
  ArrowUpRight,
  Briefcase,
  Building2,
  AlertTriangle,
  MapPin,
  Truck,
  PackageSearch
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/metric-card";
import { CurrencyDisplay } from "@/components/currency-display";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { MetricCardsSkeleton, TableSkeleton } from "@/components/loading-skeleton";
import { Link } from "wouter";
import type { BankAccount, Employee, Task } from "@shared/schema";
import { useGlobalScope } from "@/contexts/global-scope";
import { apiRequest } from "@/lib/queryClient";

interface DashboardStats {
  bankBalance: number;
  pendingLeaveRequests: number;
}

export default function Dashboard() {
  const { currentShopId, currentBranchId } = useGlobalScope();
  
  // Dashboard stats from server (contains bank balance and leave requests)
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard", currentShopId, currentBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentShopId) params.append("shopId", currentShopId);
      if (currentBranchId) params.append("branchId", currentBranchId);
      const url = `/api/dashboard${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  // Fetch employees to show total count
  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch tasks to show pending tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", currentBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentBranchId) params.append("branchId", currentBranchId);
      const url = `/api/tasks${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  // Fetch bank accounts to show balances
  const { data: bankAccounts = [], isLoading: accountsLoading } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank/accounts", currentBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentBranchId) params.append("branchId", currentBranchId);
      const url = `/api/bank/accounts${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const isLoading = statsLoading || employeesLoading || tasksLoading || accountsLoading;

  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const totalEmployees = employees.length;

  const bankAccountColumns = [
    { key: "accountName", header: "Account Name" },
    { key: "accountNumber", header: "Account Number" },
    { key: "bankName", header: "Bank" },
    { key: "currentBalance", header: "Balance", className: "text-right", render: (acc: BankAccount) => <CurrencyDisplay amount={acc.currentBalance} /> },
  ];

  const taskColumns = [
    { key: "title", header: "Task Title" },
    { key: "priority", header: "Priority", render: (task: Task) => <span className="capitalize">{task.priority}</span> },
    { key: "status", header: "Status", render: (task: Task) => <StatusBadge status={task.status} /> },
    { key: "dueDate", header: "Due Date", render: (task: Task) => task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-" },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader 
        title="Dashboard" 
        description="Overview of your business performance, HR, and accounting"
      />

      {isLoading ? (
        <MetricCardsSkeleton count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            title="Total Bank Balance"
            value={stats?.bankBalance ?? 0}
            icon={Banknote}
            isCurrency
            description="Combined bank balances"
          />
          <MetricCard
            title="Pending Leaves"
            value={stats?.pendingLeaveRequests ?? 0}
            icon={Calendar}
            description="Awaiting approval"
          />
          <MetricCard
            title="Pending Tasks"
            value={pendingTasks.length}
            icon={ListTodo}
            description="In progress or todo"
          />
          <MetricCard
            title="Active Orders"
            value={24}
            icon={PackageSearch}
            description="Currently in transit"
          />
          <MetricCard
            title="Pending Dispatch"
            value={8}
            icon={Truck}
            description="Awaiting assignment"
          />
          <MetricCard
            title="Logistics Alerts"
            value={3}
            icon={AlertTriangle}
            description="Delays & issues"
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="text-base font-medium">Bank Accounts Summary</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bank">View Accounts</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
              <DataTable
                columns={bankAccountColumns}
                data={bankAccounts.slice(0, 5)}
                getRowKey={(acc) => acc.id}
                emptyMessage="No bank accounts registered"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="text-base font-medium">Recent Standalone Tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tasks">View All Tasks</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
              <DataTable
                columns={taskColumns}
                data={pendingTasks.slice(0, 5)}
                getRowKey={(task) => task.id}
                emptyMessage="No pending tasks"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Smart Command Center Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4 border-b">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Smart Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-start gap-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-amber-900 dark:text-amber-300">Delayed Transit: TRP-1002</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">Driver John Doe is 45 mins behind schedule due to border delays.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-red-900 dark:text-red-300">Incomplete Order: ORD-8842</p>
                <p className="text-xs text-red-700 dark:text-red-400">Partial delivery recorded. Missing 2 pallets.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4 border-b">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-primary">
              <MapPin className="h-5 w-5" /> Zone-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">North Zone</span>
                <span className="text-green-600 text-xs font-bold">+14% Revenue</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[85%] rounded-full"></div>
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="font-medium">South Zone</span>
                <span className="text-amber-600 text-xs font-bold">92% Dispatch Rate</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full w-[60%] rounded-full"></div>
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="font-medium">Border Ops</span>
                <span className="text-blue-600 text-xs font-bold">4 Active Trips</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[45%] rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 cursor-pointer" asChild>
              <Link href="/bank">
                <Banknote className="h-5 w-5 text-primary" />
                <span>Bank Transactions</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 cursor-pointer" asChild>
              <Link href="/employees">
                <Users className="h-5 w-5 text-primary" />
                <span>Add Employee</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 cursor-pointer" asChild>
              <Link href="/leave-management">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Leave Management</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 cursor-pointer" asChild>
              <Link href="/tasks">
                <ListTodo className="h-5 w-5 text-primary" />
                <span>Create Task</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
