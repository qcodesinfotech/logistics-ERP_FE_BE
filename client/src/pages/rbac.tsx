import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Copy, Shield, Menu, Check, X, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean | null;
  status: string;
  createdAt: string;
}

interface MenuModule {
  id: string;
  key: string;
  title: string;
  icon: string | null;
  path: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
}

interface Permission {
  id: string;
  roleId: string;
  menuId: string;
  canRead: boolean | null;
  canWrite: boolean | null;
}

export default function RBACPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("roles");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [cloneNewName, setCloneNewName] = useState("");

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: menus = [] } = useQuery<MenuModule[]>({
    queryKey: ["/api/rbac/menus"],
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/rbac/permissions", { roleId: selectedRoleId }],
    enabled: !!selectedRoleId,
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await apiRequest("POST", "/api/rbac/roles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      setRoleDialogOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      toast({ title: "Role created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Role> }) => {
      const res = await apiRequest("PATCH", `/api/rbac/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      setRoleDialogOpen(false);
      setEditingRole(null);
      toast({ title: "Role updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rbac/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "Role deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cloneRoleMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const res = await apiRequest("POST", `/api/rbac/roles/${id}/clone`, { newName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      setCloneDialogOpen(false);
      setCloneNewName("");
      setCloneSourceId(null);
      toast({ title: "Role cloned successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setPermissionMutation = useMutation({
    mutationFn: async (data: { roleId: string; menuId: string; canRead: boolean; canWrite: boolean }) => {
      const res = await apiRequest("POST", "/api/rbac/permissions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/permissions"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedMenusMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rbac/menus/seed");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/menus"] });
      toast({ title: "Menus seeded", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const seedRolesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rbac/roles/seed");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      toast({ title: "Roles seeded", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getPermissionForMenu = (menuId: string) => {
    return permissions.find(p => p.menuId === menuId && p.roleId === selectedRoleId);
  };

  const handlePermissionChange = (menuId: string, field: "canRead" | "canWrite", value: boolean) => {
    if (!selectedRoleId) return;
    const existing = getPermissionForMenu(menuId);
    const canRead = field === "canRead" ? value : (existing?.canRead ?? false);
    const canWrite = field === "canWrite" ? value : (existing?.canWrite ?? false);
    setPermissionMutation.mutate({ roleId: selectedRoleId, menuId, canRead, canWrite });
  };

  const handleSubmitRole = () => {
    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        data: { name: newRoleName, description: newRoleDescription },
      });
    } else {
      createRoleMutation.mutate({ name: newRoleName, description: newRoleDescription });
    }
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description || "");
    setRoleDialogOpen(true);
  };

  const openCloneDialog = (roleId: string) => {
    setCloneSourceId(roleId);
    setCloneNewName("");
    setCloneDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Role-Based Access Control
          </h1>
          <p className="text-muted-foreground mt-1">Manage roles and permissions for users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMenusMutation.mutate()} disabled={seedMenusMutation.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Seed Menus
          </Button>
          <Button variant="outline" onClick={() => seedRolesMutation.mutate()} disabled={seedRolesMutation.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Seed Roles
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Manage Roles</CardTitle>
              <Dialog open={roleDialogOpen} onOpenChange={(open) => {
                setRoleDialogOpen(open);
                if (!open) {
                  setEditingRole(null);
                  setNewRoleName("");
                  setNewRoleDescription("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Role Name</Label>
                      <Input
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="e.g., Warehouse Manager"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={newRoleDescription}
                        onChange={(e) => setNewRoleDescription(e.target.value)}
                        placeholder="Role description"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSubmitRole}
                      disabled={!newRoleName || createRoleMutation.isPending || updateRoleMutation.isPending}
                    >
                      {editingRole ? "Update Role" : "Create Role"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-muted-foreground">{role.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={role.status === "active" ? "default" : "secondary"}>
                          {role.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {role.isSystemRole ? (
                          <Badge variant="outline">System</Badge>
                        ) : (
                          <Badge variant="secondary">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openCloneDialog(role.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!role.isSystemRole && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteRoleMutation.mutate(role.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clone Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>New Role Name</Label>
                  <Input
                    value={cloneNewName}
                    onChange={(e) => setCloneNewName(e.target.value)}
                    placeholder="Enter name for cloned role"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => cloneSourceId && cloneRoleMutation.mutate({ id: cloneSourceId, newName: cloneNewName })}
                  disabled={!cloneNewName || cloneRoleMutation.isPending}
                >
                  Clone Role
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-4">
                <Menu className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <div className="mt-4">
                <Label>Select Role</Label>
                <Select value={selectedRoleId || ""} onValueChange={setSelectedRoleId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a role to configure" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {selectedRoleId ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead className="text-center w-32">Read</TableHead>
                      <TableHead className="text-center w-32">Write</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {menus.map((menu) => {
                      const perm = getPermissionForMenu(menu.id);
                      return (
                        <TableRow key={menu.id}>
                          <TableCell className="font-medium">{menu.title}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm?.canRead ?? false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(menu.id, "canRead", checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perm?.canWrite ?? false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(menu.id, "canWrite", checked as boolean)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Select a role to configure its permissions
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
