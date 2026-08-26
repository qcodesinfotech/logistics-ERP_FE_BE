import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { BankAccount } from "@shared/schema";

const expenseFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.string().min(1, "Amount is required"),
  category: z.string().min(1, "Category is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  bankAccountId: z.string().optional(),
  expenseDate: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

export default function ExpensesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: "",
      amount: "",
      category: "general",
      paymentMethod: "cash",
      bankAccountId: "",
      expenseDate: new Date().toISOString().split("T")[0],
    },
  });

  const { data: journalEntries, isLoading } = useQuery<any[]>({
    queryKey: ["/api/journal-entries", { sourceType: "general_expense" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/journal-entries?sourceType=general_expense");
      return response.json();
    }
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: (data: ExpenseFormData) => apiRequest("POST", "/api/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "General expense recorded successfully" });
      setIsDialogOpen(false);
      form.reset({
        description: "",
        amount: "",
        category: "general",
        paymentMethod: "cash",
        bankAccountId: "",
        expenseDate: new Date().toISOString().split("T")[0],
      });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const totalExpenses = journalEntries?.reduce(
    (sum, entry) => sum + parseFloat(entry.totalAmount || "0"),
    0
  ) || 0;

  const getBankAccountName = (bankAccountId: string | null) => {
    if (!bankAccountId) return "-";
    return bankAccounts?.find((b) => b.id === bankAccountId)?.name || "Unknown";
  };

  const paymentMethod = form.watch("paymentMethod");
  const showBankAccount = paymentMethod === "bank" || paymentMethod === "card" || paymentMethod === "transfer";

  const columns = [
    {
      key: "entryDate",
      header: "Date",
      render: (e: any) => e.entryDate ? new Date(e.entryDate).toLocaleDateString("en-GB") : "N/A",
    },
    {
      key: "entryNumber",
      header: "Reference",
      className: "font-mono font-semibold",
    },
    {
      key: "description",
      header: "Description",
    },
    {
      key: "category",
      header: "Category",
      render: (e: any) => {
        // Source description format is usually "category: description"
        const parts = e.description?.split(":");
        const category = parts && parts.length > 1 ? parts[0] : "General";
        return <span className="capitalize">{category}</span>;
      }
    },
    {
      key: "totalAmount",
      header: "Amount",
      className: "text-right",
      render: (e: any) => <CurrencyDisplay amount={e.totalAmount} />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="General Expenses"
        description="Track and record general company expenses"
      >
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-expense">
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </PageHeader>

      {isLoading ? (
        <MetricCardsSkeleton count={1} />
      ) : (
        <MetricCard
          title="Total Expenses"
          value={totalExpenses}
          icon={Receipt}
          isCurrency
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expenses Log</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !journalEntries || journalEntries.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No general expenses recorded yet"
              description="Record general expenses such as salaries, rents, utilities, or repairs."
            >
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </EmptyState>
          ) : (
            <DataTable
              columns={columns}
              data={journalEntries}
              getRowKey={(e) => e.id}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add General Expense</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Monthly internet bill" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="0.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">General Expense</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                        <SelectItem value="rent">Rent</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="repairs">Repairs & Maintenance</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank Account</SelectItem>
                        <SelectItem value="card">Credit/Debit Card</SelectItem>
                        <SelectItem value="transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showBankAccount && (
                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank-account">
                            <SelectValue placeholder="Select bank account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankAccounts?.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} (Balance: <CurrencyDisplay amount={account.currentBalance} />)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  Record Expense
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
