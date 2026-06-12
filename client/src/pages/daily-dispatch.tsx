import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Truck, Upload, FileText, Calendar, MapPin, User, Package,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock,
  X, Plus, Trash2, RefreshCw, ArrowRight, Eye,
} from "lucide-react";

// ===== Types =====
interface DispatchSheet { id: string; date: string; fileName: string | null; status: string; createdAt: string; }
interface DispatchItem {
  id: string; sheetId: string; outletCode: string; outletId: string | null;
  outletName?: string; itemCode: string; description: string | null;
  weight: string | null; totalDelivered: string | null; remaining: string | null;
  remark: string | null; grnNumber: string | null;
  delivery?: { status: string; deliveredQty: string | null; remainingQty: string | null; remark: string | null; } | null;
}
interface OutletGroup {
  outletId: string | null; outletCode: string; outletName: string;
  isOverridden: boolean; overrideZoneId: string | null; items: DispatchItem[];
  truckAssignmentId: string | null;
}
interface ZoneGroup {
  zoneId: string; zoneName: string;
  drivers: { id: string; name: string }[];
  trucks?: { id: string; usedCapacity: string; vehicle: any; driver: any }[];
  outlets: OutletGroup[];
}
interface BoardData { zones: ZoneGroup[]; overrides: any[]; }
interface Driver { id: string; name: string; status: string; }
interface Zone { id: string; name: string; }

// ===== CSV Parser =====
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));
  // Normalize common header variants
  const normalize = (h: string) => {
    if (h.includes("outlet") && h.includes("code")) return "outlet_code";
    if (h.includes("item") && h.includes("code")) return "item_code";
    if (h.includes("desc")) return "description";
    if (h === "weight" || h.includes("qty") || h.includes("quantity")) return "weight";
    if (h.includes("total") && h.includes("del")) return "total_delivered";
    if (h === "remaining") return "remaining";
    if (h.includes("remark")) return "remark";
    if (h.includes("grn")) return "grn_number";
    return h;
  };
  const headers = rawHeaders.map(normalize);
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

