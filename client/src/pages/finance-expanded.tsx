import { useState } from "react";
import { DollarSign, FileText, TrendingUp, Package, PlusCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { CurrencyDisplay } from "@/components/currency-display";
import { StatusBadge } from "@/components/status-badge";

export default function FinanceExpandedPage() {
  const [activeTab, setActiveTab] = useState("invoices");

  // Mock data for UI
  const invoices = [
    { id: "1", invoiceNumber: "INV-2026-001", type: "delivery", customer: "Al Raya Trading", amount: "1250.000", date: "2026-05-20", status: "paid" },
    { id: "2", invoiceNumber: "INV-2026-002", type: "contract", customer: "Muscat Logistics", amount: "5400.000", date: "2026-05-21", status: "pending" },
    { id: "3", invoiceNumber: "INV-2026-003", type: "delivery", customer: "Global Corp", amount: "850.500", date: "2026-05-22", status: "draft" }
  ];

  const expenses = [
    { id: "1", category: "fuel", description: "Trip TRP-1001 Refuel", amount: "45.000", date: "2026-05-21", status: "approved" },
    { id: "2", category: "toll", description: "Border crossing toll TRP-1001", amount: "15.500", date: "2026-05-21", status: "approved" },
    { id: "3", category: "clearing_agent", description: "Customs agent fee - TRP-1002", amount: "120.000", date: "2026-05-22", status: "pending" }
  ];

  const assets = [
    { id: "1", name: "Volvo FH16 Tractor", type: "truck", value: "45000.000", purchaseDate: "2024-01-15", status: "active" },
    { id: "2", name: "Trailer Axle Set", type: "spare_part", value: "1200.000", purchaseDate: "2025-11-20", status: "active" }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Expanded Finance" 
        description="Comprehensive tracking of invoices, dynamic expenses, profitability, and company assets."
      >
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" /> New Transaction
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <MetricCard
          title="Monthly Revenue"
          value="45200"
          isCurrency
          icon={TrendingUp}
          description="↑ 12% from last month"
        />
        <MetricCard
          title="Pending Invoices"
          value="12450"
          isCurrency
          icon={FileText}
          description="15 invoices awaiting payment"
        />
        <MetricCard
          title="Trip Expenses"
          value="8430"
          isCurrency
          icon={DollarSign}
          description="Fuel, tolls & agent fees"
        />
        <MetricCard
          title="Total Asset Value"
          value="1250000"
          isCurrency
          icon={Package}
          description="Trucks, trailers & spares"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border rounded-lg flex flex-wrap">
          <TabsTrigger value="invoices" className="px-4 py-2">Invoices</TabsTrigger>
          <TabsTrigger value="expenses" className="px-4 py-2">Dynamic Expenses</TabsTrigger>
          <TabsTrigger value="profitability" className="px-4 py-2">Profitability Analysis</TabsTrigger>
          <TabsTrigger value="assets" className="px-4 py-2">Company Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoicing & Billing</CardTitle>
                <CardDescription>Auto-generated delivery invoices and contract billing.</CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" /> Generate Invoice
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-mono font-semibold">{inv.invoiceNumber}</TableCell>
                      <TableCell className="capitalize text-xs font-mono">{inv.type}</TableCell>
                      <TableCell>{inv.customer}</TableCell>
                      <TableCell className="text-xs font-mono">{inv.date}</TableCell>
                      <TableCell className="text-right font-bold"><CurrencyDisplay amount={inv.amount} /></TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dynamic Expenses Tracker</CardTitle>
                <CardDescription>Track driver expenses, clearing agent costs, and transit tolls.</CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <PlusCircle className="h-4 w-4" /> Add Expense
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="capitalize font-semibold">{exp.category.replace('_', ' ')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{exp.description}</TableCell>
                      <TableCell className="text-xs font-mono">{exp.date}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600"><CurrencyDisplay amount={exp.amount} /></TableCell>
                      <TableCell><StatusBadge status={exp.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profitability" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle>Profitability per Route</CardTitle>
              <CardDescription>Analyze costs vs revenue for trips and contracts.</CardDescription>
            </CardHeader>
            <CardContent className="p-12 text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Cost vs Revenue Analysis</h3>
              <p>Profitability analytics engine is processing historical data. Connect to backend to view live metrics.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="m-0">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Company Assets & Inventory</CardTitle>
                <CardDescription>Manage trucks, heavy equipment, and high-value spare parts.</CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <Package className="h-4 w-4" /> Add Asset
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Valuation</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-accent/40 transition-colors">
                      <TableCell className="font-semibold">{asset.name}</TableCell>
                      <TableCell className="capitalize text-xs font-mono">{asset.type.replace('_', ' ')}</TableCell>
                      <TableCell className="text-xs font-mono">{asset.purchaseDate}</TableCell>
                      <TableCell className="text-right font-bold"><CurrencyDisplay amount={asset.value} /></TableCell>
                      <TableCell><StatusBadge status={asset.status} /></TableCell>
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
}
