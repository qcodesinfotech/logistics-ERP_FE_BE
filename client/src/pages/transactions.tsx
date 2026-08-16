import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Users, Building2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CustomerTransactionsLedger } from "@/pages/customers";
import { SupplierTransactionsLedger } from "@/pages/suppliers";
import type { Client, Supplier } from "@shared/schema";

export default function TransactionsPage() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  // Retrieve Customers (clients where isVendor is false)
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  const customers = clients.filter(c => !c.isVendor);

  // Retrieve Suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          Transactions Ledger
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Centralized search and history ledger for customer and supplier transactions.
        </p>
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            Customer Transactions
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Building2 className="h-4 w-4" />
            Supplier Transactions
          </TabsTrigger>
        </TabsList>

        {/* Customer Transactions */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Select Customer
              </CardTitle>
              <CardDescription>Select a customer to view their logistics orders and invoices statement</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="customer-select">Customer Name</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger id="customer-select">
                    <SelectValue placeholder={clientsLoading ? "Loading customers..." : "Choose a Customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} {customer.customerCode ? `(${customer.customerCode})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedCustomerId ? (
            <CustomerTransactionsLedger id={selectedCustomerId} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 opacity-20" />
                <span>Please select a customer to view their transactions ledger.</span>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Supplier Transactions */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Select Supplier
              </CardTitle>
              <CardDescription>Select a supplier to view their purchase invoices and payments statement</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="max-w-xs space-y-2">
                <Label htmlFor="supplier-select">Supplier Name</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger id="supplier-select">
                    <SelectValue placeholder={suppliersLoading ? "Loading suppliers..." : "Choose a Supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedSupplierId ? (
            <SupplierTransactionsLedger id={selectedSupplierId} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 opacity-20" />
                <span>Please select a supplier to view their transactions ledger.</span>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