// ===== Status Badge =====
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
  partial: { label: "Partial", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  damaged: { label: "Damaged", color: "bg-red-100 text-red-700 border-red-200", icon: X },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

// ===== Delivery Update Dialog =====
function DeliveryDialog({
  item, sheetId, onClose, onSave,
}: { item: DispatchItem; sheetId: string; onClose: () => void; onSave: (data: any) => void }) {
  const [status, setStatus] = useState(item.delivery?.status || "pending");
  const [deliveredQty, setDeliveredQty] = useState(item.delivery?.deliveredQty || item.totalDelivered || item.weight || "");
  const [remainingQty, setRemainingQty] = useState(item.delivery?.remainingQty || item.remaining || "0");
  const [damagedQty, setDamagedQty] = useState(item.delivery?.damagedQty || "0");
  const [damageReason, setDamageReason] = useState(item.delivery?.damageReason || "");
  const [remark, setRemark] = useState(item.delivery?.remark || "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Update Delivery — {item.itemCode}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-muted-foreground">Outlet:</span> <span className="font-medium">{item.outletCode}</span></p>
            {item.description && <p><span className="text-muted-foreground">Item:</span> {item.description}</p>}
            {item.grnNumber && <p><span className="text-muted-foreground">GRN:</span> {item.grnNumber}</p>}
            {item.weight && <p><span className="text-muted-foreground">Weight:</span> {item.weight} kg</p>}
          </div>
          <div className="space-y-2">
            <Label>Delivery Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Delivered Qty</Label>
              <Input type="number" value={deliveredQty} onChange={e => setDeliveredQty(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Remaining Qty</Label>
              <Input type="number" value={remainingQty} onChange={e => setRemainingQty(e.target.value)} placeholder="0" />
            </div>
          </div>
          
          {/* Damaged fields */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-red-50/50 rounded-lg border border-red-100">
            <div className="space-y-2">
              <Label className="text-red-700">Damaged Qty</Label>
              <Input type="number" value={damagedQty} onChange={e => setDamagedQty(e.target.value)} placeholder="0" className="border-red-200" />
            </div>
            <div className="space-y-2">
              <Label className="text-red-700">Damage Reason</Label>
              <Input value={damageReason} onChange={e => setDamageReason(e.target.value)} placeholder="Reason..." className="border-red-200" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>General Remark</Label>
            <Textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ status, deliveredQty, remainingQty, damagedQty, damageReason, remark })}>Save Delivery</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Zone Override Dialog =====
function ZoneOverrideDialog({
  outletCode, outletId, sheetId, zones, onClose, onSave,
}: { outletCode: string; outletId: string; sheetId: string; zones: Zone[]; onClose: () => void; onSave: (zoneId: string, reason: string) => void }) {
  const [zoneId, setZoneId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-amber-500" />
            Move Outlet — {outletCode}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Temporarily reassign this outlet to a different zone for this dispatch sheet.</p>
          <div className="space-y-2">
            <Label>Target Zone</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue placeholder="Select zone..." /></SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Truck at max capacity" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!zoneId} onClick={() => onSave(zoneId, reason)} className="bg-amber-500 hover:bg-amber-600 text-white">Move Outlet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Outlet Card =====
function OutletCard({
  outlet, sheetId, zones, isSupervisor, assignedTruck, onDeliveryUpdate, onOverride,
}: {
  outlet: OutletGroup; sheetId: string; zones: Zone[]; isSupervisor: boolean;
  assignedTruck?: { vehicle: any; driver: any } | null;
  onDeliveryUpdate: (item: DispatchItem) => void;
  onOverride: (outlet: OutletGroup) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const delivered = outlet.items.filter(i => i.delivery?.status === "delivered").length;
  const total = outlet.items.length;
  const allDone = delivered === total && total > 0;
  const anyPartial = outlet.items.some(i => i.delivery?.status === "partial" || i.delivery?.status === "damaged");

  return (
    <div className={`rounded-xl border ${allDone ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" : anyPartial ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : "border-border bg-card"} shadow-sm`}>
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${allDone ? "bg-emerald-100" : "bg-primary/10"}`}>
            <MapPin className={`h-4 w-4 ${allDone ? "text-emerald-600" : "text-primary"}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{outlet.outletName}</p>
            <p className="text-xs text-muted-foreground">{outlet.outletCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {assignedTruck && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] h-6 px-1.5 gap-1 shadow-sm" title={`Assigned to truck: ${assignedTruck.vehicle?.name}`}>
              <Truck className="h-3 w-3" />
              <span className="max-w-[60px] truncate">{assignedTruck.vehicle?.name || "Truck"}</span>
            </Badge>
          )}
          {outlet.isOverridden && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Override</Badge>
          )}
          <Badge variant="outline" className="text-xs">{delivered}/{total}</Badge>
          {isSupervisor && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={e => { e.stopPropagation(); onOverride(outlet); }}>
              <ArrowRight className="h-3 w-3 mr-1" />Move
            </Button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t divide-y">
          {outlet.items.map(item => {
            const status = item.delivery?.status || "pending";
            return (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-xs">{item.itemCode}</span>
                    {item.grnNumber && <span className="text-xs text-muted-foreground">GRN: {item.grnNumber}</span>}
                    <StatusBadge status={status} />
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>}
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                    {item.totalDelivered && <span>Total: {item.totalDelivered}</span>}
                    {item.delivery?.deliveredQty && <span className="text-emerald-600">Del: {item.delivery.deliveredQty}</span>}
                    {item.delivery?.remainingQty && <span className="text-amber-600">Rem: {item.delivery.remainingQty}</span>}
                    {item.weight && <span>{item.weight} kg</span>}
                  </div>
                  {item.delivery?.remark && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">"{item.delivery.remark}"</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-shrink-0"
                  onClick={() => onDeliveryUpdate(item)}>
                  <Eye className="h-3 w-3 mr-1" />Update
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Zone Column =====
function ZoneColumn({
  zone, sheetId, zones, isSupervisor, onDeliveryUpdate, onOverride,
}: {
  zone: ZoneGroup; sheetId: string; zones: Zone[]; isSupervisor: boolean;
  onDeliveryUpdate: (item: DispatchItem) => void;
  onOverride: (outlet: OutletGroup) => void;
}) {
  const totalItems = zone.outlets.reduce((s, o) => s + o.items.length, 0);
  const deliveredItems = zone.outlets.reduce((s, o) => s + o.items.filter(i => i.delivery?.status === "delivered").length, 0);
  const isUnassigned = zone.zoneId === "unassigned";

  return (
    <div className={`flex-shrink-0 w-80 flex flex-col rounded-2xl border ${isUnassigned ? "border-dashed border-slate-300 bg-slate-50/50 dark:bg-slate-900/20" : "border-border bg-card"} shadow-sm`}>
      {/* Zone Header */}
      <div className={`p-4 rounded-t-2xl ${isUnassigned ? "" : "bg-gradient-to-r from-primary/10 to-primary/5"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isUnassigned ? "bg-slate-200" : "bg-primary/20"}`}>
              <MapPin className={`h-4 w-4 ${isUnassigned ? "text-slate-500" : "text-primary"}`} />
            </div>
            <div>
              <h3 className="font-bold text-sm">{zone.zoneName}</h3>
              <p className="text-xs text-muted-foreground">{zone.outlets.length} outlets · {totalItems} items</p>
            </div>
          </div>
          <Badge className={`${deliveredItems === totalItems && totalItems > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-primary/10 text-primary"} border text-xs`}>
            {deliveredItems}/{totalItems}
          </Badge>
        </div>
        {zone.trucks && zone.trucks.length > 0 ? (
          <div className="flex flex-col gap-2 mt-2">
            {zone.trucks.map(t => {
              const capacity = parseFloat(t.vehicle?.capacity || "0");
              const used = parseFloat(t.usedCapacity || "0");
              const isOver = used > capacity && capacity > 0;
              return (
                <div key={t.id} className="bg-background rounded-md p-2 text-xs border flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between font-medium">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      <span className="truncate max-w-[100px]" title={t.vehicle?.name}>{t.vehicle?.name || 'Unknown Truck'}</span>
                    </div>
                    {capacity > 0 && (
                      <span className={isOver ? "text-red-600 font-bold" : "text-emerald-600"}>
                        {used.toFixed(1)} / {capacity.toFixed(0)} kg
                      </span>
                    )}
                  </div>
                  {t.driver && (
                    <div className="flex items-center gap-1.5 text-muted-foreground border-t pt-1">
                      <User className="h-3 w-3" />
                      <span className="truncate">{t.driver.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : zone.drivers.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {zone.drivers.map(d => (
              <div key={d.id} className="flex items-center gap-1 bg-background rounded-full px-2 py-0.5 border text-xs">
                <User className="h-3 w-3 text-primary" />
                <span className="font-medium">{d.name}</span>
              </div>
            ))}
          </div>
        ) : !isUnassigned && (
          <p className="text-xs text-muted-foreground italic mt-2">No trucks or drivers assigned</p>
        )}
      </div>
      {/* Outlets */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: "calc(100vh - 280px)" }}>
        {zone.outlets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No outlets in this zone</div>
        ) : (
          zone.outlets.map((outlet, i) => {
            const assignedTruck = zone.trucks?.find(t => t.id === outlet.truckAssignmentId);
            return (
              <OutletCard key={outlet.outletId || outlet.outletCode + i}
                outlet={outlet} sheetId={sheetId} zones={zones}
                isSupervisor={isSupervisor}
                assignedTruck={assignedTruck}
                onDeliveryUpdate={onDeliveryUpdate}
                onOverride={onOverride}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ===== Main Page =====
export default function DailyDispatchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [activeTab, setActiveTab] = useState("board");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [boardSheetId, setBoardSheetId] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadDate, setUploadDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isDragging, setIsDragging] = useState(false);
  const [deliveryDialog, setDeliveryDialog] = useState<DispatchItem | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<OutletGroup | null>(null);
  const [driverZoneForm, setDriverZoneForm] = useState({ driverId: "", zoneId: "" });

  // Queries
  const { data: sheets = [] } = useQuery<DispatchSheet[]>({ queryKey: ["/api/dispatch/sheets"] });
  const { data: zones = [] } = useQuery<Zone[]>({ queryKey: ["/api/zones"] });
  const { data: drivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: driverZones = [] } = useQuery<any[]>({ queryKey: ["/api/dispatch/driver-zones"] });

  const { data: boardData, isLoading: boardLoading, refetch: refetchBoard } = useQuery<BoardData>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`],
    enabled: !!boardSheetId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { date: string; fileName: string; items: any[] }) =>
      apiRequest("POST", "/api/dispatch/sheets", data),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({ title: `Sheet uploaded! ${result.itemCount} items loaded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/sheets"] });
      setCsvPreview(null);
      setCsvFileName("");
      setActiveTab("board");
      setBoardSheetId(result.sheet.id);
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteSheetMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dispatch/sheets/${id}`),
    onSuccess: () => {
      toast({ title: "Sheet deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/sheets"] });
      if (boardSheetId) {
        setBoardSheetId(null);
        setActiveTab("upload");
      }
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  // Delivery mutation
  const deliveryMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: any }) =>
      apiRequest("PATCH", `/api/dispatch/items/${itemId}/delivery`, data),
    onSuccess: () => {
      toast({ title: "Delivery updated!" });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      setDeliveryDialog(null);
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  // Override mutation
  const overrideMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/dispatch/overrides", data),
    onSuccess: () => {
      toast({ title: "Zone override applied!" });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      setOverrideDialog(null);
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dispatch/overrides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
    },
  });

  // Driver zone mutations
  const assignDriverZoneMutation = useMutation({
    mutationFn: (data: { driverId: string; zoneId: string }) => apiRequest("POST", "/api/dispatch/driver-zones", data),
    onSuccess: () => {
      toast({ title: "Driver assigned to zone!" });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/driver-zones"] });
      setDriverZoneForm({ driverId: "", zoneId: "" });
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const removeDriverZoneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dispatch/driver-zones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/dispatch/driver-zones"] }),
  });

  // File handling
  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleUpload = () => {
    if (!csvPreview || csvPreview.length === 0) return;
    uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview });
  };

  // Find sheet for selected date on board
  const sheetForDate = sheets.find(s => s.date === selectedDate);

  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const zoneMap = new Map(zones.map(z => [z.id, z]));

  const isSupervisor = true; // TODO: link to user role

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 57px)" }}>
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gradient-to-r from-primary/5 via-background to-background">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Daily Dispatch</h1>
            <p className="text-sm text-muted-foreground">Upload delivery sheets, track orders by zone and driver</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b bg-background">
        <TabsList className="gap-1 flex-wrap">
            <TabsTrigger value="board" className="gap-2"><MapPin className="h-4 w-4" />Dispatch Board</TabsTrigger>
            <TabsTrigger value="trucks" className="gap-2"><Truck className="h-4 w-4" />Truck Planning</TabsTrigger>
            <TabsTrigger value="pending" className="gap-2"><Package className="h-4 w-4" />Pending</TabsTrigger>
            <TabsTrigger value="upload" className="gap-2"><Upload className="h-4 w-4" />Upload Sheet</TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2"><User className="h-4 w-4" />Driver Zones</TabsTrigger>
            <TabsTrigger value="transfers" className="gap-2"><ArrowRight className="h-4 w-4" />Transfers</TabsTrigger>
          </TabsList>
        </div>

        {/* ===== BOARD TAB ===== */}
        <TabsContent value="board" className="flex-1 flex flex-col min-h-0 m-0 p-0 data-[state=inactive]:hidden">
          <div className="px-6 py-3 border-b flex items-center gap-4 flex-wrap bg-background">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="w-40 h-8 text-sm" />
            </div>
            {sheetForDate ? (
              <Button size="sm" variant={boardSheetId === sheetForDate.id ? "default" : "outline"}
                onClick={() => setBoardSheetId(sheetForDate.id)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {boardSheetId === sheetForDate.id ? "Viewing Board" : "Load Board"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                No sheet for this date.
                <Button size="sm" variant="ghost" onClick={() => { setUploadDate(selectedDate); setActiveTab("upload"); }}>
                  Upload one →
                </Button>
              </div>
            )}
            {boardSheetId && (
              <Button size="sm" variant="ghost" onClick={() => refetchBoard()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
              </Button>
            )}
            {boardData && boardData.overrides.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {boardData.overrides.length} zone override(s) active
              </Badge>
            )}
          </div>

          {!boardSheetId ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-semibold">Select a Date to Load the Board</p>
                <p className="text-sm text-muted-foreground">Pick a date above that has an uploaded dispatch sheet.</p>
              </div>
            </div>
          ) : boardLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : !boardData ? (
            <div className="flex-1 flex items-center justify-center min-h-0 text-muted-foreground">Failed to load board.</div>
          ) : (
            <div className="flex-1 overflow-auto p-4 min-h-0">
              <div className="flex gap-4 min-w-max pb-4">
                {boardData.zones
                  .filter(z => z.outlets.length > 0 || z.zoneId === "unassigned")
                  .map(zone => (
                    <ZoneColumn key={zone.zoneId} zone={zone} sheetId={boardSheetId}
                      zones={zones} isSupervisor={isSupervisor}
                      onDeliveryUpdate={item => setDeliveryDialog(item)}
                      onOverride={outlet => setOverrideDialog(outlet)}
                    />
                  ))}
                {boardData.zones.every(z => z.outlets.length === 0) && (
                  <div className="flex items-center justify-center w-full h-64 text-muted-foreground">
                    No items found in this sheet.
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== TRUCK PLANNING TAB ===== */}
        <TabsContent value="trucks" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
          <TruckPlanningTab boardSheetId={boardSheetId} zones={zones} drivers={drivers} selectedDate={selectedDate} onSelectSheet={(id) => { setBoardSheetId(id); }} sheets={sheets} />
        </TabsContent>

        {/* ===== PENDING QUANTITIES TAB ===== */}
        <TabsContent value="pending" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
          <PendingQuantitiesTab />
        </TabsContent>

        {/* ===== UPLOAD TAB ===== */}
        <TabsContent value="upload" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Existing Sheets */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Uploaded Sheets
                </CardTitle>
                <CardDescription>All daily dispatch sheets. Re-uploading for the same date replaces the previous sheet.</CardDescription>
              </CardHeader>
              <CardContent>
                {sheets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No sheets uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sheets.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{format(parseISO(s.date), "EEEE, dd MMM yyyy")}</p>
                            <p className="text-xs text-muted-foreground">{s.fileName || "No filename"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={s.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
                            {s.status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedDate(s.date); setBoardSheetId(s.id); setActiveTab("board"); }}>
                            <Eye className="h-3.5 w-3.5 mr-1" />View
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" 
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this sheet? All associated items and delivery logs will be lost.")) {
                                deleteSheetMutation.mutate(s.id);
                              }
                            }}
                            disabled={deleteSheetMutation.isPending}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" />
                  Upload New Sheet
                </CardTitle>
                <CardDescription>
                  CSV columns: <code className="text-xs bg-muted px-1 py-0.5 rounded">outlet_code, item_code, description, weight, total_delivered, remaining, remark, grn_number</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Dispatch Date</Label>
                  <Input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)} className="w-44" />
                </div>

                {/* Dropzone */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/30 hover:border-primary hover:bg-primary/3"}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium text-sm">Drop CSV here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Only .csv files accepted</p>
                  {csvFileName && <p className="text-xs text-primary mt-2 font-medium">{csvFileName}</p>}
                </div>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                {/* Preview */}
                {csvPreview && csvPreview.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">{csvPreview.length} rows parsed — Preview:</p>
                      <Button variant="ghost" size="sm" onClick={() => { setCsvPreview(null); setCsvFileName(""); }}>
                        <X className="h-3.5 w-3.5 mr-1" />Clear
                      </Button>
                    </div>
                    <div className="rounded-lg border overflow-auto max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(csvPreview[0]).map(h => (
                              <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvPreview.slice(0, 8).map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((v, j) => (
                                <TableCell key={j} className="text-xs py-1.5 whitespace-nowrap">{v || "-"}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {csvPreview.length > 8 && (
                      <p className="text-xs text-muted-foreground text-center">... and {csvPreview.length - 8} more rows</p>
                    )}
                    <Button onClick={handleUpload} disabled={uploadMutation.isPending} className="w-full gap-2">
                      <Upload className="h-4 w-4" />
                      {uploadMutation.isPending ? "Uploading..." : `Upload ${csvPreview.length} Items for ${format(parseISO(uploadDate), "dd MMM yyyy")}`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== DRIVER ZONES TAB ===== */}
        <TabsContent value="drivers" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Assign Driver to Zone
                </CardTitle>
                <CardDescription>Drivers assigned here will appear on the dispatch board under their zone.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <Select value={driverZoneForm.driverId} onValueChange={v => setDriverZoneForm(f => ({ ...f, driverId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select driver..." /></SelectTrigger>
                      <SelectContent>
                        {drivers.filter(d => d.status === "active").map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zone</Label>
                    <Select value={driverZoneForm.zoneId} onValueChange={v => setDriverZoneForm(f => ({ ...f, zoneId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select zone..." /></SelectTrigger>
                      <SelectContent>
                        {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => assignDriverZoneMutation.mutate(driverZoneForm)}
                  disabled={!driverZoneForm.driverId || !driverZoneForm.zoneId || assignDriverZoneMutation.isPending}
                  className="gap-2">
                  <Plus className="h-4 w-4" />Assign
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Current Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                {driverZones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No driver zone assignments yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {driverZones.map((dz: any) => {
                        const driver = driverMap.get(dz.driverId);
                        const zone = zoneMap.get(dz.zoneId);
                        return (
                          <TableRow key={dz.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="font-medium text-sm">{driver?.name || dz.driverId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                <span className="text-sm">{zone?.name || dz.zoneId}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removeDriverZoneMutation.mutate(dz.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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

        {/* ===== TRANSFERS TAB ===== */}
        <TabsContent value="transfers" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
          <TruckTransfersTab zones={zones} vehicles={[]} />
        </TabsContent>
      </Tabs>

      {/* Delivery Dialog */}
      {deliveryDialog && (
        <DeliveryDialog item={deliveryDialog} sheetId={boardSheetId!}
          onClose={() => setDeliveryDialog(null)}
          onSave={data => deliveryMutation.mutate({ itemId: deliveryDialog.id, data })}
        />
      )}

      {/* Override Dialog */}
      {overrideDialog && overrideDialog.outletId && (
        <ZoneOverrideDialog
          outletCode={overrideDialog.outletCode}
          outletId={overrideDialog.outletId!}
          sheetId={boardSheetId!}
          zones={zones}
          onClose={() => setOverrideDialog(null)}
          onSave={(zoneId, reason) => overrideMutation.mutate({
            sheetId: boardSheetId, outletId: overrideDialog.outletId, overrideZoneId: zoneId, reason,
          })}
        />
      )}
    </div>
  );
}

// ===== TRUCK PLANNING TAB =====
function TruckPlanningTab({ boardSheetId, zones, drivers, selectedDate, onSelectSheet, sheets }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [truckForm, setTruckForm] = useState({ truckId: "", driverId: "", zoneId: "" });

  const { data: vehiclesList = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles"] });

  const { data: truckData, refetch } = useQuery<any>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`],
    enabled: !!boardSheetId,
  });

  const sheetForDate = sheets.find((s: any) => s.date === selectedDate);
  const truckAssignments = truckData?.trucks || [];
  const outletAssignments = truckData?.outletAssignments || [];

  const addTruckMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/dispatch/sheets/${boardSheetId}/trucks`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] }); toast({ title: "Truck added to dispatch!" }); setTruckForm({ truckId: "", driverId: "", zoneId: "" }); },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const removeTruckMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dispatch/trucks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] }); toast({ title: "Truck removed" }); },
  });

  const autoAllocateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/dispatch/sheets/${boardSheetId}/trucks/auto-allocate`, {}),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      const msg = data.overflow?.length > 0 ? `Allocated ${data.allocated} outlets. ⚠ ${data.overflow.length} outlets couldn't fit any truck.` : `✅ Allocated ${data.allocated} outlets across trucks.`;
      toast({ title: msg });
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const getVehicleInfo = (id: string) => vehiclesList.find((v: any) => v.id === id);
  const getDriverName = (id: string) => drivers.find((d: any) => d.id === id)?.name || "Unassigned";
  const getZoneName = (id: string) => zones.find((z: any) => z.id === id)?.name || "Unknown";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {!boardSheetId ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-3 text-primary/40" />
            <p className="font-medium">Select a dispatch sheet first</p>
            <p className="text-sm">Go to the Dispatch Board tab, pick a date, and load a sheet. Then return here to plan trucks.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Add Truck */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add Truck to Today's Dispatch
              </CardTitle>
              <CardDescription>Assign a vehicle and driver to a zone for this dispatch sheet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle / Truck</Label>
                  <Select value={truckForm.truckId} onValueChange={v => setTruckForm(f => ({ ...f, truckId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                    <SelectContent>
                      {vehiclesList.filter((v: any) => v.status === "available").map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.plateNumber} — {v.name} ({v.capacity || "?"} T)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Driver (Optional)</Label>
                  <Select value={truckForm.driverId} onValueChange={v => setTruckForm(f => ({ ...f, driverId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select driver..." /></SelectTrigger>
                    <SelectContent>
                      {drivers.filter((d: any) => d.status === "active").map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Zone</Label>
                  <Select value={truckForm.zoneId} onValueChange={v => setTruckForm(f => ({ ...f, zoneId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select zone..." /></SelectTrigger>
                    <SelectContent>
                      {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => addTruckMutation.mutate(truckForm)} disabled={!truckForm.truckId || !truckForm.zoneId || addTruckMutation.isPending} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Truck
                </Button>
                <Button variant="outline" onClick={() => autoAllocateMutation.mutate()} disabled={truckAssignments.length === 0 || autoAllocateMutation.isPending} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${autoAllocateMutation.isPending ? "animate-spin" : ""}`} /> Auto-Allocate Outlets (FFD)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Truck Capacity Board */}
          {truckAssignments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {truckAssignments.map((ta: any) => {
                const veh = getVehicleInfo(ta.truckId);
                const cap = parseFloat(veh?.capacity || "0");
                const used = parseFloat(ta.usedCapacity || "0");
                const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                const outletsOnTruck = outletAssignments.filter((o: any) => o.truckAssignmentId === ta.id);

                return (
                  <Card key={ta.id} className={`border ${pct >= 90 ? "border-red-300 bg-red-50/30" : pct >= 70 ? "border-amber-300" : "border-border"}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm font-mono">{veh?.plateNumber || ta.truckId}</p>
                          <p className="text-xs text-muted-foreground">{veh?.name} · {getZoneName(ta.zoneId)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />{getDriverName(ta.driverId)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeTruckMutation.mutate(ta.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {/* Capacity Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Capacity</span>
                          <span className={pct >= 90 ? "text-red-600 font-semibold" : "text-muted-foreground"}>{used.toFixed(1)}T / {cap.toFixed(1)}T ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {/* Outlets */}
                      {outletsOnTruck.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-xs font-semibold text-muted-foreground">Assigned Outlets:</p>
                          {outletsOnTruck.map((o: any) => (
                            <div key={o.id} className="flex justify-between text-xs bg-muted/40 px-2 py-1 rounded">
                              <span className="font-medium">{o.outletCode}</span>
                              <span className="text-muted-foreground">{parseFloat(o.assignedWeight || "0").toFixed(1)}T</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {pct >= 90 && (
                        <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle className="h-3 w-3" /> Near capacity overflow risk!
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== PENDING QUANTITIES TAB =====
function PendingQuantitiesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/dispatch/pending"] });

  const carryForwardMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/dispatch/pending/${id}/carry-forward`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dispatch/pending"] }); toast({ title: "Marked as carried forward" }); },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Pending Delivery Quantities
          </CardTitle>
          <CardDescription>
            These quantities were not delivered in previous dispatch sheets. They are automatically included in future planning.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : pending.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/60" />
              <p className="font-medium">No pending quantities!</p>
              <p className="text-sm">All deliveries are up to date.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Pending Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Source Sheet</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.outletCode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.itemCode}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{p.description || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">{parseFloat(p.pendingQty).toFixed(3)}</TableCell>
                    <TableCell className="text-xs">{p.reason || "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{p.sourceSheetId?.slice(0, 8)}...</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => carryForwardMutation.mutate(p.id)}>
                        <Check className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== TRUCK TRANSFERS TAB =====
function TruckTransfersTab({ zones, vehicles: _v }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ truckId: "", fromZoneId: "", toZoneId: "", transferType: "temporary", startDate: "", endDate: "", reason: "", remarks: "" });

  const { data: transfers = [] } = useQuery<any[]>({ queryKey: ["/api/truck-transfers"] });
  const { data: vehiclesList = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles"] });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/truck-transfers", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truck-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Truck transfer recorded!" });
      setForm({ truckId: "", fromZoneId: "", toZoneId: "", transferType: "temporary", startDate: "", endDate: "", reason: "", remarks: "" });
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const getVehiclePlate = (id: string) => vehiclesList.find((v: any) => v.id === id)?.plateNumber || id;
  const getZoneName = (id: string) => zones.find((z: any) => z.id === id)?.name || "—";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" /> Log Truck Transfer
          </CardTitle>
          <CardDescription>Record temporary or permanent truck zone transfers. Permanent transfers will update the vehicle's home zone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Truck</Label>
              <Select value={form.truckId} onValueChange={v => setForm(f => ({ ...f, truckId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select truck..." /></SelectTrigger>
                <SelectContent>{vehiclesList.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plateNumber} — {v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Zone</Label>
              <Select value={form.fromZoneId} onValueChange={v => setForm(f => ({ ...f, fromZoneId: v }))}>
                <SelectTrigger><SelectValue placeholder="Current zone..." /></SelectTrigger>
                <SelectContent>{zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To Zone *</Label>
              <Select value={form.toZoneId} onValueChange={v => setForm(f => ({ ...f, toZoneId: v }))}>
                <SelectTrigger><SelectValue placeholder="Target zone..." /></SelectTrigger>
                <SelectContent>{zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transfer Type</Label>
              <Select value={form.transferType} onValueChange={v => setForm(f => ({ ...f, transferType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporary (Date-limited)</SelectItem>
                  <SelectItem value="permanent">Permanent (Zone change)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            {form.transferType === "temporary" && (
              <div className="space-y-2">
                <Label>End Date (Return Date)</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Capacity exceeded, breakdown..." />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Additional notes..." />
            </div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!form.truckId || !form.toZoneId || !form.startDate || createMutation.isPending} className="gap-2">
            <Plus className="h-4 w-4" />{createMutation.isPending ? "Saving..." : "Record Transfer"}
          </Button>
        </CardContent>
      </Card>

      {/* Transfer History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Transfer History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transfers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No transfers recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Truck</TableHead>
                  <TableHead>From Zone</TableHead>
                  <TableHead>To Zone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono font-semibold">{getVehiclePlate(t.truckId)}</TableCell>
                    <TableCell className="text-xs">{getZoneName(t.fromZoneId)}</TableCell>
                    <TableCell className="text-xs font-semibold">{getZoneName(t.toZoneId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={t.transferType === "permanent" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                        {t.transferType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{t.startDate}</TableCell>
                    <TableCell className="text-xs font-mono">{t.endDate || "Open"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.reason || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={t.status === "active" ? "bg-emerald-50 text-emerald-700" : ""}>{t.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
