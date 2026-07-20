import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Store, Plus, Edit, Trash2, MapPin, Globe, Check, ChevronDown, ChevronRight, Route as RouteIcon
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
interface Brand {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  status: string;
  createdAt?: string;
}

interface RouteType {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt?: string;
}

interface Outlet {
  id: string;
  brandId?: string;
  routeId?: string;
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
const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const routeSchema = z.object({
  name: z.string().min(1, "Route name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const outletSchema = z.object({
  routeId: z.string().optional(),
  brandId: z.string().optional(),
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

type BrandFormData = z.infer<typeof brandSchema>;
type RouteFormData = z.infer<typeof routeSchema>;
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
export default function RoutesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"routes" | "brands" | "outlets">("routes");

  // Brand state
  const [brandDialog, setBrandDialog] = useState<{ open: boolean; editing?: Brand }>({ open: false });
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);

  // Route state
  const [routeDialog, setRouteDialog] = useState<{ open: boolean; editing?: RouteType }>({ open: false });
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);

  // Outlet state
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>("all");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [outletDialog, setOutletDialog] = useState<{ open: boolean; editing?: Outlet }>({ open: false });
  const [deleteOutletId, setDeleteOutletId] = useState<string | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);

  // ---- Queries ----
  const { data: brands = [], isLoading: brandsLoading } = useQuery<Brand[]>({
    queryKey: ["/api/brands"],
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery<RouteType[]>({
    queryKey: ["/api/routes"],
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["/api/zones"],
  });

  const { data: outletsList = [], isLoading: outletsLoading } = useQuery<Outlet[]>({
    queryKey: ["/api/outlets"],
    enabled: true,
  });

  // ---- Brand Form ----
  const brandForm = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "", email: "", phone: "", website: "", address: "", status: "active" },
  });

  const openBrandDialog = (brand?: Brand) => {
    if (brand) {
      brandForm.reset({
        name: brand.name,
        email: brand.email || "",
        phone: brand.phone || "",
        website: brand.website || "",
        address: brand.address || "",
        status: brand.status as "active" | "inactive",
      });
    } else {
      brandForm.reset({ name: "", email: "", phone: "", website: "", address: "", status: "active" });
    }
    setBrandDialog({ open: true, editing: brand });
  };

  const createBrandMutation = useMutation({
    mutationFn: (data: BrandFormData) => apiRequest("POST", "/api/brands", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setBrandDialog({ open: false });
      toast({ title: "Brand created successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const updateBrandMutation = useMutation({
    mutationFn: (data: BrandFormData) =>
      apiRequest("PATCH", `/api/brands/${brandDialog.editing?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setBrandDialog({ open: false });
      toast({ title: "Brand updated successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/brands/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      setDeleteBrandId(null);
      toast({ title: "Brand deleted" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const onBrandSubmit = (data: BrandFormData) => {
    if (brandDialog.editing) {
      updateBrandMutation.mutate(data);
    } else {
      createBrandMutation.mutate(data);
    }
  };

  // ---- Route Form ----
  const routeForm = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: { name: "", description: "", status: "active" },
  });

  const openRouteDialog = (route?: RouteType) => {
    if (route) {
      routeForm.reset({
        name: route.name,
        description: route.description || "",
        status: route.status as "active" | "inactive",
      });
    } else {
      routeForm.reset({ name: "", description: "", status: "active" });
    }
    setRouteDialog({ open: true, editing: route });
  };

  const createRouteMutation = useMutation({
    mutationFn: (data: RouteFormData) => apiRequest("POST", "/api/routes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      setRouteDialog({ open: false });
      toast({ title: "Route created successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const updateRouteMutation = useMutation({
    mutationFn: (data: RouteFormData) =>
      apiRequest("PATCH", `/api/routes/${routeDialog.editing?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      setRouteDialog({ open: false });
      toast({ title: "Route updated successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      setDeleteRouteId(null);
      toast({ title: "Route deleted" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const onRouteSubmit = (data: RouteFormData) => {
    if (routeDialog.editing) {
      updateRouteMutation.mutate(data);
    } else {
      createRouteMutation.mutate(data);
    }
  };

  // ---- Outlet Form ----
  const outletForm = useForm<OutletFormData>({
    resolver: zodResolver(outletSchema),
    defaultValues: { routeId: "", brandId: "", name: "", code: "", phone: "", email: "", address: "", latitude: "", longitude: "", contactPerson: "", contactPhone: "", status: "active" },
  });

  const openOutletDialog = async (outlet?: Outlet) => {
    setSelectedZoneIds([]);
    if (outlet) {
      outletForm.reset({
        routeId: outlet.routeId || "",
        brandId: outlet.brandId || "",
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
      outletForm.reset({ 
        routeId: selectedRouteFilter !== "all" ? selectedRouteFilter : "",
        brandId: selectedBrandFilter !== "all" ? selectedBrandFilter : "",
        name: "", code: "", phone: "", email: "", address: "", latitude: "", longitude: "", contactPerson: "", contactPhone: "", status: "active" 
      });
    }
    setOutletDialog({ open: true, editing: outlet });
  };

  const createOutletMutation = useMutation({
    mutationFn: (data: OutletFormData) =>
      apiRequest("POST", "/api/outlets", { ...data, zoneIds: selectedZoneIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlets"] });
      setOutletDialog({ open: false });
      toast({ title: "Outlet created successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const updateOutletMutation = useMutation({
    mutationFn: (data: OutletFormData) =>
      apiRequest("PATCH", `/api/outlets/${outletDialog.editing?.id}`, { ...data, zoneIds: selectedZoneIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlets"] });
      setOutletDialog({ open: false });
      toast({ title: "Outlet updated successfully" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteOutletMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/outlets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlets"] });
      setDeleteOutletId(null);
      toast({ title: "Outlet deleted" });
    },
    onError: (err) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const onOutletSubmit = (data: OutletFormData) => {
    if (outletDialog.editing) {
      updateOutletMutation.mutate(data);
    } else {
      createOutletMutation.mutate(data);
    }
  };

  const filteredOutlets = (Array.isArray(outletsList) ? outletsList : []).filter((o) => {
    let match = true;
    if (selectedRouteFilter !== "all" && o.routeId !== selectedRouteFilter) match = false;
    if (selectedBrandFilter !== "all" && o.brandId !== selectedBrandFilter) match = false;
    return match;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <RouteIcon className="h-6 w-6 text-primary" />
            Routes, Brands & Outlets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage logistics routes, brands, and their delivery outlets.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-2">
          <TabsTrigger value="routes" className="gap-2">
            <RouteIcon className="h-4 w-4" />
            Routes
          </TabsTrigger>
          <TabsTrigger value="brands" className="gap-2">
            <Globe className="h-4 w-4" />
            Brands
          </TabsTrigger>
          <TabsTrigger value="outlets" className="gap-2">
            <MapPin className="h-4 w-4" />
            Outlets
          </TabsTrigger>
        </TabsList>

        {/* ==================== ROUTES TAB ==================== */}
        <TabsContent value="routes">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b">
              <div>
                <CardTitle>Routes</CardTitle>
                <CardDescription>
                  Manage delivery routes
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => openRouteDialog()} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Route
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {routesLoading ? (
                <div className="p-10 text-center text-muted-foreground">Loading routes...</div>
              ) : routes.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 text-muted-foreground">
                  <RouteIcon className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No routes yet. Add your first route to get started.</p>
                  <Button variant="outline" onClick={() => openRouteDialog()} className="gap-2 mt-1">
                    <Plus className="h-4 w-4" /> Add Route
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route) => (
                      <TableRow key={route.id} className="hover:bg-accent/30 transition-colors">
                        <TableCell className="font-semibold">{route.name}</TableCell>
                        <TableCell className="text-muted-foreground">{route.description || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            className={route.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}
                          >
                            {route.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setSelectedRouteFilter(route.id); setActiveTab("outlets"); }}
                              className="gap-1 text-xs"
                            >
                              <MapPin className="h-3.5 w-3.5" /> View Outlets
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openRouteDialog(route)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteRouteId(route.id)}>
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

        {/* ==================== BRANDS TAB ==================== */}
        <TabsContent value="brands">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle>Brands</CardTitle>
                <CardDescription>Manage your brands</CardDescription>
              </div>
              <Button onClick={() => openBrandDialog()} className="gap-2">
                <Plus className="h-4 w-4" /> Add Brand
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {brandsLoading ? (
                <div className="p-10 text-center text-muted-foreground">Loading brands...</div>
              ) : brands.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 text-muted-foreground">
                  <Globe className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No brands yet. Add your first brand to get started.</p>
                  <Button variant="outline" onClick={() => openBrandDialog()} className="gap-2 mt-1">
                    <Plus className="h-4 w-4" /> Add Brand
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.map((brand) => (
                      <TableRow key={brand.id} className="hover:bg-accent/30 transition-colors">
                        <TableCell className="font-semibold">{brand.name}</TableCell>
                        <TableCell className="text-muted-foreground">{brand.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{brand.phone || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {brand.website ? (
                            <a href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {brand.website}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={brand.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}
                          >
                            {brand.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setSelectedBrandFilter(brand.id); setActiveTab("outlets"); }}
                              className="gap-1 text-xs"
                            >
                              <MapPin className="h-3.5 w-3.5" /> View Outlets
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openBrandDialog(brand)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteBrandId(brand.id)}>
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
            {/* Filters */}
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2 flex-1 w-full max-w-sm">
                    <RouteIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select value={selectedRouteFilter} onValueChange={setSelectedRouteFilter}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="All Routes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Routes</SelectItem>
                        {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 flex-1 w-full max-w-sm">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="All Brands" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => openOutletDialog()} className="gap-2 shrink-0 ml-auto">
                    <Plus className="h-4 w-4" /> Add Outlet
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Outlets Table */}
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Outlets List
                    </CardTitle>
                    <CardDescription>{filteredOutlets.length} outlet{filteredOutlets.length !== 1 ? "s" : ""}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {outletsLoading ? (
                  <div className="p-10 text-center text-muted-foreground">Loading outlets...</div>
                ) : filteredOutlets.length === 0 ? (
                  <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
                    <MapPin className="h-10 w-10 opacity-25" />
                    <p className="text-sm">No outlets match the selected filters.</p>
                    <Button variant="outline" onClick={() => openOutletDialog()} className="gap-2 mt-1">
                      <Plus className="h-4 w-4" /> Add Outlet
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Outlet Name</TableHead>
                        <TableHead>Route / Brand</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Phone / Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOutlets.map((outlet) => {
                        const route = routes.find(r => r.id === outlet.routeId);
                        const brand = brands.find(b => b.id === outlet.brandId);
                        
                        return (
                          <TableRow key={outlet.id} className="hover:bg-accent/30 transition-colors">
                            <TableCell>
                              <div className="font-medium">{outlet.name}</div>
                              {outlet.address && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{outlet.address}</div>}
                            </TableCell>
                            <TableCell>
                              {route && <div className="text-sm font-medium">{route.name}</div>}
                              {brand && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Globe className="h-3 w-3"/> {brand.name}</div>}
                              {!route && !brand && <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {outlet.code ? (
                                <Badge variant="outline" className="font-mono text-xs">{outlet.code}</Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{outlet.phone || outlet.contactPhone || "—"}</div>
                              {outlet.contactPerson && <div className="text-xs text-muted-foreground">{outlet.contactPerson}</div>}
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
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== ROUTE DIALOG ==================== */}
      <Dialog open={routeDialog.open} onOpenChange={(o) => setRouteDialog({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{routeDialog.editing ? "Edit Route" : "Add New Route"}</DialogTitle>
            <DialogDescription>
              Fill in the route details.
            </DialogDescription>
          </DialogHeader>
          <Form {...routeForm}>
            <form onSubmit={routeForm.handleSubmit(onRouteSubmit)} className="space-y-4">
              <FormField control={routeForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Route Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Muscat Route A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routeForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Route description..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={routeForm.control} name="status" render={({ field }) => (
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRouteDialog({ open: false })}>Cancel</Button>
                <Button type="submit" disabled={createRouteMutation.isPending || updateRouteMutation.isPending}>
                  {createRouteMutation.isPending || updateRouteMutation.isPending ? "Saving..." : routeDialog.editing ? "Update Route" : "Create Route"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ==================== BRAND DIALOG ==================== */}
      <Dialog open={brandDialog.open} onOpenChange={(o) => setBrandDialog({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{brandDialog.editing ? "Edit Brand" : "Add New Brand"}</DialogTitle>
            <DialogDescription>
              Fill in the brand details.
            </DialogDescription>
          </DialogHeader>
          <Form {...brandForm}>
            <form onSubmit={brandForm.handleSubmit(onBrandSubmit)} className="space-y-4">
              <FormField control={brandForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Acme Corp" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={brandForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="contact@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={brandForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="+968 9000 0000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={brandForm.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl><Input placeholder="example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={brandForm.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea placeholder="Full address..." rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={brandForm.control} name="status" render={({ field }) => (
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBrandDialog({ open: false })}>Cancel</Button>
                <Button type="submit" disabled={createBrandMutation.isPending || updateBrandMutation.isPending}>
                  {createBrandMutation.isPending || updateBrandMutation.isPending ? "Saving..." : brandDialog.editing ? "Update Brand" : "Create Brand"}
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
              Configure outlet details and assignments.
            </DialogDescription>
          </DialogHeader>
          <Form {...outletForm}>
            <form onSubmit={outletForm.handleSubmit(onOutletSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={outletForm.control} name="routeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Route</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a route" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Route Selected</SelectItem>
                        {routes.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={outletForm.control} name="brandId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linked Brand</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a brand" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Brand Selected</SelectItem>
                        {brands.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                
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

      {/* Delete Route Confirmation */}
      <AlertDialog open={!!deleteRouteId} onOpenChange={(o) => !o && setDeleteRouteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the route. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteRouteId && deleteRouteMutation.mutate(deleteRouteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Brand Confirmation */}
      <AlertDialog open={!!deleteBrandId} onOpenChange={(o) => !o && setDeleteBrandId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the brand. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteBrandId && deleteBrandMutation.mutate(deleteBrandId)}
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
