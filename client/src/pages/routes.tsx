import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import {
  Store, Plus, Edit, Trash2, MapPin, Globe, Check, ChevronDown, ChevronRight, Route as RouteIcon, Eye,
  Upload, Download, FileSpreadsheet, Building2, Navigation, Layers, Search
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
import type { Zone, Client } from "@shared/schema";

// ===================== Types =====================
interface Brand {
  id: string;
  clientId?: string;
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
  clientId?: string;
  name: string;
  description?: string;
  status: string;
  createdAt?: string;
}

interface Outlet {
  id: string;
  clientId?: string;
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
  isVendor?: boolean;
}

// ===================== Schemas =====================
const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  clientId: z.string().optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const routeSchema = z.object({
  name: z.string().min(1, "Route name is required"),
  clientId: z.string().optional().nullable().or(z.literal("")),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const outletSchema = z.object({
  routeId: z.string().optional(),
  brandId: z.string().optional(),
  clientId: z.string().optional().nullable().or(z.literal("")),
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
  const [location, setLocation] = useLocation();

  const activeTab = location === "/logistics/brands"
    ? "brands"
    : location === "/logistics/outlets"
      ? "outlets"
      : "routes";

  const setActiveTab = (tab: "routes" | "brands" | "outlets") => {
    setLocation(`/logistics/${tab}`);
  };

  // Brand state
  const [brandDialog, setBrandDialog] = useState<{ open: boolean; editing?: Brand }>({ open: false });
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);

  // Route state
  const [selectedRouteCustomerFilter, setSelectedRouteCustomerFilter] = useState<string>("all");
  const [routeDialog, setRouteDialog] = useState<{ open: boolean; editing?: RouteType }>({ open: false });
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);

  // Outlet state
  const [searchOutletText, setSearchOutletText] = useState<string>("");
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>("all");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
  const [outletDialog, setOutletDialog] = useState<{ open: boolean; editing?: Outlet }>({ open: false });
  const [deleteOutletId, setDeleteOutletId] = useState<string | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // ---- Brand Form ----
  const brandForm = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "", clientId: "", email: "", phone: "", website: "", address: "", status: "active" },
  });

  const openBrandDialog = (brand?: Brand) => {
    if (brand) {
      brandForm.reset({
        name: brand.name,
        clientId: brand.clientId || "",
        email: brand.email || "",
        phone: brand.phone || "",
        website: brand.website || "",
        address: brand.address || "",
        status: brand.status as "active" | "inactive",
      });
    } else {
      brandForm.reset({ name: "", clientId: "", email: "", phone: "", website: "", address: "", status: "active" });
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
    defaultValues: { name: "", clientId: "", description: "", status: "active" },
  });

  const openRouteDialog = (route?: RouteType) => {
    if (route) {
      routeForm.reset({
        name: route.name,
        clientId: route.clientId || "",
        description: route.description || "",
        status: route.status as "active" | "inactive",
      });
    } else {
      routeForm.reset({
        name: "",
        clientId: selectedRouteCustomerFilter !== "all" ? selectedRouteCustomerFilter : "",
        description: "",
        status: "active",
      });
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
    defaultValues: { routeId: "", brandId: "", clientId: "", name: "", code: "", phone: "", email: "", address: "", latitude: "", longitude: "", contactPerson: "", contactPhone: "", status: "active" },
  });

  const openOutletDialog = async (outlet?: Outlet) => {
    setSelectedZoneIds([]);
    if (outlet) {
      outletForm.reset({
        routeId: outlet.routeId || "",
        brandId: outlet.brandId || "",
        clientId: outlet.clientId || "",
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
        clientId: "",
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

  const bulkUploadMutation = useMutation({
    mutationFn: (outlets: any[]) => apiRequest("POST", "/api/outlets/bulk", { outlets }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Outlets Uploaded Successfully",
        description: `Imported ${data.created || 0} new outlets, updated ${data.updated || 0} existing outlets.`,
      });
      setBulkUploadOpen(false);
      setBulkFile(null);
      setParsedRows([]);
    },
    onError: (err) => {
      toast({ title: "Bulk upload failed", description: getErrorMessage(err), variant: "destructive" });
    }
  });

  const downloadSampleTemplate = () => {
    const templateData = [
      {
        "Outlet Code": "FI-SEEF-01",
        "Outlet Name": "Food Innovation - Seef Branch",
        "Customer Name": "Food Innovation",
        "Parent Account": "HORECA",
        "Route / Zone": "Manama North",
        "Latitude": "26.2412",
        "Longitude": "50.5364",
        "Address": "Road 2819, Block 428, Seef District",
        "Contact Person": "Ahmed Al-Sayed",
        "Contact Phone": "+973 3912 3456",
        "Status": "active"
      },
      {
        "Outlet Code": "FI-JUF-02",
        "Outlet Name": "Food Innovation - Juffair Branch",
        "Customer Name": "Food Innovation",
        "Parent Account": "HORECA",
        "Route / Zone": "Manama South",
        "Latitude": "26.2155",
        "Longitude": "50.6050",
        "Address": "Building 450, Road 2408, Juffair",
        "Contact Person": "Mohammed Hassan",
        "Contact Phone": "+973 3923 4567",
        "Status": "active"
      },
      {
        "Outlet Code": "FI-RIF-03",
        "Outlet Name": "Food Innovation - Riffa Branch",
        "Customer Name": "Food Innovation",
        "Parent Account": "HORECA",
        "Route / Zone": "Southern Zone",
        "Latitude": "26.1280",
        "Longitude": "50.5550",
        "Address": "Avenue 41, East Riffa",
        "Contact Person": "Ali Redha",
        "Contact Phone": "+973 3934 5678",
        "Status": "active"
      },
      {
        "Outlet Code": "FI-MUH-04",
        "Outlet Name": "Food Innovation - Muharraq Branch",
        "Customer Name": "Food Innovation",
        "Parent Account": "HORECA",
        "Route / Zone": "Muharraq Zone",
        "Latitude": "26.2570",
        "Longitude": "50.6120",
        "Address": "Airport Road, Muharraq",
        "Contact Person": "Yousif Kamal",
        "Contact Phone": "+973 3945 6789",
        "Status": "active"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outlets");
    XLSX.writeFile(wb, "Outlets_Location_Upload_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const formatted = data.map((row: any) => ({
          code: String(row["Outlet Code"] || row["Code"] || row["outlet_code"] || row["outletCode"] || "").trim(),
          name: String(row["Outlet Name"] || row["Name"] || row["outlet_name"] || row["outletName"] || "").trim(),
          customerName: String(row["Customer Name"] || row["Customer"] || row["Client"] || row["customer_name"] || "").trim(),
          parentAccount: String(row["Parent Account"] || row["Parent Customer"] || row["parent_client"] || "").trim(),
          zoneName: String(row["Route / Zone"] || row["Route"] || row["Zone"] || row["zone"] || "").trim(),
          latitude: String(row["Latitude"] || row["Lat"] || row["lat"] || "").trim(),
          longitude: String(row["Longitude"] || row["Long"] || row["Lng"] || row["long"] || row["lng"] || "").trim(),
          address: String(row["Address"] || row["Delivery Address"] || row["address"] || "").trim(),
          contactPerson: String(row["Contact Person"] || row["contact_person"] || "").trim(),
          contactPhone: String(row["Contact Phone"] || row["Phone"] || row["phone"] || "").trim(),
          status: String(row["Status"] || "active").toLowerCase().trim(),
        }));

        setParsedRows(formatted);
      } catch (err: any) {
        toast({ title: "Failed to read Excel file", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredOutlets = (Array.isArray(outletsList) ? outletsList : [])
    .filter((o) => !o.isVendor)
    .filter((o) => {
      let match = true;
      if (selectedRouteFilter !== "all" && o.routeId !== selectedRouteFilter) match = false;
      if (selectedBrandFilter !== "all" && o.brandId !== selectedBrandFilter) match = false;
      if (selectedCustomerFilter !== "all") {
        const outletClient = clients.find(c => c.id === o.clientId);
        const matchesDirect = o.clientId === selectedCustomerFilter;
        const matchesParent = outletClient?.parentClientId === selectedCustomerFilter;
        if (!matchesDirect && !matchesParent) match = false;
      }
      if (searchOutletText.trim()) {
        const q = searchOutletText.trim().toLowerCase();
        const matchesName = o.name?.toLowerCase().includes(q);
        const matchesCode = o.code?.toLowerCase().includes(q);
        const matchesPhone = o.phone?.toLowerCase().includes(q);
        const matchesAddress = o.address?.toLowerCase().includes(q);
        const matchesContact = o.contactPerson?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesPhone && !matchesAddress && !matchesContact) {
          match = false;
        }
      }
      return match;
    });

  const filteredRoutes = routes.filter((r) => {
    if (selectedRouteCustomerFilter !== "all") {
      const routeClient = clients.find(c => c.id === r.clientId);
      const matchesDirect = r.clientId === selectedRouteCustomerFilter;
      const matchesParent = routeClient?.parentClientId === selectedRouteCustomerFilter;
      if (!matchesDirect && !matchesParent) return false;
    }
    return true;
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
                  Manage delivery routes ({filteredRoutes.length} route{filteredRoutes.length !== 1 ? "s" : ""})
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 min-w-[220px]">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={selectedRouteCustomerFilter} onValueChange={setSelectedRouteCustomerFilter}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="All Customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Customers</SelectItem>
                      {clients.filter(c => !c.parentClientId).map((parent) => {
                        const children = clients.filter(c => c.parentClientId === parent.id);
                        return (
                          <div key={parent.id}>
                            <SelectItem value={parent.id} className="font-semibold text-primary">
                              🏢 {parent.name}
                            </SelectItem>
                            {children.map(child => (
                              <SelectItem key={child.id} value={child.id} className="pl-6 text-sm">
                                ↳ {child.name}
                              </SelectItem>
                            ))}
                          </div>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => openRouteDialog()} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Route
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {routesLoading ? (
                <div className="p-10 text-center text-muted-foreground">Loading routes...</div>
              ) : filteredRoutes.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3 text-muted-foreground">
                  <RouteIcon className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No routes found matching the selected customer.</p>
                  <Button variant="outline" onClick={() => openRouteDialog()} className="gap-2 mt-1">
                    <Plus className="h-4 w-4" /> Add Route
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route Name</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoutes.map((route) => {
                      const client = clients.find(c => c.id === route.clientId);
                      return (
                        <TableRow key={route.id} className="hover:bg-accent/30 transition-colors">
                          <TableCell className="font-semibold">{route.name}</TableCell>
                          <TableCell>
                            {client ? (
                              <Badge variant="outline" className="font-medium bg-primary/5 text-primary border-primary/20">
                                <Building2 className="h-3 w-3 mr-1" />
                                {client.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
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
                      );
                    })}
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
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
                    {/* Customer Filter (with parent-child hierarchy) */}
                    <div className="flex items-center gap-2 min-w-[220px] flex-1">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select value={selectedCustomerFilter} onValueChange={setSelectedCustomerFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All Customers (Parent / Child)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          {clients.filter(c => !c.parentClientId).map((parent) => {
                            const children = clients.filter(c => c.parentClientId === parent.id);
                            return (
                              <div key={parent.id}>
                                <SelectItem value={parent.id} className="font-semibold text-primary">
                                  🏢 {parent.name} (Parent Account)
                                </SelectItem>
                                {children.map(child => (
                                  <SelectItem key={child.id} value={child.id} className="pl-6 text-sm">
                                    ↳ {child.name}
                                  </SelectItem>
                                ))}
                              </div>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Route Filter */}
                    <div className="flex items-center gap-2 min-w-[180px] flex-1">
                      <RouteIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select value={selectedRouteFilter} onValueChange={setSelectedRouteFilter}>
                        <SelectTrigger className="w-full">
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

                    {/* Brand Filter */}
                    <div className="flex items-center gap-2 min-w-[180px] flex-1">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
                        <SelectTrigger className="w-full">
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

                    {/* Search Input for Outlets */}
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search outlets (name, code, address)..."
                        value={searchOutletText}
                        onChange={(e) => setSearchOutletText(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => setBulkUploadOpen(true)} 
                      className="gap-2 border-primary/40 hover:bg-primary/5 text-primary"
                    >
                      <Upload className="h-4 w-4" /> Import Excel
                    </Button>
                    <Button onClick={() => openOutletDialog()} className="gap-2">
                      <Plus className="h-4 w-4" /> Add Outlet
                    </Button>
                  </div>
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
                        <TableHead>Customer / Parent</TableHead>
                        <TableHead>Route / Brand</TableHead>
                        <TableHead>Code & Location</TableHead>
                        <TableHead>Phone / Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOutlets.map((outlet) => {
                        const route = routes.find(r => r.id === outlet.routeId);
                        const brand = brands.find(b => b.id === outlet.brandId);
                        const client = clients.find(c => c.id === outlet.clientId);
                        const parentClient = client?.parentClientId ? clients.find(c => c.id === client.parentClientId) : null;
                        
                        return (
                          <TableRow key={outlet.id} className="hover:bg-accent/30 transition-colors">
                            <TableCell>
                              <div className="font-medium">{outlet.name}</div>
                              {outlet.address && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{outlet.address}</div>}
                            </TableCell>
                            <TableCell>
                              {client ? (
                                <div>
                                  <div className="text-sm font-medium flex items-center gap-1">
                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                    <span>{client.name}</span>
                                  </div>
                                  {parentClient && (
                                    <div className="text-[11px] text-primary/80 mt-0.5">
                                      ↳ Parent: <span className="font-semibold">{parentClient.name}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {route && <div className="text-sm font-medium">{route.name}</div>}
                              {brand && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Globe className="h-3 w-3"/> {brand.name}</div>}
                              {!route && !brand && <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {outlet.code ? (
                                  <Badge variant="outline" className="font-mono text-xs">{outlet.code}</Badge>
                                ) : null}
                                {outlet.latitude && outlet.longitude ? (
                                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                    <Navigation className="h-3 w-3 shrink-0" />
                                    <span>{Number(outlet.latitude).toFixed(4)}, {Number(outlet.longitude).toFixed(4)}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">No GPS</div>
                                )}
                              </div>
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
              <FormField control={routeForm.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Customer (General)</SelectItem>
                      {clients.filter(c => !c.parentClientId).map((parent) => {
                        const children = clients.filter(c => c.parentClientId === parent.id);
                        return (
                          <div key={parent.id}>
                            <SelectItem value={parent.id} className="font-semibold text-primary">
                              🏢 {parent.name}
                            </SelectItem>
                            {children.map(child => (
                              <SelectItem key={child.id} value={child.id} className="pl-6 text-sm">
                                ↳ {child.name}
                              </SelectItem>
                            ))}
                          </div>
                        );
                      })}
                    </SelectContent>
                  </Select>
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
              <FormField control={brandForm.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Customer (Master Customer)</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select master customer (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Customer Selected</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <FormField control={outletForm.control} name="clientId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Linked Customer (Master Customer)</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select master customer (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Customer Selected</SelectItem>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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

      {/* ==================== BULK UPLOAD DIALOG ==================== */}
      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import Outlets & Geolocations (Excel)
            </DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx/.csv) sheet containing outlet details, customer mappings, and GPS coordinates.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Need the standard spreadsheet format?</p>
                <p className="text-xs text-muted-foreground">Download our pre-filled template with sample HORECA / Food Innovation rows.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadSampleTemplate} className="gap-2 shrink-0">
                <Download className="h-4 w-4" /> Download Template
              </Button>
            </div>

            {/* Dropzone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-primary/5 flex flex-col items-center justify-center gap-2"
            >
              <Upload className="h-8 w-8 text-primary/70 animate-pulse" />
              <div className="text-sm font-semibold">
                {bulkFile ? bulkFile.name : "Click or drag & drop to choose Excel file"}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: .xlsx, .xls, .csv
              </p>
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".xlsx,.xls,.csv" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </div>

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Preview ({parsedRows.length} outlets ready to import)</span>
                  <span>Review details before saving</span>
                </div>
                <div className="border rounded-md max-h-56 overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 text-xs">
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Outlet Name</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Route / Zone</TableHead>
                        <TableHead>GPS (Lat, Long)</TableHead>
                        <TableHead>Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono font-medium">{r.code || "—"}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.customerName || "—"}</TableCell>
                          <TableCell>{r.zoneName || "—"}</TableCell>
                          <TableCell className="font-mono">
                            {r.latitude && r.longitude ? `${r.latitude}, ${r.longitude}` : <span className="text-muted-foreground">No GPS</span>}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={r.address}>{r.address || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedRows.length > 10 && (
                  <p className="text-[11px] text-muted-foreground text-center">... and {parsedRows.length - 10} more rows</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3 mt-2 flex items-center justify-between">
            <Button variant="ghost" onClick={() => { setBulkUploadOpen(false); setBulkFile(null); setParsedRows([]); }}>
              Cancel
            </Button>
            <Button 
              disabled={parsedRows.length === 0 || bulkUploadMutation.isPending}
              onClick={() => bulkUploadMutation.mutate(parsedRows)}
              className="gap-2"
            >
              {bulkUploadMutation.isPending ? "Importing..." : `Import ${parsedRows.length} Outlets`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
