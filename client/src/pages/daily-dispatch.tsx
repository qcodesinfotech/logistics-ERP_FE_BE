import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Truck, Upload, FileText, Calendar, MapPin, User, Package, Store, Hourglass, AlertCircle,
  ChevronDown, ChevronUp, ChevronRight, AlertTriangle, CheckCircle2, Clock,
  X, Plus, Trash2, RefreshCw, ArrowRight, Eye, Printer, Download, Edit2, Check,
  Share2,
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
  // Normalize common header variants
  const normalize = (h: string) => {
    if (h.includes("outlet") && h.includes("code")) return "outlet_code";
    if (h.includes("item") && h.includes("code")) return "item_code";
    if (h.includes("desc") && !h.includes("sub_desc")) return "description";
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
  outlet, sheetId, zones, isSupervisor, assignedTruck, onDeliveryUpdate, onOverride, onOverrideItem, selectedDate,
}: {
  outlet: OutletGroup; sheetId: string; zones: Zone[]; isSupervisor: boolean;
  assignedTruck?: { vehicle: any; driver: any } | null;
  onDeliveryUpdate: (item: DispatchItem) => void;
  onOverride: (outlet: OutletGroup) => void;
  onOverrideItem: (item: DispatchItem) => void;
  selectedDate: string;
}) {
  const { user } = useAuth();
  const isDriver = user?.role === "driver" || user?.role?.toLowerCase().includes("driver");
  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");
  const isFuture = selectedDate > format(new Date(), "yyyy-MM-dd");
  const [expanded, setExpanded] = useState(true);
  const delivered = outlet.items.filter(i => i.delivery?.status === "delivered").length;
  const total = outlet.items.length;
  const allDone = delivered === total && total > 0;
  const anyPartial = outlet.items.some(i => i.delivery?.status === "partial" || i.delivery?.status === "damaged");
  const isOutletComplete = total > 0 && outlet.items.every(i => (i.delivery?.status || "pending") !== "pending");

  return (
    <div className={`rounded-xl border ${allDone ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" : anyPartial ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : "border-border bg-card"} shadow-sm`}>
      <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${allDone ? "bg-emerald-100" : "bg-primary/10"}`}>
            <MapPin className={`h-4 w-4 ${allDone ? "text-emerald-600" : "text-primary"}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate flex items-center gap-2">
              {outlet.outletName}
              {assignedTruck && (
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-primary/20 shadow-sm">
                  <Truck className="h-3 w-3" />
                  {assignedTruck.vehicle?.plateNumber || assignedTruck.vehicle?.name || "Truck"}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-muted-foreground">{outlet.outletCode}</p>
              {Array.from(new Set(outlet.items.map((i: any) => i.storageType).filter(Boolean))).map((st: any) => (
                <Badge key={st} variant="outline" className="text-[9px] h-4 px-1 bg-slate-50">{st}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {outlet.isOverridden && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">Override</Badge>
          )}
          <Badge variant="outline" className="text-xs">{delivered}/{total}</Badge>
          {isSupervisor && !isOutletComplete && (
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
}: {
  zone: ZoneGroup; sheetId: string; zones: Zone[]; isSupervisor: boolean;
  onDeliveryUpdate: (item: DispatchItem) => void;
  onOverride: (outlet: OutletGroup) => void;
  onOverrideItem: (item: DispatchItem) => void;
  selectedDate: string;
}) {
  const totalItems = zone.outlets.reduce((s, o) => s + o.items.length, 0);
  const deliveredItems = zone.outlets.reduce((s, o) => s + o.items.filter(i => i.delivery?.status === "delivered").length, 0);
  const completionPercentage = totalItems > 0 ? Math.round((deliveredItems / totalItems) * 100) : 0;
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
            {deliveredItems}/{totalItems} ({completionPercentage}%)
          </Badge>
        </div>
        {totalItems > 0 && (
          <div className="mb-3 space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>Delivery Completion</span>
              <span className="font-semibold text-primary">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-1.5 bg-slate-100 dark:bg-slate-800" />
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
                      <span className="truncate max-w-[100px]" title={t.vehicle?.name}>{t.vehicle?.name || 'Unknown Truck'}</span>
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
            {zone.drivers && zone.drivers.map(d => (
              <div key={`driver-${d.id}`} className="bg-background rounded-md p-2 text-xs border shadow-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate font-medium">{d.name} <span className="font-normal">(Zone Driver)</span></span>
                </div>
              </div>
            ))}
          </div>
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
                onOverrideItem={onOverrideItem}
                selectedDate={selectedDate}
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

  const [csvPreview, setCsvPreview] = useState<Record<string, string>[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadDate, setUploadDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isDragging, setIsDragging] = useState(false);
  const [deliveryDialog, setDeliveryDialog] = useState<DispatchItem | null>(null);
  const [overrideDialog, setOverrideDialog] = useState<OutletGroup | null>(null);
  const [itemOverrideDialog, setItemOverrideDialog] = useState<DispatchItem | null>(null);
  const [driverZoneForm, setDriverZoneForm] = useState({ driverId: "", zoneId: "" });
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);

  const [boardRouteFilter, setBoardRouteFilter] = useState("all");
  const [boardOutletFilter, setBoardOutletFilter] = useState("all");
  const [boardDriverFilter, setBoardDriverFilter] = useState("all");
  const [boardTruckFilter, setBoardTruckFilter] = useState("all");
  const [boardStatusFilter, setBoardStatusFilter] = useState("all");

  // Queries
  const { data: sheets = [] } = useQuery<DispatchSheet[]>({ queryKey: ["/api/dispatch/sheets"] });
  const { data: zones = [] } = useQuery<any[]>({ queryKey: ["/api/routes"] });
  const { data: drivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: driverZones = [] } = useQuery<any[]>({ queryKey: ["/api/dispatch/driver-zones"] });

  // Sync boardSheetId with sheets matching the selectedDate automatically
  useEffect(() => {
    if (sheets && sheets.length > 0) {
      const sheet = sheets.find(s => s.date === selectedDate);
      if (sheet) {
        setBoardSheetId(sheet.id);
      } else {
        setBoardSheetId(null);
      }
    }
  }, [selectedDate, sheets]);

  const { data: boardData, isLoading: boardLoading, refetch: refetchBoard } = useQuery<BoardData>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`],
    enabled: !!boardSheetId,
    refetchInterval: 5000,
  });

  const stats = useMemo(() => {
    if (!boardData) return { totalOutlets: 0, pendingOutlets: 0, partiallyDelivered: 0, totalQtyAssigned: 0, completedQty: 0, pendingQty: 0 };
    
    let totalOutletsSet = new Set<string>();
    let pendingOutletsSet = new Set<string>();
    let partialOutletsSet = new Set<string>();
    
    let totalQtyAssigned = 0;
    let completedQty = 0;
    let pendingQty = 0;

    boardData.zones.forEach(z => {
      z.outlets.forEach(o => {
        const outletKey = o.outletId || o.outletCode;
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
      pendingQty
    };
  }, [boardData]);

  const { data: reportData, isLoading: reportLoading } = useQuery<{ items: any[]; routeMap: Record<string, string> }>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/report`],
    enabled: !!boardSheetId && activeTab === "item-summary",
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { date: string; fileName: string; items: any[]; mergeStrategy?: "skip" | "replace" | "overwrite" }) =>
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

  const itemOverrideMutation = useMutation({
    mutationFn: (data: { itemId: string, overrideRouteId: string }) => apiRequest("PUT", `/api/dispatch/items/${data.itemId}/override`, { overrideRouteId: data.overrideRouteId }),
    onSuccess: () => {
      toast({ title: "Item moved successfully!" });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      setItemOverrideDialog(null);
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
            const normalize = (h: string) => {
              const lower = h.toLowerCase().replace(/\s+/g, "_");
              if (lower.includes("outlet") && lower.includes("code")) return "outlet_code";
              if (lower.includes("item") && lower.includes("code")) return "item_code";
              if (lower.includes("desc") && !lower.includes("sub_desc")) return "description";
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

      // Filter out total/summary rows and invalid lines
      const filteredParsed = parsed.filter(row => {
        const outletCode = row.to_sub_code || row.outlet_code || row.outletCode || "";
        const itemCode = row.item_number || row.item_code || row.itemCode || "";
        
        if (!outletCode.trim() || !itemCode.trim()) return false;
        
        const lowerOutletCode = outletCode.toLowerCase();
        if (lowerOutletCode.includes("total") || lowerOutletCode.includes("summary") || lowerOutletCode.includes("count")) return false;

        const qtyVal = row.fus_requested_qty || row.weight || row.requestedQty || row.qty || "0";
        const parsedQty = parseFloat(qtyVal);
        if (isNaN(parsedQty) || parsedQty <= 0) return false;

        return true;
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
    
    const existingSheet = sheets.find(s => s.date === uploadDate);
    if (existingSheet) {
      setMergeConfirmOpen(true);
      return;
    }

    uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview, mergeStrategy: "overwrite" });
  };

  // Find sheet for selected date on board
  const sheetForDate = sheets.find(s => s.date === selectedDate);

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

          {boardData && (
            <>
              {/* Supervisor Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 px-6 py-4 bg-slate-50 border-b">
                <Card className={`bg-white border shadow-sm cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'all' ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
                  onClick={() => setBoardStatusFilter("all")}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="mt-1">
                      <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalOutlets}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Total Outlets</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'pending' ? 'ring-2 ring-amber-500/30 border-amber-500' : ''}`}
                  onClick={() => setBoardStatusFilter("pending")}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                      <Hourglass className="h-5 w-5" />
                    </div>
                    <div className="mt-1">
                      <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.pendingOutlets}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Pending Outlets</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-blue-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'partial' ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
                  onClick={() => setBoardStatusFilter("partial")}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="mt-1">
                      <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.partiallyDelivered}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Partially Delivered</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-indigo-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'all' ? 'ring-2 ring-indigo-500/30 border-indigo-500' : ''}`}
                  onClick={() => setBoardStatusFilter("all")}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="mt-1">
                      <p className="text-2xl font-bold tracking-tight text-slate-900">
                        {stats.totalQtyAssigned % 1 === 0 ? stats.totalQtyAssigned.toFixed(0) : stats.totalQtyAssigned.toFixed(1)}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Total Qty Assigned</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-emerald-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'delivered' ? 'ring-2 ring-emerald-500/30 border-emerald-500' : ''}`}
                  onClick={() => setBoardStatusFilter("delivered")}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="mt-1">
                      <p className="text-2xl font-bold tracking-tight text-slate-900">
                        {stats.completedQty % 1 === 0 ? stats.completedQty.toFixed(0) : stats.completedQty.toFixed(1)}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Completed Qty</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`bg-white border shadow-sm border-t-2 border-t-red-500 cursor-pointer hover:shadow-md transition-all ${boardStatusFilter === 'pending' ? 'ring-2 ring-red-500/30 border-red-500' : ''}`}
                  onClick={() => setBoardStatusFilter("pending")}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="h-9 w-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="mt-1">
                      <p className="text-2xl font-bold tracking-tight text-slate-900 text-red-600">
                        {stats.pendingQty % 1 === 0 ? stats.pendingQty.toFixed(0) : stats.pendingQty.toFixed(1)}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Pending Qty</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="px-6 py-2 border-b bg-muted/20 flex items-center gap-3 flex-wrap">
              <Select value={boardOutletFilter} onValueChange={setBoardOutletFilter}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="All Outlets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {(() => {
                    const outlets = new Map<string, string>();
                    boardData.zones.forEach(z => z.outlets.forEach(o => {
                      const id = o.outletId || o.outletCode;
                      if (id) {
                        outlets.set(id, `${o.outletName || "Unnamed"} (${o.outletCode || "No Code"})`);
                      }
                    }));
                    return Array.from(outlets.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              
              <Select value={boardRouteFilter} onValueChange={setBoardRouteFilter}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="All Routes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  {(() => {
                    const routes = new Map<string, string>();
                    boardData.zones.forEach(z => { if (z.zoneId !== "unassigned") routes.set(z.zoneId, z.zoneName); });
                    return Array.from(routes.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              
              <Select value={boardDriverFilter} onValueChange={setBoardDriverFilter}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="All Drivers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {(() => {
                    const driversMap = new Map<string, string>();
                    boardData.zones.forEach(z => {
                      z.trucks?.forEach(t => { if (t.driver) driversMap.set(t.driver.id, t.driver.name); });
                      z.drivers?.forEach(d => { if (d) driversMap.set(d.id, d.name); });
                    });
                    return Array.from(driversMap.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              
              <Select value={boardTruckFilter} onValueChange={setBoardTruckFilter}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="All Trucks" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trucks</SelectItem>
                  {(() => {
                    const trucksMap = new Map<string, string>();
                    boardData.zones.forEach(z => z.trucks?.forEach(t => { if (t.vehicle) trucksMap.set(t.vehicle.id, t.vehicle.plateNumber || t.vehicle.name); }));
                    return Array.from(trucksMap.entries()).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
              
              <Select value={boardStatusFilter} onValueChange={setBoardStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial Delivered</SelectItem>
                  <SelectItem value="delivered">Completed</SelectItem>
                </SelectContent>
              </Select>
              
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
            <div className="flex-1 overflow-auto p-4 min-h-0">
              <div className="flex gap-4 min-w-max pb-4">
                {(() => {
                  const filteredZones = boardData.zones.map(zone => {
                    if (boardRouteFilter !== "all" && zone.zoneId !== boardRouteFilter) return null;

                    const filteredOutlets = zone.outlets.map(outlet => {
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

                    if (filteredOutlets.length === 0 && (boardOutletFilter !== "all" || boardDriverFilter !== "all" || boardTruckFilter !== "all" || boardStatusFilter !== "all")) {
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
                        selectedDate={selectedDate}
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
            <PivotSummaryTab boardData={boardData} />
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
                  const qty = Number(item.requestedQty || item.weight || 0);
                  itemGroups[key].totalQty += qty;
                  grandTotal += qty;
                });

                const sortedItems = Object.values(itemGroups).sort((a, b) => a.itemCode.localeCompare(b.itemCode));

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
                        {sortedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 break-inside-avoid">
                            <td className="py-1.5 px-3 border-r text-slate-600 font-medium">{item.itemCode}</td>
                            <td className="py-1.5 px-3 border-r text-slate-600">{item.description}</td>
                            <td className="py-1.5 px-3 border-r text-slate-600 text-center">{item.uom}</td>
                            <td className="py-1.5 px-3 border-r text-slate-600 text-center">{item.fromOrg}</td>
                            <td className="py-1.5 px-3 border-r text-slate-600">{item.storageType}</td>
                            <td className="py-1.5 px-3 text-right font-medium text-slate-900">{item.totalQty}</td>
                          </tr>
                        ))}
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
          <CompletedDeliveriesTab selectedDate={selectedDate} />
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
              uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview!, mergeStrategy: "skip" });
              setMergeConfirmOpen(false);
            }}>
              <p className="font-medium text-sm text-primary">Skip Duplicates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ignore items that are already in the system. Only add new items.</p>
            </div>
            <div className="border rounded-lg p-3 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors" onClick={() => {
              uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview!, mergeStrategy: "replace" });
              setMergeConfirmOpen(false);
            }}>
              <p className="font-medium text-sm text-primary">Replace Duplicates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Update quantities for existing items, and add new items.</p>
            </div>
            <div className="border rounded-lg p-3 cursor-pointer hover:border-destructive hover:bg-destructive/10 transition-colors" onClick={() => {
              uploadMutation.mutate({ date: uploadDate, fileName: csvFileName, items: csvPreview!, mergeStrategy: "overwrite" });
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
          targetName={overrideDialog.outletCode}
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
    </div>
  );
}

// ===== PIVOT SUMMARY TAB =====
function PivotSummaryTab({ boardData }: { boardData: BoardData }) {
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  const toggleRoute = (id: string) => setExpandedRoutes(prev => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  const toggleOutlet = (id: string) => setExpandedOutlets(prev => ({ ...prev, [id]: !prev[id] }));

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
            {boardData.zones.map(zone => {
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
                    const isOutletExpanded = !!expandedOutlets[outletId]; // Default false

                    return (
                      <React.Fragment key={outletId}>
                        <tr className="hover:bg-slate-50 cursor-pointer text-slate-700" onClick={() => toggleOutlet(outletId)}>
                          <td className="py-1.5 px-3 border-r"></td>
                          <td className="py-1.5 px-3 border-r flex items-center gap-1.5 font-medium pl-6">
                            {isOutletExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                            {outlet.outletName}
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
  const [truckForm, setTruckForm] = useState({ truckId: "", driverId: "", zoneId: "" });
  const [editAssignment, setEditAssignment] = useState<{ open: boolean; id: string; truckId: string; driverId: string } | null>(null);
  const [expandedStorageTypes, setExpandedStorageTypes] = useState<Record<string, boolean>>({});
  const [planningTab, setPlanningTab] = useState("unassigned");

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
      setTruckForm({ truckId: "", driverId: "", zoneId: "" });
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
    mutationFn: (data: { id: string; truckId: string; driverId: string | null }) =>
      apiRequest("PATCH", `/api/dispatch/truck-assignments/${data.id}`, { truckId: data.truckId, driverId: data.driverId }),
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
        return sum + parseFloat(item.weight || item.totalDelivered || "0");
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                          // Show vehicles assigned to selected zone, or all available if none are zone-matched
                          return v.currentZoneId === truckForm.zoneId || v.status === "available";
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
                            <SelectItem key={v.id} value={v.id} disabled={isAssigned}>
                              {isZoneMatch ? "✓ " : ""}{v.plateNumber} — {v.name} ({v.capacity || "?"} T{v.storageType ? ` - ${v.storageType}` : ""})
                              {isAssigned ? " (Already in sheet)" : !isZoneMatch ? " (Other Zone)" : ""}
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
                          <SelectItem key={d.id} value={d.id} disabled={isAssigned}>
                            {d.name} {isAssigned ? "(Assigned)" : ""}
                          </SelectItem>
                        );
                      })}
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
                  <CardHeader className="bg-gradient-to-r from-primary/8 to-transparent pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-primary" />
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
                          const used = parseFloat(ta.usedCapacity || "0");
                          const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
                          const isOver = used > cap && cap > 0;
                          
                          const taAssignments = outletAssignments.filter((oa: any) => oa.truckAssignmentId === ta.id);
                          const taOutletCount = new Set(taAssignments.map((oa: any) => oa.outletCode)).size;
                          const taItemCount = taAssignments.reduce((sum, oa) => {
                            if (oa.itemIds && Array.isArray(oa.itemIds)) return sum + oa.itemIds.length;
                            const outlet = boardData?.zones?.flatMap((z: any) => z.outlets).find((o: any) => o.outletCode === oa.outletCode);
                            if (!outlet) return sum;
                            if (oa.storageType) {
                              return sum + outlet.items.filter((i: any) => i.storageType === oa.storageType).length;
                            }
                            return sum + outlet.items.length;
                          }, 0);

                          return (
                            <div key={ta.id} className={`rounded-lg border p-2 text-xs min-w-[140px] shadow-sm ${isOver ? "border-red-400 bg-red-50/50" : "border-border bg-background"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1 font-semibold">
                                  <Truck className="h-3 w-3 text-primary" />
                                  <span className="truncate max-w-[80px]" title={veh?.plateNumber}>{veh?.plateNumber || "Truck"}</span>
                                </div>
                                <div className="flex items-center">
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-primary mr-1"
                                    onClick={() => setEditAssignment({ open: true, id: ta.id, truckId: ta.truckId, driverId: ta.driverId || "" })}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                                    onClick={() => removeTruckMutation.mutate(ta.id)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {cap > 0 && (
                                <>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                                    <div
                                      className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <p className={`text-[10px] flex items-center gap-1 mt-1 ${isOver ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                                    {isOver && <AlertTriangle className="h-3 w-3" />}
                                    {used.toFixed(2)}T / {cap.toFixed(0)}T ({pct.toFixed(0)}%)
                                    {isOver && " — Warning: Overweight"}
                                  </p>
                                </>
                              )}
                              <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                <User className="h-2.5 w-2.5" />{getDriverName(ta.driverId)}
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
                  <CardContent className="p-0">
                    {outletRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No outlets in this zone's dispatch sheet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="pl-4">Outlet</TableHead>
                            <TableHead className="text-right">Total Weight</TableHead>
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
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={`font-mono text-sm font-semibold ${outletWeightT > 10 ? "text-amber-600" : "text-foreground"}`}>
                                      {outletWeightT.toFixed(3)} T
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right pr-4">
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
                                      <Select
                                        onValueChange={(truckAssignId) => {
                                          if (!truckAssignId) return;
                                          const truck = truckAssignments.find((t: any) => t.id === truckAssignId);
                                          const veh = getVehicleInfo(truck?.truckId);
                                          const cap = parseFloat(veh?.capacity || "0");
                                          const used = parseFloat(truck?.usedCapacity || "0");
                                          if (cap > 0 && used + outletWeightT > cap) {
                                            toast({
                                              title: `⚠️ Capacity exceeded! Adding ${outlet.outletCode} (${outletWeightT.toFixed(2)}T) would exceed ${veh?.plateNumber}'s limit of ${cap}T. Current load: ${used.toFixed(2)}T.`,
                                              variant: "destructive"
                                            });
                                            return;
                                          }
                                          assignOutletMutation.mutate({
                                            outletCode: outlet.outletCode,
                                            truckAssignmentId: truckAssignId,
                                            outletWeight: outletWeightT.toFixed(3),
                                            sheetId: boardSheetId!,
                                          } as any);
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-36 border-dashed">
                                          <SelectValue placeholder="Assign all →" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {truckAssignments.map((ta: any) => {
                                            const veh = getVehicleInfo(ta.truckId);
                                            const zoneName = getZoneName(ta.zoneId);
                                            const cap = parseFloat(veh?.capacity || "0");
                                            const used = parseFloat(ta.usedCapacity || "0");
                                            const remaining = cap > 0 ? cap - used : null;
                                            const wouldOverflow = cap > 0 && used + outletWeightT > cap;
                                            return (
                                              <SelectItem key={ta.id} value={ta.id} className={wouldOverflow ? "text-red-500" : ""}>
                                                {zoneName} - {veh?.name || "Truck"} ({veh?.plateNumber || "N/A"})
                                                {remaining !== null ? ` - ${remaining.toFixed(1)}T free${wouldOverflow ? " ⚠" : ""}` : ""}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </TableCell>
                                </TableRow>

                                {/* Per-Storage Type Assignment Rows */}
                                {!assignedTruck && storageTypes.length > 0 && storageTypes.map((st: string) => {
                                  // Calculate total weight of items for this storage type
                                  const stItems = outlet.items.filter((i: any) => i.storageType === st);
                                  const isStCompleted = stItems.length > 0 && stItems.every((i: any) => ["delivered", "damaged"].includes(i.delivery?.status));
                                  const stWeightT = stItems.reduce((sum: number, item: any) => {
                                    const qty = parseFloat(item.quantity) || 0;
                                    const unitWeight = parseFloat(item.itemWeightKg) || 0;
                                    return sum + ((qty * unitWeight) / 1000);
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
                                          {stWeightT.toFixed(3)} T
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
                                                {stAssignedVeh?.plateNumber || "Truck"}
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
                                            <div onClick={e => e.stopPropagation()}>
                                              <Select
                                                onValueChange={(truckAssignId) => {
                                                  if (!truckAssignId) return;
                                                  const truck = truckAssignments.find((t: any) => t.id === truckAssignId);
                                                  const veh = getVehicleInfo(truck?.truckId);
                                                  const cap = parseFloat(veh?.capacity || "0");
                                                  const used = parseFloat(truck?.usedCapacity || "0");
                                                  if (cap > 0 && used + stWeightT > cap) {
                                                    toast({
                                                      title: `⚠️ Capacity exceeded for ${st} items!`,
                                                      variant: "destructive"
                                                    });
                                                    return;
                                                  }
                                                  assignOutletMutation.mutate({
                                                    outletCode: outlet.outletCode,
                                                    truckAssignmentId: truckAssignId,
                                                    outletWeight: stWeightT.toFixed(3),
                                                    sheetId: boardSheetId!,
                                                    storageType: st
                                                  } as any);
                                                }}
                                              >
                                                <SelectTrigger className="h-6 text-[10px] w-32 border-dashed ml-auto bg-transparent">
                                                  <SelectValue placeholder={`Assign ${st} →`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {truckAssignments.map((ta: any) => {
                                                    const veh = getVehicleInfo(ta.truckId);
                                                    const zoneName = getZoneName(ta.zoneId);
                                                    const cap = parseFloat(veh?.capacity || "0");
                                                    const used = parseFloat(ta.usedCapacity || "0");
                                                    const remaining = cap > 0 ? cap - used : null;
                                                    const wouldOverflow = cap > 0 && used + stWeightT > cap;
                                                    return (
                                                      <SelectItem key={ta.id} value={ta.id} className={`text-xs ${wouldOverflow ? "text-red-500" : ""}`}>
                                                        {zoneName} - {veh?.name || "Truck"} ({veh?.plateNumber || "N/A"})
                                                        {remaining !== null ? ` - ${remaining.toFixed(1)}T free` : ""}
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
                                        const iQty = parseFloat(item.quantity) || parseFloat(item.requestedQty) || 0;
                                        const iWeight = parseFloat(item.itemWeightKg || item.weight || "0");
                                        const totalIWeight = (iQty * iWeight) / 1000;
                                        
                                        return (
                                          <TableRow key={item.id || itemIdx} className="bg-muted/10 border-t-0">
                                            <TableCell className="pl-16 py-1.5 text-[10px] text-muted-foreground/80 border-t-0">
                                              {item.itemCode} - {item.description}
                                            </TableCell>
                                            <TableCell className="text-right text-[10px] font-mono text-muted-foreground/80 border-t-0 py-1.5">
                                              {totalIWeight.toFixed(3)} T
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
                </Card>
              ))}
            </div>
          )}
        </>
      )}

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
                        <SelectItem key={d.id} value={d.id} disabled={isAssignedToOther}>
                          {d.name} {isAssignedToOther ? "(Assigned)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditAssignment(null)}>Cancel</Button>
                <Button
                  onClick={() => updateTruckAssignmentMutation.mutate({
                    id: editAssignment.id,
                    truckId: editAssignment.truckId,
                    driverId: editAssignment.driverId || null
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
            <div className="bg-white border-t overflow-hidden text-sm rounded-b-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/80 border-b">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r w-64">Route / Outlet</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Date</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Item Code</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Description</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 border-r">Assigned To</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-right w-20">Req Qty</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-right w-20">Remaining</th>
                    <th className="py-2 px-3 font-semibold text-slate-700 w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groupedData.map(zone => {
                    const isRouteExpanded = expandedRoutes[zone.zoneName] !== false; // Default true
                    
                    return (
                      <React.Fragment key={zone.zoneName}>
                        <tr className="bg-slate-100/60 hover:bg-slate-100 cursor-pointer font-semibold text-slate-800" onClick={() => toggleRoute(zone.zoneName)}>
                          <td className="py-2 px-3 border-r flex items-center gap-1.5" colSpan={8}>
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
                                <td className="py-1.5 px-3 border-r flex items-center gap-1.5 font-medium pl-6 bg-slate-50/50" colSpan={8}>
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
                                    <td className="py-1.5 px-3 text-xs">
                                      <StatusBadge status={p.status || "pending"} />
                                    </td>
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
function CompletedDeliveriesTab({ selectedDate }: { selectedDate?: string }) {
  const [startDate, setStartDate] = useState(selectedDate || format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(selectedDate || format(new Date(), "yyyy-MM-dd"));

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
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const revertMutation = useMutation({
    mutationFn: async (dispatchItemId: string) => {
      return apiRequest("PATCH", `/api/dispatch/items/${dispatchItemId}/delivery`, {
        status: "pending",
        deliveredQty: "0",
        remainingQty: "0",
        remark: "Reverted by admin",
        podUrl: ""
      });
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
  });

  const groupedData = Array.from(groupedMap.values()).map(r => ({ ...r, outlets: Array.from(r.outlets.values()) }));
  
  const handlePrint = () => window.print();
  
  const handleExport = () => {
    if (!filteredDeliveries.length) return;
    const ws = XLSX.utils.json_to_sheet(filteredDeliveries.map(d => ({
      Date: d.deliveredAt ? format(new Date(d.deliveredAt), "dd/MM/yyyy HH:mm") : "",
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
            <div className="bg-white border-t overflow-hidden text-sm rounded-b-xl">
              <table className="w-full text-left border-collapse">
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
                                          .map((d: any) => format(new Date(d), "dd MMM yyyy, HH:mm"))
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
                                              const url = `/api/reports/delivery-pod-pdf?sheetId=${firstItem.sheetId}&outletId=${firstItem.outletId}&storageType=${firstItem.storageType}&includeAttachments=${includeAttachments}`;
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
                                              const shareUrl = `${window.location.origin}/api/reports/delivery-pod-pdf?sheetId=${firstItem.sheetId}&outletId=${firstItem.outletId}&storageType=${firstItem.storageType}&includeAttachments=${includeAttachments}`;
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
                                      {p.deliveredAt && format(new Date(p.deliveredAt), "dd/MM HH:mm")}
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
                                      <td className="py-1.5 px-3 text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-[10px] px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm("Are you sure you want to revert this delivery to pending?")) {
                                              revertMutation.mutate(p.dispatchItemId);
                                            }
                                          }}
                                          disabled={revertMutation.isPending}
                                        >
                                          Revert
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
              const dateStr = pod.date ? format(new Date(pod.date), "dd MMM yyyy, HH:mm") : "Unknown Date";
              
              return (
                <div key={idx} className="border rounded-md overflow-hidden bg-slate-50 flex flex-col min-h-[300px]">
                  <div className="p-2 bg-slate-100 border-b text-xs font-medium text-slate-600 text-center flex items-center justify-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Delivered At: {dateStr}
                  </div>
                  <div className="flex-1 flex items-center justify-center p-2">
                    {url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.startsWith("data:image") ? (
                      <img src={srcUrl} alt={`POD ${idx + 1}`} className="w-full h-auto object-contain max-h-[400px]" />
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
