import { useQuery } from "@tanstack/react-query";
import { 
  Banknote, 
  Users,
  ListTodo,
  Calendar,
  ArrowUpRight,
  Briefcase,
  Building2
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Bank Balance"
            value={stats?.bankBalance ?? 0}
            icon={Banknote}
            isCurrency
            description="Combined bank balances"
          />
          <MetricCard
            title="Total Employees"
            value={totalEmployees}
            icon={Users}
            description="Active staff members"
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
