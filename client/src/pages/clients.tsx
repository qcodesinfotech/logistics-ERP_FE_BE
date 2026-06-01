import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Store, Plus, Edit, Trash2, MapPin, Building2, Phone, Mail, User,
  Globe, Check, X, Upload, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Zone } from "@shared/schema";

// ===================== Types =====================
interface Client {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status: string;
  createdAt?: string;
}

interface Outlet {
  id: string;
  clientId: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  contactPerson?: string;
  contactPhone?: string;
  status: string;
}

// ===================== Schemas =====================
const clientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  companyName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const outletSchema = z.object({
  name: z.string().min(1, "Outlet name is required"),
  code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

type ClientFormData = z.infer<typeof clientSchema>;
type OutletFormData = z.infer<typeof outletSchema>;

// ===================== Multi-select Zone Picker =====================
function ZoneMultiSelect({
  zones,
  selectedIds,
  onChange,
}: {
  zones: Zone[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((z) => z !== id) : [...selectedIds, id]);
  };

  return (
    <div className="border rounded-lg max-h-44 overflow-y-auto p-2 space-y-1 bg-background">
      {zones.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">No zones available</p>
      )}
      {zones.map((zone) => (
        <div
          key={zone.id}
          onClick={() => toggle(zone.id)}
          className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
            selectedIds.includes(zone.id)
              ? "bg-primary/10 border border-primary/40 text-primary font-medium"
              : "hover:bg-accent/50 border border-transparent text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            <span>{zone.name}</span>
          </div>
          {selectedIds.includes(zone.id) && <Check className="h-3.5 w-3.5" />}
        </div>
      ))}
    </div>
  );
}

// ===================== Main Page =====================
export default function ClientsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"clients" | "outlets">("clients");

  // Client state
  const [clientDialog, setClientDialog] = useState<{ open: boolean; editing?: Client }>({ open: false });
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Outlet state
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [outletDialog, setOutletDialog] = useState<{ open: boolean; editing?: Outlet }>({ open: false });
  const [deleteOutletId, setDeleteOutletId] = useState<string | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  // ---- Queries ----
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["/api/zones"],
  });

  const outletsQueryKey = selectedClientId
    ? `/api/outlets?clientId=${selectedClientId}`
    : "/api/outlets";
  const { data: outletsList = [], isLoading: outletsLoading } = useQuery<Outlet[]>({
    queryKey: [outletsQueryKey],
    enabled: true,
  });

  // ---- Client Form ----
  const clientForm = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", companyName: "", email: "", phone: "", address: "", logo: "", status: "active" },
  });

  const openClientDialog = (client?: Client) => {
    if (client) {
      clientForm.reset({
        name: client.name,
        companyName: client.companyName || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        logo: client.logo || "",
        status: client.status as "active" | "inactive",
      });
      setLogoPreview(client.logo || "");
    } else {
      clientForm.reset({ name: "", companyName: "", email: "", phone: "", address: "", logo: "", status: "active" });
      setLogoPreview("");
    }
    setClientDialog({ open: true, editing: client });
  };

  const createClientMutation = useMutation({
    mutationFn: (data: ClientFormData) => apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setClientDialog({ open: false });
      toast({ title: "Client created successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const updateClientMutation = useMutation({
    mutationFn: (data: ClientFormData) =>
      apiRequest("PATCH", `/api/clients/${clientDialog.editing?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setClientDialog({ open: false });
      toast({ title: "Client updated successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteClientMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setDeleteClientId(null);
      toast({ title: "Client deleted" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/shop-logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      clientForm.setValue("logo", url);
      setLogoPreview(url);
      toast({ title: "Logo uploaded successfully" });
    } catch {
      toast({ title: "Logo upload failed", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const onClientSubmit = (data: ClientFormData) => {
    if (clientDialog.editing) {
      updateClientMutation.mutate(data);
    } else {
      createClientMutation.mutate(data);
    }
  };

  // ---- Outlet Form ----
  const outletForm = useForm<OutletFormData>({
    resolver: zodResolver(outletSchema),
    defaultValues: { name: "", code: "", phone: "", email: "", address: "", latitude: "", longitude: "", contactPerson: "", contactPhone: "", status: "active" },
  });

  const openOutletDialog = async (outlet?: Outlet) => {
    setSelectedZoneIds([]);
    if (outlet) {
      outletForm.reset({
        name: outlet.name,
        code: outlet.code || "",
        phone: outlet.phone || "",
        email: outlet.email || "",
        address: outlet.address || "",
        latitude: outlet.latitude || "",
        longitude: outlet.longitude || "",
        contactPerson: outlet.contactPerson || "",
        contactPhone: outlet.contactPhone || "",
        status: outlet.status as "active" | "inactive",
      });
      // Fetch existing zone assignments
      try {
        const res = await fetch(`/api/outlets/${outlet.id}/zones`, { credentials: "include" });
        if (res.ok) {
          const assignedZones: Zone[] = await res.json();
          setSelectedZoneIds(assignedZones.map((z) => z.id));
        }
      } catch {}
    } else {
      outletForm.reset({ name: "", code: "", phone: "", email: "", address: "", latitude: "", longitude: "", contactPerson: "", contactPhone: "", status: "active" });
    }
    setOutletDialog({ open: true, editing: outlet });
  };

  const createOutletMutation = useMutation({
    mutationFn: (data: OutletFormData) =>
      apiRequest("POST", "/api/outlets", { ...data, clientId: selectedClientId, zoneIds: selectedZoneIds }),
    onSuccess: () => {
      const key = selectedClientId ? `/api/outlets?clientId=${selectedClientId}` : "/api/outlets";
      queryClient.invalidateQueries({ queryKey: [key] });
      setOutletDialog({ open: false });
      toast({ title: "Outlet created successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const updateOutletMutation = useMutation({
    mutationFn: (data: OutletFormData) =>
      apiRequest("PATCH", `/api/outlets/${outletDialog.editing?.id}`, { ...data, zoneIds: selectedZoneIds }),
    onSuccess: () => {
      const key = selectedClientId ? `/api/outlets?clientId=${selectedClientId}` : "/api/outlets";
      queryClient.invalidateQueries({ queryKey: [key] });
      setOutletDialog({ open: false });
      toast({ title: "Outlet updated successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteOutletMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/outlets/${id}`),
    onSuccess: () => {
      const key = selectedClientId ? `/api/outlets?clientId=${selectedClientId}` : "/api/outlets";
      queryClient.invalidateQueries({ queryKey: [key] });
      setDeleteOutletId(null);
      toast({ title: "Outlet deleted" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const onOutletSubmit = (data: OutletFormData) => {
    if (!selectedClientId) {
      toast({ title: "Please select a client first", variant: "destructive" });
      return;
    }
    if (outletDialog.editing) {
      updateOutletMutation.mutate(data);
    } else {
      createOutletMutation.mutate(data);
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const outlets = Array.isArray(outletsList) ? outletsList : [];
  const filteredOutlets = selectedClientId ? outlets.filter((o) => o.clientId === selectedClientId) : outlets;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            Clients & Outlets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage logistics clients and their delivery outlets, map outlets to operational zones.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-2">
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="outlets" className="gap-2">
            <MapPin className="h-4 w-4" />
            Outlets
          </TabsTrigger>
        </TabsList>

        {/* ==================== CLIENTS TAB ==================== */}
        <TabsContent value="clients">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle>Clients</CardTitle>
                <CardDescription>All logistics client companies</CardDescription>
              </div>
              <Button onClick={() => openClientDialog()} className="gap-2">
                <Plus className="h-4 w-4" /> Add Client
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {clientsLoading ? (
                <div className="p-10 text-center text-muted-foreground">Loading clients...</div>
              ) : clients.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 text-muted-foreground">
                  <Store className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No clients yet. Add your first client to get started.</p>
                  <Button variant="outline" onClick={() => openClientDialog()} className="gap-2 mt-1">
                    <Plus className="h-4 w-4" /> Add Client
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Logo</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id} className="hover:bg-accent/30 transition-colors">
                        <TableCell>
                          {client.logo ? (
                            <img src={client.logo} alt={client.name} className="h-9 w-9 rounded-full object-cover border" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{client.name}</TableCell>
                        <TableCell className="text-muted-foreground">{client.companyName || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{client.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{client.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            className={client.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}
                          >
                            {client.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setSelectedClientId(client.id); setActiveTab("outlets"); }}
                              className="gap-1 text-xs"
                            >
                              <MapPin className="h-3.5 w-3.5" /> Outlets
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openClientDialog(client)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteClientId(client.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== OUTLETS TAB ==================== */}
        <TabsContent value="outlets">
          <div className="space-y-4">
            {/* Client Selector */}
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2 flex-1 w-full">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a client to view or add outlets..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              {c.logo ? (
                                <img src={c.logo} alt={c.name} className="h-5 w-5 rounded-full object-cover" />
                              ) : (
                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Building2 className="h-3 w-3 text-primary" />
                                </div>
                              )}
                              <span>{c.name}</span>
                              {c.companyName && <span className="text-muted-foreground text-xs">({c.companyName})</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedClientId && (
                    <Button onClick={() => openOutletDialog()} className="gap-2 shrink-0">
                      <Plus className="h-4 w-4" /> Add Outlet
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Outlets Table */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selectedClient ? `Outlets — ${selectedClient.name}` : "All Outlets"}
                    </CardTitle>
                    <CardDescription>{filteredOutlets.length} outlet{filteredOutlets.length !== 1 ? "s" : ""}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedClientId ? (
                  <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
                    <MapPin className="h-10 w-10 opacity-25" />
                    <p className="text-sm">Select a client above to view and manage their outlets.</p>
                  </div>
                ) : outletsLoading ? (
                  <div className="p-10 text-center text-muted-foreground">Loading outlets...</div>
                ) : filteredOutlets.length === 0 ? (
                  <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
                    <MapPin className="h-10 w-10 opacity-25" />
                    <p className="text-sm">No outlets for this client yet.</p>
                    <Button variant="outline" onClick={() => openOutletDialog()} className="gap-2 mt-1">
                      <Plus className="h-4 w-4" /> Add First Outlet
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Outlet Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOutlets.map((outlet) => (
                        <TableRow key={outlet.id} className="hover:bg-accent/30 transition-colors">
                          <TableCell className="font-medium">{outlet.name}</TableCell>
                          <TableCell>
                            {outlet.code ? (
                              <Badge variant="outline" className="font-mono text-xs">{outlet.code}</Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{outlet.phone || "—"}</TableCell>
                          <TableCell>
                            {outlet.contactPerson ? (
                              <div>
                                <div className="text-sm">{outlet.contactPerson}</div>
                                {outlet.contactPhone && (
                                  <div className="text-xs text-muted-foreground">{outlet.contactPhone}</div>
                                )}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">
                            {outlet.address || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={outlet.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}
                            >
                              {outlet.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openOutletDialog(outlet)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteOutletId(outlet.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== CLIENT DIALOG ==================== */}
      <Dialog open={clientDialog.open} onOpenChange={(o) => setClientDialog({ open: o })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{clientDialog.editing ? "Edit Client" : "Add New Client"}</DialogTitle>
            <DialogDescription>
              Fill in the client details. Logo, email and phone are optional.
            </DialogDescription>
          </DialogHeader>
          <Form {...clientForm}>
            <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img src={logoPreview} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
                      <button type="button" onClick={() => { setLogoPreview(""); clientForm.setValue("logo", ""); }}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 hover:bg-accent transition-colors">
                        <Upload className="h-4 w-4" />
                        {uploadingLogo ? "Uploading..." : "Upload Logo"}
                      </div>
                    </label>
                    <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 5MB</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={clientForm.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Muscat Traders LLC" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={clientForm.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl><Input placeholder="Trade name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={clientForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={clientForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="contact@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={clientForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+968 9000 0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={clientForm.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl><Textarea placeholder="Full address..." rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setClientDialog({ open: false })}>Cancel</Button>
                <Button type="submit" disabled={createClientMutation.isPending || updateClientMutation.isPending}>
                  {createClientMutation.isPending || updateClientMutation.isPending ? "Saving..." : clientDialog.editing ? "Update Client" : "Create Client"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ==================== OUTLET DIALOG ==================== */}
      <Dialog open={outletDialog.open} onOpenChange={(o) => setOutletDialog({ open: o })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{outletDialog.editing ? "Edit Outlet" : "Add New Outlet"}</DialogTitle>
            <DialogDescription>
              {selectedClient && <span className="text-primary font-medium">{selectedClient.name}</span>}
              {" — Configure outlet details and map to zones."}
            </DialogDescription>
          </DialogHeader>
          <Form {...outletForm}>
            <form onSubmit={outletForm.handleSubmit(onOutletSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={outletForm.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Outlet Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. CBD Branch" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outlet Code</FormLabel>
                    <FormControl><Input placeholder="e.g. MCT-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+968 9000 0000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="outlet@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl><Textarea placeholder="Full outlet address..." rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="latitude" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl><Input placeholder="e.g. 23.6140" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="longitude" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl><Input placeholder="e.g. 58.5922" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="contactPerson" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl><Input placeholder="Name of contact" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="contactPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl><Input placeholder="+968 9000 0001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Zone Multi-Select */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Assign to Zones
                    {selectedZoneIds.length > 0 && (
                      <Badge className="ml-1 bg-primary/10 text-primary text-xs">{selectedZoneIds.length} selected</Badge>
                    )}
                  </Label>
                </div>
                <ZoneMultiSelect zones={zones} selectedIds={selectedZoneIds} onChange={setSelectedZoneIds} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOutletDialog({ open: false })}>Cancel</Button>
                <Button type="submit" disabled={createOutletMutation.isPending || updateOutletMutation.isPending}>
                  {createOutletMutation.isPending || updateOutletMutation.isPending ? "Saving..." : outletDialog.editing ? "Update Outlet" : "Create Outlet"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Client Confirmation */}
      <AlertDialog open={!!deleteClientId} onOpenChange={(o) => !o && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteClientId && deleteClientMutation.mutate(deleteClientId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Outlet Confirmation */}
      <AlertDialog open={!!deleteOutletId} onOpenChange={(o) => !o && setDeleteOutletId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outlet</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the outlet and its zone assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteOutletId && deleteOutletMutation.mutate(deleteOutletId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
