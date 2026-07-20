import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Ban, CheckCircle, Building2, ShieldCheck, X } from "lucide-react";
import { useGlobalScope } from "@/contexts/global-scope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { MultiSelect } from "@/components/ui/multi-select";
import type { Employee, Company, Role, Branch, Shop } from "@shared/schema";

interface User {
  id: string; username: string; name: string | null; email: string | null;
  role: string; employeeId: string | null; companyId: string | null;
  shopId: string | null; branchId: string | null; warehouseId: string | null;
  status: string; lastLogin: string | null;
}

interface UserScope {
  id: string; userId: string; companyId: string | null;
  shopId: string | null; branchId: string | null;
}

interface ScopeRow { companyId: string; shopId: string; branchId: string; }

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().default("staff"),
  employeeId: z.string().optional(),
  companyId: z.string().optional(),
  shopId: z.string().optional(),
  branchId: z.string().optional(),
  warehouseId: z.string().optional(),
  status: z.string().default("active"),
});
type UserFormData = z.infer<typeof userSchema>;

export default function UsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [blockingUser, setBlockingUser] = useState<User | null>(null);
  const [scopeUser, setScopeUser] = useState<User | null>(null);
  const [selectedScopeCompanies, setSelectedScopeCompanies] = useState<string[]>([]);
  const [selectedScopeShops, setSelectedScopeShops] = useState<string[]>([]);
  const [selectedScopeBranches, setSelectedScopeBranches] = useState<string[]>([]);
  const { toast } = useToast();
  const {
    currentCompanyId, currentShopId, currentBranchId, currentWarehouseId,
    currentShop, currentBranch, currentWarehouse, currentCompany,
  } = useGlobalScope();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", password: "", name: "", email: "", role: "staff", employeeId: "", companyId: "", shopId: "", branchId: "", warehouseId: "", status: "active" },
  });

  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { data: companies = [] } = useQuery<Company[]>({ queryKey: ["/api/companies"] });
  const { data: shops = [] } = useQuery<{ id: string; name: string; companyId?: string }[]>({ queryKey: ["/api/shops"] });
  const { data: branches = [] } = useQuery<{ id: string; name: string; shopId?: string }[]>({ queryKey: ["/api/branches"] });
  const { data: roles = [] } = useQuery<Role[]>({ queryKey: ["/api/rbac/roles"] });

  const findRoleIdBySlug = (slug: string) => {
    if (slug === "super_admin") return null;
    return roles.find(r => r.name.toLowerCase().replace(/\s+/g, "_") === slug || r.name.toLowerCase() === slug || r.name === slug)?.id || null;
  };

  // ─── Scope dialog ────────────────────────────────────────────────────────────
  const openScopeDialog = async (user: User) => {
    setScopeUser(user);
    try {
      const res = await apiRequest("GET", `/api/users/${user.id}/scopes`);
      const existing: UserScope[] = await res.json();
      const compIds: string[] = [];
      const shopIds: string[] = [];
      const branchIds: string[] = [];

      existing.forEach(s => {
        if (s.companyId && !s.shopId && !s.branchId) compIds.push(s.companyId);
        else if (s.shopId && !s.branchId) shopIds.push(s.shopId);
        else if (s.branchId) branchIds.push(s.branchId);
        // Handle combined rows by selecting all components
        else {
          if (s.companyId) compIds.push(s.companyId);
          if (s.shopId) shopIds.push(s.shopId);
          if (s.branchId) branchIds.push(s.branchId);
        }
      });

      setSelectedScopeCompanies(Array.from(new Set(compIds)));
      setSelectedScopeShops(Array.from(new Set(shopIds)));
      setSelectedScopeBranches(Array.from(new Set(branchIds)));
    } catch (error) {
      console.error("Failed to load user scopes:", error);
      setSelectedScopeCompanies([]);
      setSelectedScopeShops([]);
      setSelectedScopeBranches([]);
    }
  };

  const saveScopesMutation = useMutation({
    mutationFn: async () => {
      const scopes = [
        ...selectedScopeCompanies.map(id => ({ companyId: id, shopId: null, branchId: null })),
        ...selectedScopeShops.map(id => ({ companyId: null, shopId: id, branchId: null })),
        ...selectedScopeBranches.map(id => ({ companyId: null, shopId: null, branchId: id })),
      ];
      return apiRequest("PUT", `/api/users/${scopeUser!.id}/scopes`, { scopes });
    },
    onSuccess: () => {
      toast({ title: "Scope assignments saved" });
      setScopeUser(null);
    },
    onError: () => toast({ title: "Failed to save scopes", variant: "destructive" }),
  });

  // ─── User CRUD mutations ──────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!data.password?.trim()) throw new Error("Password is required for new users");
      return apiRequest("POST", "/api/users", { ...data, roleId: findRoleIdBySlug(data.role), employeeId: data.employeeId || null, companyId: data.companyId || null, shopId: data.shopId || null, branchId: data.branchId || null, warehouseId: data.warehouseId || null });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); form.reset(); toast({ title: "User created successfully" }); },
    onError: (e: any) => toast({ title: "Failed to create user", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UserFormData & { id: string }) => {
      const { id, password, ...rest } = data;
      const payload: any = { ...rest, roleId: findRoleIdBySlug(rest.role), employeeId: rest.employeeId || null, companyId: rest.companyId || null, shopId: rest.shopId || null, branchId: rest.branchId || null, warehouseId: rest.warehouseId || null };
      if (password?.trim()) payload.password = password;
      return apiRequest("PATCH", `/api/users/${id}`, payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setIsDialogOpen(false); setEditingUser(null); form.reset(); toast({ title: "User updated successfully" }); },
    onError: (e: any) => toast({ title: "Failed to update user", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setDeletingUser(null); toast({ title: "User deleted successfully" }); },
    onError: (e: any) => toast({ title: "Failed to delete user", description: e.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/users/${id}/status`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setBlockingUser(null); toast({ title: "User status updated" }); },
    onError: (e: any) => toast({ title: "Failed to update status", description: e.message, variant: "destructive" }),
  });

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      form.reset({ username: user.username, password: "", name: user.name ?? "", email: user.email ?? "", role: user.role, employeeId: user.employeeId ?? "", companyId: user.companyId ?? "", shopId: user.shopId ?? "", branchId: user.branchId ?? "", warehouseId: user.warehouseId ?? "", status: user.status });
    } else {
      setEditingUser(null);
      form.reset({ username: "", password: "", name: "", email: "", role: "staff", employeeId: "", companyId: currentCompanyId ?? "", shopId: currentShopId ?? "", branchId: currentBranchId ?? "", warehouseId: currentWarehouseId ?? "", status: "active" });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: UserFormData) => editingUser ? updateMutation.mutate({ ...data, id: editingUser.id }) : createMutation.mutate(data);

  const getShopName = (id: string | null) => id ? (shops.find(s => s.id === id)?.name ?? id) : "-";
  const getCompanyName = (id: string | null) => id ? (companies.find(c => c.id === id)?.name ?? id) : "-";
  const getBranchName = (id: string | null | undefined) => id ? (branches.find(b => b.id === id)?.name ?? id) : "-";

  const columns = [
    { key: "username", header: "Username", render: (u: User) => u.username },
    { key: "name", header: "Name", render: (u: User) => u.name ?? "-" },
    { key: "email", header: "Email", render: (u: User) => u.email ?? "-" },
    { key: "role", header: "Role", render: (u: User) => <span className="capitalize">{u.role.replace("_", " ")}</span> },
    { key: "status", header: "Status", render: (u: User) => <StatusBadge status={u.status} /> },
    {
      key: "actions", header: "Actions",
      render: (u: User) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" title="Edit user" onClick={() => handleOpenDialog(u)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" title="Assign scopes" onClick={() => openScopeDialog(u)}><Building2 className="h-4 w-4 text-blue-500" /></Button>
          <Button variant="ghost" size="sm" title={u.status === "active" ? "Block" : "Unblock"} onClick={() => setBlockingUser(u)}>
            {u.status === "active" ? <Ban className="h-4 w-4 text-orange-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
          </Button>
          <Button variant="ghost" size="sm" title="Delete" onClick={() => setDeletingUser(u)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ),
    },
  ];

  // ─── filtered lists for scope dialog rows ────────────────────────────────────
  const getShopsForCompany = (cId: string) => cId ? shops.filter(s => !s.companyId || s.companyId === cId) : shops;
  const getBranchesForShop = (sId: string) => sId ? branches.filter(b => !b.shopId || b.shopId === sId) : branches;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="User Management" description="Manage system users and their access" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users</CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Add User
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <TableSkeleton /> : !users?.length ? (
            <EmptyState icon={Users} title="No users found" description="Create your first user to get started">
              <Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Add User</Button>
            </EmptyState>
          ) : (
            <DataTable columns={columns} data={users} getRowKey={(u) => u.id} />
          )}
        </CardContent>
      </Card>

      {/* ── Create / Edit User Dialog ────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Create User"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem><FormLabel>Username *</FormLabel><FormControl><Input {...field} disabled={!!editingUser} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password {editingUser ? "(leave blank to keep)" : "*"}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        {roles.filter(r => r.status === "active").map(r => (
                          <SelectItem key={r.id} value={r.name.toLowerCase().replace(/\s+/g, "_")}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem><FormLabel>Link to Employee</FormLabel>
                    <Select onValueChange={v => {
                      field.onChange(v === "__none__" ? "" : v);
                      if (v !== "__none__") {
                        const selectedEmp = employees.find(e => e.id === v);
                        if (selectedEmp && (selectedEmp as any).password) {
                          form.setValue("password", (selectedEmp as any).password);
                        }
                      }
                    }} value={field.value || "__none__"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select employee (optional)" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {employees.filter(e => e.id).map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />

                {/* Primary scope — read-only display showing global/user scope */}
                <FormItem>
                  <FormLabel>Default Company</FormLabel>
                  <Input value={editingUser ? (companies.find(c => c.id === form.watch("companyId"))?.name ?? "Not set") : (currentCompany?.name ?? "Not selected")} disabled className="bg-muted" />
                </FormItem>
                <FormItem>
                  <FormLabel>Default Branch</FormLabel>
                  <Input value={editingUser ? getBranchName(form.watch("branchId")) : (currentBranch?.name ?? "Not selected")} disabled className="bg-muted" />
                </FormItem>

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingUser ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Scope Assignment Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!scopeUser} onOpenChange={open => { if (!open) setScopeUser(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Scope Assignments — {scopeUser?.name ?? scopeUser?.username}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Assign one or more company / shop / branch combinations this user can access.
            Leave fields blank to mean "all" within that level.
          </p>

          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Assigned Companies
              </label>
              <MultiSelect
                options={companies.map(c => ({ label: c.name, value: c.id }))}
                selected={selectedScopeCompanies}
                onChange={setSelectedScopeCompanies}
                placeholder="Select companies..."
              />
              <p className="text-xs text-muted-foreground">User will have access to all shops and branches within selected companies.</p>
            </div>



            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                Assigned Branches
              </label>
              <MultiSelect
                options={branches.map(b => ({ label: `${b.name} (${getShopName(b.shopId || null)})`, value: b.id }))}
                selected={selectedScopeBranches}
                onChange={setSelectedScopeBranches}
                placeholder="Select branches..."
              />
              <p className="text-xs text-muted-foreground">User will have specific access to these branches.</p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setScopeUser(null)}>Cancel</Button>
            <Button onClick={() => saveScopesMutation.mutate()} disabled={saveScopesMutation.isPending}>
              Save Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────────── */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deletingUser?.username}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Block / Unblock Confirm ─────────────────────────────────────────────── */}
      <AlertDialog open={!!blockingUser} onOpenChange={() => setBlockingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{blockingUser?.status === "active" ? "Block User" : "Unblock User"}</AlertDialogTitle>
            <AlertDialogDescription>
              {blockingUser?.status === "active"
                ? `Block "${blockingUser?.username}"? They won't be able to log in.`
                : `Unblock "${blockingUser?.username}"? They will be able to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockingUser && toggleStatusMutation.mutate({ id: blockingUser.id, status: blockingUser.status === "active" ? "blocked" : "active" })}
              className={blockingUser?.status === "active" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
            >
              {blockingUser?.status === "active" ? "Block" : "Unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
