import React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalScopeProvider, useGlobalScope } from "@/contexts/global-scope";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { HeaderScopeSelector } from "@/components/header-scope-selector";
import { ChangePasswordModal } from "@/components/change-password-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as UserIcon, LogOut, Key, ChevronDown } from "lucide-react";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Companies from "@/pages/companies";
import Branches from "@/pages/branches";
import Bank from "@/pages/bank";
import PettyCash from "@/pages/petty-cash";
import Capital from "@/pages/capital";
import Employees from "@/pages/employees";
import Tasks from "@/pages/tasks";
import Accounting from "@/pages/accounting";
import LeaveManagement from "@/pages/leave-management";
import Reports from "@/pages/reports";
import CRM from "@/pages/crm";
import UsersPage from "@/pages/users";
import ComplianceDocuments from "@/pages/compliance-documents";
import ComplianceReminders from "@/pages/compliance-reminders";
import RBACPage from "@/pages/rbac";

// Logistics ERP Modules
import ZonesPage from "@/pages/zones";
import ContractsPage from "@/pages/contracts";
import FleetPage from "@/pages/fleet";
import RfqPage from "@/pages/rfq";
import OrdersPage from "@/pages/orders";
import DispatchPage from "@/pages/dispatch";
import DriverHubPage from "@/pages/driver-hub";
import DriverManagementPage from "@/pages/driver-management";
import FinanceExpandedPage from "@/pages/finance-expanded";
import SettingsPage from "@/pages/settings";

function PrivateRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/companies" component={Companies} />
      <Route path="/branches" component={Branches} />
      <Route path="/bank" component={Bank} />
      <Route path="/petty-cash" component={PettyCash} />
      <Route path="/capital" component={Capital} />
      <Route path="/employees" component={Employees} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/accounting" component={Accounting} />
      <Route path="/leave-management" component={LeaveManagement} />
      <Route path="/reports" component={Reports} />
      <Route path="/crm" component={CRM} />
      <Route path="/users" component={UsersPage} />
      <Route path="/compliance/documents" component={ComplianceDocuments} />
      <Route path="/compliance/reminders" component={ComplianceReminders} />
      <Route path="/rbac" component={RBACPage} />

      {/* Logistics ERP Routes */}
      <Route path="/logistics/zones" component={ZonesPage} />
      <Route path="/logistics/contracts" component={ContractsPage} />
      <Route path="/logistics/fleet" component={FleetPage} />
      <Route path="/logistics/rfq" component={RfqPage} />
      <Route path="/logistics/orders" component={OrdersPage} />
      <Route path="/logistics/dispatch" component={DispatchPage} />
      <Route path="/logistics/driver-hub" component={DriverHubPage} />
      <Route path="/logistics/driver-management" component={DriverManagementPage} />
      <Route path="/logistics/finance" component={FinanceExpandedPage} />
      <Route path="/settings" component={SettingsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayoutContent() {
  const { user, logout, canChangeScope } = useAuth();
  const { isScopeReady, isLoading: scopeLoading } = useGlobalScope();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const handleLogout = async () => {
    await logout();
  };

  // Show loading until scope is ready
  if (!isScopeReady || scopeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-muted-foreground">Loading shop context...</div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full print:h-auto print:block">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden print:overflow-visible">
          <header className="flex items-center justify-between gap-4 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 print:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              {canChangeScope && <HeaderScopeSelector />}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">
                  {user?.name || user?.username}
                </div>
                <div className="text-xs text-muted-foreground hidden md:block">
                  ({user?.role?.replace("_", " ")})
                </div>
              </div>
              <ThemeToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 p-1 rounded-md hover:bg-accent transition-colors" data-testid="user-menu-trigger">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                    <Key className="mr-2 h-4 w-4" />
                    <span>Change Password</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <PrivateRouter />
          </main>
          <ChangePasswordModal 
            open={isChangePasswordOpen} 
            onOpenChange={setIsChangePasswordOpen} 
          />
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedLayout() {
  return (
    <GlobalScopeProvider>
      <PermissionsProvider>
        <AuthenticatedLayoutContent />
        <Toaster />
      </PermissionsProvider>
    </GlobalScopeProvider>
  );
}

function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  return <Login />;
}

function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <AuthenticatedLayout />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="tt-erp-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Switch>
              <Route path="/login" component={PublicRoute} />
              <Route component={PrivateRoute} />
            </Switch>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
