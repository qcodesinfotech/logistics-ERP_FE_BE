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
    if (t.includes("frozen") || t.includes("frz")) return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300";
    if (t.includes("chilled") || t.includes("ch")) return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300";
    if (t.includes("dry")) return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300";
    if (t.includes("pack")) return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300";
    return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
  };

  const getBrandBadgeClass = (brand: string) => {
    const b = (brand || "").toLowerCase();
    if (b.includes("kfc")) return "bg-red-100 text-red-800 border-red-200 font-semibold dark:bg-red-950 dark:text-red-300";
    if (b.includes("hardee")) return "bg-amber-100 text-amber-900 border-amber-200 font-semibold dark:bg-amber-950 dark:text-amber-300";
    if (b.includes("pizza")) return "bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold dark:bg-emerald-950 dark:text-emerald-300";
    if (b.includes("tgi")) return "bg-rose-100 text-rose-800 border-rose-200 font-semibold dark:bg-rose-950 dark:text-rose-300";
    return "bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold dark:bg-indigo-950 dark:text-indigo-300";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 print:p-0">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 bg-background print:hidden">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            Customer Activity & Fleet Utilization Report
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Outlet-wise delivery activity, truck capacity utilization, carton occupancy %, and deviation log based on customer reporting standards.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
          <Button 
            size="sm" 
            onClick={handleExportFullExcel} 
            disabled={!activityRecords.length || isExporting}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all"
          >
            {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {isExporting ? "Generating Styled Excel..." : "Export Customer Report (Excel)"}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="print:hidden border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-2 lg:col-span-4 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {dateMode === "single" ? "Single Day Selection" : "Date Range"}
                </Label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDateMode("single");
                      if (startDate) setEndDate(startDate);
                    }}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${dateMode === "single" ? "bg-white dark:bg-slate-700 shadow-xs text-primary font-bold" : "text-muted-foreground"}`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateMode("range")}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${dateMode === "range" ? "bg-white dark:bg-slate-700 shadow-xs text-primary font-bold" : "text-muted-foreground"}`}
                  >
                    Date Range
                  </button>
                </div>
              </div>

              {dateMode === "single" ? (
                <div className="flex gap-1.5 items-center">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }} 
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] px-2"
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
                    className="h-8 text-[11px] px-2"
                    onClick={() => {
                      setStartDate("2026-09-01");
                      setEndDate("2026-09-01");
                    }}
                  >
                    1-Sep
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    placeholder="Start"
                    className="h-8 text-xs"
                  />
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    placeholder="End"
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-1 lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Brand</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="h-8 text-xs">
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

            <div className="sm:col-span-1 lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Type of Goods</Label>
              <Select value={selectedStorageType} onValueChange={setSelectedStorageType}>
                <SelectTrigger className="h-8 text-xs">
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

            <div className="sm:col-span-1 lg:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Truck No</Label>
              <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                <SelectTrigger className="h-8 text-xs">
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

            <div className="sm:col-span-1 lg:col-span-2 flex gap-2">
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
                className="h-8 text-xs text-muted-foreground w-full"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-blue-600" /> Total Stops
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {activityRecords.length.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Outlet deliveries</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-emerald-600" /> Total Cases
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {Math.round(totalCases).toLocaleString()} <span className="text-xs font-normal text-slate-500">CS</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Qty delivered</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600" /> Fleet Util %
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {avgUtil}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Target: 100% (10h)</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600" /> Occupancy %
            </div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {avgCarton}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Target: 95% cap</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-purple-600" /> Active Trips
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {utilizationRecords.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Truck dispatches</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-cyan-600" /> Total KM Used
            </div>
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
              {(reportData?.totalKmUsed || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">KM</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Fleet travel distance</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Deviations
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {deviations.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Damages & discrepancies</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              Activity Report (Outlet-Wise)
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {activityRecords.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="utilization" className="text-xs gap-1.5">
              Truck Utilization & KPIs
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {utilizationRecords.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="deviations" className="text-xs gap-1.5">
              Outbound Deviations
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                {deviations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="masters" className="text-xs gap-1.5">
              Master Data (Outlets & Fleet)
            </TabsTrigger>
          </TabsList>

          {activeSubTab === "activity" && (
            <div className="relative w-full sm:w-64 print:hidden">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Search outlet, truck, brand..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
          )}
        </div>

        {/* ==================== TAB 1: ACTIVITY REPORT (IMAGE 1) ==================== */}
        <TabsContent value="activity" className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="font-semibold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-700" />
              Customer Template Timestamps Legend:
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <span><strong className="text-blue-700 dark:text-blue-400">[1]</strong> Time Arrived at Warehouse</span>
              <span><strong className="text-indigo-700 dark:text-indigo-400">[2]</strong> Time Left the Warehouse</span>
              <span><strong className="text-emerald-700 dark:text-emerald-400">[3]</strong> Time Arrived at Restaurant</span>
              <span><strong className="text-purple-700 dark:text-purple-400">[4]</strong> Time Left the Restaurant</span>
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
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
                      <TableHeader className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur text-[11px] uppercase tracking-wider shadow-sm">
                        <TableRow>
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
                          <TableHead className="text-right font-bold text-emerald-700 dark:text-emerald-400">Cases Handled</TableHead>
                          <TableHead className="text-center font-bold">Temp</TableHead>
                          <TableHead className="font-bold text-center bg-blue-50/50 dark:bg-blue-950/20">ReportingTime [1]</TableHead>
                          <TableHead className="font-bold text-center bg-indigo-50/50 dark:bg-indigo-950/20">DepartTime [2]</TableHead>
                          <TableHead className="font-bold text-center bg-emerald-50/50 dark:bg-emerald-950/20">DropStartTime [3]</TableHead>
                          <TableHead className="font-bold text-center bg-purple-50/50 dark:bg-purple-950/20">DropEndTime [4]</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {paginatedActivities.map((a: any, idx: number) => (
                          <TableRow key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/80 transition-colors">
                            <TableCell className="text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {a.trip}
                            </TableCell>
                            <TableCell className="text-center font-mono text-slate-500">
                              {a.seq}
                            </TableCell>
                            <TableCell className="font-mono whitespace-nowrap">
                              {a.date}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                                {a.week}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getStorageBadgeClass(a.storageType)}`}>
                                {a.storageType}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {a.truckNo}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${getBrandBadgeClass(a.brand)}`}>
                                {a.brand}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                              {a.location}
                              <div className="text-[10px] text-muted-foreground font-mono">{a.outletCode}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {a.vehicleType}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {a.noOfRestaurants}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {a.cases} CS
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {a.temperature && a.temperature !== "-" ? (
                                <Badge variant="outline" className="text-[11px] font-mono border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                                  <Thermometer className="h-3 w-3 mr-1" />
                                  {a.temperature}°C
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-slate-600 dark:text-slate-300 bg-blue-50/20 dark:bg-blue-950/10 whitespace-nowrap">
                              {a.reportingTime}
                            </TableCell>
                            <TableCell className="text-center font-mono text-slate-600 dark:text-slate-300 bg-indigo-50/20 dark:bg-indigo-950/10 whitespace-nowrap">
                              <div>{a.departTime}</div>
                              {a.loadingDurationMinutes !== null && a.loadingDurationMinutes !== undefined && (
                                <div className="text-[10px] text-muted-foreground font-sans">({a.loadingDurationMinutes}m load)</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50/20 dark:bg-emerald-950/10 whitespace-nowrap">
                              {a.dropStartTime}
                            </TableCell>
                            <TableCell className="text-center font-mono text-purple-700 dark:text-purple-300 font-medium bg-purple-50/20 dark:bg-purple-950/10 whitespace-nowrap">
                              {a.dropEndTime}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Toolbar */}
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/70 dark:bg-slate-900/70 print:hidden">
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
                          <SelectTrigger className="h-7 w-[72px] text-xs bg-background">
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
                            className="h-7 w-7"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage <= 1}
                            title="First page"
                          >
                            <ChevronsLeft className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            title="Previous page"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Button>

                          <div className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                            Page <strong className="text-foreground">{currentPage}</strong> of <strong className="text-foreground">{totalPages}</strong>
                          </div>

                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            title="Next page"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
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

        {/* ==================== TAB 2: TRUCK UTILIZATION & WEEKLY KPIS (IMAGE 2) ==================== */}
        <TabsContent value="utilization" className="space-y-6">
          {/* Weekly KPI Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  Weekly Fleet Performance & KPI Matrix
                </CardTitle>
                <CardDescription className="text-xs">
                  Target threshold vs weekly performance for vehicle operational hours and carton capacity occupancy.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-100/70 dark:bg-slate-800/70 text-xs">
                    <TableRow>
                      <TableHead className="font-bold">KPI Metric</TableHead>
                      <TableHead className="text-center font-bold text-blue-600">Target</TableHead>
                      <TableHead className="text-center font-bold">wk1</TableHead>
                      <TableHead className="text-center font-bold">wk2</TableHead>
                      <TableHead className="text-center font-bold">wk3</TableHead>
                      <TableHead className="text-center font-bold">wk4</TableHead>
                      <TableHead className="text-center font-bold text-emerald-600">Total Avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs font-mono">
                    {weeklyKpis.map((k: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold font-sans text-slate-800 dark:text-slate-200">
                          {k.kpi}
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-600 bg-blue-50/30 dark:bg-blue-950/20">
                          {k.target}
                        </TableCell>
                        <TableCell className="text-center">{k.wk1}</TableCell>
                        <TableCell className="text-center">{k.wk2}</TableCell>
                        <TableCell className="text-center">{k.wk3}</TableCell>
                        <TableCell className="text-center">{k.wk4}</TableCell>
                        <TableCell className="text-center font-bold text-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20">
                          {k.total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Standards & Benchmarks
                </CardTitle>
                <CardDescription className="text-xs">
                  Operational guidelines established for FMCG distribution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-medium text-slate-800 dark:text-slate-200">Target Daily Utilization</div>
                  <div className="text-slate-500">10.00 Hours / Day per Truck (Trip Start to Trip End)</div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-medium text-slate-800 dark:text-slate-200">Target Carton Occupancy</div>
                  <div className="text-slate-500">95% of Target Truck Capacity (Standard: 280-320 CS)</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily / Trip Utilization Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                Daily & Trip-Wise Truck Utilization Log
              </CardTitle>
              <CardDescription className="text-xs">
                Calculated duration, restaurant stops, actual carton loading, and utilization efficiency per truck run.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Week</TableHead>
                      <TableHead className="font-bold">Type</TableHead>
                      <TableHead className="font-bold">Truck No</TableHead>
                      <TableHead className="text-center font-bold">No of Rest.</TableHead>
                      <TableHead className="text-right font-bold">Target Cap (CS)</TableHead>
                      <TableHead className="text-right font-bold text-emerald-600">Actual Cases (CS)</TableHead>
                      <TableHead className="text-center font-bold">TripStart</TableHead>
                      <TableHead className="text-center font-bold">TripEnd</TableHead>
                      <TableHead className="text-right font-bold">Target (Hrs)</TableHead>
                      <TableHead className="text-right font-bold">Actual (Hrs)</TableHead>
                      <TableHead className="text-center font-bold bg-amber-50/50 dark:bg-amber-950/20">Utilization %</TableHead>
                      <TableHead className="text-center font-bold bg-indigo-50/50 dark:bg-indigo-950/20">Carton %</TableHead>
                      <TableHead className="text-right font-bold">Opening KM</TableHead>
                      <TableHead className="text-right font-bold">Closing KM</TableHead>
                      <TableHead className="text-right font-bold text-cyan-600 dark:text-cyan-400">Distance (KM)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs font-mono">
                    {utilizationRecords.map((u: any, idx: number) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/80 transition-colors">
                        <TableCell className="whitespace-nowrap">{u.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                            {u.week}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStorageBadgeClass(u.type)}`}>
                            {u.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                          {u.truckNo}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-700 dark:text-slate-300">
                          {u.noOfRestaurants}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {u.targetTruckCapacity}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {u.actualCases}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {u.tripStart}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {u.tripEnd}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Number(u.targetUtilization || 10).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                          {Number(u.actualUtilization || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-amber-50/20 dark:bg-amber-950/10">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${u.utilizationPercent >= 85 ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950' : 'text-amber-700 bg-amber-100 dark:bg-amber-950'}`}>
                            {u.utilizationPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-bold bg-indigo-50/20 dark:bg-indigo-950/10">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${u.cartonPercent >= 85 ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950' : 'text-indigo-700 bg-indigo-100 dark:bg-indigo-950'}`}>
                            {u.cartonPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400">
                          {u.openingKm && u.openingKm !== "-" ? Number(u.openingKm).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-right text-slate-600 dark:text-slate-400">
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

        {/* ==================== TAB 3: OUTBOUND DEVIATIONS (IMAGE 3) ==================== */}
        <TabsContent value="deviations" className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
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
                    <TableHeader className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase tracking-wider">
                      <TableRow>
                        <TableHead className="w-12 text-center font-bold">SN</TableHead>
                        <TableHead className="font-bold">Order Date</TableHead>
                        <TableHead className="font-bold min-w-[150px]">Outlet</TableHead>
                        <TableHead className="font-bold min-w-[220px]">Product / Item</TableHead>
                        <TableHead className="font-bold min-w-[200px]">Reason / Remark</TableHead>
                        <TableHead className="text-center font-bold text-rose-600">Qty</TableHead>
                        <TableHead className="font-bold">GDN / TO</TableHead>
                        <TableHead className="font-bold">SKU</TableHead>
                        <TableHead className="font-bold">Completion Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {deviations.map((d: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/80 transition-colors">
                          <TableCell className="text-center font-mono text-muted-foreground">
                            {d.sn}
                          </TableCell>
                          <TableCell className="font-mono whitespace-nowrap">
                            {d.orderDate}
                          </TableCell>
                          <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                            {d.outlet}
                          </TableCell>
                          <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                            {d.product}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                              {d.reason}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                            {d.qty}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {d.gdn}
                          </TableCell>
                          <TableCell className="font-mono text-slate-600 dark:text-slate-300">
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
        <TabsContent value="masters" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outlets Master */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Outlet Location Master (Customer Accounts)
                </CardTitle>
                <CardDescription className="text-xs">
                  Registry of restaurant branches, GPS coordinates, Brand mapping, and target capacity.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase">
                      <TableRow>
                        <TableHead className="w-12 text-center">SN</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Target Cap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {masters.outlets.map((o: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-center font-mono text-muted-foreground">{o.sn}</TableCell>
                          <TableCell className="font-medium">
                            {o.location}
                            <div className="text-[10px] text-muted-foreground font-mono">{o.deliveredTo}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono">{o.brand}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{o.type}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">{o.targetTruckCapacity} CS</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Fleet Master */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  Customer Fleet Specifications
                </CardTitle>
                <CardDescription className="text-xs">
                  Dedicated vehicles, payload ratings, box dimensions, and carton capacities.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-slate-100/70 dark:bg-slate-800/70 text-[11px] uppercase">
                      <TableRow>
                        <TableHead className="w-12 text-center">SL#</TableHead>
                        <TableHead>Truck#</TableHead>
                        <TableHead>Make</TableHead>
                        <TableHead>GVW</TableHead>
                        <TableHead>Payload</TableHead>
                        <TableHead>Box Size</TableHead>
                        <TableHead className="text-right">Carton Cap.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {masters.vehicles.map((v: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-center font-mono text-muted-foreground">{v.sl}</TableCell>
                          <TableCell className="font-bold font-mono text-blue-600">{v.truckNo}</TableCell>
                          <TableCell>{v.make}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{v.gvw}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{v.netPayload}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{v.boxMeasurement}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-indigo-600">{v.cartonCapacity}</TableCell>
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
