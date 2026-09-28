import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Truck, Package, CheckCircle2, Clock, Hourglass, Search, Printer,
  Download, RefreshCw, Calendar, Boxes, ChevronDown, ChevronRight,
  Filter, AlertTriangle, ArrowRight, RotateCcw, ShieldCheck, Check
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportLoadingMonitorExcel } from "@/lib/customer-excel-export";

interface LoadingMonitorTabProps {
  boardSheetId: string | null;
  sheetForDate: any;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  boardData: any;
  boardLoading: boolean;
  refetchBoard: () => void;
  clientOptions?: any[];
  boardClientId?: string;
  setBoardClientId?: (id: string) => void;
}

export default function LoadingMonitorTab({
  boardSheetId,
  sheetForDate,
  selectedDate,
  setSelectedDate,
  boardData,
  boardLoading,
  refetchBoard,
  clientOptions = [],
  boardClientId = "all",
  setBoardClientId,
}: LoadingMonitorTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [storageFilter, setStorageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_only" | "fully_loaded">("all");
  const [deductCriteria, setDeductCriteria] = useState<"departed" | "loaded_or_departed">("departed");
  const [viewMode, setViewMode] = useState<"sku" | "truck">("sku");
  const [expandedSkus, setExpandedSkus] = useState<Record<string, boolean>>({});
  const [expandedTrucks, setExpandedTrucks] = useState<Record<string, boolean>>({});

  // Fetch truck assignments and outlet assignments for the sheet
  const { data: truckData, refetch: refetchTrucks, isLoading: trucksLoading } = useQuery<any>({
    queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`],
    enabled: !!boardSheetId,
  });

  // Quick Truck Departure Mutation
  const updateTruckTimingMutation = useMutation({
    mutationFn: async ({ truckAssignmentId, departTime, loadingStatus }: { truckAssignmentId: string; departTime?: string; loadingStatus?: string }) => {
      const formattedNow = format(new Date(), "hh:mm a");
      return apiRequest("PATCH", `/api/dispatch/trucks/${truckAssignmentId}/timing`, {
        departTime: departTime || formattedNow,
        loadingStatus: loadingStatus || "dispatched",
      });
    },
    onSuccess: () => {
      toast({ title: "Truck departure recorded! Pending quantities deducted." });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      refetchBoard();
      refetchTrucks();
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to update truck departure", variant: "destructive" }),
  });

  // Revert Truck Departure Mutation
  const revertTruckDepartureMutation = useMutation({
    mutationFn: async ({ truckAssignmentId }: { truckAssignmentId: string }) => {
      return apiRequest("PATCH", `/api/dispatch/trucks/${truckAssignmentId}/timing`, {
        departTime: "",
        loadingStatus: "pending",
      });
    },
    onSuccess: () => {
      toast({ title: "Truck departure reverted to pending." });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/trucks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/dispatch/sheets/${boardSheetId}/board`] });
      refetchBoard();
      refetchTrucks();
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to revert truck departure", variant: "destructive" }),
  });

  const isTruckDeparted = (t: any) => {
    if (!t) return false;
    if (t.isAutoDeparted) return true;
    const s = (t.loadingStatus || "").toLowerCase();
    if (["dispatched", "departed", "in_transit", "completed"].includes(s)) return true;
    if (t.departTime && t.departTime.trim() !== "" && t.departTime !== "-") return true;
    return false;
  };

  const isTruckLoaded = (t: any) => {
    if (!t) return false;
    if (isTruckDeparted(t)) return true;
    const s = (t.loadingStatus || "").toLowerCase();
    if (s === "loaded") return true;
    if (t.loadingEndTime && t.loadingEndTime.trim() !== "" && t.loadingEndTime !== "-") return true;
    return false;
  };

  const isTruckLoading = (t: any) => {
    if (!t) return false;
    if (isTruckLoaded(t) || isTruckDeparted(t)) return false;
    const s = (t.loadingStatus || "").toLowerCase();
    return s === "loading";
  };

  const toggleSkuExpand = (skuKey: string) => {
    setExpandedSkus(prev => ({ ...prev, [skuKey]: !prev[skuKey] }));
  };

  const toggleTruckExpand = (truckId: string) => {
    setExpandedTrucks(prev => ({ ...prev, [truckId]: !prev[truckId] }));
  };

  const expandAllSkus = () => {
    const next: Record<string, boolean> = {};
    skuList.forEach(s => { next[`${s.skuCode}__${s.storageType}`] = true; });
    setExpandedSkus(next);
  };

  const collapseAllSkus = () => {
    setExpandedSkus({});
  };

  // Main aggregation
  const {
    skuList,
    truckList,
    globalTotals,
    storageCounts,
  } = useMemo(() => {
    if (!boardData || !boardData.zones) {
      return {
        skuList: [],
        truckList: [],
        globalTotals: { totalQty: 0, loadedQty: 0, balanceQty: 0, progressPct: 0, totalTrucks: 0, departedTrucks: 0, loadingTrucks: 0, pendingTrucks: 0, totalSkus: 0, pendingSkusCount: 0 },
        storageCounts: { DRY: 0, CHILLED: 0, FROZEN: 0, AMBIENT: 0 },
      };
    }

    // 1. Build truck map
    const truckMap = new Map<string, any>();
    const allTrucksList: any[] = [];
    const seenTruckIds = new Set<string>();

    (truckData?.trucks || []).forEach((t: any) => {
      truckMap.set(t.id, t);
      if (!seenTruckIds.has(t.id)) {
        seenTruckIds.add(t.id);
        allTrucksList.push(t);
      }
    });

    boardData.zones.forEach((z: any) => {
      (z.trucks || []).forEach((t: any) => {
        if (!truckMap.has(t.id)) {
          truckMap.set(t.id, t);
        } else {
          const existing = truckMap.get(t.id);
          truckMap.set(t.id, {
            ...existing,
            ...t,
            vehicle: t.vehicle || existing.vehicle,
            driver: t.driver || existing.driver,
            tripNumber: t.tripNumber || existing.tripNumber || 1
          });
        }
        if (!seenTruckIds.has(t.id)) {
          seenTruckIds.add(t.id);
          allTrucksList.push(t);
        }
      });
    });

    // 2. Build outlet truck map
    const outletTruckMap = new Map<string, string>();
    (truckData?.outletAssignments || []).forEach((oa: any) => {
      if (oa.outletCode) {
        if (oa.storageType) {
          outletTruckMap.set(`${oa.outletCode}_${oa.storageType.toUpperCase()}`, oa.truckAssignmentId);
        }
        outletTruckMap.set(oa.outletCode, oa.truckAssignmentId);
      }
    });

    // 3. Process all items
    const skuMap = new Map<string, any>();
    const truckItemsMap = new Map<string, any[]>();
    const counts = { DRY: 0, CHILLED: 0, FROZEN: 0, AMBIENT: 0 };

    let globalTotalQty = 0;
    let globalLoadedQty = 0;

    boardData.zones.forEach((zone: any) => {
      (zone.outlets || []).forEach((outlet: any) => {
        (outlet.items || []).forEach((item: any) => {
          const rawStorage = (item.storageType || "DRY").toUpperCase();
          const stType = rawStorage.includes("CHILL") ? "CHILLED" : rawStorage.includes("FROZ") ? "FROZEN" : rawStorage.includes("AMB") ? "AMBIENT" : "DRY";
          counts[stType] = (counts[stType] || 0) + 1;

          const qty = Number(item.requestedQty || item.weight || 0);
          globalTotalQty += qty;

          // Find assigned truck
          const directTruckId = item.truckAssignmentId;
          const storageTruckId = outletTruckMap.get(`${outlet.outletCode}_${stType}`);
          const outletTruckId = outlet.truckAssignmentId || outletTruckMap.get(outlet.outletCode);
          const tAssignId = directTruckId || storageTruckId || outletTruckId || null;

          const truck = tAssignId ? truckMap.get(tAssignId) : null;

          const departed = isTruckDeparted(truck);
          const loaded = isTruckLoaded(truck);
          const loading = isTruckLoading(truck);

          const isDeducted = deductCriteria === "departed" ? departed : loaded;

          if (isDeducted) {
            globalLoadedQty += qty;
          }

          // SKU key
          const skuKey = `${item.itemCode}__${stType}`;
          if (!skuMap.has(skuKey)) {
            skuMap.set(skuKey, {
              skuCode: item.itemCode,
              description: item.description || "",
              storageType: item.storageType || stType,
              uom: item.uom || "CT",
              totalQty: 0,
              loadedQty: 0,
              balanceQty: 0,
              loadingQty: 0,
              allocations: [],
            });
          }

          const skuRecord = skuMap.get(skuKey)!;
          skuRecord.totalQty += qty;
          if (isDeducted) {
            skuRecord.loadedQty += qty;
          } else {
            skuRecord.balanceQty += qty;
          }
          if (loading) {
            skuRecord.loadingQty += qty;
          }

          const truckPlate = truck?.vehicle?.plateNumber || truck?.vehicle?.name || "Unassigned Truck";
          const tripNum = truck?.tripNumber || 1;
          const driverName = truck?.driver?.name || truck?.driver?.username || "Unassigned";

          skuRecord.allocations.push({
            truckAssignmentId: truck?.id || null,
            truckPlate,
            tripNumber: tripNum,
            driverName,
            route: zone.zoneName,
            outletCode: outlet.outletCode,
            outletName: outlet.outletName,
            qty,
            isDeparted: departed,
            isLoaded: loaded,
            isLoading: loading,
            loadingStatus: truck ? (departed ? "dispatched" : loaded ? "loaded" : loading ? "loading" : "pending") : "unassigned",
            departTime: truck?.departTime || null,
            loadingEndTime: truck?.loadingEndTime || null,
          });

          // Populate truckItemsMap
          const truckKey = truck?.id || "unassigned";
          if (!truckItemsMap.has(truckKey)) {
            truckItemsMap.set(truckKey, []);
          }
          truckItemsMap.get(truckKey)!.push({
            skuCode: item.itemCode,
            description: item.description || "",
            storageType: item.storageType || stType,
            uom: item.uom || "CT",
            qty,
            outletCode: outlet.outletCode,
            outletName: outlet.outletName,
            isDeducted,
          });
        });
      });
    });

    const skuList = Array.from(skuMap.values()).map(sku => {
      // Group pending trucks for this SKU
      const pendingAllocations = sku.allocations.filter((a: any) => deductCriteria === "departed" ? !a.isDeparted : !a.isLoaded);
      const pendingTrucksMap = new Map<string, number>();
      pendingAllocations.forEach((a: any) => {
        const key = a.truckAssignmentId ? `${a.truckPlate} (Trip ${a.tripNumber})` : "Unassigned";
        pendingTrucksMap.set(key, (pendingTrucksMap.get(key) || 0) + a.qty);
      });
      const pendingTrucksSummary = Array.from(pendingTrucksMap.entries()).map(([trk, q]) => `${trk}: ${q.toFixed(0)}`).join(", ");

      const allTrucksMap = new Map<string, string>();
      sku.allocations.forEach((a: any) => {
        const key = a.truckAssignmentId ? `${a.truckPlate} (T${a.tripNumber})` : "Unassigned";
        const st = a.isDeparted ? "Departed" : a.isLoaded ? "Loaded" : a.isLoading ? "Loading" : "Pending";
        allTrucksMap.set(key, st);
      });
      const allTrucksSummary = Array.from(allTrucksMap.entries()).map(([k, s]) => `${k} [${s}]`).join(", ");

      const status = sku.balanceQty === 0 ? "FULLY LOADED" : sku.loadedQty > 0 ? "PARTIALLY LOADED" : "PENDING";

      return {
        ...sku,
        totalQty: Math.round(sku.totalQty * 100) / 100,
        loadedQty: Math.round(sku.loadedQty * 100) / 100,
        balanceQty: Math.max(0, Math.round(sku.balanceQty * 100) / 100),
        loadingQty: Math.round(sku.loadingQty * 100) / 100,
        pendingTrucksSummary,
        allTrucksSummary,
        pendingTrucksList: Array.from(pendingTrucksMap.keys()),
        status,
        progressPct: sku.totalQty > 0 ? Math.round((sku.loadedQty / sku.totalQty) * 100) : 0,
      };
    }).sort((a, b) => {
      if (a.balanceQty > 0 && b.balanceQty === 0) return -1;
      if (a.balanceQty === 0 && b.balanceQty > 0) return 1;
      return a.skuCode.localeCompare(b.skuCode);
    });

    // 4. Build truck list
    const truckList = allTrucksList.map((t: any) => {
      const departed = isTruckDeparted(t);
      const loaded = isTruckLoaded(t);
      const loading = isTruckLoading(t);
      const items = truckItemsMap.get(t.id) || [];
      const totalQty = items.reduce((sum: number, it: any) => sum + it.qty, 0);

      // SKU summary on this truck
      const skuSummaryMap = new Map<string, { skuCode: string; description: string; uom: string; qty: number }>();
      items.forEach((it: any) => {
        if (!skuSummaryMap.has(it.skuCode)) {
          skuSummaryMap.set(it.skuCode, { skuCode: it.skuCode, description: it.description, uom: it.uom, qty: 0 });
        }
        skuSummaryMap.get(it.skuCode)!.qty += it.qty;
      });

      return {
        ...t,
        plateNumber: t.vehicle?.plateNumber || t.vehicle?.name || "Truck",
        vehicleName: t.vehicle?.name || "",
        driverName: t.driver?.name || t.driver?.username || "Unassigned",
        tripNumber: t.tripNumber || 1,
        isDeparted: departed,
        isLoaded: loaded,
        isLoading: loading,
        status: departed ? "dispatched" : loaded ? "loaded" : loading ? "loading" : "pending",
        totalQty: Math.round(totalQty * 100) / 100,
        skus: Array.from(skuSummaryMap.values()),
        itemsCount: items.length,
      };
    }).sort((a: any, b: any) => {
      if (a.tripNumber !== b.tripNumber) return a.tripNumber - b.tripNumber;
      return a.plateNumber.localeCompare(b.plateNumber);
    });

    const globalBalanceQty = Math.max(0, globalTotalQty - globalLoadedQty);
    const globalProgressPct = globalTotalQty > 0 ? Math.round((globalLoadedQty / globalTotalQty) * 100) : 0;
    const departedTrucks = truckList.filter((t: any) => t.isDeparted).length;
    const loadingTrucks = truckList.filter((t: any) => t.isLoading).length;
    const pendingTrucks = truckList.filter((t: any) => !t.isDeparted && !t.isLoaded && !t.isLoading).length;
    const pendingSkusCount = skuList.filter(s => s.balanceQty > 0).length;

    return {
      skuList,
      truckList,
      globalTotals: {
        totalQty: Math.round(globalTotalQty * 100) / 100,
        loadedQty: Math.round(globalLoadedQty * 100) / 100,
        balanceQty: Math.round(globalBalanceQty * 100) / 100,
        progressPct: globalProgressPct,
        totalTrucks: truckList.length,
        departedTrucks,
        loadingTrucks,
        pendingTrucks,
        totalSkus: skuList.length,
        pendingSkusCount,
      },
      storageCounts: counts,
    };
  }, [boardData, truckData, deductCriteria]);

  // Filtered SKUs
  const filteredSkus = useMemo(() => {
    return skuList.filter(sku => {
      if (storageFilter !== "all") {
        const raw = (sku.storageType || "").toUpperCase();
        if (storageFilter === "DRY" && !raw.includes("DRY") && !raw.includes("DEFAULT")) return false;
        if (storageFilter === "CHILLED" && !raw.includes("CHILL")) return false;
        if (storageFilter === "FROZEN" && !raw.includes("FROZ")) return false;
        if (storageFilter === "AMBIENT" && !raw.includes("AMB")) return false;
      }
      if (statusFilter === "pending_only" && sku.balanceQty <= 0) return false;
      if (statusFilter === "fully_loaded" && sku.balanceQty > 0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = sku.skuCode.toLowerCase().includes(q);
        const matchesDesc = (sku.description || "").toLowerCase().includes(q);
        const matchesTruck = sku.allocations.some((a: any) =>
          a.truckPlate.toLowerCase().includes(q) ||
          a.driverName.toLowerCase().includes(q) ||
          a.route.toLowerCase().includes(q) ||
          a.outletName.toLowerCase().includes(q)
        );
        if (!matchesCode && !matchesDesc && !matchesTruck) return false;
      }
      return true;
    });
  }, [skuList, storageFilter, statusFilter, searchQuery]);

  // Export Excel
  const handleExportExcel = async () => {
    if (skuList.length === 0) {
      toast({ title: "No SKU loading data to export", variant: "destructive" });
      return;
    }
    const rows = filteredSkus.map(s => ({
      skuCode: s.skuCode,
      description: s.description,
      storageType: s.storageType,
      uom: s.uom,
      totalQty: s.totalQty,
      loadedQty: s.loadedQty,
      balanceQty: s.balanceQty,
      status: s.status,
      pendingTrucks: s.pendingTrucksSummary,
      allTrucks: s.allTrucksSummary,
    }));
    await exportLoadingMonitorExcel(rows, selectedDate);
    toast({ title: `Exported ${rows.length} SKU loading records to Excel!` });
  };

  const handleQuickDepart = (truckAssignmentId: string | null) => {
    if (!truckAssignmentId) {
      toast({ title: "Cannot depart an unassigned truck. Please assign a truck in Truck Planning first.", variant: "destructive" });
      return;
    }
    updateTruckTimingMutation.mutate({ truckAssignmentId });
  };

  const handleRevertDepart = (truckAssignmentId: string | null) => {
    if (!truckAssignmentId) return;
    revertTruckDepartureMutation.mutate({ truckAssignmentId });
  };

  if (!boardSheetId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
        <div className="text-center max-w-md space-y-3">
          <Boxes className="h-12 w-12 text-amber-500 mx-auto opacity-80" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Dispatch Sheet Loaded</h3>
          <p className="text-xs text-muted-foreground">
            Please pick a date with an active dispatch sheet to monitor truck loading and view pending SKU balances.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-40 h-8 text-xs"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/40 dark:bg-background overflow-hidden">
      {/* Top Header Control Toolbar */}
      <div className="px-6 py-3 border-b bg-background flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-36 h-8 text-xs px-2"
            />
          </div>

          {clientOptions.length > 0 && setBoardClientId && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Client:</span>
              <select
                value={boardClientId}
                onChange={e => setBoardClientId(e.target.value)}
                className="h-8 border rounded-md px-2 bg-transparent text-xs w-44 font-medium"
              >
                <option value="all">All Clients</option>
                {clientOptions.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Deduct Criteria Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border text-xs">
            <button
              onClick={() => setDeductCriteria("departed")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                deductCriteria === "departed"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
              title="Deducts quantity from pending as each truck physically departs / leaves"
            >
              🚚 Deduct on Truck Departure (Default)
            </button>
            <button
              onClick={() => setDeductCriteria("loaded_or_departed")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                deductCriteria === "loaded_or_departed"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
              title="Deducts quantity as soon as truck is marked loaded or departed"
            >
              📦 Deduct on Loading Done
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border text-xs">
            <button
              onClick={() => setViewMode("sku")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                viewMode === "sku"
                  ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Boxes className="h-3 w-3" /> SKU Balance View
            </button>
            <button
              onClick={() => setViewMode("truck")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                viewMode === "truck"
                  ? "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-sm font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Truck className="h-3 w-3" /> Trucks & Trips View
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { refetchBoard(); refetchTrucks(); }}
            className="h-8 text-xs gap-1.5"
            disabled={boardLoading || trucksLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${boardLoading || trucksLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-8 text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-800 font-medium"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-3 bg-white dark:bg-card border-b">
        {/* Card 1: Total Dispatch Qty */}
        <Card className="border shadow-none bg-slate-50/60 dark:bg-slate-900/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Scheduled Qty</span>
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600">
              <Package className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {globalTotals.totalQty.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Cartons / Units</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {globalTotals.totalSkus} Distinct SKUs scheduled today
          </p>
        </Card>

        {/* Card 2: Loaded & Departed Qty */}
        <Card className="border shadow-none bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Loaded & Departed</span>
            <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {globalTotals.loadedQty.toLocaleString()}
            </span>
            <Badge variant="outline" className="bg-emerald-100/70 text-emerald-800 border-emerald-300 text-[10px] h-4 px-1.5">
              {globalTotals.progressPct}% Deducted
            </Badge>
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
            Left warehouse on {globalTotals.departedTrucks} departed truck(s)
          </p>
        </Card>

        {/* Card 3: Balance Pending to Load */}
        <Card className={`border shadow-none p-3 transition-colors ${
          globalTotals.balanceQty > 0
            ? "bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
            : "bg-slate-50 dark:bg-slate-900/40"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Boxes className="h-3.5 w-3.5 text-amber-600" />
              Balance Pending to Load
            </span>
            <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
              globalTotals.balanceQty > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
            }`}>
              {globalTotals.balanceQty > 0 ? <Hourglass className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-xl font-bold ${
              globalTotals.balanceQty > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-600"
            }`}>
              {globalTotals.balanceQty.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Cartons / Units</span>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-400 mt-0.5">
            {globalTotals.pendingSkusCount > 0 ? `${globalTotals.pendingSkusCount} SKU(s) waiting for truck completion` : "All SKUs completely loaded!"}
          </p>
        </Card>

        {/* Card 4: Truck Departure Progress */}
        <Card className="border shadow-none bg-sky-50/40 dark:bg-sky-950/20 border-sky-200/60 dark:border-sky-900/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-800 dark:text-sky-300 uppercase tracking-wider">Trucks & Trips</span>
            <div className="h-7 w-7 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600">
              <Truck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-sky-900 dark:text-sky-200">
              {globalTotals.departedTrucks} / {globalTotals.totalTrucks}
            </span>
            <span className="text-[11px] text-sky-700 font-medium">
              {globalTotals.totalTrucks > 0 ? `${Math.round((globalTotals.departedTrucks / globalTotals.totalTrucks) * 100)}% Departed` : "0 Trucks"}
            </span>
          </div>
          <div className="mt-2">
            <Progress
              value={globalTotals.totalTrucks > 0 ? (globalTotals.departedTrucks / globalTotals.totalTrucks) * 100 : 0}
              className="h-1.5 bg-sky-100 dark:bg-sky-950"
            />
          </div>
          <p className="text-[10px] text-sky-700/80 dark:text-sky-400 mt-1">
            {globalTotals.loadingTrucks} loading on dock · {globalTotals.pendingTrucks} pending
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-2.5 border-b bg-background flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search box */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search SKU code, description, truck, route..."
              className="pl-8 h-8 text-xs bg-slate-50/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground">
                ×
              </button>
            )}
          </div>

          {/* Storage Type Filter Pills */}
          <div className="flex items-center gap-1 border-l pl-2 text-xs">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1">Storage:</span>
            {[
              { id: "all", label: "All" },
              { id: "DRY", label: "Dry", count: storageCounts.DRY },
              { id: "CHILLED", label: "Chilled", count: storageCounts.CHILLED },
              { id: "FROZEN", label: "Frozen", count: storageCounts.FROZEN },
              { id: "AMBIENT", label: "Ambient", count: storageCounts.AMBIENT },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStorageFilter(st.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  storageFilter === st.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {st.label} {st.count !== undefined ? `(${st.count})` : ""}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 border-l pl-2 text-xs">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1">Status:</span>
            {[
              { id: "all", label: "All SKUs" },
              { id: "pending_only", label: `Pending Balance (${globalTotals.pendingSkusCount})` },
              { id: "fully_loaded", label: "Fully Loaded" },
            ].map(sf => (
              <button
                key={sf.id}
                onClick={() => setStatusFilter(sf.id as any)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === sf.id
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "sku" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              onClick={expandAllSkus}
              className="text-[11px] hover:text-foreground font-medium underline-offset-2 hover:underline"
            >
              Expand All
            </button>
            <span>·</span>
            <button
              onClick={collapseAllSkus}
              className="text-[11px] hover:text-foreground font-medium underline-offset-2 hover:underline"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 min-h-0">
        {boardLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Calculating warehouse loading quantities and truck allocations...</p>
          </div>
        ) : filteredSkus.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-2 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No SKUs match the selected filters</p>
            <p className="text-xs text-muted-foreground">Try clearing search terms or changing storage type / status filters.</p>
          </div>
        ) : viewMode === "sku" ? (
          /* SKU-WISE TABLE VIEW */
          <div className="bg-white dark:bg-card border rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-900/60 sticky top-0 z-10 border-b">
                <TableRow className="text-xs">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="min-w-[130px] font-semibold">SKU Code</TableHead>
                  <TableHead className="min-w-[200px] font-semibold">Item Description</TableHead>
                  <TableHead className="w-24 text-center font-semibold">Storage</TableHead>
                  <TableHead className="w-16 text-center font-semibold">UOM</TableHead>
                  <TableHead className="w-28 text-right font-semibold">Planned Qty</TableHead>
                  <TableHead className="w-32 text-right font-semibold">Loaded / Departed</TableHead>
                  <TableHead className="w-36 text-right font-semibold bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                    Pending to Load
                  </TableHead>
                  <TableHead className="min-w-[200px] font-semibold">Pending Trucks & Trips</TableHead>
                  <TableHead className="w-28 text-center font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkus.map((sku, index) => {
                  const skuKey = `${sku.skuCode}__${sku.storageType}`;
                  const isExpanded = !!expandedSkus[skuKey];
                  const hasPendingBalance = sku.balanceQty > 0;

                  return (
                    <React.Fragment key={skuKey}>
                      <TableRow
                        className={`text-xs cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                          hasPendingBalance ? "bg-amber-50/15" : ""
                        }`}
                        onClick={() => toggleSkuExpand(skuKey)}
                      >
                        <TableCell className="text-center text-muted-foreground font-mono text-[11px]">
                          {index + 1}
                        </TableCell>
                        <TableCell className="text-center p-1">
                          <button
                            type="button"
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-muted-foreground"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {sku.skuCode}
                        </TableCell>
                        <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                          {sku.description}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 px-1.5 uppercase font-medium ${
                              sku.storageType?.toUpperCase().includes("CHILL")
                                ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                : sku.storageType?.toUpperCase().includes("FROZ")
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {sku.storageType || "Dry"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {sku.uom}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {sku.totalQty.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                              {sku.loadedQty.toLocaleString()}
                            </span>
                            <div className="w-16 mt-1">
                              <Progress value={sku.progressPct} className="h-1 bg-slate-100" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right bg-amber-50/40 dark:bg-amber-950/15">
                          <span
                            className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              hasPendingBalance
                                ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-100 dark:border-amber-700"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            }`}
                          >
                            {sku.balanceQty.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {sku.pendingTrucksList && sku.pendingTrucksList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {sku.pendingTrucksList.map((pt: string, pIdx: number) => (
                                <Badge
                                  key={pIdx}
                                  variant="outline"
                                  className="text-[10px] h-5 bg-amber-50/80 border-amber-200 text-amber-800 font-medium"
                                >
                                  {pt}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> All Trucks Departed
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`text-[10px] h-5 px-1.5 font-semibold ${
                              sku.balanceQty === 0
                                ? "bg-emerald-600 text-white"
                                : sku.loadedQty > 0
                                ? "bg-blue-600 text-white"
                                : "bg-amber-500 text-white"
                            }`}
                          >
                            {sku.status}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Truck Allocation Details */}
                      {isExpanded && (
                        <TableRow className="bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-50/70 border-b">
                          <TableCell colSpan={11} className="p-3 pl-12">
                            <div className="bg-white dark:bg-card border rounded-md p-3 space-y-2.5 shadow-xs">
                              <div className="flex items-center justify-between border-b pb-2">
                                <div className="flex items-center gap-2">
                                  <Truck className="h-4 w-4 text-primary" />
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Truck & Trip Breakdown for {sku.skuCode} ({sku.description})
                                  </span>
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {sku.allocations.length} truck allocation(s)
                                  </Badge>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  Total Qty: <strong className="text-foreground">{sku.totalQty} {sku.uom}</strong> ·
                                  Departed: <strong className="text-emerald-600">{sku.loadedQty}</strong> ·
                                  Pending: <strong className="text-amber-600">{sku.balanceQty}</strong>
                                </span>
                              </div>

                              <Table>
                                <TableHeader className="bg-slate-50 text-[10px]">
                                  <TableRow className="h-7">
                                    <TableHead className="font-semibold">Truck No / Vehicle</TableHead>
                                    <TableHead className="font-semibold text-center w-20">Trip</TableHead>
                                    <TableHead className="font-semibold">Route</TableHead>
                                    <TableHead className="font-semibold">Driver</TableHead>
                                    <TableHead className="font-semibold">Outlet</TableHead>
                                    <TableHead className="font-semibold text-right w-24">Allocated Qty</TableHead>
                                    <TableHead className="font-semibold text-center w-36">Loading / Depart Status</TableHead>
                                    <TableHead className="font-semibold text-center w-32">Quick Action</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                  {sku.allocations.map((alloc: any, aIdx: number) => {
                                    return (
                                      <TableRow key={aIdx} className="h-8">
                                        <TableCell className="font-semibold flex items-center gap-1.5">
                                          <Truck className="h-3 w-3 text-slate-500" />
                                          {alloc.truckPlate}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
                                            Trip {alloc.tripNumber}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{alloc.route}</TableCell>
                                        <TableCell className="text-muted-foreground">{alloc.driverName}</TableCell>
                                        <TableCell className="text-slate-700 dark:text-slate-300 font-medium">
                                          {alloc.outletCode} - {alloc.outletName}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                          {alloc.qty.toLocaleString()} {sku.uom}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {alloc.isDeparted ? (
                                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 text-[10px] h-5 gap-1">
                                              <CheckCircle2 className="h-2.5 w-2.5" /> Dispatched {alloc.departTime ? `@ ${alloc.departTime}` : ""}
                                            </Badge>
                                          ) : alloc.isLoaded ? (
                                            <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 text-[10px] h-5 gap-1">
                                              <Check className="h-2.5 w-2.5" /> Loaded {alloc.loadingEndTime ? `@ ${alloc.loadingEndTime}` : ""}
                                            </Badge>
                                          ) : alloc.isLoading ? (
                                            <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 text-[10px] h-5 animate-pulse">
                                              Loading
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-slate-600 bg-slate-100 text-[10px] h-5">
                                              Pending to Load
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {alloc.truckAssignmentId && !alloc.isDeparted ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-6 text-[10px] px-2 gap-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickDepart(alloc.truckAssignmentId);
                                              }}
                                              disabled={updateTruckTimingMutation.isPending}
                                            >
                                              <Truck className="h-2.5 w-2.5 text-emerald-600" />
                                              Mark Departed
                                            </Button>
                                          ) : alloc.truckAssignmentId && alloc.isDeparted ? (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-slate-400 hover:text-red-600 h-6 text-[10px] px-1.5"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRevertDepart(alloc.truckAssignmentId);
                                              }}
                                              title="Revert to pending"
                                            >
                                              <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                                              Revert
                                            </Button>
                                          ) : (
                                            <span className="text-[10px] text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* TRUCK & TRIP LOAD MONITOR VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {truckList.map((truck: any) => {
              const isExpanded = !!expandedTrucks[truck.id];
              return (
                <Card key={truck.id} className="border shadow-xs overflow-hidden flex flex-col">
                  <CardHeader className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border-b flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-bold">
                          {truck.plateNumber}
                        </CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-bold h-4 px-1.5">
                          Trip {truck.tripNumber}
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px]">
                        Driver: <strong className="text-foreground">{truck.driverName}</strong> · Route: {truck.zoneName || "Assigned"}
                      </CardDescription>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {truck.isDeparted ? (
                        <Badge className="bg-emerald-600 text-white text-[10px] h-5">
                          Departed {truck.departTime ? `@ ${truck.departTime}` : ""}
                        </Badge>
                      ) : truck.isLoaded ? (
                        <Badge className="bg-blue-600 text-white text-[10px] h-5">
                          Loaded
                        </Badge>
                      ) : truck.isLoading ? (
                        <Badge className="bg-amber-500 text-white text-[10px] h-5 animate-pulse">
                          Loading
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-600 text-[10px] h-5">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-3 flex-1 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between text-xs border-b pb-2">
                      <span className="text-muted-foreground font-medium">Total Qty on Truck:</span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                        {truck.totalQty.toLocaleString()} Units
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>SKUs on this Truck ({truck.skus.length}):</span>
                        <button
                          onClick={() => toggleTruckExpand(truck.id)}
                          className="text-primary hover:underline font-medium text-[10px]"
                        >
                          {isExpanded ? "Hide Details" : "View Breakdown"}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className="max-h-48 overflow-y-auto border rounded divide-y text-xs">
                          {truck.skus.map((s: any, idx: number) => (
                            <div key={idx} className="p-1.5 flex items-center justify-between bg-white dark:bg-card">
                              <div className="space-y-0.5">
                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">
                                  {s.skuCode}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate max-w-[180px] block">
                                  {s.description}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                                {s.qty} {s.uom}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {truck.skus.map((s: any) => `${s.skuCode} (${s.qty})`).join(", ") || "No items assigned yet"}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {truck.isDeparted ? "Departed & deducted from warehouse" : "Pending departure"}
                      </span>
                      {!truck.isDeparted ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-7 text-xs gap-1"
                          onClick={() => handleQuickDepart(truck.id)}
                          disabled={updateTruckTimingMutation.isPending}
                        >
                          <Truck className="h-3 w-3 text-emerald-600" />
                          Mark Departed
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-red-600 h-7 text-xs"
                          onClick={() => handleRevertDepart(truck.id)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Revert
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
