import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PiggyBank, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CurrencyDisplay } from "@/components/currency-display";
import { MetricCard } from "@/components/metric-card";
import { TableSkeleton, MetricCardsSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Capital, Company, BankAccount } from "@shared/schema";

const capitalSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  bankAccountId: z.string().min(1, "Bank account is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["initial", "additional"]),
  description: z.string().optional(),
});

type CapitalFormData = z.infer<typeof capitalSchema>;

export default function CapitalPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CapitalFormData>({
    resolver: zodResolver(capitalSchema),
    defaultValues: {
      companyId: "",
      bankAccountId: "",
      amount: "",
      type: "initial",
      description: "",
    },
  });

  const { data: capitalEntries, isLoading } = useQuery<Capital[]>({
    queryKey: ["/api/capital"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: CapitalFormData) => apiRequest("POST", "/api/capital", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capital"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Capital entry recorded successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const totalCapital = capitalEntries?.reduce(
    (sum, entry) => sum + parseFloat(entry.amount || "0"),
    0
  ) || 0;

  const getCompanyName = (companyId: string) => {
    return companies?.find((c) => c.id === companyId)?.name || "Unknown";
  };

  const getBankAccountName = (bankAccountId: string | null) => {
    if (!bankAccountId) return "-";
    return bankAccounts?.find((b) => b.id === bankAccountId)?.name || "Unknown";
  };

  const columns = [
    {
      key: "transactionDate",
      header: "Date",
      render: (c: Capital) => new Date(c.transactionDate!).toLocaleDateString(),
    },
    { key: "companyId", header: "Company", render: (c: Capital) => getCompanyName(c.companyId || "") },
    { key: "type", header: "Type", render: (c: Capital) => <span className="capitalize">{c.type}</span> },
    { key: "bankAccountId", header: "Bank Account", render: (c: Capital) => getBankAccountName(c.bankAccountId) },
    { key: "description", header: "Description", render: (c: Capital) => c.description || "-" },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (c: Capital) => <CurrencyDisplay amount={c.amount} />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Capital"
        description="Manage company capital contributions"
      >
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-capital">
          <Plus className="h-4 w-4 mr-2" />
          Add Capital
        </Button>
      </PageHeader>

      {isLoading ? (
        <MetricCardsSkeleton count={1} />
      ) : (
        <MetricCard
          title="Total Capital"
          value={totalCapital}
          icon={PiggyBank}
          isCurrency
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capital Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : !capitalEntries || capitalEntries.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No capital entries yet"
              description="Record initial or additional capital contributions."
            >
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Capital
              </Button>
            </EmptyState>
          ) : (
            <DataTable
              columns={columns}
              data={capitalEntries}
              getRowKey={(c) => c.id}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Capital</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-company">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="initial">Initial Capital</SelectItem>
                        <SelectItem value="additional">Additional Capital</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit to Bank Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bank-account">
                          <SelectValue placeholder="Select bank account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bankAccounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (BD) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.001" data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-capital">
                  {createMutation.isPending ? "Saving..." : "Add Capital"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
