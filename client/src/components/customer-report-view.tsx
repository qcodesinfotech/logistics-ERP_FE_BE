import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, Download, Printer, RefreshCw, Search, Calendar, 
  Truck, CheckCircle2, AlertTriangle, Building2, TrendingUp, Clock, Package, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Gauge, Thermometer
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { exportCustomerReportExcel } from "@/lib/customer-excel-export";

export default function CustomerReportView() {
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedStorageType, setSelectedStorageType] = useState<string>("all");
  const [selectedTruck, setSelectedTruck] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<string>("activity");

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (selectedBrand !== "all") params.append("brandId", selectedBrand);
    if (selectedStorageType !== "all") params.append("storageType", selectedStorageType);
    if (selectedTruck !== "all") params.append("truckNo", selectedTruck);
    return `/api/dispatch/activity-utilization-report?${params.toString()}`;
  }, [startDate, endDate, selectedBrand, selectedStorageType, selectedTruck]);

  const { data: reportData, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: [queryUrl],
    queryFn: async () => {
      const res = await apiRequest("GET", queryUrl);
      return res.json();
    }
  });

  const activityRecords = reportData?.activityRecords || [];
  const utilizationRecords = reportData?.utilizationRecords || [];
  const weeklyKpis = reportData?.weeklyKpis || [];
  const deviations = reportData?.deviations || [];
  const masters = reportData?.masters || { outlets: [], vehicles: [] };

  // Unique filter lists
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    activityRecords.forEach((a: any) => {
      if (a.brand) brands.add(a.brand);
    });
    return Array.from(brands).sort();
  }, [activityRecords]);

  const availableStorageTypes = useMemo(() => {
    const types = new Set<string>();
    activityRecords.forEach((a: any) => {
      if (a.storageType) types.add(a.storageType);
    });
    return Array.from(types).sort();
  }, [activityRecords]);

  const availableTrucks = useMemo(() => {
    const trucks = new Set<string>();
    activityRecords.forEach((a: any) => {
      if (a.truckNo) trucks.add(a.truckNo);
    });
    return Array.from(trucks).sort();
  }, [activityRecords]);

  // Filtered activity records by search query
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activityRecords;
    const q = searchQuery.toLowerCase();
    return activityRecords.filter((a: any) => 
      a.location?.toLowerCase().includes(q) ||
      a.brand?.toLowerCase().includes(q) ||
      a.truckNo?.toLowerCase().includes(q) ||
      a.storageType?.toLowerCase().includes(q) ||
      a.outletCode?.toLowerCase().includes(q) ||
      String(a.trip).includes(q)
    );
  }, [activityRecords, searchQuery]);

  // Pagination State for Activity Delivery Records
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reset to page 1 whenever any filter or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBrand, selectedStorageType, selectedTruck, startDate, endDate]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredActivities.length / pageSize));

  const paginatedActivities = useMemo(() => {
    if (pageSize === -1) return filteredActivities;
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

  // Metrics summary
  const totalCases = useMemo(() => {
    return activityRecords.reduce((sum: number, a: any) => sum + (Number(a.cases) || 0), 0);
  }, [activityRecords]);

  const avgUtil = useMemo(() => {
    if (!utilizationRecords.length) return 0;
    return Math.round(utilizationRecords.reduce((sum: number, u: any) => sum + u.utilizationPercent, 0) / utilizationRecords.length);
  }, [utilizationRecords]);

  const avgCarton = useMemo(() => {
    if (!utilizationRecords.length) return 0;
    return Math.round(utilizationRecords.reduce((sum: number, u: any) => sum + u.cartonPercent, 0) / utilizationRecords.length);
  }, [utilizationRecords]);

  const [isExporting, setIsExporting] = useState(false);

  // One-click multi-sheet styled Excel export matching customer template
  const handleExportFullExcel = async () => {
    if (!reportData) return;
    try {
      setIsExporting(true);
      await exportCustomerReportExcel(reportData);
    } catch (err) {
      console.error("Failed to export styled customer report:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const getStorageBadgeClass = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("frozen") || t.includes("frz")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-medium";
    if (t.includes("chilled") || t.includes("ch")) return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 font-medium";
    if (t.includes("dry")) return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-medium";
    if (t.includes("pack")) return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium";
    return "bg-muted text-muted-foreground border-border font-medium";
  };

  const getBrandBadgeClass = (brand: string) => {
    const b = (brand || "").toLowerCase();
    if (b.includes("kfc")) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-semibold";
    if (b.includes("hardee")) return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-semibold";
    if (b.includes("pizza")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold";
    if (b.includes("tgi")) return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold";
    return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-semibold";
  };

  return (
    <div className="space-y-2.5 w-full p-2.5 md:p-3.5 print:p-0">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-2 bg-background print:hidden">
        <div>
          <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
            Customer Activity & Fleet Utilization Report
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Outlet-wise delivery activity, truck capacity utilization, carton occupancy %, and deviation log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="h-7 text-xs gap-1.5 px-2.5 bg-background border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.print()}
            className="h-7 text-xs gap-1.5 px-2.5 bg-background border-border"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>
          <Button 
            size="sm" 
            onClick={handleExportFullExcel} 
            disabled={!activityRecords.length || isExporting}
            className="h-7 text-xs gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs transition-all"
          >
            {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            {isExporting ? "Generating..." : "Export Customer Report (Excel)"}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="print:hidden border-border bg-card text-card-foreground shadow-xs">
        <CardContent className="p-2 sm:px-3 sm:py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-2 lg:col-span-4 space-y-0.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  {dateMode === "single" ? "Single Day Selection" : "Date Range"}
                </Label>
                <div className="flex items-center bg-muted rounded p-0.5 text-[10px] border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setDateMode("single");
                      if (startDate) setEndDate(startDate);
                    }}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors ${dateMode === "single" ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateMode("range")}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors ${dateMode === "range" ? "bg-background shadow-xs text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Date Range
                  </button>
                </div>
              </div>

              {dateMode === "single" ? (
                <div className="flex gap-1 items-center">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }} 
                    className="h-7 text-xs flex-1 bg-background border-border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 shrink-0 bg-background border-border"
                    onClick={() => {
                      const today = new Date().toISOString().split("T")[0];
                      setStartDate(today);
                      setEndDate(today);
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 shrink-0 bg-background border-border"
                    onClick={() => {
                      setStartDate("2026-09-01");
                      setEndDate("2026-09-01");
                    }}
                  >
                    1-Sep
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    placeholder="Start"
                    className="h-7 text-xs bg-background border-border"
                  />
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    placeholder="End"
                    className="h-7 text-xs bg-background border-border"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-1 lg:col-span-2 space-y-0.5">
              <Label className="text-[11px] font-semibold text-muted-foreground">Brand</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="h-7 text-xs bg-background border-border">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {availableBrands.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-1 lg:col-span-2 space-y-0.5">
              <Label className="text-[11px] font-semibold text-muted-foreground">Type of Goods</Label>
              <Select value={selectedStorageType} onValueChange={setSelectedStorageType}>
                <SelectTrigger className="h-7 text-xs bg-background border-border">
                  <SelectValue placeholder="All Storage Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableStorageTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-1 lg:col-span-2 space-y-0.5">
              <Label className="text-[11px] font-semibold text-muted-foreground">Truck No</Label>
              <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                <SelectTrigger className="h-7 text-xs bg-background border-border">
                  <SelectValue placeholder="All Trucks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trucks</SelectItem>
                  {availableTrucks.map(t => (
                    <SelectItem key={t} value={t}>Truck #{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-1 lg:col-span-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSelectedBrand("all");
                  setSelectedStorageType("all");
                  setSelectedTruck("all");
                  setSearchQuery("");
                }}
                className="h-7 text-xs text-muted-foreground w-full hover:bg-muted"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Header - Compact Streamlined View */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="truncate">Total Stops</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-foreground mt-0.5 leading-tight">
              {activityRecords.length.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Outlet deliveries</div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <Package className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Total Cases</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 leading-tight">
              {Math.round(totalCases).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">CS</span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Qty delivered</div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Fleet Util %</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 leading-tight">
              {avgUtil}%
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Target: 100% (10h)</div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">Occupancy %</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 leading-tight">
              {avgCarton}%
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Target: 95% cap</div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <Truck className="h-3.5 w-3.5 text-purple-500 shrink-0" />
              <span className="truncate">Active Trips</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5 leading-tight">
              {utilizationRecords.length}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Truck dispatches</div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <Gauge className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
              <span className="truncate">Total KM Used</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-0.5 leading-tight">
              {(reportData?.totalKmUsed || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">KM</span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Fleet distance</div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-2 sm:p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 truncate">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">Deviations</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 leading-tight">
              {deviations.length}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">Damages & discrepancies</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-1.5">
          <TabsList className="bg-muted p-0.5 h-7.5 border border-border">
            <TabsTrigger value="activity" className="text-xs py-1 px-2.5 gap-1.5">
              Activity Report (Outlet-Wise)
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {activityRecords.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="utilization" className="text-xs py-1 px-2.5 gap-1.5">
              Truck Utilization & KPIs
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {utilizationRecords.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deviations" className="text-xs py-1 px-2.5 gap-1.5">
              Outbound Deviations
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {deviations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="masters" className="text-xs py-1 px-2.5 gap-1.5">
              Master Data (Outlets & Fleet)
            </TabsTrigger>
          </TabsList>

          {activeSubTab === "activity" && (
            <div className="relative w-full sm:w-60 print:hidden">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search outlet, truck, brand..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-7 text-xs bg-background border-border"
              />
            </div>
          )}
        </div>

        {/* ==================== TAB 1: ACTIVITY REPORT ==================== */}
        <TabsContent value="activity" className="space-y-2">
          <div className="py-1 px-2.5 bg-card border border-border rounded flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-muted-foreground shadow-2xs">
            <div className="font-semibold flex items-center gap-1.5 text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Timestamps Legend:</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] font-mono">
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                <strong>[1]</strong> Arr Whse
              </span>
              <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
                <strong>[2]</strong> Left Whse
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <strong>[3]</strong> Arr Restaurant
              </span>
              <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>
                <strong>[4]</strong> Left Restaurant
              </span>
            </div>
          </div>

          <Card className="overflow-hidden border-border bg-card text-card-foreground shadow-xs">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" /> Loading activity report data...
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No activity records found for the selected criteria.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-[640px] overflow-y-auto relative">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold shadow-2xs">
                        <TableRow className="border-b border-border hover:bg-transparent">
                          <TableHead className="w-12 text-center font-bold">Trip</TableHead>
                          <TableHead className="w-12 text-center font-bold">Seq</TableHead>
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="font-bold">Week</TableHead>
                          <TableHead className="font-bold">Type of Goods</TableHead>
                          <TableHead className="font-bold">Truck No</TableHead>
                          <TableHead className="font-bold">Brand</TableHead>
                          <TableHead className="font-bold min-w-[180px]">Location / Outlet</TableHead>
                          <TableHead className="font-bold">Vehicle Type</TableHead>
                          <TableHead className="text-center font-bold">No of Rest.</TableHead>
                          <TableHead className="text-right font-bold text-emerald-600 dark:text-emerald-400">Cases Handled</TableHead>
                          <TableHead className="text-center font-bold">Temp</TableHead>
                          <TableHead className="font-bold text-center text-blue-600 dark:text-blue-400">ReportingTime [1]</TableHead>
                          <TableHead className="font-bold text-center text-indigo-600 dark:text-indigo-400">DepartTime [2]</TableHead>
                          <TableHead className="font-bold text-center text-emerald-600 dark:text-emerald-400">DropStartTime [3]</TableHead>
                          <TableHead className="font-bold text-center text-purple-600 dark:text-purple-400">DropEndTime [4]</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {paginatedActivities.map((a: any, idx: number) => (
                          <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                            <TableCell className="text-center font-mono font-semibold text-foreground">
                              {a.trip}
                            </TableCell>
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {a.seq}
                            </TableCell>
                            <TableCell className="font-mono whitespace-nowrap text-foreground">
                              {a.date}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 border-border">
                                {a.week}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${getStorageBadgeClass(a.storageType)}`}>
                                {a.storageType}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-foreground">
                              {a.truckNo}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${getBrandBadgeClass(a.brand)}`}>
                                {a.brand}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {a.location}
                              <div className="text-[10px] text-muted-foreground font-mono">{a.outletCode}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {a.vehicleType}
                            </TableCell>
                            <TableCell className="text-center font-mono text-foreground">
                              {a.noOfRestaurants}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {a.cases} CS
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {a.temperature && a.temperature !== "-" ? (
                                <Badge variant="outline" className="text-[11px] font-mono border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  <Thermometer className="h-3 w-3 mr-1" />
                                  {a.temperature}°C
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                              {a.reportingTime}
                            </TableCell>
                            <TableCell className="text-center font-mono text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap">
                              <div>{a.departTime}</div>
                              {a.loadingDurationMinutes !== null && a.loadingDurationMinutes !== undefined && (
                                <div className="text-[10px] text-muted-foreground font-sans">({a.loadingDurationMinutes}m load)</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                              {a.dropStartTime}
                            </TableCell>
                            <TableCell className="text-center font-mono text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">
                              {a.dropEndTime}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Toolbar */}
                  <div className="px-4 py-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-card print:hidden">
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <span>Showing</span>
                      <span className="font-semibold text-foreground">
                        {filteredActivities.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                      </span>
                      <span>to</span>
                      <span className="font-semibold text-foreground">
                        {pageSize === -1 ? filteredActivities.length : Math.min(currentPage * pageSize, filteredActivities.length)}
                      </span>
                      <span>of</span>
                      <span className="font-semibold text-foreground">
                        {filteredActivities.length}
                      </span>
                      <span>records</span>
                      {searchQuery && (
                        <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 font-normal">
                          Search Filtered
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs">Per page:</span>
                        <Select
                          value={String(pageSize)}
                          onValueChange={(v) => {
                            setPageSize(Number(v));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-7 w-[72px] text-xs bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="250">250</SelectItem>
                            <SelectItem value="-1">All</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {pageSize !== -1 && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-background border-border"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage <= 1}
                            title="First page"
                          >
                            <ChevronsLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-background border-border"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            title="Previous page"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>

                          <div className="px-2 text-xs font-medium text-foreground">
                            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                          </div>

                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-background border-border"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            title="Next page"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-background border-border"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage >= totalPages}
                            title="Last page"
                          >
                            <ChevronsRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 2: TRUCK UTILIZATION & WEEKLY KPIS ==================== */}
        <TabsContent value="utilization" className="space-y-3">
          {/* Weekly KPI Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-border bg-card text-card-foreground shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Weekly Fleet Performance & KPI Matrix
                </CardTitle>
                <CardDescription className="text-xs">
                  Target threshold vs weekly performance for vehicle operational hours and carton capacity occupancy.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/80 text-xs border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold">KPI Metric</TableHead>
                      <TableHead className="text-center font-bold text-blue-600 dark:text-blue-400">Target</TableHead>
                      <TableHead className="text-center font-bold">wk1</TableHead>
                      <TableHead className="text-center font-bold">wk2</TableHead>
                      <TableHead className="text-center font-bold">wk3</TableHead>
                      <TableHead className="text-center font-bold">wk4</TableHead>
                      <TableHead className="text-center font-bold text-emerald-600 dark:text-emerald-400">Total Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs font-mono">
                    {weeklyKpis.map((k: any, idx: number) => (
                      <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <TableCell className="font-semibold font-sans text-foreground">
                          {k.kpi}
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400">
                          {k.target}
                        </TableCell>
                        <TableCell className="text-center text-foreground">{k.wk1}</TableCell>
                        <TableCell className="text-center text-foreground">{k.wk2}</TableCell>
                        <TableCell className="text-center text-foreground">{k.wk3}</TableCell>
                        <TableCell className="text-center text-foreground">{k.wk4}</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {k.total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground shadow-xs flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Standards & Benchmarks
                </CardTitle>
                <CardDescription className="text-xs">
                  Operational guidelines established for FMCG distribution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-muted/40 border border-border space-y-1">
                  <div className="font-medium text-foreground">Target Daily Utilization</div>
                  <div className="text-muted-foreground">10.00 Hours / Day per Truck (Trip Start to Trip End)</div>
                </div>
                <div className="p-2.5 rounded bg-muted/40 border border-border space-y-1">
                  <div className="font-medium text-foreground">Target Carton Occupancy</div>
                  <div className="text-muted-foreground">95% of Target Truck Capacity (Standard: 280-320 CS)</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily / Trip Utilization Table */}
          <Card className="border-border bg-card text-card-foreground shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                Daily & Trip-Wise Truck Utilization Log
              </CardTitle>
              <CardDescription className="text-xs">
                Calculated duration, restaurant stops, actual carton loading, and utilization efficiency per truck run.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/80 text-[11px] uppercase tracking-wider border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Week</TableHead>
                      <TableHead className="font-bold">Type</TableHead>
                      <TableHead className="font-bold">Truck No</TableHead>
                      <TableHead className="text-center font-bold">No of Rest.</TableHead>
                      <TableHead className="text-right font-bold">Target Cap (CS)</TableHead>
                      <TableHead className="text-right font-bold text-emerald-600 dark:text-emerald-400">Actual Cases (CS)</TableHead>
                      <TableHead className="text-center font-bold">TripStart</TableHead>
                      <TableHead className="text-center font-bold">TripEnd</TableHead>
                      <TableHead className="text-right font-bold">Target (Hrs)</TableHead>
                      <TableHead className="text-right font-bold">Actual (Hrs)</TableHead>
                      <TableHead className="text-center font-bold">Utilization %</TableHead>
                      <TableHead className="text-center font-bold">Carton %</TableHead>
                      <TableHead className="text-right font-bold">Opening KM</TableHead>
                      <TableHead className="text-right font-bold">Closing KM</TableHead>
                      <TableHead className="text-right font-bold text-cyan-600 dark:text-cyan-400">Distance (KM)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs font-mono">
                    {utilizationRecords.map((u: any, idx: number) => (
                      <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <TableCell className="whitespace-nowrap text-foreground">{u.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase border-border">
                            {u.week}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getStorageBadgeClass(u.type)}`}>
                            {u.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold text-foreground">
                          {u.truckNo}
                        </TableCell>
                        <TableCell className="text-center font-bold text-foreground">
                          {u.noOfRestaurants}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {u.targetTruckCapacity}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {u.actualCases}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap text-muted-foreground">
                          {u.tripStart}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap text-muted-foreground">
                          {u.tripEnd}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Number(u.targetUtilization || 10).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground">
                          {Number(u.actualUtilization || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${u.utilizationPercent >= 85 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                            {u.utilizationPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${u.cartonPercent >= 85 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20'}`}>
                            {u.cartonPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {u.openingKm && u.openingKm !== "-" ? Number(u.openingKm).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {u.closingKm && u.closingKm !== "-" ? Number(u.closingKm).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-cyan-600 dark:text-cyan-400">
                          {u.kmRun ? `${Number(u.kmRun).toLocaleString()} KM` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 3: OUTBOUND DEVIATIONS ==================== */}
        <TabsContent value="deviations" className="space-y-3">
          <Card className="border-border bg-card text-card-foreground shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                Outbound Deviation & Delivery Discrepancy Log
              </CardTitle>
              <CardDescription className="text-xs">
                Log of shortages, damaged goods, packaging rectifications, replacements, and non-delivery causes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {deviations.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  No outbound deviations or delivery discrepancies recorded for this period!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/80 text-[11px] uppercase tracking-wider border-b border-border">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center font-bold">SN</TableHead>
                        <TableHead className="font-bold">Order Date</TableHead>
                        <TableHead className="font-bold min-w-[150px]">Outlet</TableHead>
                        <TableHead className="font-bold min-w-[220px]">Product / Item</TableHead>
                        <TableHead className="font-bold min-w-[200px]">Reason / Remark</TableHead>
                        <TableHead className="text-center font-bold text-rose-600 dark:text-rose-400">Qty</TableHead>
                        <TableHead className="font-bold">GDN / TO</TableHead>
                        <TableHead className="font-bold">SKU</TableHead>
                        <TableHead className="font-bold">Completion Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {deviations.map((d: any, idx: number) => (
                        <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <TableCell className="text-center font-mono text-muted-foreground">
                            {d.sn}
                          </TableCell>
                          <TableCell className="font-mono whitespace-nowrap text-foreground">
                            {d.orderDate}
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            {d.outlet}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {d.product}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              {d.reason}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                            {d.qty}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {d.gdn}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {d.sku}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {d.completionDate}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 4: MASTERS ==================== */}
        <TabsContent value="masters" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outlets Master */}
            <Card className="border-border bg-card text-card-foreground shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-500" />
                  Outlet Location Master (Customer Accounts)
                </CardTitle>
                <CardDescription className="text-xs">
                  Registry of restaurant branches, GPS coordinates, Brand mapping, and target capacity.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/80 text-[11px] uppercase border-b border-border">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center font-bold">SN</TableHead>
                        <TableHead className="font-bold">Location</TableHead>
                        <TableHead className="font-bold">Brand</TableHead>
                        <TableHead className="font-bold">Type</TableHead>
                        <TableHead className="text-right font-bold">Target Cap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {masters.outlets.map((o: any, idx: number) => (
                        <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <TableCell className="text-center font-mono text-muted-foreground">{o.sn}</TableCell>
                          <TableCell className="font-medium text-foreground">
                            {o.location}
                            <div className="text-[10px] text-muted-foreground font-mono">{o.deliveredTo}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono border-border">{o.brand}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{o.type}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{o.targetTruckCapacity} CS</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Fleet Master */}
            <Card className="border-border bg-card text-card-foreground shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-500" />
                  Customer Fleet Specifications
                </CardTitle>
                <CardDescription className="text-xs">
                  Dedicated vehicles, payload ratings, box dimensions, and carton capacities.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/80 text-[11px] uppercase border-b border-border">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center font-bold">SL#</TableHead>
                        <TableHead className="font-bold">Truck#</TableHead>
                        <TableHead className="font-bold">Make</TableHead>
                        <TableHead className="font-bold">GVW</TableHead>
                        <TableHead className="font-bold">Payload</TableHead>
                        <TableHead className="font-bold">Box Size</TableHead>
                        <TableHead className="text-right font-bold">Carton Cap.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {masters.vehicles.map((v: any, idx: number) => (
                        <TableRow key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <TableCell className="text-center font-mono text-muted-foreground">{v.sl}</TableCell>
                          <TableCell className="font-bold font-mono text-blue-600 dark:text-blue-400">{v.truckNo}</TableCell>
                          <TableCell className="text-foreground">{v.make}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{v.gvw}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{v.netPayload}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{v.boxMeasurement}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">{v.cartonCapacity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
