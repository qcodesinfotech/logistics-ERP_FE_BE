import { Link, useLocation } from "wouter";
import {
  Building2,
  GitBranch,
  Package,
  Users,
  LayoutDashboard,
  Banknote,
  Wallet,
  PiggyBank,
  UserCircle,
  ListTodo,
  FileText,
  Calculator,
  Calendar,
  BarChart3,
  Scale,
  Shield,
  Target,
  Truck,
  MapPin,
  ClipboardList,
  Clock,
  Settings,
  Receipt,
  FileCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/contexts/permissions-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  menuKey?: string;
  superAdminOnly?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, menuKey: "dashboard" },
    ],
  },
  {
    label: "Organization",
    items: [
      { title: "Companies", url: "/companies", icon: Building2, menuKey: "companies" },
      { title: "Branches", url: "/branches", icon: GitBranch, menuKey: "branches" },
      { title: "Users", url: "/users", icon: Users, menuKey: "users", superAdminOnly: true },
      // { title: "Compliance Reminders", url: "/compliance/reminders", icon: Clock, menuKey: "compliance" },
      { title: "Roles & Permissions", url: "/rbac", icon: Shield, menuKey: "rbac", superAdminOnly: true },
      // { title: "System Settings", url: "/settings", icon: Settings, menuKey: "settings", superAdminOnly: true },
    ],
  },
  {
    label: "Logistics ERP",
    items: [
      { title: "Clients", url: "/logistics/clients", icon: Users, menuKey: "clients" },
      { title: "Zonal Config", url: "/logistics/zones", icon: MapPin },
      { title: "Contracts", url: "/logistics/contracts", icon: FileText },
      { title: "Fleet & Assets", url: "/logistics/fleet", icon: Truck },
      { title: "RFQ System", url: "/logistics/rfq", icon: Calculator },
      { title: "Order Book", url: "/logistics/orders", icon: ClipboardList },
      { title: "Dispatch Board", url: "/logistics/dispatch", icon: BarChart3 },
      { title: "Daily Dispatch", url: "/logistics/daily-dispatch", icon: Truck },
      { title: "Delivery Receipts", url: "/logistics/deliveries", icon: FileCheck },
      { title: "Trucking Invoices", url: "/logistics/invoices", icon: Receipt },
      { title: "Contract Invoices", url: "/logistics/contract-invoices", icon: Receipt },
      { title: "Driver Geo-Hub", url: "/logistics/driver-hub", icon: UserCircle },
      { title: "Logistics Finance", url: "/logistics/finance", icon: Calculator },
    ],
  },
  {
    label: "Accounting",
    items: [
      { title: "Chart of Accounts", url: "/accounting", icon: Calculator, menuKey: "chart_of_accounts" },
      { title: "Bank Accounts", url: "/bank", icon: Banknote, menuKey: "bank_accounts" },
      { title: "Petty Cash", url: "/petty-cash", icon: Wallet, menuKey: "petty_cash" },
      { title: "Capital", url: "/capital", icon: PiggyBank, menuKey: "capital" },
    ],
  },
  {
    label: "HR & Payroll",
    items: [
      { title: "Employees", url: "/employees", icon: UserCircle, menuKey: "employees" },
      { title: "Leave Management", url: "/leave-management", icon: Calendar, menuKey: "leave_management" },
      { title: "Tasks", url: "/tasks", icon: ListTodo, menuKey: "tasks" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { title: "Documents", url: "/compliance/documents", icon: FileText, menuKey: "compliance_documents" },
      { title: "Reminders", url: "/compliance/reminders", icon: Calendar, menuKey: "compliance_reminders" },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Trial Balance", url: "/reports", icon: Scale, menuKey: "reports" },
      { title: "All Reports", url: "/reports", icon: BarChart3, menuKey: "reports" },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { isSuperAdmin, hasReadPermission, isLoading: permissionsLoading } = usePermissions();

  const canViewItem = (item: MenuItem): boolean => {
    if (isSuperAdmin) return true;
    if (item.superAdminOnly) return false;
    if (!item.menuKey) return true;
    return hasReadPermission(item.menuKey);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent">
            <img src="/invoice-logo.png" className="h-8 w-8 object-contain" alt="Logo" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Logistics</span>
            <span className="text-xs text-muted-foreground">ERP System</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter(canViewItem);
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive = location === item.url ||
                      (item.url !== "/" && location.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          data-testid={`nav-${item.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="text-xs text-muted-foreground">
          Bahraini Dinar (BD) Currency
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
