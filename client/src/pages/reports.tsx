import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Users, Truck, ShoppingCart, Receipt, CreditCard, TrendingUp, Calendar, Building2, AlertTriangle, PackageX, Package, Scale, Landmark, Wallet, Briefcase, Printer, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Shop, Branch, Sale, Purchase, Customer, Supplier, Product, Employee, Project } from "@shared/schema";
import { useGlobalScope } from "@/contexts/global-scope";

const formatCurrency = (value: string | number | null | undefined) => {
  const num = parseFloat(String(value || "0"));
  return `${num.toFixed(3)} RO`;
};

type DateRange = "today" | "week" | "month" | "year" | "custom";

export default function Reports() {
  const [activeReport, setActiveReport] = useState("trial-balance");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { currentShopId, currentBranchId, shops: scopeShops, branches: scopeBranches, currentShop, currentBranch } = useGlobalScope();
  const [shopId, setShopId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");

  const { data: shops = [] } = useQuery<Shop[]>({ queryKey: ["/api/shops"] });
  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const { data: sales = [] } = useQuery<Sale[]>({ queryKey: ["/api/sales"] });
  const { data: purchases = [] } = useQuery<Purchase[]>({ queryKey: ["/api/purchases"] });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const { data: supplierBalances = [] } = useQuery<any[]>({ 
    queryKey: ["/api/supplier-balances", { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }] 
  });
  const { data: customerBalances = [] } = useQuery<any[]>({ 
    queryKey: ["/api/customer-balances", { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }] 
  });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: chartOfAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/chart-of-accounts"] });
  const { data: employeesList = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { data: projectsList = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");

  const getDateFilter = () => {
    const now = new Date();
    let start: Date, end: Date;

    switch (dateRange) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        start = weekStart;
        end = new Date(weekStart);
        end.setDate(weekStart.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case "custom":
        start = startDate ? new Date(startDate) : new Date(0);
        end = endDate ? new Date(endDate + "T23:59:59") : new Date();
        break;
      default:
        start = new Date(0);
        end = new Date();
    }
    return { start, end };
  };

  const currentDates = getDateFilter();

  const { data: trialBalance } = useQuery({
    queryKey: [
      `/api/reports/trial-balance?startDate=${currentDates.start.toISOString()}&endDate=${currentDates.end.toISOString()}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "trial-balance",
  });

  const { data: balanceSheet } = useQuery({
    queryKey: [
      `/api/reports/balance-sheet?asOfDate=${currentDates.end.toISOString()}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "balance-sheet",
  });

  const { data: profitLoss } = useQuery({
    queryKey: [
      `/api/reports/profit-loss?startDate=${currentDates.start.toISOString()}&endDate=${currentDates.end.toISOString()}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "profit-loss",
  });
  
  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });

  const { data: overallReport, isLoading: isOverallLoading } = useQuery({
    queryKey: [
      `/api/reports/overall?startDate=${currentDates.start.toISOString()}&endDate=${currentDates.end.toISOString()}&warehouseId=${selectedWarehouseId}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "overall",
  });

  const { data: salaryReport } = useQuery({
    queryKey: [
      `/api/reports/salary?employeeId=${selectedEmployeeId}&startDate=${startDate || ""}&endDate=${endDate || ""}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "salary",
  });

  const { data: projectReport } = useQuery({
    queryKey: [
      `/api/reports/project?projectId=${selectedProjectId}&employeeId=${selectedEmployeeId}&startDate=${startDate || ""}&endDate=${endDate || ""}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "project",
  });

  const { data: pettyCashReport } = useQuery({
    queryKey: [
      `/api/reports/petty-cash?startDate=${currentDates.start.toISOString()}&endDate=${currentDates.end.toISOString()}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "petty-cash",
  });

  const { data: employeeWorkReport = [] } = useQuery<any[]>({
    queryKey: [
      `/api/reports/employee-work?employeeId=${selectedEmployeeId}&startDate=${currentDates.start.toISOString()}&endDate=${currentDates.end.toISOString()}`,
    ],
    enabled: activeReport === "employee-work" && !!selectedEmployeeId,
  });

  const { data: serviceTicketReport = [] } = useQuery<any[]>({
    queryKey: [
      `/api/reports/service-tickets?technicianId=${selectedEmployeeId}&paymentStatus=${selectedPaymentStatus === "all" ? "" : selectedPaymentStatus}&startDate=${currentDates.start.toISOString()}&endDate=${currentDates.end.toISOString()}`,
      { scope: { shopId: shopId || currentShopId, branchId: branchId || currentBranchId } }
    ],
    enabled: activeReport === "service-tickets" || activeReport === "vat",
  });

  const filterByDateAndScope = <T extends { shopId?: string | null; branchId?: string | null }>(
    items: T[],
    dateField: keyof T
  ): T[] => {
    const { start, end } = getDateFilter();
    return items.filter(item => {
      const itemDate = new Date(item[dateField] as string);
      const dateMatch = itemDate >= start && itemDate <= end;
      const shopMatch = !shopId || item.shopId === shopId;
      const branchMatch = !branchId || item.branchId === branchId;
      return dateMatch && shopMatch && branchMatch;
    });
  };

  const filteredSales = filterByDateAndScope(sales, "saleDate" as keyof Sale);
  const filteredPurchases = filterByDateAndScope(purchases, "purchaseDate" as keyof Purchase);
  const filteredServiceTickets = filterByDateAndScope(serviceTicketReport, "receivedDate" as any);

  const totalSales = filteredSales.reduce((sum, s) => sum + parseFloat(s.total || "0"), 0);
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + parseFloat(p.total || "0"), 0);

  // Use accounting ledger (account 1100) for receivables to match Balance Sheet
  const arAccount = chartOfAccounts.find((acc: any) => acc.accountCode === "1100");
  const totalReceivables = arAccount ? parseFloat(arAccount.balance || "0") : 0;

  // Use accounting ledger (account 2000) for payables to match Balance Sheet
  const apAccount = chartOfAccounts.find((acc: any) => acc.accountCode === "2000");
  const totalPayables = apAccount ? parseFloat(apAccount.balance || "0") : 0;

  // Get VAT Payable from accounting ledger (account 2150)
  const vatAccount = chartOfAccounts.find((acc: any) => acc.accountCode === "2150");
  const totalVatPayable = vatAccount ? parseFloat(vatAccount.balance || "0") : 0;

  const reportTypes = [
    { id: "overall", label: "Overall Income & Expense", icon: TrendingUp },
    { id: "trial-balance", label: "Trial Balance", icon: Scale },
    { id: "balance-sheet", label: "Balance Sheet", icon: Landmark },
    { id: "profit-loss", label: "Profit & Loss", icon: TrendingUp },
    { id: "daily", label: "Daily Summary", icon: Calendar },
    { id: "salary", label: "Salary Report", icon: Wallet },
    { id: "petty-cash", label: "Petty Cash Report", icon: Wallet },
    { id: "employee-work", label: "Employee Work Report", icon: Users },
  ];

  const filteredBranches = shopId ? branches.filter(b => b.shopId === shopId) : branches;

  const renderSalesReport = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold font-mono">{formatCurrency(totalSales)}</div>
            <div className="text-sm text-muted-foreground">Total Sales</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{filteredSales.length}</div>
            <div className="text-sm text-muted-foreground">Transactions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold font-mono">{formatCurrency(filteredSales.reduce((sum, s) => sum + parseFloat(s.cashAmount || "0"), 0))}</div>
            <div className="text-sm text-muted-foreground">Cash Sales</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold font-mono">{formatCurrency(filteredSales.reduce((sum, s) => sum + parseFloat(s.creditAmount || "0"), 0))}</div>
            <div className="text-sm text-muted-foreground">Credit Sales</div>
          </CardContent>
        </Card>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sale #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Shop</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSales.slice(0, 50).map(sale => (
            <TableRow key={sale.id}>
              <TableCell className="font-mono">{sale.saleNumber}</TableCell>
              <TableCell>{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "-"}</TableCell>
              <TableCell>{shops.find(s => s.id === sale.shopId)?.name || "-"}</TableCell>
              <TableCell>{sale.paymentMethod}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(sale.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderPurchaseReport = () => {
    // Calculate actual paid amount from filtered purchases
    const totalPaid = filteredPurchases.reduce((sum, p) => sum + parseFloat(p.paidAmount || "0"), 0);
    // Calculate pending payables as total minus paid
    const pendingPayables = totalPurchases - totalPaid;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(totalPurchases)}</div>
              <div className="text-sm text-muted-foreground">Total Purchases</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{filteredPurchases.length}</div>
              <div className="text-sm text-muted-foreground">Purchase Orders</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(totalPaid)}</div>
              <div className="text-sm text-muted-foreground">Amount Paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-destructive">{formatCurrency(Math.max(0, pendingPayables))}</div>
              <div className="text-sm text-muted-foreground">Pending Payables</div>
            </CardContent>
          </Card>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purchase #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPurchases.slice(0, 50).map(purchase => (
              <TableRow key={purchase.id}>
                <TableCell className="font-mono">{purchase.purchaseNumber}</TableCell>
                <TableCell>{purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString() : "-"}</TableCell>
                <TableCell>{suppliers.find(s => s.id === purchase.supplierId)?.name || "-"}</TableCell>
                <TableCell>{purchase.paymentStatus}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(purchase.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderCustomerTransactions = () => (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Opening Balance</TableHead>
            <TableHead className="text-right">Current Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map(customer => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell>{customer.phone || "-"}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(customer.openingBalance)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(customer.currentBalance)}</TableCell>
              <TableCell>
                {parseFloat(customer.currentBalance || "0") > 0 ? (
                  <span className="text-destructive">Outstanding</span>
                ) : (
                  <span className="text-green-600">Clear</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderSupplierTransactions = () => (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Opening Balance</TableHead>
            <TableHead className="text-right">Current Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map(supplier => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell>{supplier.phone || "-"}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(supplier.openingBalance)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(supplier.currentBalance)}</TableCell>
              <TableCell>
                {parseFloat(supplier.currentBalance || "0") > 0 ? (
                  <span className="text-destructive">Payable</span>
                ) : (
                  <span className="text-green-600">Clear</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderReceivables = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-xl font-bold">Accounts Receivable</h2>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="text-3xl font-bold font-mono text-green-600">{formatCurrency(totalReceivables)}</div>
          <div className="text-muted-foreground">Total Accounts Receivable</div>
        </CardContent>
      </Card>

      <div className="print-title hidden print:block text-2xl font-bold mb-4">
        Accounts Receivable Report - {new Date().toLocaleDateString()}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Amount Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customerBalances.map(item => (
            <TableRow key={item.customerId}>
              <TableCell className="font-medium">{item.customerName}</TableCell>
              <TableCell>{item.phone || "-"}</TableCell>
              <TableCell className="text-right font-mono text-green-600">{formatCurrency(item.outstandingReceivable)}</TableCell>
            </TableRow>
          ))}
          {customerBalances.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                No outstanding receivables found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderPayables = () => {
    // Helper to get ledger-calculated outstanding for a supplier
    const getLedgerOutstanding = (supplierId: string): number => {
      const balance = supplierBalances.find(b => b.supplierId === supplierId);
      return balance ? parseFloat(balance.outstandingPayable || "0") : 0;
    };

    // Calculate total accounts payable from ledger-driven supplier balances
    const totalSupplierPayables = supplierBalances.reduce((sum, b) => {
      return sum + parseFloat(b.outstandingPayable || "0");
    }, 0);

    // Filter suppliers with outstanding balances
    const suppliersWithBalance = suppliers.filter(s => getLedgerOutstanding(s.id) > 0);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center no-print">
          <h2 className="text-xl font-bold">Accounts Payable</h2>
          <Button onClick={() => window.print()} variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold font-mono text-destructive">{formatCurrency(totalSupplierPayables)}</div>
            <div className="text-muted-foreground">Total Accounts Payable</div>
          </CardContent>
        </Card>

        <div className="print-title hidden print:block text-2xl font-bold mb-4">
          Accounts Payable Report - {new Date().toLocaleDateString()}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Amount Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplierBalances.filter(b => parseFloat(b.outstandingPayable) > 0).map(item => (
              <TableRow key={item.supplierId}>
                <TableCell className="font-medium">{item.supplierName}</TableCell>
                <TableCell>{item.phone || "-"}</TableCell>
                <TableCell className="text-right font-mono text-destructive">{formatCurrency(item.outstandingPayable)}</TableCell>
              </TableRow>
            ))}
            {supplierBalances.filter(b => parseFloat(b.outstandingPayable) > 0).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No outstanding payables found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderVatPayable = () => {
    // Calculate VAT from filtered sales and service tickets
    const outputVatFromSales = filteredSales.reduce((sum, s) => sum + parseFloat(s.vatAmount || "0"), 0);
    const outputVatFromServices = filteredServiceTickets.reduce((sum, t) => sum + parseFloat(t.vatAmount || "0"), 0);
    
    const outputVat = outputVatFromSales + outputVatFromServices;
    const inputVat = filteredPurchases.reduce((sum, p) => sum + parseFloat(p.vatAmount || "0"), 0);
    const netVat = outputVat - inputVat;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(outputVat)}</div>
              <div className="text-sm text-muted-foreground">Total Output VAT (Sales & Services)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-blue-600">{formatCurrency(inputVat)}</div>
              <div className="text-sm text-muted-foreground">Input VAT (Purchases)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold font-mono ${netVat >= 0 ? "text-destructive" : "text-green-600"}`}>
                {formatCurrency(Math.abs(netVat))}
              </div>
              <div className="text-sm text-muted-foreground">
                {netVat >= 0 ? "Net VAT Payable" : "Net VAT Refundable"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>VAT Ledger Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-destructive">{formatCurrency(totalVatPayable)}</div>
            <div className="text-muted-foreground">Current VAT Payable (Account 2150)</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>VAT Breakdown by Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">VAT Amount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                    <TableCell>{new Date(sale.saleDate || "").toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(sale.subtotal)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatCurrency(sale.vatAmount)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(sale.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell colSpan={3}>Subtotal (Sales Output VAT)</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{formatCurrency(outputVatFromSales)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {filteredServiceTickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>VAT Breakdown by Services</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead className="text-right">VAT Amount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServiceTickets.map(ticket => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.ticketNumber}</TableCell>
                      <TableCell>{new Date(ticket.receivedDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(parseFloat(ticket.serviceAmount || "0") + parseFloat(ticket.partsAmount || "0"))}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{formatCurrency(ticket.vatAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(ticket.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell colSpan={3}>Subtotal (Service Output VAT)</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatCurrency(outputVatFromServices)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex justify-between items-center text-lg font-bold no-print">
          <span>Total Combined Output VAT</span>
          <span className="text-destructive font-mono">{formatCurrency(outputVat)}</span>
        </div>
      </div>
    );
  };

  const renderTrialBalance = () => {
    if (!trialBalance) {
      return <div className="text-center py-8 text-muted-foreground">Loading trial balance...</div>;
    }
    const tb = trialBalance as any;
    const cashBreakdown = tb.cashBreakdown || [];
    const totalCashReceived = cashBreakdown.reduce((sum: number, item: any) => sum + item.amount, 0);

    const getSourceLabel = (source: string) => {
      const labels: Record<string, string> = {
        "sale": "Sales Receipts",
        "credit_clearing": "Credit Clearing Payments",
        "purchase_return": "Purchase Return Refunds",
        "project_income": "Project Income",
        "service_ticket": "Service Ticket Payments",
        "opening_balance": "Opening Balance",
        "Other": "Other Sources",
      };
      return labels[source] || source.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(parseFloat(tb.totalDebits || "0"))}</div>
              <div className="text-sm text-muted-foreground">Total Debits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(parseFloat(tb.totalCredits || "0"))}</div>
              <div className="text-sm text-muted-foreground">Total Credits</div>
            </CardContent>
          </Card>
        </div>

        {cashBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cash Receipts Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {cashBreakdown.map((item: any, index: number) => (
                  <div key={index} className="bg-muted/50 rounded-lg p-4">
                    <div className="text-lg font-bold font-mono text-green-600">{formatCurrency(item.amount)}</div>
                    <div className="text-sm text-muted-foreground">{getSourceLabel(item.source)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <span className="font-semibold">Total Cash Received</span>
                <span className="text-xl font-bold font-mono text-green-600">{formatCurrency(totalCashReceived)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trial Balance Report</CardTitle>
            {tb.isBalanced ? (
              <Badge className="bg-green-100 text-green-800">Balanced</Badge>
            ) : (
              <Badge variant="destructive">NOT Balanced</Badge>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tb.accounts?.filter((acc: any) => parseFloat(acc.debit) > 0 || parseFloat(acc.credit) > 0).map((acc: any) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-mono">{acc.accountCode}</TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{acc.accountType}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(acc.debit) > 0 ? formatCurrency(parseFloat(acc.debit)) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {parseFloat(acc.credit) > 0 ? formatCurrency(parseFloat(acc.credit)) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(parseFloat(tb.totalDebits || "0"))}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(parseFloat(tb.totalCredits || "0"))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!balanceSheet) {
      return <div className="text-center py-8 text-muted-foreground">Loading balance sheet...</div>;
    }
    const bs = balanceSheet as any;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(parseFloat(bs.totalAssets || "0"))}</div>
              <div className="text-sm text-muted-foreground">Total Assets</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(parseFloat(bs.totalLiabilities || "0"))}</div>
              <div className="text-sm text-muted-foreground">Total Liabilities</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(parseFloat(bs.totalEquity || "0"))}</div>
              <div className="text-sm text-muted-foreground">Total Equity</div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assets</CardTitle>
            </CardHeader>
            <CardContent>
              {bs.assets?.length > 0 ? (
                <Table>
                  <TableBody>
                    {bs.assets.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(parseFloat(bs.totalAssets || "0"))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No assets recorded</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Liabilities & Equity</CardTitle>
            </CardHeader>
            <CardContent>
              {(bs.liabilities?.length > 0 || bs.equity?.length > 0) ? (
                <Table>
                  <TableBody>
                    {bs.liabilities?.map((item: any, i: number) => (
                      <TableRow key={`l-${i}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</TableCell>
                      </TableRow>
                    ))}
                    {bs.liabilities?.length > 0 && (
                      <TableRow className="font-semibold">
                        <TableCell>Total Liabilities</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(parseFloat(bs.totalLiabilities || "0"))}</TableCell>
                      </TableRow>
                    )}
                    {bs.equity?.map((item: any, i: number) => (
                      <TableRow key={`e-${i}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(parseFloat(bs.totalLiabilities || "0") + parseFloat(bs.totalEquity || "0"))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No liabilities or equity recorded</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderProfitLoss = () => {
    if (!profitLoss) {
      return <div className="text-center py-8 text-muted-foreground">Loading profit & loss...</div>;
    }

    const {
      totalRevenue: revStr,
      totalExpenses: expStr,
      netIncome: netStr,
      revenue = [],
      expenses = []
    } = profitLoss as any;

    const totalRevenue = parseFloat(revStr || "0");
    const totalExpensesAndCOGS = parseFloat(expStr || "0"); // Contains both Operating Expenses and COGS

    // Separate COGS from Operating Expenses based on accountCode
    const cogsAccount = expenses.find((acc: any) => acc.accountCode === "5000");
    const totalCOGS = Math.abs(parseFloat(cogsAccount?.amount || "0"));

    const operatingExpenses = expenses.filter((acc: any) =>
      acc.accountCode?.startsWith("6") && Math.abs(parseFloat(acc.amount || "0")) > 0
    );
    const totalOperatingExpenses = operatingExpenses.reduce((sum: number, acc: any) =>
      sum + Math.abs(parseFloat(acc.amount || "0")), 0
    );

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = parseFloat(netStr || "0");

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(totalRevenue)}</div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-destructive">{formatCurrency(totalCOGS)}</div>
              <div className="text-sm text-muted-foreground">Cost of Goods Sold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold font-mono ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(grossProfit)}
              </div>
              <div className="text-sm text-muted-foreground">Gross Profit</div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Sales Revenue (4000)</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalRevenue)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Cost of Goods Sold (5000)</TableCell>
                  <TableCell className="text-right font-mono text-destructive">({formatCurrency(totalCOGS)})</TableCell>
                </TableRow>
                <TableRow className="border-t-2 bg-muted/30">
                  <TableCell className="font-bold">Gross Profit</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {formatCurrency(grossProfit)}
                  </TableCell>
                </TableRow>
                {operatingExpenses.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold pt-4">Operating Expenses</TableCell>
                    </TableRow>
                    {operatingExpenses.map((acc: any) => (
                      <TableRow key={acc.id || acc.accountCode}>
                        <TableCell className="pl-6">{acc.name} ({acc.accountCode})</TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          ({formatCurrency(Math.abs(parseFloat(acc.amount || "0")))})
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-medium">Total Operating Expenses</TableCell>
                      <TableCell className="text-right font-mono text-destructive">({formatCurrency(totalOperatingExpenses)})</TableCell>
                    </TableRow>
                  </>
                )}
                <TableRow className="border-t-2 bg-primary/5">
                  <TableCell className="font-bold text-lg">Net Profit / (Loss)</TableCell>
                  <TableCell className={`text-right font-mono font-bold text-lg ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    {netProfit >= 0 ? formatCurrency(netProfit) : `(${formatCurrency(Math.abs(netProfit))})`}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDailySummary = () => {
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.saleDate || "");
      const today = new Date();
      return saleDate.toDateString() === today.toDateString();
    });
    const todayTotal = todaySales.reduce((sum, s) => sum + parseFloat(s.total || "0"), 0);
    const todayCash = todaySales.reduce((sum, s) => sum + parseFloat(s.cashAmount || "0"), 0);
    const todayCard = todaySales.reduce((sum, s) => sum + parseFloat(s.cardAmount || "0"), 0);
    const todayCredit = todaySales.reduce((sum, s) => sum + parseFloat(s.creditAmount || "0"), 0);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(todayTotal)}</div>
              <div className="text-sm text-muted-foreground">Today's Sales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(todayCash)}</div>
              <div className="text-sm text-muted-foreground">Cash Collected</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-blue-600">{formatCurrency(todayCard)}</div>
              <div className="text-sm text-muted-foreground">Card Payments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-orange-600">{formatCurrency(todayCredit)}</div>
              <div className="text-sm text-muted-foreground">Credit Sales</div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Daily Closing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-2">Opening Position</h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Accounts Receivable</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totalReceivables)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Accounts Payable</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{formatCurrency(totalPayables)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Today's Activity</h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Transactions</TableCell>
                      <TableCell className="text-right">{todaySales.length}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Total Revenue</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{formatCurrency(todayTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderExpiryReport = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expiringProducts = products.filter(p => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      return expiry <= ninetyDaysFromNow;
    }).sort((a, b) => {
      const dateA = new Date(a.expiryDate || "");
      const dateB = new Date(b.expiryDate || "");
      return dateA.getTime() - dateB.getTime();
    });

    const expiredCount = expiringProducts.filter(p => new Date(p.expiryDate!) <= now).length;
    const criticalCount = expiringProducts.filter(p => {
      const expiry = new Date(p.expiryDate!);
      return expiry > now && expiry <= thirtyDaysFromNow;
    }).length;
    const warningCount = expiringProducts.filter(p => {
      const expiry = new Date(p.expiryDate!);
      return expiry > thirtyDaysFromNow && expiry <= ninetyDaysFromNow;
    }).length;

    const getExpiryStatus = (expiryDate: string) => {
      const expiry = new Date(expiryDate);
      if (expiry <= now) return { label: "Expired", variant: "destructive" as const };
      if (expiry <= thirtyDaysFromNow) return { label: "Critical", variant: "destructive" as const };
      return { label: "Warning", variant: "secondary" as const };
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{expiredCount}</div>
              <div className="text-sm text-muted-foreground">Expired Products</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{criticalCount}</div>
              <div className="text-sm text-muted-foreground">Expiring in 30 Days</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
              <div className="text-sm text-muted-foreground">Expiring in 90 Days</div>
            </CardContent>
          </Card>
        </div>
        {expiringProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No products expiring within 90 days</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiringProducts.map(product => {
                const status = getExpiryStatus(product.expiryDate!);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-mono">{product.sku || "-"}</TableCell>
                    <TableCell>{new Date(product.expiryDate!).toLocaleDateString()}</TableCell>
                    <TableCell>{product.productQty || 0}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  const renderReorderReport = () => {
    const reorderProducts = products.filter(p => {
      const reorderPoint = parseInt(p.reorderPoint || "0");
      const qty = p.productQty || 0;
      return reorderPoint > 0 && qty <= reorderPoint;
    }).sort((a, b) => {
      const aRatio = (a.productQty || 0) / parseInt(a.reorderPoint || "1");
      const bRatio = (b.productQty || 0) / parseInt(b.reorderPoint || "1");
      return aRatio - bRatio;
    });

    const criticalCount = reorderProducts.filter(p => (p.productQty || 0) === 0).length;
    const lowStockCount = reorderProducts.filter(p => {
      const qty = p.productQty || 0;
      const reorder = parseInt(p.reorderPoint || "0");
      return qty > 0 && qty <= reorder;
    }).length;

    const getStockStatus = (qty: number, reorderPoint: number) => {
      if (qty === 0) return { label: "Out of Stock", variant: "destructive" as const };
      if (qty <= reorderPoint / 2) return { label: "Critical", variant: "destructive" as const };
      return { label: "Low Stock", variant: "secondary" as const };
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{reorderProducts.length}</div>
              <div className="text-sm text-muted-foreground">Products at/Below Reorder Point</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
              <div className="text-sm text-muted-foreground">Out of Stock</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{lowStockCount}</div>
              <div className="text-sm text-muted-foreground">Low Stock</div>
            </CardContent>
          </Card>
        </div>
        {reorderProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">All products are above reorder point</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Current Qty</TableHead>
                <TableHead className="text-right">Reorder Point</TableHead>
                <TableHead className="text-right">Suggested Order</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reorderProducts.map(product => {
                const qty = product.productQty || 0;
                const reorderPoint = parseInt(product.reorderPoint || "0");
                const suggestedOrder = Math.max(reorderPoint * 2 - qty, reorderPoint);
                const status = getStockStatus(qty, reorderPoint);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="font-mono">{product.sku || "-"}</TableCell>
                    <TableCell className="text-right font-mono">{qty}</TableCell>
                    <TableCell className="text-right font-mono">{reorderPoint}</TableCell>
                    <TableCell className="text-right font-mono text-blue-600">{suggestedOrder}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  const renderEmployeeWorkReport = () => {
    const totalHours = employeeWorkReport.reduce((sum, item) => sum + parseFloat(item.hours || "0"), 0);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end mb-4 print:hidden">
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {employeesList.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print Report
          </Button>
        </div>

        {!selectedEmployeeId ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Please select an employee to view the report</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-blue-50 border-blue-100">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-700">{totalHours.toFixed(2)}</div>
                  <div className="text-sm text-blue-600 font-medium text-muted-foreground uppercase tracking-wider">Total Work Hours</div>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-100">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-700">{employeeWorkReport.length}</div>
                  <div className="text-sm text-green-600 font-medium text-muted-foreground uppercase tracking-wider">Timesheet Entries</div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-100">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-purple-700">
                    {new Set(employeeWorkReport.map(r => r.taskId)).size}
                  </div>
                  <div className="text-sm text-purple-600 font-medium text-muted-foreground uppercase tracking-wider">Unique Tasks</div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="font-bold text-gray-700">Date</TableHead>
                    <TableHead className="font-bold text-gray-700">Task Title</TableHead>
                    <TableHead className="font-bold text-gray-700">Project</TableHead>
                    <TableHead className="font-bold text-gray-700">Start Time</TableHead>
                    <TableHead className="font-bold text-gray-700">End Time</TableHead>
                    <TableHead className="font-bold text-gray-700">Status</TableHead>
                    <TableHead className="text-right font-bold text-gray-700">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeWorkReport.length > 0 ? (
                    employeeWorkReport.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium text-gray-900">{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-blue-600 font-medium">{item.taskTitle}</TableCell>
                        <TableCell className="text-gray-600">{item.projectName || "General Task"}</TableCell>
                        <TableCell className="text-gray-500 font-mono text-xs">{item.startTime ? format(new Date(item.startTime), "hh:mm a") : "-"}</TableCell>
                        <TableCell className="text-gray-500 font-mono text-xs">{item.endTime ? format(new Date(item.endTime), "hh:mm a") : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            item.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                            item.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }>
                            {item.status || 'todo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-gray-900">{parseFloat(item.hours).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-gray-400 italic">No task entries found for the selected period.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {employeeWorkReport.length > 0 && (
                  <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <TableRow>
                      <TableCell colSpan={6} className="text-right py-4 text-gray-700">Total Accumulated Hours</TableCell>
                      <TableCell className="text-right py-4 text-xl text-blue-700 font-mono">{totalHours.toFixed(2)}</TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderActiveReport = () => {
    switch (activeReport) {
      case "overall": return renderOverallReport();
      case "sales": return renderSalesReport();
      case "purchases": return renderPurchaseReport();
      case "customers": return renderCustomerTransactions();
      case "suppliers": return renderSupplierTransactions();
      case "receivables": return renderReceivables();
      case "payables": return renderPayables();
      case "vat": return renderVatPayable();
      case "trial-balance": return renderTrialBalance();
      case "balance-sheet": return renderBalanceSheet();
      case "profit-loss": return renderProfitLoss();
      case "daily": return renderDailySummary();
      case "expiry": return renderExpiryReport();
      case "reorder": return renderReorderReport();
      case "salary": return renderSalaryReport();
      case "project": return renderProjectReport();
      case "petty-cash": return renderPettyCashReport();
      case "employee-work": return renderEmployeeWorkReport();
      case "service-tickets": return renderServiceReport();
      default: return renderTrialBalance();
    }
  };

  const renderSalaryReport = () => {
    const payments = (salaryReport as any)?.payments || [];
    const summary = (salaryReport as any)?.summary || {};
    const byEmployee = (salaryReport as any)?.byEmployee || [];

    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={selectedEmployeeId || "__all__"} onValueChange={(v) => setSelectedEmployeeId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Employees</SelectItem>
                {employeesList.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(summary.totalGross)}</div>
              <div className="text-sm text-muted-foreground">Total Gross Salary</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(summary.totalDeductions)}</div>
              <div className="text-sm text-muted-foreground">Total Deductions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono">{formatCurrency(summary.totalNet)}</div>
              <div className="text-sm text-muted-foreground">Total Net Paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.paymentCount || 0}</div>
              <div className="text-sm text-muted-foreground">Payments</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Salary by Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEmployee.map((item: any) => (
                  <TableRow key={item.employee.id}>
                    <TableCell className="font-medium">{item.employee.name}</TableCell>
                    <TableCell className="text-right">{item.payments.length}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Month/Year</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 50).map((payment: any) => {
                  const emp = employeesList.find(e => e.id === payment.employeeId);
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{emp?.name || "Unknown"}</TableCell>
                      <TableCell>{payment.month}/{payment.year}</TableCell>
                      <TableCell>{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(payment.grossSalary)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(payment.deductions)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(payment.netSalary)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderProjectReport = () => {
    const income = (projectReport as any)?.income || [];
    const expenses = (projectReport as any)?.expenses || [];
    const tasksList = (projectReport as any)?.tasks || [];
    const summary = (projectReport as any)?.summary || {};

    const totalPending = income.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.amount || 0) - Number(item.paidAmount || 0)), 0);

    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select value={selectedProjectId || "__all__"} onValueChange={(v) => setSelectedProjectId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Projects</SelectItem>
                {projectsList.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={selectedEmployeeId || "__all__"} onValueChange={(v) => setSelectedEmployeeId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Employees</SelectItem>
                {employeesList.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(summary.totalIncome)}</div>
              <div className="text-sm text-muted-foreground">Total Income</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-orange-600">{formatCurrency(totalPending)}</div>
              <div className="text-sm text-muted-foreground">Total Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-red-600">{formatCurrency(summary.totalExpenses)}</div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold font-mono ${parseFloat(summary.netProfit || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(summary.netProfit)}
              </div>
              <div className="text-sm text-muted-foreground">Net Profit</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.taskCount || 0}</div>
              <div className="text-sm text-muted-foreground">Tasks</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="income" className="space-y-4">
          <TabsList>
            <TabsTrigger value="income">Income ({income.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasksList.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="income">
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {income.slice(0, 50).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.projectName}</TableCell>
                        <TableCell>{item.description || "-"}</TableCell>
                        <TableCell>{item.paymentDate ? new Date(item.paymentDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-right font-mono text-gray-900">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(item.paidAmount || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-orange-600">{formatCurrency(Math.max(0, Number(item.amount || 0) - Number(item.paidAmount || 0)))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.slice(0, 50).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.projectName}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{item.category || "other"}</Badge></TableCell>
                        <TableCell>{item.description || "-"}</TableCell>
                        <TableCell>{item.employeeName || "-"}</TableCell>
                        <TableCell>{item.expenseDate ? new Date(item.expenseDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Est. Hours</TableHead>
                      <TableHead className="text-right">Actual Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasksList.slice(0, 50).map((task: any) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.projectName}</TableCell>
                        <TableCell>{task.title}</TableCell>
                        <TableCell>{task.assigneeName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={task.status === "completed" ? "default" : task.status === "in_progress" ? "secondary" : "outline"}>
                            {task.status?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "secondary" : "outline"}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{task.estimatedHours || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{task.actualHours || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  const renderOverallReport = () => {
    const report = (overallReport as any) || { summary: { totalIncome: "0", totalExpense: "0", netProfit: "0" }, transactions: [] };
    
    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-end flex-wrap print:hidden">
          <div className="space-y-1">
            <Label>Warehouse</Label>
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(report.summary.totalIncome)}</div>
              <div className="text-sm text-muted-foreground">Total Income</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-red-600">{formatCurrency(report.summary.totalExpense)}</div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold font-mono ${parseFloat(report.summary.netProfit || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(report.summary.netProfit)}
              </div>
              <div className="text-sm text-muted-foreground">Net Profit/Loss</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Transactions Breakdown</CardTitle>
            <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </CardHeader>
          <CardContent>
            {isOverallLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading report data...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.transactions?.map((t: any, idx: number) => (
                    <TableRow key={`${t.id}-${idx}`}>
                      <TableCell>{t.date ? new Date(t.date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.category}</Badge>
                      </TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className="font-mono text-xs">{t.reference || "-"}</TableCell>
                      <TableCell className={`text-right font-mono ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!report.transactions || report.transactions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions found for the selected filters.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderServiceReport = () => {
    const totalAmount = serviceTicketReport.reduce((sum, t) => sum + parseFloat(t.totalAmount || "0"), 0);
    const totalPaid = serviceTicketReport.reduce((sum, t) => sum + parseFloat(t.paidAmount || "0"), 0);
    const totalCredit = serviceTicketReport.reduce((sum, t) => sum + parseFloat(t.creditAmount || "0"), 0);

    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-end flex-wrap print:hidden">
          <div className="space-y-1">
            <Label>Technician</Label>
            <Select value={selectedEmployeeId || "__all__"} onValueChange={(v) => setSelectedEmployeeId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Technicians" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Technicians</SelectItem>
                {employeesList.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Payment Status</Label>
            <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="outstanding">Outstanding</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-blue-600">{formatCurrency(totalAmount)}</div>
              <div className="text-sm text-muted-foreground">Total Service Value (with VAT)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(totalPaid)}</div>
              <div className="text-sm text-muted-foreground">Successfully Collected</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-destructive">{formatCurrency(totalCredit)}</div>
              <div className="text-sm text-muted-foreground">Outstanding / Pending</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service Ticket Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceTicketReport.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono font-medium">{ticket.ticketNumber}</TableCell>
                    <TableCell>{new Date(ticket.receivedDate).toLocaleDateString()}</TableCell>
                    <TableCell>{ticket.customerName}</TableCell>
                    <TableCell>{ticket.deviceType} {ticket.deviceModel}</TableCell>
                    <TableCell>{ticket.technicianName || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(parseFloat(ticket.serviceAmount || "0") + parseFloat(ticket.partsAmount || "0"))}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCurrency(ticket.vatAmount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatCurrency(ticket.totalAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{formatCurrency(ticket.paidAmount)}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{formatCurrency(ticket.creditAmount)}</TableCell>
                  </TableRow>
                ))}
                {serviceTicketReport.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No service tickets found for the selected filters.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPettyCashReport = () => {
    const report = (pettyCashReport as any) || { totalIncome: "0", totalExpense: "0", totalReturns: "0", netCash: "0", transactions: [] };
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(report.totalIncome)}</div>
              <div className="text-sm text-muted-foreground">Total Income (Deposits)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-red-600">{formatCurrency(report.totalExpense)}</div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold font-mono text-blue-600">{formatCurrency(report.totalReturns)}</div>
              <div className="text-sm text-muted-foreground">Returned to Bank</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold font-mono ${parseFloat(report.netCash || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(report.netCash)}
              </div>
              <div className="text-sm text-muted-foreground">Net Cash Change</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Petty Cash Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.transactions?.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.transactionDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={t.type === "deposit" ? "default" : t.type === "return" ? "secondary" : "outline"} className="capitalize">
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.description || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{t.reference || "-"}</TableCell>
                    <TableCell className={`text-right font-mono ${t.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "deposit" ? "+" : "-"}{formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!report.transactions || report.transactions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions found for the selected period.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
          <BarChart3 className="w-6 h-6" />
          Reports
        </h1>
      </div>

      <div className="flex flex-wrap gap-4 items-end print:hidden">
        <div className="space-y-1">
          <Label>Date Range</Label>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateRange === "custom" && (
          <>
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label>Shop</Label>
          <Select value={shopId} onValueChange={(v) => { setShopId(v === "all" ? "" : v); setBranchId(""); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-shop">
              <SelectValue placeholder="All Shops" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shops</SelectItem>
              {shops.map(shop => (
                <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Branch</Label>
          <Select value={branchId} onValueChange={(v) => setBranchId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]" data-testid="select-branch">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {filteredBranches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 print:block">
        <div className="col-span-3 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Report Types</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {reportTypes.map(report => (
                  <Button
                    key={report.id}
                    variant={activeReport === report.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveReport(report.id)}
                    data-testid={`button-report-${report.id}`}
                  >
                    <report.icon className="w-4 h-4 mr-2" />
                    {report.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-9 print:col-span-12">
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="print:px-0 print:pt-0">
              <CardTitle className="flex items-center gap-2 print:text-2xl">
                {reportTypes.find(r => r.id === activeReport)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="print:px-0">
              {renderActiveReport()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
