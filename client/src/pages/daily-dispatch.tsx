import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ErrorBoundary } from "@/components/error-boundary";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/auth-context";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Truck, Upload, FileText, Calendar, MapPin, User, Package, Store, Hourglass, AlertCircle,
  ChevronDown, ChevronUp, ChevronRight, AlertTriangle, CheckCircle2, Clock,
  X, Plus, Trash2, RefreshCw, ArrowRight, Eye, Printer, Download, Edit2, Check,
  Share2, MoreHorizontal, Folder, Wrench, History, Fuel, Settings, PlusCircle, Search,
} from "lucide-react";

// ===== Types =====
interface DispatchSheet { id: string; date: string; fileName: string | null; status: string; createdAt: string; }
interface DispatchItem {
  id: string; sheetId: string; outletCode: string; outletId: string | null;
  outletName?: string; itemCode: string; description: string | null;
  weight: string | null; requestedQty?: string | null; uom?: string | null;
  totalDelivered: string | null; remaining: string | null;
  remark: string | null; grnNumber: string | null;
  storageType?: string | null;
  delivery?: { status: string; deliveredQty: string | null; remainingQty: string | null; remark: string | null; damagedQty?: string | null; damageReason?: string | null; } | null;
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
  const hasItemSpecificDesc = rawHeaders.some(h => {
    return (h.includes("item") || h.includes("product")) && 
           (h.includes("desc") || h.includes("name"));
  });
  // Normalize common header variants
  const normalize = (h: string) => {
    if (h.includes("outlet") && h.includes("code")) return "outlet_code";
    if (h.includes("item") && h.includes("code")) return "item_code";
    if (h.includes("sub_desc") || h.includes("outlet_desc") || h.includes("customer_desc") || h.includes("outlet_name") || h.includes("customer_name")) {
      return "to_sub_desc";
    }
    if (hasItemSpecificDesc && (h === "description" || h === "desc")) {
      return "to_sub_desc";
    }
    if (h.includes("desc")) return "description";
    if (h.includes("name") && (h.includes("item") || h.includes("product"))) return "description";
    if (h.includes("validation") && (h.includes("qty") || h.includes("quantity"))) return "weight";
    if (h.includes("total") && (h.includes("qty") || h.includes("quantity"))) return "total_qty_col";
    if (h.includes("qty") && !h.includes("fus")) return "weight"; // Fallback for old format
    if (h === "remaining") return "remaining";
    if (h.includes("remark")) return "remark";
    if (h.includes("grn")) return "grn_number";
    if (h.includes("requested") && h.includes("delivery") && h.includes("date")) return "requested_delivery_date";
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
  const [deliveredQty, setDeliveredQty] = useState(item.delivery?.deliveredQty || item.totalDelivered || item.requestedQty || item.weight || "");
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
            {item.requestedQty && <p><span className="text-muted-foreground">Requested Qty:</span> <span className="font-semibold text-primary">{item.requestedQty} {item.uom || ''}</span></p>}
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
function MoveOverrideDialog({
  title, targetName, zones, boardZones, onClose, onSave,
}: { title: string; targetName: string; zones: Zone[]; boardZones?: ZoneGroup[]; onClose: () => void; onSave: (zoneId: string, truckId: string | null, reason: string) => void }) {
  const [zoneId, setZoneId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [reason, setReason] = useState("");

  const selectedZoneData = boardZones?.find(z => z.zoneId === zoneId);
  const availableTrucks = selectedZoneData?.trucks || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-amber-500" />
            {title} — {targetName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Temporarily reassign this to a different zone for this dispatch sheet.</p>
          <div className="space-y-2">
            <Label>Target Zone</Label>
            <Select value={zoneId} onValueChange={(v) => { setZoneId(v); setTruckId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select zone..." /></SelectTrigger>
              <SelectContent>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {zoneId && availableTrucks.length > 0 && (
            <div className="space-y-2">
              <Label>Target Truck (optional)</Label>
              <Select value={truckId || "any"} onValueChange={(v) => setTruckId(v === "any" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Any Truck" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Truck</SelectItem>
                  {availableTrucks.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.vehicle?.plateNumber || t.vehicle?.name || "Truck"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Truck at max capacity" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!zoneId} onClick={() => onSave(zoneId, truckId || null, reason)} className="bg-amber-500 hover:bg-amber-600 text-white">Confirm Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Outlet Card =====
function OutletCard({
  outlet, sheetId, zones, isSupervisor, assignedTruck, onDeliveryUpdate, onOverride, onOverrideItem, selectedDate, onSelect, onManageItems,
  onQuickComplete, onRevertDelivery,
}: {
  outlet: OutletGroup; sheetId: string; zones: Zone[]; isSupervisor: boolean;
  assignedTruck?: { vehicle: any; driver: any } | null;
  onDeliveryUpdate: (item: DispatchItem) => void;
  onOverride: (outlet: OutletGroup) => void;
  onOverrideItem: (item: DispatchItem) => void;
  selectedDate: string;
  onSelect?: () => void;
  onManageItems: (outlet: OutletGroup) => void;
  onQuickComplete?: (item: DispatchItem) => void;
  onRevertDelivery?: (item: DispatchItem) => void;
}) {
  const { user } = useAuth();
  const isDriver = user?.role === "driver" || user?.role?.toLowerCase().includes("driver");
  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");
  const isFuture = selectedDate > format(new Date(), "yyyy-MM-dd");
  const [expanded, setExpanded] = useState(false);
  const delivered = outlet.items.filter(i => i.delivery?.status === "delivered").length;
  const total = outlet.items.length;
  const allDone = delivered === total && total > 0;
  const anyPartial = outlet.items.some(i => i.delivery?.status === "partial" || i.delivery?.status === "damaged");
  const isOutletComplete = total > 0 && outlet.items.every(i => (i.delivery?.status || "pending") !== "pending");

  const totalQty = outlet.items.reduce((sum, item) => sum + parseFloat(item.requestedQty || item.weight || "0"), 0);
  const formattedQty = totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(1);

  return (
    <div className={`rounded-xl border ${allDone ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" : anyPartial ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : "border-border bg-card"} shadow-sm`}>
      <div className="p-3 cursor-pointer space-y-2.5" onClick={() => { setExpanded(e => !e); if (onSelect) onSelect(); }}>
        {/* Row 1: Icon + Name + Chevron */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${allDone ? "bg-emerald-100" : "bg-primary/10"}`}>
              <MapPin className={`h-4 w-4 ${allDone ? "text-emerald-600" : "text-primary"}`} />
            </div>
            <p className="font-semibold text-sm break-words whitespace-normal text-slate-800 dark:text-slate-200">
              {outlet.outletName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Row 2: Code, Storage Types, Assigned Truck */}
        <div className="flex flex-wrap items-center gap-1.5 pl-9 text-xs text-muted-foreground">
          <span>{outlet.outletCode}</span>
          {Array.from(new Set(outlet.items.map((i: any) => i.storageType).filter(Boolean))).map((st: any) => (
            <Badge key={st} variant="outline" className="text-[9px] h-4 px-1 bg-slate-50 font-normal">{st}</Badge>
          ))}
          {assignedTruck && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-primary/5 text-primary border-primary/20 font-medium">
              <Truck className="h-2.5 w-2.5 mr-0.5" />
              {assignedTruck.vehicle?.plateNumber || assignedTruck.vehicle?.name || "Truck"}
            </Badge>
          )}
        </div>

        {/* Row 3: Metrics (Qty, Progress, Override, Move) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pl-9 pt-1.5 border-t border-slate-100/50 mt-1.5">
          <div className="flex items-center gap-1.5">
            {outlet.isOverridden && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] h-4 px-1 font-normal">Override</Badge>
            )}
            <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 text-primary border-primary/20 font-semibold">Qty: {formattedQty}</Badge>
            <Badge variant="outline" className="text-[10px] h-5 bg-slate-100 text-slate-700 border-slate-200 font-medium">{delivered}/{total}</Badge>
          </div>
          
          <div className="flex items-center gap-1">
            {isSupervisor && !isOutletComplete && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-0.5"
                onClick={e => { e.stopPropagation(); onOverride(outlet); }}
              >
                <ArrowRight className="h-3 w-3" />
                Move
              </Button>
            )}
            {isSupervisor && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-0.5"
                onClick={e => { e.stopPropagation(); onManageItems(outlet); }}
              >
                <Settings className="h-3 w-3" />
                Manage
              </Button>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t divide-y">
          {outlet.items.map(item => {
            const status = item.delivery?.status || "pending";
            return (
              <div key={item.id} className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-xs">{item.itemCode}</span>
                    {item.storageType && <Badge variant="outline" className="text-[9px] h-4 px-1 bg-slate-50">{item.storageType}</Badge>}
                    {item.grnNumber && <span className="text-xs text-muted-foreground">GRN: {item.grnNumber}</span>}
                    <StatusBadge status={status} />
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>}
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                    {item.totalDelivered && <span>Total: {item.totalDelivered}</span>}
                    {item.delivery?.deliveredQty && <span className="text-emerald-600">Del: {item.delivery.deliveredQty}</span>}
                    {item.delivery?.remainingQty && <span className="text-amber-600">Rem: {item.delivery.remainingQty}</span>}
                    {item.requestedQty ? (
                      <span>Qty: {item.requestedQty} {item.uom || ''}</span>
                    ) : item.weight ? (
                      <span>{item.weight} kg</span>
                    ) : null}
                  </div>
                  {item.delivery?.remark && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">"{item.delivery.remark}"</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isSupervisor && status === "pending" && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 flex-shrink-0"
                      onClick={() => onOverrideItem(item)}>
                      Move
                    </Button>
                  )}
                  {isSupervisor && status === "pending" && onQuickComplete && (
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] text-emerald-600 border-emerald-200 hover:bg-emerald-50 flex-shrink-0"
                      onClick={() => onQuickComplete(item)}>
                      <Check className="h-3.5 w-3.5 mr-0.5" />Complete
                    </Button>
                  )}
                  {isSupervisor && status !== "pending" && onRevertDelivery && (
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50 flex-shrink-0"
                      onClick={() => onRevertDelivery(item)}>
                      <RefreshCw className="h-3 w-3 mr-0.5" />Revert
                    </Button>
                  )}
                  {status === "pending" && (
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] flex-shrink-0"
                      disabled={isFuture || (isDriver && !isToday)}
                      title={isFuture ? "Cannot update deliveries for a future date." : (isDriver && !isToday) ? "Drivers can only update deliveries for today's date." : ""}
                      onClick={() => onDeliveryUpdate(item)}>
                      <Eye className="h-3 w-3 mr-1" />Update
                    </Button>
                  )}
                </div>
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
  zone, sheetId, zones, isSupervisor, onDeliveryUpdate, onOverride, onOverrideItem, selectedDate,
  onSelectRoute, onSelectOutlet, isExpanded, selectedOutletForDetails, onCloseDetails, onManageItems,
  onQuickComplete, onRevertDelivery, initialZoneData,
}: {
  zone: ZoneGroup; sheetId: string; zones: Zone[]; isSupervisor: boolean;
  onDeliveryUpdate: (item: DispatchItem) => void;
  onOverride: (outlet: OutletGroup) => void;
  onOverrideItem: (item: DispatchItem) => void;
  selectedDate: string;
  onSelectRoute: () => void;
  onSelectOutlet: (outlet: OutletGroup) => void;
  isExpanded: boolean;
  selectedOutletForDetails: any | null;
  onCloseDetails: () => void;
  onManageItems: (outlet: OutletGroup) => void;
  onQuickComplete?: (item: DispatchItem) => void;
  onRevertDelivery?: (item: DispatchItem) => void;
  initialZoneData?: ZoneGroup;
}) {
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [localOutlets, setLocalOutlets] = useState(zone.outlets);

  useEffect(() => {
    setLocalOutlets(zone.outlets);
  }, [zone.outlets]);

  const updateSequenceMutation = useMutation({
    mutationFn: async (sequences: string[]) => {
      const response = await apiRequest("POST", `/api/dispatch/sheets/${sheetId}/routes/${zone.zoneId}/sequence`, { sequences });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${sheetId}/board`] });
      toast({ title: "Delivery sequence updated successfully" });
    },
    onError: (err: any) => {
      setLocalOutlets(zone.outlets);
      toast({
        title: "Error updating sequence",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleMoveSequence = (outlet: any, direction: "up" | "down") => {
    const idx = localOutlets.findIndex(o => (o.outletId || o.outletCode) === (outlet.outletId || outlet.outletCode));
    if (idx === -1) return;

    const newOutlets = [...localOutlets];
    if (direction === "up" && idx > 0) {
      const temp = newOutlets[idx];
      newOutlets[idx] = newOutlets[idx - 1];
      newOutlets[idx - 1] = temp;
    } else if (direction === "down" && idx < newOutlets.length - 1) {
      const temp = newOutlets[idx];
      newOutlets[idx] = newOutlets[idx + 1];
      newOutlets[idx + 1] = temp;
    } else {
      return;
    }

    setLocalOutlets(newOutlets);
    const sequences = newOutlets.map(o => o.outletId || o.outletCode).filter(Boolean) as string[];
    updateSequenceMutation.mutate(sequences);
  };

  const toggleOutlet = (id: string) => {
    setExpandedOutlets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const newOutlets = [...localOutlets];
    const [draggedItem] = newOutlets.splice(draggedIdx, 1);
    newOutlets.splice(targetIdx, 0, draggedItem);

    setLocalOutlets(newOutlets);
    const sequences = newOutlets.map(o => o.outletId || o.outletCode).filter(Boolean) as string[];
    updateSequenceMutation.mutate(sequences);
    setDraggedIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const parseNumber = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const totalItems = localOutlets.reduce((s, o) => s + o.items.length, 0);
  const totalQty = localOutlets.reduce((sumOutlet, o) => {
    return sumOutlet + o.items.reduce((sumItem, i) => sumItem + parseNumber(i.requestedQty || i.weight), 0);
  }, 0);
  const deliveredQty = localOutlets.reduce((sumOutlet, o) => {
    return sumOutlet + o.items.reduce((sumItem, i) => {
      if (i.delivery?.status === "delivered") {
        return sumItem + parseNumber(i.delivery.deliveredQty || i.requestedQty || i.weight);
      }
      return sumItem;
    }, 0);
  }, 0);

  const formattedTotalQty = totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(1);
  const formattedDeliveredQty = deliveredQty % 1 === 0 ? deliveredQty.toFixed(0) : deliveredQty.toFixed(1);
  const completionPercentage = totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;

  // Unfiltered (initial) stats calculation
  const initialOutlets = initialZoneData?.outlets || zone.outlets;
  const initialOutletsCount = initialOutlets.length;
  
  const initialTotalQty = initialOutlets.reduce((sumOutlet, o) => {
    return sumOutlet + o.items.reduce((sumItem, i) => sumItem + parseNumber(i.requestedQty || i.weight), 0);
  }, 0);

  const initialDeliveredQty = initialOutlets.reduce((sumOutlet, o) => {
    return sumOutlet + o.items.reduce((sumItem, i) => {
      if (i.delivery?.status === "delivered") {
        return sumItem + parseNumber(i.delivery.deliveredQty || i.requestedQty || i.weight);
      }
      return sumItem;
    }, 0);
  }, 0);

  const initialCompletionPercentage = initialTotalQty > 0 ? Math.round((initialDeliveredQty / initialTotalQty) * 100) : 0;

  const initialCompletedOutletsCount = initialOutlets.filter(o => 
    o.items.length > 0 && o.items.every(i => (i.delivery?.status || "pending") !== "pending")
  ).length;

  const formattedInitialTotalQty = initialTotalQty % 1 === 0 ? initialTotalQty.toFixed(0) : initialTotalQty.toFixed(1);
  const formattedInitialDeliveredQty = initialDeliveredQty % 1 === 0 ? initialDeliveredQty.toFixed(0) : initialDeliveredQty.toFixed(1);

  const isUnassigned = zone.zoneId === "unassigned";

  const renderOutletItems = (items: any[]) => {
    return (
      <div className="pl-6 space-y-1.5 border-l border-slate-200 ml-3.5 mt-1">
        {items.map((item, idx) => {
          const req = item.requestedQty || item.weight || "0";
          const status = item.delivery?.status || "pending";
          const statusColor = status === "delivered" 
            ? "text-emerald-600 bg-emerald-50 border-emerald-100" 
            : status === "partial" || status === "damaged"
            ? "text-amber-600 bg-amber-50 border-amber-100"
            : "text-slate-500 bg-slate-50 border-slate-100";

          return (
            <div key={idx} className="flex items-start gap-2 text-xs py-1 hover:bg-slate-50 rounded px-1 transition-colors">
              <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 truncate" title={item.description || item.itemCode}>
                  {item.description || item.itemCode}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">Qty: {req}</span>
                  <span className={`text-[9px] px-1 rounded border font-semibold uppercase ${statusColor}`}>
                    {status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic pl-2">No items assigned</p>
        )}
      </div>
    );
  };

  return (
    <div className={`flex-shrink-0 flex rounded-2xl border ${isUnassigned ? "border-dashed border-slate-300 bg-slate-50/50 dark:bg-slate-900/20" : "border-border bg-card"} shadow-sm transition-all duration-300 ${isExpanded ? "w-[600px] flex-row" : "w-80 flex-col"}`}>
      {/* Left Column */}
      <div className={`flex flex-col h-full ${isExpanded ? "w-80 border-r" : "w-full"}`}>
        {/* Zone Header */}
        <div 
          onClick={onSelectRoute}
          className={`p-4 rounded-t-2xl cursor-pointer hover:opacity-90 select-none ${isUnassigned ? "" : "bg-gradient-to-r from-primary/10 to-primary/5"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isUnassigned ? "bg-slate-200" : "bg-primary/20"}`}>
                <MapPin className={`h-4 w-4 ${isUnassigned ? "text-slate-500" : "text-primary"}`} />
              </div>
              <div>
                <h3 className="font-bold text-sm">{zone.zoneName}</h3>
                <p className="text-xs text-muted-foreground">
                  {zone.outlets.length === initialOutletsCount 
                    ? `${initialOutletsCount} outlets` 
                    : `${zone.outlets.length}/${initialOutletsCount} outlets`}
                  {" · "}
                  Qty: {formattedTotalQty === formattedInitialTotalQty 
                    ? formattedTotalQty 
                    : `${formattedTotalQty}/${formattedInitialTotalQty}`}
                </p>
              </div>
            </div>
            <Badge className={`${initialDeliveredQty === initialTotalQty && initialTotalQty > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-primary/10 text-primary"} border text-xs`}>
              {formattedInitialDeliveredQty}/{formattedInitialTotalQty} ({initialCompletionPercentage}%)
            </Badge>
          </div>
          {initialTotalQty > 0 && (
            <div className="mb-3 space-y-2">
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Qty Completion</span>
                  <span className="font-semibold text-primary">{initialCompletionPercentage}%</span>
                </div>
                <Progress value={initialCompletionPercentage} className="h-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Outlets Completion</span>
                  <span className="font-semibold text-indigo-600">
                    {initialCompletedOutletsCount}/{initialOutletsCount} ({initialOutletsCount > 0 ? Math.round((initialCompletedOutletsCount / initialOutletsCount) * 100) : 0}%)
                  </span>
                </div>
                <Progress 
                  value={initialOutletsCount > 0 ? Math.round((initialCompletedOutletsCount / initialOutletsCount) * 100) : 0} 
                  className="h-1 bg-slate-100 dark:bg-slate-800" 
                />
              </div>
            </div>
          )}
          {(!zone.trucks || zone.trucks.length === 0) && (!zone.drivers || zone.drivers.length === 0) ? (
            !isUnassigned && <p className="text-xs text-muted-foreground mt-2 italic flex items-center gap-1"><AlertTriangle className="h-3 w-3" />No trucks or drivers assigned</p>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              {zone.trucks && zone.trucks.map(t => {
                const capacity = parseFloat(t.vehicle?.capacity || "0");
                const used = parseFloat(t.usedCapacity || "0");
                const isOver = used > capacity && capacity > 0;
                return (
                  <div key={`truck-${t.id}`} className="bg-background rounded-md p-2 text-xs border flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center justify-between font-medium">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate max-w-[100px]" title={t.vehicle?.plateNumber || t.vehicle?.name}>{t.vehicle?.plateNumber || t.vehicle?.name || 'Unknown Truck'}</span>
                      </div>
                      {capacity > 0 && (
                        <span className={isOver ? "text-red-600 font-bold flex items-center gap-1" : "text-emerald-600"}>
                          {isOver && <AlertTriangle className="h-3.5 w-3.5" />}
                          {used.toFixed(1)} / {capacity.toFixed(0)} kg
                        </span>
                      )}
                    </div>
                    {t.driver && (
                      <div className="flex items-center gap-1.5 text-muted-foreground border-t pt-1 mt-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{t.driver.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* Outlets */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: "calc(100vh - 280px)" }}>
          {localOutlets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No outlets in this zone</div>
          ) : (
            localOutlets.map((outlet, i) => {
              const assignedTruck = zone.trucks?.find(t => t.id === outlet.truckAssignmentId);
              return (
                <div
                  key={outlet.outletId || outlet.outletCode}
                  draggable={isSupervisor}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`transition-all duration-200 ${isSupervisor ? "cursor-grab active:cursor-grabbing" : ""} ${draggedIdx === i ? "opacity-40 scale-95" : "opacity-100"}`}
                >
                  <OutletCard
                    outlet={outlet} sheetId={sheetId} zones={zones}
                    isSupervisor={isSupervisor}
                    assignedTruck={assignedTruck}
                    onDeliveryUpdate={onDeliveryUpdate}
                    onOverride={onOverride}
                    onOverrideItem={onOverrideItem}
                    selectedDate={selectedDate}
                    onSelect={() => onSelectOutlet(outlet)}
                    onManageItems={onManageItems}
                    onQuickComplete={onQuickComplete}
                    onRevertDelivery={onRevertDelivery}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column */}
      {isExpanded && (
        <div className="w-[280px] flex flex-col h-full bg-slate-100/90 rounded-r-2xl border-l animate-in fade-in slide-in-from-left-5 duration-250">
          <div className="p-3 border-b flex items-center justify-between bg-slate-100 rounded-tr-2xl">
            <div>
              <h4 className="font-bold text-xs text-slate-800 truncate max-w-[190px]" title={zone.zoneName}>
                Route: {zone.zoneName}
              </h4>
              <p className="text-[9px] text-muted-foreground">Route Details Structure</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200" onClick={onCloseDetails}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {selectedOutletForDetails && selectedOutletForDetails.zoneId === zone.zoneId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-800 bg-white p-2 rounded shadow-sm border">
                  <div className="flex items-center gap-2 min-w-0">
                    <Store className="h-4 w-4 text-blue-600 fill-blue-50 shrink-0" />
                    <span className="truncate">{selectedOutletForDetails.outletName}</span>
                  </div>
                  <Button variant="ghost" className="h-5 text-[9px] px-1 hover:bg-slate-200" onClick={onSelectRoute}>
                    Show All
                  </Button>
                </div>
                {renderOutletItems(selectedOutletForDetails.items || [])}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 bg-white p-2 rounded shadow-sm border">
                  <MapPin className="h-4 w-4 text-primary fill-primary/10 shrink-0" />
                  <span className="truncate">{zone.zoneName} Route</span>
                </div>
                
                <div className="pl-1 space-y-2">
                  {localOutlets.map((ot: any, idx: number) => {
                    const id = ot.outletId || ot.outletCode || idx.toString();
                    const isExpanded = !!expandedOutlets[id];
                    return (
                      <div
                        key={id}
                        draggable={isSupervisor}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`space-y-1 transition-all duration-200 ${isSupervisor ? "cursor-grab active:cursor-grabbing" : ""} ${draggedIdx === idx ? "opacity-40 scale-95" : "opacity-100"}`}
                      >
                        <div 
                          className="group flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded shadow-sm border border-transparent hover:border-slate-200 bg-white/40 transition-colors"
                          onClick={() => toggleOutlet(id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            )}
                            <Store className="h-3.5 w-3.5 text-blue-600 fill-blue-50 shrink-0" />
                            <span className="truncate" title={ot.outletName}>{ot.outletName}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSupervisor && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 hover:bg-slate-200"
                                  disabled={idx === 0 || updateSequenceMutation.isPending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveSequence(ot, "up");
                                  }}
                                  title="Move Up (Sequence)"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 hover:bg-slate-200"
                                  disabled={idx === localOutlets.length - 1 || updateSequenceMutation.isPending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveSequence(ot, "down");
                                  }}
                                  title="Move Down (Sequence)"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <span className="text-[9px] font-normal text-slate-500 bg-slate-100 px-1 py-0.5 rounded-full shrink-0">
                              {ot.items?.length || 0}
                            </span>
                          </div>
                        </div>
                        {isExpanded && renderOutletItems(ot.items)}
                      </div>
                    );
                  })}
                  {localOutlets.length === 0 && (
                    <p className="text-xs text-muted-foreground italic pl-2">No outlets assigned</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  emptyText = "No results found.",
  width = "w-[160px]"
}: {
  value: string;
  onValueChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  emptyText?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`h-8 text-xs justify-between font-normal bg-white border border-input shadow-sm hover:bg-accent hover:text-accent-foreground ${width}`}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`p-0 ${width}`} align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-8 text-xs" />
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                  className="text-xs flex items-center justify-between py-1 px-2 cursor-pointer"
                >
                  <span className="truncate mr-2">{opt.label}</span>
                  {value === opt.value && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
function TruckHistoryTab({ vehicles }: { vehicles: any[] }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  useEffect(() => {
    if (vehicles && vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  const { data: maintenanceLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicles/maintenance"],
  });

  const { data: fuelLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicles/fuel"],
  });

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const vehicleMaintenance = useMemo(() => {
    return maintenanceLogs.filter(log => log.vehicleId === selectedVehicleId);
  }, [maintenanceLogs, selectedVehicleId]);

  const vehicleFuel = useMemo(() => {
    return fuelLogs.filter(log => log.vehicleId === selectedVehicleId);
  }, [fuelLogs, selectedVehicleId]);

  const stats = useMemo(() => {
    const totalMaintCost = vehicleMaintenance.reduce((sum, log) => sum + parseFloat(log.cost || "0"), 0);
    const totalFuelCost = vehicleFuel.reduce((sum, log) => sum + parseFloat(log.fuelExpense || "0"), 0);
    const totalLitres = vehicleFuel.reduce((sum, log) => sum + parseFloat(log.liters || "0"), 0);
    
    const odometers = vehicleFuel
      .map(log => parseFloat(log.odometer || "0"))
      .filter(o => o > 0);
    const kmCovered = odometers.length > 1 ? (Math.max(...odometers) - Math.min(...odometers)) : 0;

    return {
      totalMaintCost,
      totalFuelCost,
      totalLitres,
      kmCovered,
      maintCount: vehicleMaintenance.length,
      fuelCount: vehicleFuel.length
    };
  }, [vehicleMaintenance, vehicleFuel]);

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
        <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No trucks registered in the fleet registry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-sm border border-slate-200">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Select Truck / Vehicle</h4>
              <p className="text-xs text-muted-foreground">Select a vehicle to view its fuel and maintenance history logs</p>
            </div>
          </div>
          
          <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
            <SelectTrigger className="w-64 h-9 text-xs">
              <SelectValue placeholder="Select Vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id} className="text-xs">
                  {v.plateNumber || "No Plate"} - {v.name || "Unnamed"} ({v.type || "Owned"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedVehicle && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border shadow-sm">
              <CardContent className="p-4 flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Total Maintenance</span>
                <span className="text-2xl font-extrabold text-slate-800">BD {stats.totalMaintCost.toFixed(3)}</span>
                <span className="text-xs text-slate-500 font-medium">{stats.maintCount} service logs recorded</span>
              </CardContent>
            </Card>

            <Card className="bg-white border shadow-sm">
              <CardContent className="p-4 flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Total Fuel Expense</span>
                <span className="text-2xl font-extrabold text-slate-800">BD {stats.totalFuelCost.toFixed(3)}</span>
                <span className="text-xs text-slate-500 font-medium">{stats.fuelCount} fuel receipts logged</span>
              </CardContent>
            </Card>

            <Card className="bg-white border shadow-sm font-sans">
              <CardContent className="p-4 flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Total Fuel Litres</span>
                <span className="text-2xl font-extrabold text-slate-800">{stats.totalLitres.toFixed(1)} L</span>
                <span className="text-xs text-slate-500 font-medium">Accumulated quantity logged</span>
              </CardContent>
            </Card>

            <Card className="bg-white border shadow-sm">
              <CardContent className="p-4 flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Distance Range</span>
                <span className="text-2xl font-extrabold text-slate-800">{stats.kmCovered > 0 ? `${stats.kmCovered.toLocaleString()} km` : "N/A"}</span>
                <span className="text-xs text-slate-500 font-medium">Logged odometer span</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white shadow-sm border border-slate-200">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Fuel className="h-4 w-4 text-primary" /> Fuel Log History
                </CardTitle>
                <CardDescription className="text-xs">Odometer and diesel refilling expense history</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Odometer (km)</TableHead>
                      <TableHead className="text-xs">Liters</TableHead>
                      <TableHead className="text-xs text-right">Cost (BD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleFuel.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground italic">No fuel logs found.</TableCell>
                      </TableRow>
                    ) : (
                      vehicleFuel.map((log, idx) => (
                        <TableRow key={log.id || idx}>
                          <TableCell className="text-xs font-medium">{log.date ? format(parseISO(log.date), "dd MMM yyyy") : "-"}</TableCell>
                          <TableCell className="text-xs font-mono">{log.odometer ? parseFloat(log.odometer).toLocaleString() : "-"}</TableCell>
                          <TableCell className="text-xs font-mono">{log.liters ? parseFloat(log.liters).toFixed(1) : "-"}</TableCell>
                          <TableCell className="text-xs font-mono text-right font-bold text-slate-800">{log.fuelExpense ? parseFloat(log.fuelExpense).toFixed(3) : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border border-slate-200">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <Wrench className="h-4 w-4 text-primary" /> Maintenance History
                </CardTitle>
                <CardDescription className="text-xs">Mechanical logs, service checks, and repairs history</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Cost (BD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleMaintenance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground italic">No maintenance logs found.</TableCell>
                      </TableRow>
                    ) : (
                      vehicleMaintenance.map((log, idx) => (
                        <TableRow key={log.id || idx}>
                          <TableCell className="text-xs font-medium">{log.date ? format(parseISO(log.date), "dd MMM yyyy") : "-"}</TableCell>
                          <TableCell className="text-xs capitalize font-semibold text-slate-700">{log.maintenanceType?.replace("_", " ") || "-"}</TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]" title={log.description}>{log.description || "-"}</TableCell>
                          <TableCell className="text-xs font-mono text-right font-bold text-slate-800">{log.cost ? parseFloat(log.cost).toFixed(3) : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
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
  const [expandedSummaryItems, setExpandedSummaryItems] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem("dispatchSelectedDate") || format(new Date(), "yyyy-MM-dd");
  });
  const [boardSheetId, setBoardSheetId] = useState<string | null>(() => {
    return localStorage.getItem("dispatchBoardSheetId") || null;
  });

  useEffect(() => {
    localStorage.setItem("dispatchSelectedDate", selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (boardSheetId) {
      localStorage.setItem("dispatchBoardSheetId", boardSheetId);
    } else {
      localStorage.removeItem("dispatchBoardSheetId");
    }
  }, [boardSheetId]);

  const [boardClientId, setBoardClientId] = useState<string>(() => {
    return localStorage.getItem("dispatchBoardClientId") || "all";
  });
  const [boardBrandId, setBoardBrandId] = useState<string>(() => {
    return localStorage.getItem("dispatchBoardBrandId") || "all";
  });
  const [uploadClientId, setUploadClientId] = useState<string>("");

  useEffect(() => {
    localStorage.setItem("dispatchBoardClientId", boardClientId);
    setBoardBrandId("all");
    localStorage.setItem("dispatchBoardBrandId", "all");
  }, [boardClientId]);

  useEffect(() => {
    localStorage.setItem("dispatchBoardBrandId", boardBrandId);
  }, [boardBrandId]);

  const { data: clientList = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { data: brandList = [] } = useQuery<any[]>({ queryKey: ["/api/brands"] });

  const filteredBrands = useMemo(() => {
    if (boardClientId === "all") {
      return brandList;
    }
    return brandList.filter((b: any) => b.clientId === boardClientId);
  }, [brandList, boardClientId]);



  const [csvPreview, setCsvPreview] = useState<Record<string, string>[] | null>(null);
  const [skippedRowsInfo, setSkippedRowsInfo] = useState<{ total: number; missingOutlet: number; missingItemOrQty: number } | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadDate, setUploadDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isDragging, setIsDragging] = useState(false);
  const [deliveryDialog, setDeliveryDialog] = useState<DispatchItem | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<OutletGroup | null>(null);
  const [itemOverrideDialog, setItemOverrideDialog] = useState<DispatchItem | null>(null);
  const [driverZoneForm, setDriverZoneForm] = useState({ driverId: "", zoneId: "" });
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);

  // Item Management Modals State
  const [manageItemsModal, setManageItemsModal] = useState<{
    isOpen: boolean;
    outletCode: string;
    outletName: string;
    items: any[];
  }>({
    isOpen: false,
    outletCode: "",
    outletName: "",
    items: [],
  });

  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [prevOpen, setPrevOpen] = useState(false);

  useEffect(() => {
    if (manageItemsModal.isOpen && !prevOpen) {
      setEditedItems(JSON.parse(JSON.stringify(manageItemsModal.items || [])));
    }
    setPrevOpen(manageItemsModal.isOpen);
  }, [manageItemsModal.isOpen, manageItemsModal.items, prevOpen]);

  const [newItemForm, setNewItemForm] = useState({
    itemCode: "",
    description: "",
    requestedQty: "",
    storageType: "Dry",
    routeId: "",
    toNo: "",
    uom: "",
  });

  const [globalAddModal, setGlobalAddModal] = useState({
    isOpen: false,
    selectedOutletCode: "",
  });

  const [summarySearchQuery, setSummarySearchQuery] = useState("");
  const [pivotSearchQuery, setPivotSearchQuery] = useState("");

  const [boardRouteFilter, setBoardRouteFilter] = useState("all");
  const [boardOutletFilter, setBoardOutletFilter] = useState("all");
  const [boardDriverFilter, setBoardDriverFilter] = useState("all");
  const [boardTruckFilter, setBoardTruckFilter] = useState("all");
  const [boardStatusFilter, setBoardStatusFilter] = useState("all");

  const [selectedRouteForDetails, setSelectedRouteForDetails] = useState<any | null>(null);
  const [selectedOutletForDetails, setSelectedOutletForDetails] = useState<any | null>(null);

  const handleSelectRouteForDetails = (route: any) => {
    setSelectedRouteForDetails(route);
    setSelectedOutletForDetails(null);
  };

  const handleSelectOutletForDetails = (outlet: any) => {
    setSelectedOutletForDetails(outlet);
    setSelectedRouteForDetails(null);
  };

  const handleCloseDetailsPanel = () => {
    setSelectedRouteForDetails(null);
    setSelectedOutletForDetails(null);
  };

  const handleManageItems = (outlet: any) => {
    setManageItemsModal({
      isOpen: true,
      outletCode: outlet.outletCode,
      outletName: outlet.outletName || outlet.outletCode,
      items: outlet.items || [],
    });
  };

  // Queries
  const { data: sheets = [], isLoading: sheetsLoading } = useQuery<DispatchSheet[]>({ queryKey: ["/api/dispatch/sheets"] });
  const { data: zones = [] } = useQuery<any[]>({ queryKey: ["/api/routes"] });
  const { data: drivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: driverZones = [] } = useQuery<any[]>({ queryKey: ["/api/dispatch/driver-zones"] });
  const { data: outlets = [] } = useQuery<any[]>({ queryKey: ["/api/outlets"] });
  // Sync boardSheetId with sheets matching the selectedDate and boardClientId automatically
  useEffect(() => {
    if (!sheetsLoading) {
      const sheet = sheets.find(s => s.date === selectedDate && (boardClientId === "all" || s.clientId === boardClientId));
      if (sheet) {
        setBoardSheetId(sheet.id);
      } else {
        setBoardSheetId(null);
      }
    }
  }, [selectedDate, boardClientId, sheets, sheetsLoading]);

  const { data: boardData, isLoading: boardLoading, refetch: refetchBoard } = useQuery<BoardData>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`],
    enabled: !!boardSheetId,
    refetchInterval: 5000,
  });

  const { data: vehiclesList = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
  });

  const brandFilteredOutletsMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of outlets || []) {
      map.set(o.id, o);
      if (o.code) {
        map.set(o.code.trim().toLowerCase().replace(/^0+/, ""), o);
      }
    }
    return map;
  }, [outlets]);

  const allOutletOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();

    // 1. Add outlets from the active boardData sheet
    if (boardData && boardData.zones) {
      boardData.zones.forEach(z => {
        z.outlets.forEach((o: any) => {
          const code = o.outletCode;
          if (code) {
            map.set(code.trim().toLowerCase(), {
              value: code,
              label: `${o.outletName || "Unnamed"} (${code})`
            });
          }
        });
      });
    }

    // 2. Add outlets from global list, filtered by client/brand context
    const filteredGlobalOutlets = (outlets || []).filter((o: any) => {
      if (boardClientId !== "all" && o.clientId !== boardClientId) return false;
      if (boardBrandId !== "all" && o.brandId !== boardBrandId) return false;
      return true;
    });

    filteredGlobalOutlets.forEach((o: any) => {
      const code = o.code;
      if (code) {
        map.set(code.trim().toLowerCase(), {
          value: code,
          label: `${o.name || "Unnamed"} (${code})`
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [outlets, boardData, boardClientId, boardBrandId]);

  const activeZones = useMemo(() => {
    if (!boardData || !boardData.zones) return zones || [];
    const activeIds = new Set(boardData.zones.map((z: any) => z.zoneId));
    return (zones || []).filter((r: any) => activeIds.has(r.id));
  }, [zones, boardData]);

  const stats = useMemo(() => {
    if (!boardData) return { totalOutlets: 0, pendingOutlets: 0, partiallyDelivered: 0, totalQtyAssigned: 0, completedQty: 0, pendingQty: 0, assignedTrucksCount: 0 };
    
    let totalOutletsSet = new Set<string>();
    let pendingOutletsSet = new Set<string>();
    let partialOutletsSet = new Set<string>();
    
    let totalQtyAssigned = 0;
    let completedQty = 0;
    let pendingQty = 0;
    let assignedTrucksSet = new Set<string>();

    boardData.zones.forEach(z => {
      z.trucks?.forEach(t => {
        if (t.vehicle?.id) {
          if (boardBrandId !== "all") {
            const hasBrandOutlet = z.outlets.some((o: any) => {
              const fullOutlet = (o.outletId ? brandFilteredOutletsMap.get(o.outletId) : null) || (o.outletCode ? brandFilteredOutletsMap.get(o.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
              return fullOutlet?.brandId === boardBrandId && o.truckAssignmentId === t.id;
            });
            if (!hasBrandOutlet) return;
          }
          assignedTrucksSet.add(t.vehicle.id);
        }
      });

      z.outlets.forEach(o => {
        const outletKey = o.outletId || o.outletCode;
        
        const fullOutlet = (o.outletId ? brandFilteredOutletsMap.get(o.outletId) : null) || (o.outletCode ? brandFilteredOutletsMap.get(o.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
        if (boardBrandId !== "all" && fullOutlet?.brandId !== boardBrandId) {
          return;
        }

        totalOutletsSet.add(outletKey);

        let hasPending = false;
        let hasPartial = false;

        o.items.forEach(item => {
          const req = parseFloat(item.requestedQty || item.weight || "0");
          const del = parseFloat(item.delivery?.deliveredQty || "0");
          const status = item.delivery?.status || "pending";

          totalQtyAssigned += req;
          completedQty += del;

          if (status === "pending") {
            hasPending = true;
          } else if (status === "partial" || status === "damaged") {
            hasPartial = true;
          }

          // Calculate remaining quantity
          let rem = parseFloat(item.delivery?.remainingQty || "0");
          if (rem === 0 && status === "pending") {
            rem = req - del;
          }
          pendingQty += rem;
        });

        if (hasPending) {
          pendingOutletsSet.add(outletKey);
        }
        if (hasPartial) {
          partialOutletsSet.add(outletKey);
        }
      });
    });

    return {
      totalOutlets: totalOutletsSet.size,
      pendingOutlets: pendingOutletsSet.size,
      partiallyDelivered: partialOutletsSet.size,
      totalQtyAssigned,
      completedQty,
      pendingQty,
      assignedTrucksCount: assignedTrucksSet.size
    };
  }, [boardData, brandFilteredOutletsMap, boardBrandId]);

  const outletOptions = useMemo(() => {
    if (!boardData) return [{ value: "all", label: "All Outlets" }];
    const outlets = new Map();
    boardData.zones.forEach(z => z.outlets.forEach(o => {
      const id = o.outletId || o.outletCode;
      if (id) {
        const fullOutlet = (o.outletId ? brandFilteredOutletsMap.get(o.outletId) : null) || (o.outletCode ? brandFilteredOutletsMap.get(o.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
        if (boardBrandId !== "all" && fullOutlet?.brandId !== boardBrandId) {
          return;
        }
        outlets.set(id, `${o.outletName || "Unnamed"} (${o.outletCode || "No Code"})`);
      }
    }));
    return [
      { value: "all", label: "All Outlets" },
      ...Array.from(outlets.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [boardData, brandFilteredOutletsMap, boardBrandId]);

  const routeOptions = useMemo(() => {
    if (!boardData) return [{ value: "all", label: "All Routes" }];
    const routes = new Map();
    boardData.zones.forEach(z => {
      if (z.zoneId !== "unassigned") {
        if (boardBrandId !== "all") {
          const hasBrandOutlet = z.outlets.some((o: any) => {
            const fullOutlet = (o.outletId ? brandFilteredOutletsMap.get(o.outletId) : null) || (o.outletCode ? brandFilteredOutletsMap.get(o.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
            return fullOutlet?.brandId === boardBrandId;
          });
          if (!hasBrandOutlet) return;
        }
        routes.set(z.zoneId, z.zoneName);
      }
    });
    return [
      { value: "all", label: "All Routes" },
      ...Array.from(routes.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [boardData, brandFilteredOutletsMap, boardBrandId]);

  const driverOptions = useMemo(() => {
    if (!boardData) return [{ value: "all", label: "All Drivers" }];
    const driversMap = new Map();
    boardData.zones.forEach(z => {
      if (boardBrandId !== "all") {
        const hasBrandOutlet = z.outlets.some((o: any) => {
          const fullOutlet = (o.outletId ? brandFilteredOutletsMap.get(o.outletId) : null) || (o.outletCode ? brandFilteredOutletsMap.get(o.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
          return fullOutlet?.brandId === boardBrandId;
        });
        if (!hasBrandOutlet) return;
      }
      z.trucks?.forEach(t => { if (t.driver) driversMap.set(t.driver.id, t.driver.name); });
      z.drivers?.forEach(d => { if (d) driversMap.set(d.id, d.name); });
    });
    return [
      { value: "all", label: "All Drivers" },
      ...Array.from(driversMap.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [boardData, brandFilteredOutletsMap, boardBrandId]);

  const truckOptions = useMemo(() => {
    if (!boardData) return [{ value: "all", label: "All Trucks" }];
    const trucksMap = new Map();
    boardData.zones.forEach(z => {
      if (boardBrandId !== "all") {
        const hasBrandOutlet = z.outlets.some((o: any) => {
          const fullOutlet = (o.outletId ? brandFilteredOutletsMap.get(o.outletId) : null) || (o.outletCode ? brandFilteredOutletsMap.get(o.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
          return fullOutlet?.brandId === boardBrandId;
        });
        if (!hasBrandOutlet) return;
      }
      z.trucks?.forEach(t => { if (t.vehicle) trucksMap.set(t.vehicle.id, t.vehicle.plateNumber || t.vehicle.name); });
    });
    return [
      { value: "all", label: "All Trucks" },
      ...Array.from(trucksMap.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [boardData, brandFilteredOutletsMap, boardBrandId]);

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "partial", label: "Partial Delivered" },
    { value: "delivered", label: "Completed" }
  ];

  const { data: reportData, isLoading: reportLoading } = useQuery<{ items: any[]; routeMap: Record<string, string> }>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/report`],
    enabled: !!boardSheetId && activeTab === "item-summary",
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { date: string; fileName: string; items: any[]; mergeStrategy?: "skip" | "replace" | "overwrite"; clientId?: string | null }) =>
      apiRequest("POST", "/api/dispatch/sheets", data),
    onSuccess: async (res) => {
      const result = await res.json();
      toast({ title: `Sheet uploaded! ${result.itemCount} items loaded.` });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/sheets"] });
      setCsvPreview(null);
      setSkippedRowsInfo(null);
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

  const handleQuickComplete = (item: DispatchItem) => {
    deliveryMutation.mutate({
      itemId: item.id,
      data: {
        status: "delivered",
        deliveredQty: item.requestedQty || item.weight || "0",
        remainingQty: "0",
        damagedQty: "0",
        damageReason: "",
        remark: "Completed by Supervisor",
      },
    });
  };

  const handleRevert = (item: DispatchItem) => {
    deliveryMutation.mutate({
      itemId: item.id,
      data: {
        status: "pending",
      },
    });
  };

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

  const itemOverrideMutation = useMutation({
    mutationFn: (data: { itemId: string, overrideRouteId: string }) => apiRequest("PUT", `/api/dispatch/items/${data.itemId}/override`, { overrideRouteId: data.overrideRouteId }),
    onSuccess: () => {
      toast({ title: "Item moved successfully!" });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      setItemOverrideDialog(null);
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  // Item Management mutations
  const addItemMutation = useMutation({
    mutationFn: async (data: { sheetId: string; outletCode: string; itemCode: string; description: string; requestedQty: number; storageType: string; routeId?: string; toNo?: string; uom?: string }) => {
      const res = await apiRequest("POST", `/api/dispatch/sheets/${data.sheetId}/items`, data);
      return res.json();
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      setEditedItems(prev => [...prev, newItem]);
      toast({ title: "Item added successfully" });
      setNewItemForm({
        itemCode: "",
        description: "",
        requestedQty: "",
        storageType: "Dry",
        routeId: "",
        toNo: "",
        uom: "",
      });
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { id: string; requestedQty?: number; storageType?: string; overrideRouteId?: string | null; description?: string; itemCode?: string }) => {
      const res = await apiRequest("PATCH", `/api/dispatch/items/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      toast({ title: "Item updated successfully" });
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const batchUpdateItemsMutation = useMutation({
    mutationFn: async (data: { items: any[] }) => {
      const res = await apiRequest("POST", "/api/dispatch/items/batch-update", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      toast({ title: "Items updated successfully" });
      setManageItemsModal(prev => ({ ...prev, isOpen: false }));
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/dispatch/items/${id}`);
      return res.json();
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      setEditedItems(prev => prev.filter(item => item.id !== deletedId));
      toast({ title: "Item deleted successfully" });
    },
    onError: err => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  // Sync manageItemsModal items when boardData changes
  useEffect(() => {
    if (manageItemsModal.isOpen && boardData) {
      let foundOutlet: any = null;
      for (const zone of boardData.zones) {
        const outlet = zone.outlets.find((o: any) => o.outletCode === manageItemsModal.outletCode);
        if (outlet) {
          foundOutlet = outlet;
          break;
        }
      }
      if (foundOutlet) {
        setManageItemsModal(prev => ({
          ...prev,
          items: foundOutlet.items,
        }));
      } else {
        setManageItemsModal(prev => ({
          ...prev,
          items: [],
        }));
      }
    }
  }, [boardData, manageItemsModal.isOpen, manageItemsModal.outletCode]);

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
  const handleFile = async (file: File) => {
    const isCsv = file.name.endsWith(".csv");
    const isExcel = file.name.endsWith(".xls") || file.name.endsWith(".xlsx");

    if (!isCsv && !isExcel) {
      toast({ title: "Please upload a CSV or Excel file", variant: "destructive" });
      return;
    }
    setCsvFileName(file.name);

    try {
      let parsed: Record<string, string>[] = [];
      if (isCsv) {
        const text = await file.text();
        parsed = parseCSV(text);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        let allParsed: Record<string, string>[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          if (rawJson.length > 0) {
            const rawHeaders = Object.keys(rawJson[0]);
            const hasItemSpecificDesc = rawHeaders.some(h => {
              const lower = h.toLowerCase().replace(/\s+/g, "_");
              return (lower.includes("item") || lower.includes("product")) && 
                     (lower.includes("desc") || lower.includes("name"));
            });
            const normalize = (h: string) => {
              const lower = h.toLowerCase().replace(/\s+/g, "_");
              if (lower.includes("outlet") && lower.includes("code")) return "outlet_code";
              if (lower.includes("item") && lower.includes("code")) return "item_code";
              if (lower.includes("sub_desc") || lower.includes("outlet_desc") || lower.includes("customer_desc") || lower.includes("outlet_name") || lower.includes("customer_name")) {
                return "to_sub_desc";
              }
              if (hasItemSpecificDesc && (lower === "description" || lower === "desc")) {
                return "to_sub_desc";
              }
              if (lower.includes("desc")) return "description";
              if (lower.includes("name") && (lower.includes("item") || lower.includes("product"))) return "description";
              if (lower.includes("validation") && (lower.includes("qty") || lower.includes("quantity"))) return "weight";
              if (lower.includes("total") && (lower.includes("qty") || lower.includes("quantity"))) return "total_qty_col";
              if (lower.includes("qty") && !lower.includes("fus")) return "weight";
              if (lower === "remaining") return "remaining";
              if (lower.includes("remark")) return "remark";
              if (lower.includes("grn")) return "grn_number";
              if (lower.includes("requested") && lower.includes("delivery") && lower.includes("date")) return "requested_delivery_date";
              return lower;
            };
            const headerMap = new Map();
            rawHeaders.forEach(h => headerMap.set(h, normalize(h)));

            const sheetParsed = rawJson.map(row => {
              const newRow: Record<string, string> = {};
              Object.entries(row).forEach(([key, val]) => {
                let finalVal = val;
                
                // If it's a numeric value and the column is likely a date (Excel serial number)
                if (typeof val === "number" && headerMap.get(key).includes("date")) {
                  try {
                    const parsedDate = XLSX.SSF.parse_date_code(val);
                    if (parsedDate) {
                      const dd = String(parsedDate.d).padStart(2, '0');
                      const mm = String(parsedDate.m).padStart(2, '0');
                      const yyyy = parsedDate.y;
                      finalVal = `${yyyy}-${mm}-${dd}`;
                    }
                  } catch (e) {
                    // fallback to string if parsing fails
                  }
                }
                
                newRow[headerMap.get(key)] = String(finalVal);
              });
              return newRow;
            });

            allParsed = allParsed.concat(sheetParsed);
          }
        });

        parsed = allParsed;
      }

      let missingOutletCount = 0;
      let missingItemOrQtyCount = 0;

      // Filter out total/summary rows and invalid lines
      const filteredParsed = parsed.filter(row => {
        const outletCode = row.to_sub_code || row.outlet_code || row.outletCode || "";
        const itemCode = row.item_number || row.item_code || row.itemCode || "";
        
        const hasOutlet = !!outletCode.trim();
        const hasItem = !!itemCode.trim();

        if (!hasOutlet) {
          missingOutletCount++;
          return false;
        }

        if (!hasItem) {
          missingItemOrQtyCount++;
          return false;
        }
        
        const lowerOutletCode = outletCode.toLowerCase();
        if (lowerOutletCode.includes("total") || lowerOutletCode.includes("summary") || lowerOutletCode.includes("count")) return false;

        const qtyVal = row.fus_requested_qty || row.weight || row.requestedQty || row.qty || "0";
        const parsedQty = parseFloat(qtyVal);
        if (isNaN(parsedQty) || parsedQty <= 0) {
          missingItemOrQtyCount++;
          return false;
        }

        return true;
      });

      setSkippedRowsInfo({
        total: missingOutletCount + missingItemOrQtyCount,
        missingOutlet: missingOutletCount,
        missingItemOrQty: missingItemOrQtyCount
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const hasPastDate = filteredParsed.some(row => {
        if (!row.requested_delivery_date) return false;

        let dateStr = row.requested_delivery_date;
        let dateObj: Date | null = null;

        if (!isNaN(Number(dateStr)) && Number(dateStr) > 10000) {
          dateObj = new Date(Math.round((Number(dateStr) - 25569) * 86400 * 1000));
        } else {
          const parts = dateStr.split(/[-/]/);
          if (parts.length === 3) {
            if (parts[2].length === 4) {
              dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              if (isNaN(dateObj.getTime())) dateObj = new Date(dateStr);
            } else if (parts[0].length === 4) {
              dateObj = new Date(dateStr);
            }
          }
          if (!dateObj) dateObj = new Date(dateStr);
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          dateObj.setHours(0, 0, 0, 0);
          return dateObj < today;
        }
        return false;
      });

      if (hasPastDate) {
        toast({
          title: "Invalid Delivery Date",
          description: "One or more items have a requested delivery date prior to today.",
          variant: "destructive"
        });
        setCsvPreview(null);
        setCsvFileName("");
        return;
      }

      setCsvPreview(filteredParsed);
    } catch (e) {
      toast({ title: "Failed to parse file", variant: "destructive" });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleUpload = () => {
    if (!csvPreview || csvPreview.length === 0) return;
    if (!uploadClientId) {
      toast({ title: "Validation Error", description: "Please select a client before uploading.", variant: "destructive" });
      return;
    }
    
    const existingSheet = sheets.find(s => s.date === uploadDate && s.clientId === uploadClientId);
    if (existingSheet) {
      setMergeConfirmOpen(true);
      return;
    }

    uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview, mergeStrategy: "overwrite", clientId: uploadClientId });
  };

  // Find sheet for selected date on board
  const sheetForDate = sheets.find(s => s.date === selectedDate && (boardClientId === "all" || s.clientId === boardClientId));

  const driverMap = new Map(drivers.map(d => [d.id, d]));
  const zoneMap = new Map(zones.map(z => [z.id, z]));

  const isSupervisor = true; // TODO: link to user role

  const handleExportCSV = () => {
    if (!reportData) return;
    let csv = "ITEM_NUMBER,DESCRIPTION,UOM,FROM_ORG,STORAGE_TYPE,QTY\n";

    const itemGroups: Record<string, any> = {};
    reportData.items.forEach(item => {
      const key = item.itemCode;
      if (!itemGroups[key]) {
        itemGroups[key] = {
          itemCode: item.itemCode,
          description: item.description,
          uom: item.uom,
          fromOrg: item.fromOrg,
          storageType: item.storageType,
          totalQty: 0
        };
      }
      itemGroups[key].totalQty += Number(item.requestedQty || item.weight || 0);
    });

    const sortedItems = Object.values(itemGroups).sort((a, b) => a.itemCode.localeCompare(b.itemCode));

    sortedItems.forEach(item => {
      csv += `"${item.itemCode || ''}","${item.description || ''}","${item.uom || ''}","${item.fromOrg || ''}","${item.storageType || ''}","${item.totalQty}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Dispatch_Items_Report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] print:h-auto print:block">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-gradient-to-r from-primary/5 via-background to-background print:hidden">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 print:block">
        <div className="px-6 pt-4 border-b bg-background print:hidden overflow-x-auto">
          <TabsList className="gap-0.5 flex-nowrap h-auto justify-start w-max min-w-full">
            <TabsTrigger value="board" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><MapPin className="h-3.5 w-3.5" />Dispatch Board</TabsTrigger>
            <TabsTrigger value="trucks" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><Truck className="h-3.5 w-3.5" />Truck Planning</TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><Package className="h-3.5 w-3.5" />Pending</TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><CheckCircle2 className="h-3.5 w-3.5" />Completed</TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><Upload className="h-3.5 w-3.5" />Upload Sheet</TabsTrigger>
            <TabsTrigger value="drivers" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><User className="h-3.5 w-3.5" />Driver Zones</TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><ArrowRight className="h-3.5 w-3.5" />Transfers</TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><FileText className="h-3.5 w-3.5" />Summary</TabsTrigger>
            <TabsTrigger value="item-summary" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><FileText className="h-3.5 w-3.5" />Item Summary</TabsTrigger>
            <TabsTrigger value="truck-history" className="gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"><History className="h-3.5 w-3.5" />Truck History</TabsTrigger>
          </TabsList>
        </div>

        {/* ===== BOARD TAB ===== */}
        <TabsContent value="board" className="flex-1 flex flex-col min-h-0 m-0 p-0 data-[state=inactive]:hidden">
          <div className="px-6 py-3 border-b flex items-center gap-3 bg-background flex-nowrap overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="w-36 h-8 text-xs px-2" />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Client:</span>
              <select
                value={boardClientId}
                onChange={e => setBoardClientId(e.target.value)}
                className="h-8 border rounded-md px-2 bg-transparent text-xs w-36"
              >
                <option value="all">All Clients</option>
                {clientList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Brand:</span>
              <select
                value={boardBrandId}
                onChange={e => setBoardBrandId(e.target.value)}
                className="h-8 border rounded-md px-2 bg-transparent text-xs w-36"
              >
                <option value="all">All Brands</option>
                {filteredBrands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            {sheetForDate ? (
              <Button size="sm" variant={boardSheetId === sheetForDate.id ? "default" : "outline"}
                onClick={() => setBoardSheetId(sheetForDate.id)} className="flex-shrink-0 h-8 text-xs">
                <Eye className="h-3.5 w-3.5 mr-1" />
                {boardSheetId === sheetForDate.id ? "Viewing Board" : "Load Board"}
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                <FileText className="h-3.5 w-3.5" />
                No sheet.
                <Button size="sm" variant="ghost" className="h-8 text-xs px-1" onClick={() => { setUploadDate(selectedDate); setActiveTab("upload"); }}>
                  Upload one →
                </Button>
              </div>
            )}
            {boardSheetId && (
              <Button size="sm" variant="ghost" onClick={() => refetchBoard()} className="flex-shrink-0 h-8 text-xs">
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
              </Button>
            )}
            {boardSheetId && (
              <Button 
                size="sm" 
                variant="outline" 
                className="border-orange-200 text-orange-700 hover:bg-orange-50 flex-shrink-0 h-8 text-xs"
                onClick={() => setGlobalAddModal({ isOpen: true, selectedOutletCode: "" })}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />Add Item / Outlet
              </Button>
            )}
            {boardData && boardData.overrides.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 flex-shrink-0 h-6">
                <AlertTriangle className="h-3 w-3" />
                {boardData.overrides.length} override(s) active
              </Badge>
            )}
          </div>

          {boardData && (
            <>
              {/* Supervisor Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 px-6 py-3 bg-slate-50 border-b">
                <Card className={`bg-white border shadow-sm cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'all' ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
                  onClick={() => setBoardStatusFilter("all")}>
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900">{stats.totalOutlets}</p>
                      <p className="text-xs font-medium text-slate-500">Total Outlets</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'pending' ? 'ring-2 ring-amber-500/30 border-amber-500' : ''}`}
                  onClick={() => setBoardStatusFilter("pending")}>
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                      <Hourglass className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900">{stats.pendingOutlets}</p>
                      <p className="text-xs font-medium text-slate-500">Pending Outlets</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-blue-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'partial' ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
                  onClick={() => setBoardStatusFilter("partial")}>
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900">{stats.partiallyDelivered}</p>
                      <p className="text-xs font-medium text-slate-500">Partially Delivered</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-indigo-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'all' ? 'ring-2 ring-indigo-500/30 border-indigo-500' : ''}`}
                  onClick={() => setBoardStatusFilter("all")}>
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900">
                        {stats.totalQtyAssigned % 1 === 0 ? stats.totalQtyAssigned.toFixed(0) : stats.totalQtyAssigned.toFixed(1)}
                      </p>
                      <p className="text-xs font-medium text-slate-500">Total Qty Assigned</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-emerald-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'delivered' ? 'ring-2 ring-emerald-500/30 border-emerald-500' : ''}`}
                  onClick={() => setBoardStatusFilter("delivered")}>
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900">
                        {stats.completedQty % 1 === 0 ? stats.completedQty.toFixed(0) : stats.completedQty.toFixed(1)}
                        <span className="text-xs font-normal text-slate-500 ml-1.5">
                          ({stats.totalQtyAssigned > 0 ? Math.round((stats.completedQty / stats.totalQtyAssigned) * 100) : 0}%)
                        </span>
                      </p>
                      <p className="text-xs font-medium text-slate-500">Completed Qty</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-red-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'pending' ? 'ring-2 ring-red-500/30 border-red-500' : ''}`}
                  onClick={() => setBoardStatusFilter("pending")}>
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900 text-red-600">
                        {stats.pendingQty % 1 === 0 ? stats.pendingQty.toFixed(0) : stats.pendingQty.toFixed(1)}
                      </p>
                      <p className="text-xs font-medium text-slate-500">Pending Qty</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border shadow-sm border-t-2 border-t-purple-500 hover:shadow-md transition-all">
                  <CardContent className="p-3 flex flex-col gap-1.5">
                    <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xl font-bold tracking-tight text-slate-900">
                        {stats.assignedTrucksCount} / {vehiclesList.length || 30}
                      </p>
                      <p className="text-xs font-medium text-slate-500 leading-tight">
                        Assigned today ({(vehiclesList.length || 30) - stats.assignedTrucksCount} pending)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="px-6 py-2 border-b bg-muted/20 flex items-center gap-3 flex-wrap">
                <SearchableSelect
                  value={boardOutletFilter}
                  onValueChange={setBoardOutletFilter}
                  options={outletOptions}
                  placeholder="All Outlets"
                  width="w-[180px]"
                />

                <SearchableSelect
                  value={boardRouteFilter}
                  onValueChange={setBoardRouteFilter}
                  options={routeOptions}
                  placeholder="All Routes"
                  width="w-[160px]"
                />

                <SearchableSelect
                  value={boardDriverFilter}
                  onValueChange={setBoardDriverFilter}
                  options={driverOptions}
                  placeholder="All Drivers"
                  width="w-[160px]"
                />

                <SearchableSelect
                  value={boardTruckFilter}
                  onValueChange={setBoardTruckFilter}
                  options={truckOptions}
                  placeholder="All Trucks"
                  width="w-[160px]"
                />

                <SearchableSelect
                  value={boardStatusFilter}
                  onValueChange={setBoardStatusFilter}
                  options={statusOptions}
                  placeholder="All Status"
                  width="w-[160px]"
                />
              
              {(boardRouteFilter !== "all" || boardOutletFilter !== "all" || boardDriverFilter !== "all" || boardTruckFilter !== "all" || boardStatusFilter !== "all") && (
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2 text-muted-foreground" onClick={() => {
                  setBoardRouteFilter("all");
                  setBoardOutletFilter("all");
                  setBoardDriverFilter("all");
                  setBoardTruckFilter("all");
                  setBoardStatusFilter("all");
                }}>
                  Clear Filters
                </Button>
              )}
            </div>
            </>
          )}

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
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 overflow-auto p-4 min-h-0">
                <div className="flex gap-4 min-w-max pb-4">
                  {(() => {
                    const filteredZones = boardData.zones.map(zone => {
                      if (boardRouteFilter !== "all" && zone.zoneId !== boardRouteFilter) return null;

                      const filteredOutlets = zone.outlets.map(outlet => {
                        const fullOutlet = (outlet.outletId ? brandFilteredOutletsMap.get(outlet.outletId) : null) || (outlet.outletCode ? brandFilteredOutletsMap.get(outlet.outletCode.trim().toLowerCase().replace(/^0+/, "")) : null);
                        if (boardBrandId !== "all" && fullOutlet?.brandId !== boardBrandId) return null;

                        if (boardOutletFilter !== "all" && outlet.outletId !== boardOutletFilter && outlet.outletCode !== boardOutletFilter) return null;

                        const assignedTruck = zone.trucks?.find(t => t.id === outlet.truckAssignmentId);
                        
                        if (boardDriverFilter !== "all") {
                          const isDriverInZone = zone.trucks?.some(t => t.driver?.id === boardDriverFilter) || zone.drivers?.some(d => d.id === boardDriverFilter);
                          if (assignedTruck) {
                            if (assignedTruck.driver?.id !== boardDriverFilter) return null;
                          } else {
                            if (!isDriverInZone) return null;
                          }
                        }

                        if (boardTruckFilter !== "all") {
                          const isTruckInZone = zone.trucks?.some(t => t.vehicle?.id === boardTruckFilter);
                          if (assignedTruck) {
                            if (assignedTruck.vehicle?.id !== boardTruckFilter) return null;
                          } else {
                            if (!isTruckInZone) return null;
                          }
                        }

                        const filteredItems = outlet.items.filter(item => {
                          const status = item.delivery?.status || "pending";
                          if (boardStatusFilter !== "all" && status !== boardStatusFilter) return false;
                          return true;
                        });

                        if (filteredItems.length === 0 && boardStatusFilter !== "all") return null;

                        return { ...outlet, items: filteredItems };
                      }).filter(Boolean) as OutletGroup[];

                      if (filteredOutlets.length === 0 && (boardOutletFilter !== "all" || boardDriverFilter !== "all" || boardTruckFilter !== "all" || boardStatusFilter !== "all" || boardBrandId !== "all")) {
                        return null;
                      }

                      return { ...zone, outlets: filteredOutlets };
                    }).filter(Boolean) as ZoneGroup[];
                    
                    if (filteredZones.every(z => z.outlets.length === 0)) {
                      return <div className="flex items-center justify-center w-full h-64 text-muted-foreground">No items match your filters.</div>;
                    }

                    return filteredZones
                      .filter(z => z.outlets.length > 0)
                      .map(zone => (
                        <ZoneColumn key={zone.zoneId} zone={zone} sheetId={boardSheetId!}
                          zones={zones} isSupervisor={isSupervisor}
                          onDeliveryUpdate={item => setDeliveryDialog(item)}
                          onOverride={outlet => setOverrideDialog(outlet)}
                          onOverrideItem={item => setItemOverrideDialog(item)}
                          onManageItems={handleManageItems}
                          selectedDate={selectedDate}
                          onSelectRoute={() => handleSelectRouteForDetails(zone)}
                          onSelectOutlet={handleSelectOutletForDetails}
                          isExpanded={selectedRouteForDetails?.zoneId === zone.zoneId}
                          selectedOutletForDetails={selectedOutletForDetails}
                          onCloseDetails={handleCloseDetailsPanel}
                          onQuickComplete={handleQuickComplete}
                          onRevertDelivery={handleRevert}
                          initialZoneData={boardData.zones.find(z => z.zoneId === zone.zoneId)}
                        />
                      ));
                  })()}
                  {boardData.zones.every(z => z.outlets.length === 0) && (
                    <div className="flex items-center justify-center w-full h-64 text-muted-foreground">
                      No items found in this sheet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>


        {/* ===== SUMMARY TAB ===== */}
        <TabsContent value="summary" className="flex-1 flex flex-col min-h-0 m-0 p-0 data-[state=inactive]:hidden print:block">
          <div className="px-6 py-3 border-b flex items-center gap-4 flex-wrap bg-background print:hidden">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="w-40 h-8 text-sm" />
            </div>
            {sheetForDate ? (
              <Button size="sm" variant={boardSheetId === sheetForDate.id ? "default" : "outline"}
                onClick={() => setBoardSheetId(sheetForDate.id)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {boardSheetId === sheetForDate.id ? "Viewing Summary" : "Load Summary"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                No sheet for this date.
              </div>
            )}

            {boardSheetId && boardData && (
              <div className="ml-auto flex items-center gap-2 print:hidden">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search route, outlet, item..." 
                    value={pivotSearchQuery}
                    onChange={e => setPivotSearchQuery(e.target.value)}
                    className="pl-7 w-60 h-8 text-xs bg-white border-slate-200"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>
            )}
          </div>

          {!boardSheetId ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="text-center space-y-3">
                <p className="text-lg font-semibold">Select a Date to Load the Summary</p>
              </div>
            </div>
          ) : boardLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : !boardData ? (
            <div className="flex-1 flex items-center justify-center min-h-0 text-muted-foreground">Failed to load summary.</div>
          ) : (
            <PivotSummaryTab boardData={boardData} searchQuery={pivotSearchQuery} />
          )}
        </TabsContent>

        {/* ===== ITEM SUMMARY TAB ===== */}
        <TabsContent value="item-summary" className="flex-1 flex flex-col min-h-0 m-0 p-0 data-[state=inactive]:hidden print:block">
          <div className="px-6 py-3 border-b flex items-center gap-4 flex-wrap bg-background print:hidden">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="w-40 h-8 text-sm" />
            </div>
            {sheetForDate ? (
              <Button size="sm" variant={boardSheetId === sheetForDate.id ? "default" : "outline"}
                onClick={() => setBoardSheetId(sheetForDate.id)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {boardSheetId === sheetForDate.id ? "Viewing Report" : "Load Report"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                No sheet for this date.
              </div>
            )}

            {boardSheetId && reportData && (
              <div className="ml-auto flex items-center gap-2 print:hidden">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search items, description, outlets..." 
                    value={summarySearchQuery}
                    onChange={e => setSummarySearchQuery(e.target.value)}
                    className="pl-7 w-60 h-8 text-xs bg-white border-slate-200"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
                  <Printer className="h-4 w-4" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </div>
            )}
          </div>

          {!boardSheetId ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="text-center space-y-3">
                <p className="text-lg font-semibold">Select a Date to Load the Report</p>
              </div>
            </div>
          ) : reportLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : !reportData ? (
            <div className="flex-1 flex items-center justify-center min-h-0 text-muted-foreground">Failed to load report.</div>
          ) : (
            <div className="flex-1 overflow-auto p-6 min-h-0 bg-slate-50/50 print:overflow-visible print:bg-white print:p-0 print:block">
              {(() => {
                const itemGroups: Record<string, any> = {};
                let grandTotal = 0;

                const normalizeOutletCode = (code: string | number | null | undefined): string => {
                  if (code === null || code === undefined) return "";
                  return String(code).trim().toLowerCase().replace(/^0+/, "");
                };

                const outletLookup = new Map<string, string>();
                outlets.forEach(o => {
                  if (o.code) {
                    outletLookup.set(normalizeOutletCode(o.code), o.name);
                  }
                });

                reportData.items.forEach(item => {
                  const key = item.itemCode;
                  if (!itemGroups[key]) {
                    itemGroups[key] = {
                      itemCode: item.itemCode,
                      description: item.description,
                      uom: item.uom,
                      fromOrg: item.fromOrg,
                      storageType: item.storageType,
                      totalQty: 0,
                      outlets: []
                    };
                  }
                  const qty = Number(item.requestedQty || item.weight || 0);
                  itemGroups[key].totalQty += qty;

                  // Add outlet info
                  const outletKey = item.outletCode;
                  const normalizedCode = normalizeOutletCode(outletKey);
                  const matchedName = outletLookup.get(normalizedCode) || item.outletName || item.toSubDesc || "Unnamed Outlet";

                  const existingOutlet = itemGroups[key].outlets.find((o: any) => normalizeOutletCode(o.outletCode) === normalizedCode);
                  if (existingOutlet) {
                    existingOutlet.qty += qty;
                  } else {
                    itemGroups[key].outlets.push({
                      outletCode: item.outletCode,
                      outletName: matchedName,
                      qty: qty
                    });
                  }
                });

                const sortedItems = Object.values(itemGroups).sort((a: any, b: any) => a.itemCode.localeCompare(b.itemCode));

                let filteredItems = sortedItems;
                const query = summarySearchQuery.toLowerCase().trim();
                if (query) {
                  filteredItems = sortedItems.filter(item => {
                    if (item.itemCode.toLowerCase().includes(query)) return true;
                    if (item.description && item.description.toLowerCase().includes(query)) return true;
                    if (item.storageType && item.storageType.toLowerCase().includes(query)) return true;
                    return item.outlets.some((o: any) => 
                      o.outletName.toLowerCase().includes(query) || 
                      o.outletCode.toLowerCase().includes(query)
                    );
                  });
                }

                // Recalculate grand total based on filtered items
                grandTotal = filteredItems.reduce((sum, it) => sum + it.totalQty, 0);

                return (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden text-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100/80 border-b">
                        <tr>
                          <th className="py-2 px-3 font-semibold text-slate-700 border-r w-32">ITEM_NUMBER</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 border-r">DESCRIPTION</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 border-r w-20">UOM</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 border-r w-24">FROM_ORG</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 border-r w-32">STORAGE_TYPE</th>
                          <th className="py-2 px-3 font-semibold text-slate-700 text-right w-24">QTY</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((item: any, idx) => {
                          const isExpanded = !!expandedSummaryItems[item.itemCode];
                          return (
                            <React.Fragment key={idx}>
                              <tr 
                                className="hover:bg-slate-50/50 cursor-pointer break-inside-avoid"
                                onClick={() => setExpandedSummaryItems(prev => ({ ...prev, [item.itemCode]: !isExpanded }))}
                              >
                                <td className="py-1.5 px-3 border-r text-slate-600 font-medium flex items-center gap-1.5">
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                                  {item.itemCode}
                                </td>
                                <td className="py-1.5 px-3 border-r text-slate-600">{item.description}</td>
                                <td className="py-1.5 px-3 border-r text-slate-600 text-center">{item.uom}</td>
                                <td className="py-1.5 px-3 border-r text-slate-600 text-center">{item.fromOrg}</td>
                                <td className="py-1.5 px-3 border-r text-slate-600">{item.storageType}</td>
                                <td className="py-1.5 px-3 text-right font-medium text-slate-900">{item.totalQty}</td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50/30">
                                  <td colSpan={6} className="p-3 border-b">
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-2xl mx-auto shadow-inner space-y-1.5">
                                      <p className="font-semibold text-xs text-slate-700 border-b border-slate-200 pb-1">Outlet-wise Breakdown</p>
                                      <div className="divide-y divide-slate-200/60 text-xs">
                                        {item.outlets.map((o: any, oIdx: number) => (
                                          <div key={oIdx} className="flex justify-between py-1.5">
                                            <span className="text-slate-600 font-medium">{o.outletName} ({o.outletCode})</span>
                                            <span className="text-slate-900 font-bold">{o.qty}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100/80 border-t">
                        <tr>
                          <td colSpan={5} className="py-2 px-3 font-bold text-right border-r text-slate-900">Grand Total</td>
                          <td className="py-2 px-3 font-bold text-right text-slate-900">{grandTotal}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </TabsContent>


        {/* ===== TRUCK PLANNING TAB ===== */}
        <TabsContent value="trucks" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden">
          <TruckPlanningTab boardSheetId={boardSheetId} zones={zones} drivers={drivers} selectedDate={selectedDate} onSelectSheet={(id: string | null) => { setBoardSheetId(id); }} sheets={sheets} />
        </TabsContent>

        {/* ===== PENDING QUANTITIES TAB ===== */}
        <TabsContent value="pending" className="flex-1 flex flex-col min-h-0 m-0 p-0 data-[state=inactive]:hidden print:block">
          <div className="flex-1 overflow-auto p-6 min-h-0 bg-slate-50/50 print:overflow-visible print:bg-white print:p-0 print:block">
            <PendingQuantitiesTab selectedDate={selectedDate} />
          </div>
        </TabsContent>

        {/* ===== COMPLETED TAB ===== */}
        <TabsContent value="completed" className="flex-1 overflow-auto p-6 min-h-0 bg-slate-50/50 print:overflow-visible print:bg-white print:p-0 print:block data-[state=inactive]:hidden">
          <ErrorBoundary>
            <CompletedDeliveriesTab 
              selectedDate={selectedDate} 
              onManageItems={(outletCode: string, outletName: string, items: any[]) => {
                setManageItemsModal({
                  isOpen: true,
                  outletCode,
                  outletName,
                  items,
                });
              }}
            />
          </ErrorBoundary>
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

                <div className="space-y-2">
                  <Label>Client / Customer</Label>
                  <select
                    value={uploadClientId}
                    onChange={e => setUploadClientId(e.target.value)}
                    className="w-full h-10 border rounded-md px-3 bg-transparent text-sm"
                  >
                    <option value="">-- Select Client --</option>
                    {clientList.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
                  <p className="font-medium text-sm">Drop CSV/Excel here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Accepts .csv, .xls, .xlsx</p>
                  {csvFileName && <p className="text-xs text-primary mt-2 font-medium">{csvFileName}</p>}
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

                {/* Preview */}
                {csvPreview && csvPreview.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">{csvPreview.length} rows parsed — Preview:</p>
                      <Button variant="ghost" size="sm" onClick={() => { setCsvPreview(null); setCsvFileName(""); setSkippedRowsInfo(null); }}>
                        <X className="h-3.5 w-3.5 mr-1" />Clear
                      </Button>
                    </div>

                    {skippedRowsInfo && skippedRowsInfo.total > 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                          Notice: {skippedRowsInfo.total} rows skipped during parsing
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-amber-700">
                          {skippedRowsInfo.missingOutlet > 0 && (
                            <li><strong>{skippedRowsInfo.missingOutlet} rows</strong> skipped due to missing/invalid Outlet Code.</li>
                          )}
                          {skippedRowsInfo.missingItemOrQty > 0 && (
                            <li><strong>{skippedRowsInfo.missingItemOrQty} rows</strong> skipped due to missing Item Code or invalid quantity.</li>
                          )}
                        </ul>
                      </div>
                    )}
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

        {/* ===== TRUCK HISTORY TAB ===== */}
        <TabsContent value="truck-history" className="flex-1 overflow-y-auto p-6 m-0 data-[state=inactive]:hidden bg-slate-50/50">
          <TruckHistoryTab vehicles={vehiclesList} />
        </TabsContent>
      </Tabs>

      {/* Merge Confirm Dialog */}
      <Dialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sheet Already Exists</DialogTitle>
            <DialogDescription>
              A dispatch sheet for {format(parseISO(uploadDate), "dd MMM yyyy")} already exists. How would you like to handle duplicates?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div className="border rounded-lg p-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors" onClick={() => {
              uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview!, mergeStrategy: "skip", clientId: uploadClientId });
              setMergeConfirmOpen(false);
            }}>
              <p className="font-medium text-sm text-primary">Skip Duplicates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ignore items that are already in the system. Only add new items.</p>
            </div>
            <div className="border rounded-lg p-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors" onClick={() => {
              uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview!, mergeStrategy: "replace", clientId: uploadClientId });
              setMergeConfirmOpen(false);
            }}>
              <p className="font-medium text-sm text-primary">Replace Duplicates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Update quantities for existing items, and add new items.</p>
            </div>
            <div className="border rounded-lg p-3 cursor-pointer hover:border-destructive hover:bg-destructive/10 transition-colors" onClick={() => {
              uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview!, mergeStrategy: "overwrite", clientId: uploadClientId });
              setMergeConfirmOpen(false);
            }}>
              <p className="font-medium text-sm text-destructive">Overwrite Entire Sheet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Delete ALL existing assignments and deliveries for this date, and start fresh.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Dialog */}
      {deliveryDialog && (
        <DeliveryDialog item={deliveryDialog} sheetId={boardSheetId!}
          onClose={() => setDeliveryDialog(null)}
          onSave={data => deliveryMutation.mutate({ itemId: deliveryDialog.id, data })}
        />
      )}

      {/* Override Dialog */}
      {overrideDialog && overrideDialog.outletId && (
        <MoveOverrideDialog
          title="Move Outlet"
          targetName={overrideDialog.outletName || overrideDialog.outletCode}
          zones={zones}
          boardZones={boardData?.zones || []}
          onClose={() => setOverrideDialog(null)}
          onSave={(zoneId, truckId, reason) => overrideMutation.mutate({
            sheetId: boardSheetId, outletId: overrideDialog.outletId, overrideZoneId: zoneId, overrideTruckId: truckId, reason,
          })}
        />
      )}

      {itemOverrideDialog && (
        <MoveOverrideDialog
          title="Move Item"
          targetName={itemOverrideDialog.itemCode}
          zones={zones}
          boardZones={boardData?.zones || []}
          onClose={() => setItemOverrideDialog(null)}
          onSave={(zoneId, truckId) => itemOverrideMutation.mutate({
            itemId: itemOverrideDialog.id, overrideRouteId: zoneId // Item level override Truck might need its own API field if needed, but not requested here
          })}
        />
      )}

      {/* Manage Items Dialog */}
      <Dialog 
        open={manageItemsModal.isOpen} 
        onOpenChange={(open) => setManageItemsModal(prev => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Settings className="h-5 w-5 text-orange-600 animate-spin-hover" />
              Manage Items — {manageItemsModal.outletName || ""} ({manageItemsModal.outletCode || ""})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add new items, update quantities/routes, or delete items from this sheet. Changes update truck load capacities automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Existing Items Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Existing Items</h3>
              {(!editedItems || editedItems.length === 0) ? (
                <p className="text-xs text-muted-foreground bg-slate-50 p-4 rounded text-center">No items currently on this sheet for this outlet.</p>
              ) : (
                <div className="border rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b text-slate-500 font-semibold">
                        <th className="py-2 px-3 text-left">Code</th>
                        <th className="py-2 px-3 text-left">Description</th>
                        <th className="py-2 px-3 text-left">Storage</th>
                        <th className="py-2 px-3 text-left">Route</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(editedItems || []).map((item: any, idx: number) => {
                        const effectiveRouteId = item.overrideRouteId || item.routeId;
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-medium">{item.itemCode || ""}</td>
                            <td className="py-2 px-3">
                              <Input
                                value={item.description || ""}
                                onChange={(e) => {
                                  const updated = [...editedItems];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  setEditedItems(updated);
                                }}
                                className="h-7 text-xs py-0.5 px-2"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={item.storageType || "Dry"}
                                onChange={(e) => {
                                  const updated = [...editedItems];
                                  updated[idx] = { ...updated[idx], storageType: e.target.value };
                                  setEditedItems(updated);
                                }}
                                className="h-7 text-xs py-0.5 px-2 border rounded-md"
                              >
                                <option value="Dry">Dry</option>
                                <option value="Chilled">Chilled</option>
                                <option value="Frozen">Frozen</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={effectiveRouteId || ""}
                                onChange={(e) => {
                                  const updated = [...editedItems];
                                  updated[idx] = { ...updated[idx], overrideRouteId: e.target.value || null };
                                  setEditedItems(updated);
                                }}
                                className="h-7 text-xs py-0.5 px-2 border rounded-md max-w-[120px]"
                              >
                                <option value="">Default Route</option>
                                {(activeZones || []).map((r: any) => (
                                  <option key={r.id} value={r.id}>{r.name || ""}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Input
                                type="number"
                                step="any"
                                value={item.requestedQty || item.weight || ""}
                                onChange={(e) => {
                                  const updated = [...editedItems];
                                  updated[idx] = { ...updated[idx], requestedQty: e.target.value };
                                  setEditedItems(updated);
                                }}
                                className="h-7 w-20 text-right text-xs py-0.5 px-2 ml-auto"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this item?")) {
                                    deleteItemMutation.mutate(item.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add New Item Form */}
            <div className="border-t pt-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wide">Add New Item</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">Item Code *</label>
                  <Input
                    placeholder="e.g. R1000121"
                    value={newItemForm.itemCode || ""}
                    onChange={e => setNewItemForm(prev => ({ ...prev, itemCode: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1">Description</label>
                  <Input
                    placeholder="e.g. PH FLOUR PIZZA MIX (25KG/BAG)"
                    value={newItemForm.description || ""}
                    onChange={e => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Storage Type</label>
                  <select
                    value={newItemForm.storageType || "Dry"}
                    onChange={e => setNewItemForm(prev => ({ ...prev, storageType: e.target.value }))}
                    className="w-full h-8 border rounded-md px-2 bg-transparent text-xs"
                  >
                    <option value="Dry">Dry</option>
                    <option value="Chilled">Chilled</option>
                    <option value="Frozen">Frozen</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Cleaning">Cleaning</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Route / Zone (Optional)</label>
                  <select
                    value={newItemForm.routeId || ""}
                    onChange={e => setNewItemForm(prev => ({ ...prev, routeId: e.target.value }))}
                    className="w-full h-8 border rounded-md px-2 bg-transparent text-xs"
                  >
                    <option value="">Default Route</option>
                    {(zones || []).map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name || ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Quantity *</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 10"
                    value={newItemForm.requestedQty || ""}
                    onChange={e => setNewItemForm(prev => ({ ...prev, requestedQty: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">TO Number (Optional)</label>
                  <Input
                    placeholder="e.g. TO-12502"
                    value={newItemForm.toNo || ""}
                    onChange={e => setNewItemForm(prev => ({ ...prev, toNo: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">UOM (Optional)</label>
                  <Input
                    placeholder="e.g. CT, PKT, EA"
                    value={newItemForm.uom || ""}
                    onChange={e => setNewItemForm(prev => ({ ...prev, uom: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="col-span-2 md:col-span-3 flex justify-end pt-2">
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white gap-1 h-8 text-xs"
                    onClick={() => {
                      if (!newItemForm.itemCode || !newItemForm.requestedQty) {
                        toast({ title: "Validation Error", description: "Item Code and Quantity are required.", variant: "destructive" });
                        return;
                      }
                      addItemMutation.mutate({
                        sheetId: boardSheetId!,
                        outletCode: manageItemsModal.outletCode,
                        itemCode: newItemForm.itemCode,
                        description: newItemForm.description,
                        requestedQty: parseFloat(newItemForm.requestedQty),
                        storageType: newItemForm.storageType,
                        routeId: newItemForm.routeId || undefined,
                        toNo: newItemForm.toNo || undefined,
                        uom: newItemForm.uom || undefined,
                      });
                    }}
                    disabled={addItemMutation.isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t flex flex-col md:flex-row md:justify-between md:items-center w-full gap-3 bg-slate-50">
            <p className="text-xs text-muted-foreground text-left">
              Changes are staged locally. Click "Save Changes" to apply them.
            </p>
            <div className="flex gap-2 justify-end w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManageItemsModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => {
                  batchUpdateItemsMutation.mutate({ items: editedItems });
                }}
                disabled={batchUpdateItemsMutation.isPending}
              >
                {batchUpdateItemsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Add Item / Outlet Dialog */}
      <Dialog 
        open={globalAddModal.isOpen} 
        onOpenChange={(open) => setGlobalAddModal(prev => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <PlusCircle className="h-5 w-5 text-orange-600" />
              Add Item / Outlet to Sheet
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an outlet and add a new delivery item to it on this sheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Select Outlet *</label>
              <SearchableSelect
                value={globalAddModal.selectedOutletCode || ""}
                onValueChange={(val) => {
                  setGlobalAddModal(prev => ({ ...prev, selectedOutletCode: val }));
                  const matched = (outlets || []).find((o: any) => o.code === val);
                  if (matched && matched.routeId) {
                    setNewItemForm(prev => ({ ...prev, routeId: matched.routeId }));
                  } else {
                    setNewItemForm(prev => ({ ...prev, routeId: "" }));
                  }
                }}
                options={allOutletOptions}
                placeholder="-- Choose Outlet --"
                width="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Item Code *</label>
                <Input
                  placeholder="e.g. R1000121"
                  value={newItemForm.itemCode || ""}
                  onChange={e => setNewItemForm(prev => ({ ...prev, itemCode: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">Quantity *</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 10"
                  value={newItemForm.requestedQty || ""}
                  onChange={e => setNewItemForm(prev => ({ ...prev, requestedQty: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Description</label>
              <Input
                placeholder="e.g. PH FLOUR PIZZA MIX (25KG/BAG)"
                value={newItemForm.description || ""}
                onChange={e => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">Storage Type</label>
                <select
                  value={newItemForm.storageType || "Dry"}
                  onChange={e => setNewItemForm(prev => ({ ...prev, storageType: e.target.value }))}
                  className="w-full h-8 border rounded-md px-2 bg-transparent text-xs"
                >
                  <option value="Dry">Dry</option>
                  <option value="Chilled">Chilled</option>
                  <option value="Frozen">Frozen</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Cleaning">Cleaning</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Route / Zone (Optional)</label>
                <select
                  value={newItemForm.routeId || ""}
                  onChange={e => setNewItemForm(prev => ({ ...prev, routeId: e.target.value }))}
                  className="w-full h-8 border rounded-md px-2 bg-transparent text-xs"
                >
                  <option value="">Default Route</option>
                  {(activeZones || []).map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name || ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 mb-1">TO Number (Optional)</label>
                <Input
                  placeholder="e.g. TO-12502"
                  value={newItemForm.toNo || ""}
                  onChange={e => setNewItemForm(prev => ({ ...prev, toNo: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">UOM (Optional)</label>
                <Input
                  placeholder="e.g. CT, PKT"
                  value={newItemForm.uom || ""}
                  onChange={e => setNewItemForm(prev => ({ ...prev, uom: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGlobalAddModal(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                if (!globalAddModal.selectedOutletCode || !newItemForm.itemCode || !newItemForm.requestedQty) {
                  toast({ title: "Validation Error", description: "Outlet, Item Code, and Quantity are required.", variant: "destructive" });
                  return;
                }
                addItemMutation.mutate({
                  sheetId: boardSheetId!,
                  outletCode: globalAddModal.selectedOutletCode,
                  itemCode: newItemForm.itemCode,
                  description: newItemForm.description,
                  requestedQty: parseFloat(newItemForm.requestedQty),
                  storageType: newItemForm.storageType,
                  routeId: newItemForm.routeId || undefined,
                  toNo: newItemForm.toNo || undefined,
                  uom: newItemForm.uom || undefined,
                }, {
                  onSuccess: () => {
                    setGlobalAddModal(prev => ({ ...prev, isOpen: false }));
                  }
                });
              }}
              disabled={addItemMutation.isPending}
            >
              Add to Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== PIVOT SUMMARY TAB =====
function PivotSummaryTab({ boardData, searchQuery }: { boardData: BoardData; searchQuery?: string }) {
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  const toggleRoute = (id: string) => setExpandedRoutes(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  const toggleOutlet = (id: string) => setExpandedOutlets(prev => ({ ...prev, [id]: !prev[id] }));

  const query = (searchQuery || "").toLowerCase().trim();

  const filteredZones = useMemo(() => {
    if (!query) return boardData.zones;

    return boardData.zones
      .map(zone => {
        const zoneMatches = zone.zoneName.toLowerCase().includes(query);

        if (zoneMatches) {
          return zone;
        }

        const filteredOutlets = zone.outlets
          .map(outlet => {
            const outletMatches =
              outlet.outletName.toLowerCase().includes(query) ||
              (outlet.outletCode && String(outlet.outletCode).toLowerCase().includes(query));

            if (outletMatches) {
              return outlet;
            }

            const matchingItems = outlet.items.filter(item =>
              item.itemCode.toLowerCase().includes(query) ||
              (item.description && item.description.toLowerCase().includes(query))
            );

            if (matchingItems.length > 0) {
              return {
                ...outlet,
                items: matchingItems,
              };
            }

            return null;
          })
          .filter(Boolean) as typeof zone.outlets;

        if (filteredOutlets.length > 0) {
          return {
            ...zone,
            outlets: filteredOutlets,
          };
        }

        return null;
      })
      .filter(Boolean) as typeof boardData.zones;
  }, [boardData.zones, query]);

  return (
    <div className="flex-1 overflow-auto p-6 min-h-0 bg-slate-50/50 print:overflow-visible print:bg-white print:p-0 print:block">
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100/80 border-b">
            <tr>
              <th className="py-2 px-3 font-semibold text-slate-700 border-r">ROUTE</th>
              <th className="py-2 px-3 font-semibold text-slate-700 border-r">TO_SUB_DESC</th>
              <th className="py-2 px-3 font-semibold text-slate-700 border-r">ITEM_NUMBER</th>
              <th className="py-2 px-3 font-semibold text-slate-700 border-r">DESCRIPTION</th>
              <th className="py-2 px-3 font-semibold text-slate-700 border-r w-20">UOM</th>
              <th className="py-2 px-3 font-semibold text-slate-700 text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredZones.map(zone => {
              if (zone.outlets.length === 0) return null;
              const routeTotal = zone.outlets.reduce((s, o) => s + o.items.reduce((ss, i) => ss + Number((i as any).requestedQty || i.weight || 0), 0), 0);
              const isRouteExpanded = expandedRoutes[zone.zoneId] !== false; // Default true

              return (
                <React.Fragment key={zone.zoneId}>
                  <tr className="bg-slate-100/60 hover:bg-slate-100 cursor-pointer font-semibold text-slate-800" onClick={() => toggleRoute(zone.zoneId)}>
                    <td className="py-1.5 px-3 border-r flex items-center gap-1.5">
                      {isRouteExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      {zone.zoneName}
                    </td>
                    <td className="py-1.5 px-3 border-r"></td>
                    <td className="py-1.5 px-3 border-r"></td>
                    <td className="py-1.5 px-3 border-r"></td>
                    <td className="py-1.5 px-3 border-r"></td>
                    <td className="py-1.5 px-3 text-right">{routeTotal}</td>
                  </tr>

                  {isRouteExpanded && zone.outlets.map(outlet => {
                    const outletTotal = outlet.items.reduce((s, i) => s + Number((i as any).requestedQty || i.weight || 0), 0);
                    const outletId = `${zone.zoneId}-${outlet.outletCode}`;
                    const isOutletExpanded = query 
                      ? expandedOutlets[outletId] !== false 
                      : !!expandedOutlets[outletId]; // Default true if search query is active

                    return (
                      <React.Fragment key={outletId}>
                        <tr className="hover:bg-slate-50 cursor-pointer text-slate-700" onClick={() => toggleOutlet(outletId)}>
                          <td className="py-1.5 px-3 border-r"></td>
                          <td className="py-1.5 px-3 border-r flex items-center gap-1.5 font-medium pl-6">
                            {isOutletExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                            <span>{outlet.outletName}</span>
                            <span className="text-xs text-slate-400 font-normal ml-1">({outlet.outletCode})</span>
                          </td>
                          <td className="py-1.5 px-3 border-r"></td>
                          <td className="py-1.5 px-3 border-r"></td>
                          <td className="py-1.5 px-3 border-r"></td>
                          <td className="py-1.5 px-3 text-right font-semibold">{outletTotal}</td>
                        </tr>

                        {isOutletExpanded && outlet.items.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 text-slate-600 bg-white">
                            <td className="py-1.5 px-3 border-r"></td>
                            <td className="py-1.5 px-3 border-r"></td>
                            <td className="py-1.5 px-3 border-r pl-6 font-medium text-xs">{item.itemCode}</td>
                            <td className="py-1.5 px-3 border-r text-xs">{item.description}</td>
                            <td className="py-1.5 px-3 border-r text-center text-xs">{(item as any).uom || '-'}</td>
                            <td className="py-1.5 px-3 text-right font-medium">{Number((item as any).requestedQty || item.weight || 0)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== TRUCK PLANNING TAB =====
function TruckPlanningTab({ boardSheetId, zones, drivers, selectedDate, onSelectSheet, sheets }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [truckForm, setTruckForm] = useState({ truckId: "", driverId: "", zoneId: "", tripNumber: 1 });
  const [editAssignment, setEditAssignment] = useState<{ open: boolean; id: string; truckId: string; driverId: string; tripNumber: number } | null>(null);
  const [expandedStorageTypes, setExpandedStorageTypes] = useState<Record<string, boolean>>({});
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [planningTab, setPlanningTab] = useState("unassigned");
  const [pendingAssignment, setPendingAssignment] = useState<{ title: string; description: string; payload: any } | null>(null);

  const { data: vehiclesList = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles"] });

  const { data: truckData, refetch } = useQuery<any>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`],
    enabled: !!boardSheetId,
  });

  // Fetch board data to get zone outlets with weights
  const { data: boardData } = useQuery<any>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`],
    enabled: !!boardSheetId,
  });

  const truckAssignments: any[] = truckData?.trucks || [];
  const outletAssignments: any[] = truckData?.outletAssignments || [];

  const addTruckMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/dispatch/sheets/${boardSheetId}/trucks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      toast({ title: "Truck added to dispatch!" });
      setTruckForm({ truckId: "", driverId: "", zoneId: "", tripNumber: 1 });
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const removeTruckMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dispatch/trucks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      toast({ title: "Truck removed" });
    },
  });

  const updateTruckAssignmentMutation = useMutation({
    mutationFn: (data: { id: string; truckId: string; driverId: string | null; tripNumber: number }) =>
      apiRequest("PATCH", `/api/dispatch/truck-assignments/${data.id}`, { truckId: data.truckId, driverId: data.driverId, tripNumber: data.tripNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      toast({ title: "Assignment updated successfully!" });
      setEditAssignment(null);
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const assignOutletMutation = useMutation({
    mutationFn: (data: { outletCode: string; truckAssignmentId: string; outletWeight: string; sheetId: string }) =>
      apiRequest("POST", "/api/dispatch/outlets/assign", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      toast({ title: "Outlet assigned to truck!" });
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const unassignOutletMutation = useMutation({
    mutationFn: (data: { outletCode: string; sheetId: string }) =>
      apiRequest("DELETE", "/api/dispatch/outlets/assign", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      toast({ title: "Outlet unassigned" });
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const autoAllocateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/dispatch/sheets/${boardSheetId}/trucks/auto-allocate`, {}),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      const msg = data.overflow?.length > 0
        ? `Allocated ${data.allocated} outlets. ⚠ ${data.overflow.length} outlets couldn't fit any truck.`
        : `✅ Allocated ${data.allocated} outlets across trucks.`;
      toast({ title: msg });
    },
    onError: (e: any) => toast({ title: getErrorMessage(e), variant: "destructive" }),
  });

  const getVehicleInfo = (id: string) => vehiclesList.find((v: any) => v.id === id);
  const getDriverName = (id: string) => drivers.find((d: any) => d.id === id)?.name || "No driver";
  const getZoneName = (id: string) => zones.find((z: any) => z.id === id)?.name || "Unknown";

  // Build zone-based grouping of truck assignments
  // Collect all zone IDs from truck assignments + board data (don't rely solely on full route list)
  const activeZoneIds = new Set<string>([
    ...truckAssignments.map((ta: any) => ta.zoneId).filter(Boolean),
    ...(boardData?.zones || []).map((z: any) => z.zoneId).filter((id: string) => id && id !== "unassigned"),
  ]);

  // Build a zone lookup: prefer data from zones prop (routes API), fallback to boardData
  const zoneInfoMap = new Map<string, any>();
  zones.forEach((z: any) => zoneInfoMap.set(z.id, z));
  (boardData?.zones || []).forEach((z: any) => {
    if (z.zoneId && z.zoneId !== "unassigned" && !zoneInfoMap.has(z.zoneId)) {
      zoneInfoMap.set(z.zoneId, { id: z.zoneId, name: z.zoneName });
    }
  });

  const zoneGroups = Array.from(activeZoneIds).map((zoneId: string) => {
    const zone = zoneInfoMap.get(zoneId) || { id: zoneId, name: getZoneName(zoneId) };
    const zoneTrucks = truckAssignments.filter((ta: any) => ta.zoneId === zoneId);

    // Get all outlets in this zone from board data
    const boardZone = boardData?.zones?.find((z: any) => z.zoneId === zoneId);
    const outlets: any[] = boardZone?.outlets || [];

    // Calculate total weight per outlet (sum of item weights) and sort heaviest first
    const outletRows = outlets.map((outlet: any) => {
      const totalWeight = outlet.items.reduce((sum: number, item: any) => {
        return sum + parseFloat(item.requestedQty || item.weight || item.totalDelivered || "0");
      }, 0);
      // Find current truck assignment for this outlet
      const assignment = outletAssignments.find((oa: any) =>
        oa.outletCode === outlet.outletCode &&
        truckAssignments.some((ta: any) => ta.id === oa.truckAssignmentId)
      );
      return { ...outlet, totalWeight, assignment };
    }).sort((a: any, b: any) => {
      // Sort unassigned first, then by weight
      if (a.assignment && !b.assignment) return 1;
      if (!a.assignment && b.assignment) return -1;
      return b.totalWeight - a.totalWeight;
    });

    return { zone, zoneTrucks, outletRows };
  });

  const filteredZoneGroups = zoneGroups.map((g: any) => {
    const filteredOutlets = g.outletRows.filter((outlet: any) => {
      const hasFullAssignment = !!outlet.assignment;
      
      const storageTypes = Array.from(new Set(outlet.items.map((i: any) => i.storageType).filter(Boolean))) as string[];
      const assignedStorageTypes = storageTypes.filter(st => 
        outletAssignments.some((oa: any) => oa.outletCode === outlet.outletCode && oa.storageType === st && truckAssignments.some((ta: any) => ta.id === oa.truckAssignmentId))
      );
      
      const isFullyAssigned = hasFullAssignment || (storageTypes.length > 0 && assignedStorageTypes.length === storageTypes.length);
      const isPartiallyAssigned = assignedStorageTypes.length > 0;
      
      if (planningTab === "assigned") {
        return hasFullAssignment || isPartiallyAssigned;
      } else {
        return !isFullyAssigned;
      }
    });

    return { ...g, outletRows: filteredOutlets };
  }).filter((g: any) => g.zoneTrucks.length > 0 || g.outletRows.length > 0)
    .sort((a: any, b: any) => (a.zone.name || "").localeCompare(b.zone.name || ""));

  // Trucks already assigned in this sheet (to filter out from add form)
  const trucksAssignedInSheet = truckAssignments.map((ta: any) => ta.truckId);

  // Drivers already assigned in this sheet
  const assignedDriversInSheet = new Set(truckAssignments.map((ta: any) => ta.driverId).filter(Boolean));

  // Helper to compute assigned items for a truck assignment
  const getTruckAssignedItemsCount = (truckAssignmentId: string) => {
    const taAssignments = outletAssignments.filter((oa: any) => oa.truckAssignmentId === truckAssignmentId);
    return taAssignments.reduce((sum, oa) => {
      if (oa.itemIds && Array.isArray(oa.itemIds)) return sum + oa.itemIds.length;
      const outlet = boardData?.zones?.flatMap((z: any) => z.outlets).find((o: any) => o.outletCode === oa.outletCode);
      if (!outlet) return sum;
      if (oa.storageType) return sum + outlet.items.filter((i: any) => i.storageType === oa.storageType).length;
      return sum + outlet.items.length;
    }, 0);
  };

  const handleAssign = (outlet: any, weightT: number, truckAssignId: string, storageType?: string) => {
    const truck = truckAssignments.find((t: any) => t.id === truckAssignId);
    const veh = getVehicleInfo(truck?.truckId);
    const cap = parseFloat(veh?.capacity || "0");
    const capCarton = parseInt(veh?.cartonCapacity || "0");
    const used = parseFloat(truck?.usedCapacity || "0");
    const taItemCount = getTruckAssignedItemsCount(truck?.id);
    
    const itemsToAdd = storageType ? outlet.items.filter((i:any) => i.storageType === storageType) : outlet.items;

    if (capCarton > 0 && taItemCount + itemsToAdd.length > capCarton) {
      setPendingAssignment({
        title: "Capacity Exceeded!",
        description: `Adding ${outlet.outletCode} (${itemsToAdd.length} boxes) would exceed ${veh?.plateNumber || 'Truck'}'s limit of ${capCarton} boxes.\nCurrent load: ${taItemCount} boxes.\n\nDo you want to proceed anyway?`,
        payload: {
          outletCode: outlet.outletCode,
          truckAssignmentId: truckAssignId,
          outletWeight: weightT.toFixed(3),
          sheetId: boardSheetId!,
          storageType,
          force: true
        }
      });
      return;
    } else if (capCarton === 0 && cap > 0) {
      const limit = cap < 100 ? cap * 1000 : cap;
      if (used + weightT > limit) {
        setPendingAssignment({
          title: "Capacity Exceeded!",
          description: `Adding ${outlet.outletCode} (${weightT.toFixed(0)} Boxes) would exceed ${veh?.plateNumber || 'Truck'}'s limit of ${limit.toFixed(0)} Boxes.\nCurrent load: ${used.toFixed(0)} Boxes.\n\nDo you want to proceed anyway?`,
          payload: {
            outletCode: outlet.outletCode,
            truckAssignmentId: truckAssignId,
            outletWeight: weightT.toFixed(3),
            sheetId: boardSheetId!,
            storageType,
            force: true
          }
        });
        return;
      }
    }
    
    assignOutletMutation.mutate({
      outletCode: outlet.outletCode,
      truckAssignmentId: truckAssignId,
      outletWeight: weightT.toFixed(3),
      sheetId: boardSheetId!,
      storageType
    } as any);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
          {/* ─── Add Truck Form ─── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Add Truck to a Zone
              </CardTitle>
              <CardDescription>Select a zone first, then assign a vehicle and optional driver.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Zone — primary field */}
                <div className="space-y-2">
                  <Label>Zone <span className="text-red-500">*</span></Label>
                  <Select value={truckForm.zoneId} onValueChange={v => setTruckForm(f => ({ ...f, zoneId: v, truckId: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select zone first..." /></SelectTrigger>
                    <SelectContent>
                      {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Vehicle */}
                <div className="space-y-2">
                  <Label>Vehicle / Truck <span className="text-red-500">*</span></Label>
                  <Select
                    value={truckForm.truckId}
                    onValueChange={v => setTruckForm(f => ({ ...f, truckId: v }))}
                    disabled={!truckForm.zoneId}
                  >
                    <SelectTrigger><SelectValue placeholder={truckForm.zoneId ? "Select vehicle..." : "Select zone first"} /></SelectTrigger>
                    <SelectContent>
                      {vehiclesList
                        .filter((v: any) => {
                          if (!truckForm.zoneId) return false;
                          // Show all active vehicles
                          return v.status !== "inactive";
                        })
                        .sort((a: any, b: any) => {
                          // Sort: zone-matched vehicles first
                          const aMatch = a.currentZoneId === truckForm.zoneId ? 0 : 1;
                          const bMatch = b.currentZoneId === truckForm.zoneId ? 0 : 1;
                          return aMatch - bMatch;
                        })
                        .map((v: any) => {
                          const isZoneMatch = v.currentZoneId === truckForm.zoneId;
                          const isAssigned = trucksAssignedInSheet.includes(v.id);
                          return (
                            <SelectItem key={v.id} value={v.id} disabled={false}>
                              {isZoneMatch ? "✓ " : ""}{v.plateNumber} — {v.name} ({v.capacity || "?"} T{v.storageType ? ` - ${v.storageType}` : ""})
                              {isAssigned ? " (Assigned in other route)" : !isZoneMatch ? " (Other Zone)" : ""}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
                {/* Driver */}
                <div className="space-y-2">
                  <Label>Driver (Optional)</Label>
                  <Select value={truckForm.driverId} onValueChange={v => setTruckForm(f => ({ ...f, driverId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select driver..." /></SelectTrigger>
                    <SelectContent>
                      {drivers.filter((d: any) => d.status === "active").map((d: any) => {
                        const isAssigned = assignedDriversInSheet.has(d.id);
                        return (
                          <SelectItem key={d.id} value={d.id} disabled={false}>
                            {d.name} {isAssigned ? "(Assigned)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {/* Trip Number */}
                <div className="space-y-2">
                  <Label>Trip Number <span className="text-red-500">*</span></Label>
                  <Select
                    value={String(truckForm.tripNumber)}
                    onValueChange={v => setTruckForm(f => ({ ...f, tripNumber: parseInt(v) }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Trip..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Trip 1</SelectItem>
                      <SelectItem value="2">Trip 2</SelectItem>
                      <SelectItem value="3">Trip 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => addTruckMutation.mutate(truckForm)}
                  disabled={!truckForm.truckId || !truckForm.zoneId || addTruckMutation.isPending}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> Add Truck
                </Button>
                <Button
                  variant="outline"
                  onClick={() => autoAllocateMutation.mutate()}
                  disabled={truckAssignments.length === 0 || autoAllocateMutation.isPending}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${autoAllocateMutation.isPending ? "animate-spin" : ""}`} />
                  Auto-Allocate All (FFD)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ─── Tabs for Assigned / Unassigned ─── */}
          <Tabs value={planningTab} onValueChange={setPlanningTab} className="w-full">
            <div className="flex items-center justify-between mb-2">
              <TabsList>
                <TabsTrigger value="unassigned">Unassigned Outlets</TabsTrigger>
                <TabsTrigger value="assigned">Assigned Outlets</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          {/* ─── Zone Cards ─── */}
          {filteredZoneGroups.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-primary/30" />
                <p className="font-medium">No items found</p>
                <p className="text-sm">There are no outlets matching this filter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredZoneGroups.map(({ zone, zoneTrucks, outletRows }: any) => (
                <Card key={zone.id} className="border-2">
                  {/* Zone Header */}
                  <CardHeader 
                    className="bg-gradient-to-r from-primary/8 to-transparent pb-3 cursor-pointer hover:bg-muted/10 transition-colors"
                    onClick={() => setExpandedRoutes(prev => ({ ...prev, [zone.id]: !prev[zone.id] }))}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                          {expandedRoutes[zone.id] ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-base">{zone.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {zoneTrucks.length} truck(s) · {outletRows.length} outlets
                          </p>
                        </div>
                      </div>
                      {/* Truck capacity bars */}
                      <div className="flex flex-wrap gap-2">
                        {zoneTrucks.map((ta: any) => {
                          const veh = getVehicleInfo(ta.truckId);
                          const cap = parseFloat(veh?.capacity || "0");
                          const capCarton = parseInt(veh?.cartonCapacity || "0");
                          const used = parseFloat(ta.usedCapacity || "0");
                          
                          const taAssignments = outletAssignments.filter((oa: any) => oa.truckAssignmentId === ta.id);
                          const taOutletCount = new Set(taAssignments.map((oa: any) => oa.outletCode)).size;
                          const taItemCount = getTruckAssignedItemsCount(ta.id);

                          const limit = cap < 100 ? cap * 1000 : cap;
                          const displayCap = capCarton > 0 ? capCarton : limit;
                          const displayUsed = capCarton > 0 ? taItemCount : used;
                          const pct = displayCap > 0 ? Math.min(100, (displayUsed / displayCap) * 100) : 0;
                          const isOver = displayUsed > displayCap && displayCap > 0;

                          return (
                            <div key={ta.id} className={`rounded-lg border p-2 text-xs w-[180px] shadow-sm flex flex-col ${isOver ? "border-red-400 bg-red-50/50" : "border-border bg-background"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1 font-semibold">
                                  <Truck className="h-3 w-3 text-primary shrink-0" />
                                  <span className="truncate max-w-[120px]" title={`${veh?.plateNumber || "Truck"} (Trip ${ta.tripNumber})`}>
                                    {veh?.plateNumber || "Truck"} (Trip {ta.tripNumber})
                                  </span>
                                </div>
                                <div className="flex items-center shrink-0">
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-primary mr-1"
                                    onClick={() => setEditAssignment({ open: true, id: ta.id, truckId: ta.truckId, driverId: ta.driverId || "", tripNumber: ta.tripNumber })}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                                    onClick={() => removeTruckMutation.mutate(ta.id)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {displayCap > 0 && (
                                <div className="mb-1">
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                                    <div
                                      className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <p className={`text-[10px] flex items-center gap-1 mt-1 truncate ${isOver ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                                    {isOver && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                    {capCarton > 0 ? (
                                      `${taItemCount} / ${capCarton} Boxes (${pct.toFixed(0)}%)`
                                    ) : (
                                      `${used.toFixed(0)} / ${limit.toFixed(0)} Boxes (${pct.toFixed(0)}%)`
                                    )}
                                  </p>
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5" title={getDriverName(ta.driverId)}>
                                <User className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">
                                  {getDriverName(ta.driverId).length > 20 
                                    ? getDriverName(ta.driverId).substring(0, 20) + "..." 
                                    : getDriverName(ta.driverId)}
                                </span>
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" /> {taOutletCount} Outlets
                                </p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Package className="h-2.5 w-2.5" /> {taItemCount} Items
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Outlets Table */}
                  {expandedRoutes[zone.id] && (
                    <CardContent className="p-0">
                    {outletRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No outlets in this zone's dispatch sheet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="pl-4">Outlet</TableHead>
                            <TableHead className="text-right">Total Qty (Items)</TableHead>
                            <TableHead className="text-right pr-4">Assigned Truck</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {outletRows.map((outlet: any, idx: number) => {
                            const storageTypes = Array.from(new Set(outlet.items.map((i: any) => i.storageType).filter(Boolean))) as string[];
                            
                            const isFullyCompleted = outlet.items.length > 0 && outlet.items.every((i: any) => ["delivered", "damaged"].includes(i.delivery?.status));

                            // Check for a "whole outlet" assignment
                            const currentAssignment = outletAssignments.find(
                              (oa: any) => oa.outletCode === outlet.outletCode && !oa.storageType &&
                                truckAssignments.some((ta: any) => ta.id === oa.truckAssignmentId)
                            );
                            const assignedTruck = currentAssignment
                              ? truckAssignments.find((ta: any) => ta.id === currentAssignment.truckAssignmentId)
                              : null;
                            const assignedVeh = assignedTruck ? getVehicleInfo(assignedTruck.truckId) : null;
                            const outletWeightT = outlet.totalWeight; // treat as T

                            return (
                              <React.Fragment key={outlet.outletCode + idx}>
                                <TableRow className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                  <TableCell className="pl-4">
                                    <div>
                                      <p className="font-semibold text-sm">{outlet.outletName || outlet.outletCode}</p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <p className="text-xs text-muted-foreground">{outlet.outletCode} · {outlet.items.length} item(s)</p>
                                        {storageTypes.map((st: any) => (
                                          <Badge key={st} variant="outline" className="text-[9px] h-4 px-1 bg-slate-50">{st}</Badge>
                                        ))}
                                      </div>
                                      
                                      {/* Items list - view only */}
                                      <div className="mt-2 pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1">
                                        {outlet.items.map((item: any, iIdx: number) => {
                                          const qty = parseFloat(item.weight || item.requestedQty || "0");
                                          return (
                                            <div key={item.id || iIdx} className="text-[11px] text-muted-foreground/80 flex items-center justify-between max-w-xl">
                                              <span className="truncate pr-4">
                                                {item.itemCode} - {item.description || "No description"}
                                                {item.storageType && (
                                                  <span className="text-[9px] ml-1.5 px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded font-normal text-muted-foreground">
                                                    {item.storageType}
                                                  </span>
                                                )}
                                              </span>
                                              <span className="font-mono font-semibold shrink-0">{qty.toFixed(0)} Boxes</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right align-top pt-4">
                                    <span className={`font-mono text-sm font-semibold ${outletWeightT > 100 ? "text-amber-600" : "text-foreground"}`}>
                                      {outletWeightT.toFixed(0)} Boxes
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right pr-4 align-top pt-4">
                                    {isFullyCompleted ? (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Completed
                                      </Badge>
                                    ) : assignedTruck ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                          <Truck className="h-3 w-3" />
                                          {assignedVeh?.plateNumber || "Truck"}
                                        </Badge>
                                        <Button
                                          variant="ghost" size="sm"
                                          className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                          onClick={() => unassignOutletMutation.mutate({
                                            outletCode: outlet.outletCode,
                                            sheetId: boardSheetId!
                                          })}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1">
                                        {zoneTrucks.map((ta: any) => {
                                          const veh = getVehicleInfo(ta.truckId);
                                          return (
                                            <Button 
                                              key={ta.id} 
                                              variant="outline" 
                                              size="sm" 
                                              className="h-7 px-2 text-[10px] border-dashed hover:border-primary hover:text-primary animate-none"
                                              onClick={() => handleAssign(outlet, outletWeightT, ta.id)}
                                            >
                                              <Truck className="h-3 w-3 mr-1" />
                                              {veh?.plateNumber || "Truck"} (T{ta.tripNumber})
                                            </Button>
                                          );
                                        })}
                                        <Select onValueChange={(truckAssignId) => handleAssign(outlet, outletWeightT, truckAssignId)}>
                                          <SelectTrigger className="h-7 w-8 px-0 flex justify-center items-center border-dashed bg-transparent text-muted-foreground hover:text-primary">
                                            <MoreHorizontal className="h-3 w-3" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {truckAssignments.map((ta: any) => {
                                              const veh = getVehicleInfo(ta.truckId);
                                              const zoneName = getZoneName(ta.zoneId);
                                              const cap = parseFloat(veh?.capacity || "0");
                                              const capCarton = parseInt(veh?.cartonCapacity || "0");
                                              const used = parseFloat(ta.usedCapacity || "0");
                                              const taItemCount = getTruckAssignedItemsCount(ta.id);
                                              
                                              const limit = cap < 100 ? cap * 1000 : cap;
                                              const remainingBoxes = limit > 0 ? limit - used : null;
                                              const remainingCartons = capCarton > 0 ? capCarton - taItemCount : null;
                                              const wouldOverflow = capCarton > 0 
                                                ? (taItemCount + outlet.items.length > capCarton)
                                                : (limit > 0 && used + outletWeightT > limit);

                                              return (
                                                <SelectItem key={ta.id} value={ta.id} className={wouldOverflow ? "text-red-500" : ""}>
                                                  {zoneName} - {veh?.name || "Truck"} ({veh?.plateNumber || "N/A"}) (Trip {ta.tripNumber})
                                                  {remainingCartons !== null ? ` - ${remainingCartons} boxes free` : remainingBoxes !== null ? ` - ${remainingBoxes.toFixed(0)} boxes free` : ""}
                                                  {wouldOverflow ? " ⚠" : ""}
                                                </SelectItem>
                                              );
                                            })}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>

                                {/* Per-Storage Type Assignment Rows */}
                                {!assignedTruck && storageTypes.length > 0 && storageTypes.map((st: string) => {
                                  // Calculate total weight of items for this storage type
                                  const stItems = outlet.items.filter((i: any) => i.storageType === st);
                                  const isStCompleted = stItems.length > 0 && stItems.every((i: any) => ["delivered", "damaged"].includes(i.delivery?.status));
                                  const stWeightT = stItems.reduce((sum: number, item: any) => {
                                    return sum + parseFloat(item.weight || item.requestedQty || "0");
                                  }, 0);

                                  const stAssignment = outletAssignments.find(
                                    (oa: any) => oa.outletCode === outlet.outletCode && oa.storageType === st &&
                                      truckAssignments.some((ta: any) => ta.id === oa.truckAssignmentId)
                                  );
                                  const stAssignedTruck = stAssignment
                                    ? truckAssignments.find((ta: any) => ta.id === stAssignment.truckAssignmentId)
                                    : null;
                                  const stAssignedVeh = stAssignedTruck ? getVehicleInfo(stAssignedTruck.truckId) : null;

                                  const isExpanded = expandedStorageTypes[`${outlet.outletCode}-${st}`];
                                  return (
                                    <React.Fragment key={st}>
                                      <TableRow 
                                        className="bg-muted/5 border-t-0 hover:bg-muted/10 cursor-pointer"
                                        onClick={() => setExpandedStorageTypes(prev => ({...prev, [`${outlet.outletCode}-${st}`]: !prev[`${outlet.outletCode}-${st}`]}))}
                                      >
                                        <TableCell className="pl-12 text-xs text-muted-foreground border-t-0 py-2 flex items-center gap-1 hover:text-foreground transition-colors">
                                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          ↳ {st} Items ({stItems.length})
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-mono text-muted-foreground border-t-0 py-2">
                                          {stWeightT.toFixed(0)} Boxes
                                        </TableCell>
                                        <TableCell className="text-right pr-4 border-t-0 py-2">
                                          {isStCompleted ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] h-5">
                                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                              Completed
                                            </Badge>
                                          ) : stAssignedTruck ? (
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-[10px] h-5">
                                                <Truck className="h-2.5 w-2.5" />
                                                {stAssignedVeh?.plateNumber || "Truck"} (Trip {stAssignedTruck.tripNumber})
                                              </Badge>
                                              <Button
                                                variant="ghost" size="sm"
                                                className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  unassignOutletMutation.mutate({
                                                    outletCode: outlet.outletCode,
                                                    sheetId: boardSheetId!,
                                                    storageType: st
                                                  } as any);
                                                }}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                              {zoneTrucks.map((ta: any) => {
                                                const veh = getVehicleInfo(ta.truckId);
                                                return (
                                                  <Button 
                                                    key={ta.id} 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-6 px-1.5 text-[10px] border-dashed hover:border-primary hover:text-primary animate-none"
                                                    onClick={() => handleAssign(outlet, stWeightT, ta.id, st)}
                                                  >
                                                    <Truck className="h-2.5 w-2.5 mr-1" />
                                                    {veh?.plateNumber || "Truck"} (T{ta.tripNumber})
                                                  </Button>
                                                );
                                              })}
                                              <Select onValueChange={(truckAssignId) => handleAssign(outlet, stWeightT, truckAssignId, st)}>
                                                <SelectTrigger className="h-6 w-6 px-0 flex justify-center items-center border-dashed bg-transparent text-muted-foreground hover:text-primary ml-1">
                                                  <MoreHorizontal className="h-2.5 w-2.5" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {truckAssignments.map((ta: any) => {
                                                    const veh = getVehicleInfo(ta.truckId);
                                                    const zoneName = getZoneName(ta.zoneId);
                                                    const cap = parseFloat(veh?.capacity || "0");
                                                    const capCarton = parseInt(veh?.cartonCapacity || "0");
                                                    const used = parseFloat(ta.usedCapacity || "0");
                                                    const taItemCount = getTruckAssignedItemsCount(ta.id);
                                                    
                                                    const limit = cap < 100 ? cap * 1000 : cap;
                                                    const remainingBoxes = limit > 0 ? limit - used : null;
                                                    const remainingCartons = capCarton > 0 ? capCarton - taItemCount : null;
                                                    const wouldOverflow = capCarton > 0 
                                                      ? (taItemCount + stItems.length > capCarton)
                                                      : (limit > 0 && used + stWeightT > limit);

                                                    return (
                                                      <SelectItem key={ta.id} value={ta.id} className={`text-xs ${wouldOverflow ? "text-red-500" : ""}`}>
                                                        {zoneName} - {veh?.name || "Truck"} ({veh?.plateNumber || "N/A"}) (Trip {ta.tripNumber})
                                                        {remainingCartons !== null ? ` - ${remainingCartons} boxes free` : remainingBoxes !== null ? ` - ${remainingBoxes.toFixed(0)} boxes free` : ""}
                                                        {wouldOverflow ? " ⚠" : ""}
                                                      </SelectItem>
                                                    );
                                                  })}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                      
                                      {isExpanded && stItems.map((item: any, itemIdx: number) => {
                                        const boxCount = parseFloat(item.weight || item.requestedQty || "0");
                                        
                                        return (
                                          <TableRow key={item.id || itemIdx} className="bg-muted/10 border-t-0">
                                            <TableCell className="pl-16 py-1.5 text-[10px] text-muted-foreground/80 border-t-0">
                                              {item.itemCode} - {item.description}
                                            </TableCell>
                                            <TableCell className="text-right text-[10px] font-mono text-muted-foreground/80 border-t-0 py-1.5">
                                              {boxCount.toFixed(0)} Boxes
                                            </TableCell>
                                            <TableCell className="border-t-0 py-1.5">
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Capacity Warning Dialog ─── */}
      <AlertDialog open={!!pendingAssignment} onOpenChange={(open) => !open && setPendingAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {pendingAssignment?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {pendingAssignment?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary"
              onClick={() => {
                if (pendingAssignment?.payload) {
                  assignOutletMutation.mutate(pendingAssignment.payload as any);
                }
                setPendingAssignment(null);
              }}
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Edit Truck Assignment Dialog ─── */}
      <Dialog open={editAssignment?.open} onOpenChange={(open) => !open && setEditAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Truck & Driver Assignment</DialogTitle>
            <DialogDescription>
              Temporarily override the truck or driver for this dispatch. This change only affects the current sheet.
            </DialogDescription>
          </DialogHeader>
          {editAssignment && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Vehicle / Truck</Label>
                <Select
                  value={editAssignment.truckId}
                  onValueChange={(val) => setEditAssignment((prev) => prev ? { ...prev, truckId: val } : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehiclesList.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plateNumber} — {v.name} ({v.capacity || "?"} T{v.storageType ? ` - ${v.storageType}` : ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Driver</Label>
                <Select
                  value={editAssignment.driverId || "unassigned"}
                  onValueChange={(val) => setEditAssignment((prev) => prev ? { ...prev, driverId: val === "unassigned" ? "" : val } : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-muted-foreground italic">None (Unassigned)</SelectItem>
                    {drivers.map((d: any) => {
                      const isAssignedToOther = assignedDriversInSheet.has(d.id) && editAssignment.driverId !== d.id;
                      return (
                        <SelectItem key={d.id} value={d.id} disabled={false}>
                          {d.name} {isAssignedToOther ? "(Assigned)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trip Number</Label>
                <Select
                  value={String(editAssignment.tripNumber || 1)}
                  onValueChange={(val) => setEditAssignment((prev) => prev ? { ...prev, tripNumber: parseInt(val) } : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Select trip" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Trip 1</SelectItem>
                    <SelectItem value="2">Trip 2</SelectItem>
                    <SelectItem value="3">Trip 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditAssignment(null)}>Cancel</Button>
                <Button
                  onClick={() => updateTruckAssignmentMutation.mutate({
                    id: editAssignment.id,
                    truckId: editAssignment.truckId,
                    driverId: editAssignment.driverId || null,
                    tripNumber: editAssignment.tripNumber || 1,
                  })}
                  disabled={updateTruckAssignmentMutation.isPending}
                >
                  {updateTruckAssignmentMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ===== PENDING QUANTITIES TAB =====
function PendingQuantitiesTab({ selectedDate }: { selectedDate?: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase().includes("admin");
  const { toast } = useToast();

  const [startDate, setStartDate] = useState(selectedDate || "");
  const [endDate, setEndDate] = useState(selectedDate || "");

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }
  }, [selectedDate]);
  const [routeFilter, setRouteFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [storageTypeFilter, setStorageTypeFilter] = useState("all");

  const completeMutation = useMutation({
    mutationFn: async ({ dispatchItemId, reqQty }: { dispatchItemId: string; reqQty: string }) => {
      return apiRequest("PATCH", `/api/dispatch/items/${dispatchItemId}/delivery`, {
        status: "delivered",
        deliveredQty: reqQty,
        remainingQty: "0",
        damagedQty: "0",
        damageReason: "",
        remark: "Completed by admin",
      });
    },
    onSuccess: () => {
      toast({ title: "Delivery completed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/pending-advanced"] });
    },
    onError: (err: any) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  const toggleRoute = (id: string) => setExpandedRoutes(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  const toggleOutlet = (id: string) => setExpandedOutlets(prev => ({ ...prev, [id]: !prev[id] }));

  const { data: routes = [] } = useQuery<any[]>({ queryKey: ["/api/routes"] });
  const { data: outlets = [] } = useQuery<any[]>({ queryKey: ["/api/outlets"] });
  const { data: drivers = [] } = useQuery<any[]>({ queryKey: ["/api/drivers"] });

  const queryKey = ["/api/dispatch/pending-advanced", { startDate, endDate, routeId: routeFilter, outletId: outletFilter, driverId: driverFilter, storageType: storageTypeFilter }];
  
  const { data: pendingDeliveries = [], isLoading } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      const q = new URLSearchParams();
      if (startDate) q.append("startDate", startDate);
      if (endDate) q.append("endDate", endDate);
      if (routeFilter !== "all") q.append("routeId", routeFilter);
      if (outletFilter !== "all") q.append("outletId", outletFilter);
      if (driverFilter !== "all") q.append("driverId", driverFilter);
      if (storageTypeFilter !== "all") q.append("storageType", storageTypeFilter);
      const res = await apiRequest("GET", `/api/dispatch/pending-advanced?${q.toString()}`);
      return res.json();
    }
  });

  const allStorageTypes = new Set<string>();
  const groupedData: { zoneName: string; outlets: any[] }[] = [];
  
  // Group by zoneName -> outletName -> items
  const routeMap = new Map<string, any>();
  
  pendingDeliveries.forEach((item: any) => {
    if (item.storageType) allStorageTypes.add(item.storageType);
    
    if (!routeMap.has(item.zoneName)) {
      routeMap.set(item.zoneName, { zoneName: item.zoneName, outletsMap: new Map() });
    }
    
    const r = routeMap.get(item.zoneName);
    const outletKey = `${item.outletCode}-${item.outletName}`;
    
    if (!r.outletsMap.has(outletKey)) {
      r.outletsMap.set(outletKey, { 
        outletName: item.outletName, 
        outletCode: item.outletCode, 
        items: [] 
      });
    }
    
    r.outletsMap.get(outletKey).items.push(item);
  });
  
  routeMap.forEach(r => {
    groupedData.push({
      zoneName: r.zoneName,
      outlets: Array.from(r.outletsMap.values())
    });
  });

  const storageTypesArray = Array.from(allStorageTypes).sort();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Advanced Pending Deliveries
              </CardTitle>
              <CardDescription className="mt-1">
                View all pending items across dates, routes, and outlets.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 pt-4 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" className="h-8 text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input type="date" className="h-8 text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Route</Label>
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Routes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {routes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Outlet</Label>
              <Select value={outletFilter} onValueChange={setOutletFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Outlets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Driver</Label>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Drivers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Storage Type</Label>
              <Select value={storageTypeFilter} onValueChange={setStorageTypeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {storageTypesArray.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-primary animate-spin mr-2" /> Loading pending deliveries...
            </div>
          ) : groupedData.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/60" />
              <p className="font-medium">No pending quantities!</p>
              <p className="text-sm">All deliveries matching the criteria are completed.</p>
            </div>
          ) : (
            <div className="bg-white border-t overflow-x-auto text-sm rounded-b-xl">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="bg-slate-100/80 border-b">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r w-64">Route / Outlet</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Date</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Item Code</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Description</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Assigned To</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-right w-20 border-r">Req Qty</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-right w-20 border-r">Remaining</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 w-24 border-r">Status</th>
                    {isAdmin && <th className="py-2 px-3 font-semibold text-slate-700 w-24 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groupedData.map(zone => {
                    const isRouteExpanded = expandedRoutes[zone.zoneName] !== false; // Default true
                    
                    return (
                      <React.Fragment key={zone.zoneName}>
                        <tr className="bg-slate-100/60 hover:bg-slate-100 cursor-pointer font-semibold text-slate-800" onClick={() => toggleRoute(zone.zoneName)}>
                          <td className="py-2 px-3 border-r flex items-center gap-1.5" colSpan={isAdmin ? 9 : 8}>
                            {isRouteExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {zone.zoneName}
                            <Badge variant="outline" className="ml-2 bg-white text-[10px] h-4">{zone.outlets.length} Outlets</Badge>
                          </td>
                        </tr>

                        {isRouteExpanded && zone.outlets.map(outlet => {
                          const outletId = `${zone.zoneName}-${outlet.outletCode}`;
                          const isOutletExpanded = !!expandedOutlets[outletId];

                          const totalQty = outlet.items.reduce((sum: number, p: any) => {
                            const reqQty = parseFloat(p.requestedQty || p.weight || "0");
                            const delQty = parseFloat(p.deliveredQty || p.totalDelivered || "0");
                            let remQty = parseFloat(p.remainingQty || p.remaining || "0");
                            if (remQty === 0 && !p.remainingQty && !p.remaining) remQty = reqQty - delQty;
                            return sum + remQty;
                          }, 0);
                          const formattedQty = totalQty % 1 === 0 ? totalQty.toFixed(0) : totalQty.toFixed(1);

                          return (
                            <React.Fragment key={outletId}>
                              <tr className="hover:bg-slate-50 cursor-pointer text-slate-700" onClick={() => toggleOutlet(outletId)}>
                                <td className="py-1.5 px-3 border-r flex items-center gap-1.5 font-medium pl-6 bg-slate-50/50" colSpan={isAdmin ? 9 : 8}>
                                  {isOutletExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                                  {outlet.outletName}
                                  <span className="text-xs text-muted-foreground ml-1">({outlet.outletCode})</span>
                                  <Badge variant="outline" className="ml-2 bg-white text-[10px] h-4">
                                    {outlet.items.length} Items (Qty: {formattedQty})
                                  </Badge>
                                </td>
                              </tr>

                              {isOutletExpanded && outlet.items.map((p: any) => {
                                const reqQty = parseFloat(p.requestedQty || p.weight || "0");
                                const delQty = parseFloat(p.deliveredQty || p.totalDelivered || "0");
                                let remQty = parseFloat(p.remainingQty || p.remaining || "0");
                                if (remQty === 0 && !p.remainingQty && !p.remaining) remQty = reqQty - delQty;
                                
                                return (
                                  <tr key={p.id} className="hover:bg-slate-50 text-slate-600 bg-white">
                                    <td className="py-1.5 px-3 border-r pl-12 text-xs text-muted-foreground">
                                      {p.storageType && <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1">{p.storageType}</Badge>}
                                    </td>
                                    <td className="py-1.5 px-3 border-r text-xs whitespace-nowrap">
                                      {format(new Date(p.date), "dd MMM yy")}
                                    </td>
                                    <td className="py-1.5 px-3 border-r font-mono text-xs">{p.itemCode}</td>
                                    <td className="py-1.5 px-3 border-r text-xs max-w-[200px] truncate" title={p.description || ""}>
                                      {p.description || "—"}
                                    </td>
                                    <td className="py-1.5 px-3 border-r text-xs">
                                      {p.assignedDriverName || p.assignedTruckPlate ? (
                                        <div className="flex flex-col gap-0.5">
                                          {p.assignedDriverName && <span className="font-medium text-slate-700 flex items-center gap-1"><User className="h-3 w-3" />{p.assignedDriverName}</span>}
                                          {p.assignedTruckPlate && <span className="text-muted-foreground flex items-center gap-1 text-[10px]"><Truck className="h-2.5 w-2.5" />{p.assignedTruckPlate}</span>}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground italic text-xs">Unassigned</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-3 border-r text-right font-medium">{reqQty.toFixed(2)}</td>
                                    <td className="py-1.5 px-3 border-r text-right font-bold text-amber-600">{remQty.toFixed(2)}</td>
                                    <td className="py-1.5 px-3 text-xs border-r">
                                      <StatusBadge status={p.status || "pending"} />
                                    </td>
                                    {isAdmin && (
                                      <td className="py-1.5 px-3 text-right">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-[10px] px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 font-semibold shadow-sm inline-flex items-center gap-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Mark item ${p.itemCode} as completed/delivered?`)) {
                                              completeMutation.mutate({ dispatchItemId: p.dispatchItemId || p.id, reqQty: String(reqQty) });
                                            }
                                          }}
                                          disabled={completeMutation.isPending}
                                        >
                                          <Check className="h-2.5 w-2.5" />
                                          Complete
                                        </Button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== TRUCK TRANSFERS TAB =====
// ===== COMPLETED DELIVERIES TAB =====
function CompletedDeliveriesTab({ selectedDate, onManageItems }: { selectedDate?: string; onManageItems?: (outletCode: string, outletName: string, items: any[]) => void }) {
  const [startDate, setStartDate] = useState(selectedDate || format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(selectedDate || format(new Date(), "yyyy-MM-dd"));

  const safeFormatDate = (dateVal: any, formatStr: string) => {
    if (!dateVal) return "";
    const parsed = new Date(dateVal);
    if (isNaN(parsed.getTime())) return "";
    try {
      return format(parsed, formatStr);
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }
  }, [selectedDate]);
  const [storageTypeFilter, setStorageTypeFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});
  const [viewPodsModal, setViewPodsModal] = useState<{ isOpen: boolean; title: string; pods: {url: string, date: string}[] }>({ isOpen: false, title: "", pods: [] });
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase().includes("admin");
  const isSupervisor = true; // TODO: link to user role

  const revertMutation = useMutation({
    mutationFn: async (dispatchItemIds: string | string[]) => {
      const ids = Array.isArray(dispatchItemIds) ? dispatchItemIds : [dispatchItemIds];
      await Promise.all(
        ids.map(id =>
          apiRequest("PATCH", `/api/dispatch/items/${id}/delivery`, {
            status: "pending",
            deliveredQty: "0",
            remainingQty: "0",
            remark: "Reverted by admin",
            podUrl: ""
          })
        )
      );
    },
    onSuccess: () => {
      toast({ title: "Reverted to pending successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/completed-deliveries"] });
    },
    onError: (err: any) => toast({ title: getErrorMessage(err), variant: "destructive" }),
  });

  const toggleRoute = (id: string) => setExpandedRoutes(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  const toggleOutlet = (id: string) => setExpandedOutlets(prev => ({ ...prev, [id]: !prev[id] }));

  const { data: deliveries = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dispatch/completed-deliveries", { startDate, endDate }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dispatch/completed-deliveries?startDate=${startDate}&endDate=${endDate}`);
      return res.json();
    }
  });

  const { data: zones = [] } = useQuery<any[]>({ queryKey: ["/api/routes"] });
  const { data: drivers = [] } = useQuery<any[]>({ queryKey: ["/api/drivers"] });
  const { data: outlets = [] } = useQuery<any[]>({ queryKey: ["/api/outlets"] });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0 py-12">
        <RefreshCw className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  // Build filter options
  const allStorageTypes = new Set<string>(["Ambient", "Chilled", "Frozen", "Dry"]);
  const allRoutes = new Map<string, string>();
  const allOutlets = new Map<string, string>();
  const allDrivers = new Map<string, string>();

  (zones || []).forEach(z => allRoutes.set(z.id, z.name));
  (outlets || []).forEach(o => allOutlets.set(o.id, `${o.name} (${o.code || 'No Code'})`));
  (drivers || []).forEach(d => allDrivers.set(d.id, d.name));

  (deliveries || []).forEach(d => {
    if (d.storageType) allStorageTypes.add(d.storageType);
    if (d.routeId && d.zoneName && !allRoutes.has(d.routeId)) allRoutes.set(d.routeId, d.zoneName);
    if (d.outletId && d.outletName && !allOutlets.has(d.outletId)) allOutlets.set(d.outletId, `${d.outletName} (${d.outletCode})`);
    if (d.driverId && d.driverName && !allDrivers.has(d.driverId)) allDrivers.set(d.driverId, d.driverName);
  });

  // Apply filters
  const filteredDeliveries = (deliveries || []).filter(d => {
    if (storageTypeFilter !== "all" && d.storageType !== storageTypeFilter) return false;
    if (routeFilter !== "all" && d.routeId !== routeFilter) return false;
    if (outletFilter !== "all" && d.outletId !== outletFilter) return false;
    if (driverFilter !== "all" && d.driverId !== driverFilter) return false;
    return true;
  });

  // Group by Route -> Outlet
  const groupedMap = new Map<string, { zoneId: string; zoneName: string; outlets: Map<string, { outletId: string; outletCode: string; outletName: string; items: any[]; pods: Map<string, string> }> }>();
  
  filteredDeliveries.forEach(d => {
    const routeId = d.routeId || "unassigned";
    const routeName = d.zoneName || "Unassigned Route";
    const outletId = d.outletId || d.outletCode || "unassigned";
    
    if (!groupedMap.has(routeId)) {
      groupedMap.set(routeId, { zoneId: routeId, zoneName: routeName, outlets: new Map() });
    }
    const routeGroup = groupedMap.get(routeId)!;
    
    if (!routeGroup.outlets.has(outletId)) {
      routeGroup.outlets.set(outletId, { outletId: d.outletId, outletCode: d.outletCode, outletName: d.outletName || "Unassigned", items: [], pods: new Map() });
    }
    const outletGroup = routeGroup.outlets.get(outletId)!;
    outletGroup.items.push(d);
    
    if (d.podUrl) {
      d.podUrl.split(",").forEach((p: string) => {
        const trimmed = p.trim();
        if (trimmed) {
          outletGroup.pods.set(trimmed, d.deliveredAt);
        }
      });
    }
    if (d.potUrl) {
      d.potUrl.split(",").forEach((p: string) => {
        const trimmed = p.trim();
        if (trimmed) {
          outletGroup.pods.set(trimmed, d.deliveredAt);
        }
      });
    }
  });

  const groupedData = Array.from(groupedMap.values()).map(r => ({ ...r, outlets: Array.from(r.outlets.values()) }));
  
  const handlePrint = () => window.print();
  
  const handleExport = () => {
    if (!filteredDeliveries.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredDeliveries.map(d => ({
      Date: safeFormatDate(d.deliveredAt, "dd/MM/yyyy HH:mm"),
      Route: d.zoneName,
      Outlet: d.outletName,
      Code: d.outletCode,
      ItemCode: d.itemCode,
      Description: d.description,
      RequestedQty: d.requestedQty,
      DeliveredQty: d.deliveredQty,
      Driver: d.driverName,
      Status: d.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Completed Deliveries");
    XLSX.writeFile(wb, `Completed_Deliveries_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-start justify-between pb-4 gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Completed Deliveries
            </CardTitle>
            <CardDescription className="mt-1">
              View delivered items, track PODs, and filter historical data.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2 mr-2">
              <input
                type="checkbox"
                id="includeAttachments"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <label
                htmlFor="includeAttachments"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700"
              >
                Include POD Attachments in PDF
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Export</Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden"><Printer className="h-4 w-4 mr-2" /> Print</Button>
          </div>
        </CardHeader>
        
        <div className="px-6 pb-4 border-b space-y-4 print:hidden">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Storage Type</Label>
              <Select value={storageTypeFilter} onValueChange={setStorageTypeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Array.from(allStorageTypes).sort().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Route</Label>
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {Array.from(allRoutes.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Outlet</Label>
              <Select value={outletFilter} onValueChange={setOutletFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {Array.from(allOutlets.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Driver</Label>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {Array.from(allDrivers.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {groupedData.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/60" />
              <p className="font-medium">No completed deliveries found!</p>
              <p className="text-sm">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="bg-white border-t overflow-x-auto text-sm rounded-b-xl">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-100/80 border-b">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r w-80">Route / Outlet</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Item Code</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Description</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-right w-24">Req Qty</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-right w-24">Delivered</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 w-28 border-r">Status</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 w-40">Driver</th>
                    {isAdmin && <th className="py-2 px-3 font-semibold text-slate-700 w-20 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groupedData.map(zone => {
                    const isRouteExpanded = expandedRoutes[zone.zoneId] !== false;
                    return (
                      <React.Fragment key={zone.zoneId}>
                        <tr className="bg-slate-100/60 hover:bg-slate-100 cursor-pointer font-semibold text-slate-800" onClick={() => toggleRoute(zone.zoneId)}>
                          <td className="py-2 px-3 border-r flex items-center gap-1.5" colSpan={isAdmin ? 8 : 7}>
                            {isRouteExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {zone.zoneName}
                            <Badge variant="outline" className="ml-2 bg-white text-[10px] h-4">{zone.outlets.length} Outlets</Badge>
                          </td>
                        </tr>
                        {isRouteExpanded && zone.outlets.map(outlet => {
                          const outletId = `${zone.zoneId}-${outlet.outletCode}`;
                          const isOutletExpanded = !!expandedOutlets[outletId];

                          const totalReqQty = outlet.items.reduce((sum: number, p: any) => sum + parseFloat(p.requestedQty || p.weight || "0"), 0);
                          const totalDelQty = outlet.items.reduce((sum: number, p: any) => sum + parseFloat(p.deliveredQty || "0"), 0);
                          const formattedDelQty = totalDelQty % 1 === 0 ? totalDelQty.toFixed(0) : totalDelQty.toFixed(1);
                          const formattedReqQty = totalReqQty % 1 === 0 ? totalReqQty.toFixed(0) : totalReqQty.toFixed(1);

                          return (
                            <React.Fragment key={outletId}>
                              <tr className="hover:bg-slate-50 text-slate-700 group">
                                <td className="py-1.5 px-3 border-r bg-slate-50/50" colSpan={isAdmin ? 8 : 7}>
                                  <div className="flex items-center gap-2 flex-nowrap w-full cursor-pointer" onClick={() => toggleOutlet(outletId)}>
                                    {isOutletExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                                    <span className="font-medium text-sm whitespace-nowrap">{outlet.outletName}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">({outlet.outletCode})</span>
                                    <Badge variant="outline" className="bg-white text-[10px] h-4 whitespace-nowrap flex-shrink-0">
                                      {outlet.items.length} Items (Qty: {formattedDelQty} / {formattedReqQty})
                                    </Badge>
                                    {outlet.pods.size > 0 && (() => {
                                      const uniqueDates = Array.from(new Set(
                                        Array.from(outlet.pods.values())
                                          .filter(Boolean)
                                          .map((d: any) => safeFormatDate(d, "dd MMM yyyy, HH:mm"))
                                          .filter(Boolean)
                                      ));
                                      return uniqueDates.map((dt, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0">
                                          <Clock className="h-3 w-3 flex-shrink-0" />
                                          {dt}
                                        </span>
                                      ));
                                    })()}
                                    <div className="flex-1" />
                                    {outlet.pods.size > 0 && (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-6 text-[10px] px-2 print:hidden flex-shrink-0 whitespace-nowrap"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewPodsModal({ 
                                            isOpen: true, 
                                            title: outlet.outletName, 
                                            pods: Array.from(outlet.pods.entries()).map(([url, date]) => ({ url, date: date as string })) 
                                          });
                                        }}
                                      >
                                        <Eye className="h-3 w-3 mr-1" /> View PODs ({outlet.pods.size})
                                      </Button>
                                    )}
                                    {(isSupervisor || isAdmin) && onManageItems && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px] px-2 print:hidden flex-shrink-0 whitespace-nowrap bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onManageItems(outlet.outletCode, outlet.outletName, outlet.items);
                                        }}
                                      >
                                        <Settings className="h-3 w-3 mr-1" /> Manage Items
                                      </Button>
                                    )}
                                    {outlet.items.length > 0 && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-[10px] px-2 print:hidden flex-shrink-0 whitespace-nowrap bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const firstItem = outlet.items[0];
                                            if (firstItem) {
                                              const url = `/api/reports/delivery-pod-pdf?sheetId=${firstItem.sheetId}&outletId=${firstItem.outletId}&storageType=${storageTypeFilter}&includeAttachments=${includeAttachments}`;
                                              window.open(url, "_blank");
                                            }
                                          }}
                                        >
                                          <Download className="h-3 w-3 mr-1" /> Download PDF
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 text-[10px] px-2 print:hidden flex-shrink-0 whitespace-nowrap bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const firstItem = outlet.items[0];
                                            if (firstItem) {
                                              const shareUrl = `${window.location.origin}/api/reports/delivery-pod-pdf?sheetId=${firstItem.sheetId}&outletId=${firstItem.outletId}&storageType=${storageTypeFilter}&includeAttachments=${includeAttachments}`;
                                              navigator.clipboard.writeText(shareUrl);
                                              toast({
                                                title: "Link Copied!",
                                                description: "POD PDF link copied to clipboard.",
                                              });
                                            }
                                          }}
                                        >
                                          <Share2 className="h-3 w-3 mr-1" /> Share PDF
                                        </Button>
                                        {(isSupervisor || isAdmin) && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-[10px] px-2 print:hidden flex-shrink-0 whitespace-nowrap bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (confirm(`Are you sure you want to revert all ${outlet.items.length} deliveries for ${outlet.outletName} to pending?`)) {
                                                const itemIds = outlet.items.map((i: any) => i.dispatchItemId || i.id);
                                                revertMutation.mutate(itemIds);
                                              }
                                            }}
                                            disabled={revertMutation.isPending}
                                          >
                                            <RefreshCw className="h-3 w-3 mr-1" /> Revert
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isOutletExpanded && outlet.items.map((p: any) => {
                                const reqQty = parseFloat(p.requestedQty || p.weight || "0");
                                const delQty = parseFloat(p.deliveredQty || "0");
                                return (
                                  <tr key={p.id} className="hover:bg-slate-50 text-slate-600 bg-white">
                                    <td className="py-1.5 px-3 border-r pl-12 text-xs text-muted-foreground">
                                      {p.storageType && <Badge variant="outline" className="text-[9px] h-4 px-1 mr-1">{p.storageType}</Badge>}
                                      {safeFormatDate(p.deliveredAt, "dd/MM HH:mm")}
                                    </td>
                                    <td className="py-1.5 px-3 border-r font-mono text-xs">{p.itemCode}</td>
                                    <td className="py-1.5 px-3 border-r text-xs max-w-[200px] truncate" title={p.description || ""}>
                                      {p.description || "—"}
                                    </td>
                                    <td className="py-1.5 px-3 border-r text-right font-medium">{reqQty.toFixed(2)}</td>
                                    <td className="py-1.5 px-3 border-r text-right text-emerald-600 font-medium">{delQty.toFixed(2)}</td>
                                    <td className="py-1.5 px-3 text-xs border-r">
                                      <StatusBadge status={p.status || "delivered"} />
                                    </td>
                                    <td className="py-1.5 px-3 text-xs max-w-[150px] truncate" title={p.driverName}>
                                      {p.driverName}
                                    </td>
                                    {isAdmin && (
                                      <td className="py-1.5 px-3 text-right"></td>
                                    )}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={viewPodsModal.isOpen} onOpenChange={(v) => setViewPodsModal(prev => ({ ...prev, isOpen: v }))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proof of Delivery - {viewPodsModal.title}</DialogTitle>
            <DialogDescription>
              Showing {viewPodsModal.pods.length} attachment(s) for this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {viewPodsModal.pods.map((pod, idx) => {
              const url = pod.url.replace(/\\/g, '/');
              const srcUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) ? url : `/${url}`;
              const dateStr = safeFormatDate(pod.date, "dd MMM yyyy, HH:mm") || "Unknown Date";
              
              return (
                <div key={idx} className="border rounded-md overflow-hidden bg-slate-50 flex flex-col min-h-[300px]">
                  <div className="p-2 bg-slate-100 border-b text-xs font-medium text-slate-600 text-center flex items-center justify-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Delivered At: {dateStr}
                  </div>
                  <div className="flex-1 flex items-center justify-center p-2">
                    {url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.startsWith("data:image") ? (
                      <img 
                        src={encodeURI(srcUrl)} 
                        alt={`Attachment ${idx + 1}`} 
                        className="w-full h-auto object-contain max-h-[400px] cursor-pointer hover:opacity-90 transition-opacity" 
                        onClick={() => setFullScreenImage(encodeURI(srcUrl))}
                      />
                    ) : (
                      <div className="text-center p-4">
                        <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <a href={srcUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          View Document {idx + 1}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 cursor-pointer backdrop-blur-sm" 
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-black/50 p-2 rounded-full" 
            onClick={(e) => {
              e.stopPropagation();
              setFullScreenImage(null);
            }}
          >
            <X className="h-6 w-6" />
          </button>
          <img 
            src={fullScreenImage} 
            className="max-w-full max-h-[90vh] object-contain cursor-default rounded-md shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
            alt="Full screen attachment"
          />
        </div>
      )}
    </div>
  );
}
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
                <SelectContent>{vehiclesList.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plateNumber} — {v.name} ({v.capacity || "?"} T{v.storageType ? ` - ${v.storageType}` : ""})</SelectItem>)}</SelectContent>
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
