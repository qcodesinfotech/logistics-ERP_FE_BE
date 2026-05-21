import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, Trash2, ArrowRightLeft } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { useAuth } from "@/contexts/auth-context";
import type { PettyCash, Shop, BankAccount } from "@shared/schema";

const pettyCashSchema = z.object({
  name: z.string().min(1, "Name is required"),
  shopId: z.string().min(1, "Shop is required"),
  branchId: z.string().optional(),
  openingBalance: z.string().default("0.000"),
});

const transactionSchema = z.object({
  pettyCashId: z.string().min(1, "Petty cash account is required"),
  type: z.enum(["deposit", "withdrawal", "return"]),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
  reference: z.string().optional(),
  bankAccountId: z.string().optional(),
}).refine((data) => {
  // For deposits and returns, bank account is required
  if ((data.type === "deposit" || data.type === "return") && !data.bankAccountId) {
    return false;
  }
  return true;
}, {
  message: "Bank account is required for this transaction type",
  path: ["bankAccountId"],
});

type PettyCashFormData = z.infer<typeof pettyCashSchema>;
type TransactionFormData = z.infer<typeof transactionSchema>;

interface PettyCashTransaction {
  id: string;
  pettyCashId: string;
  transactionDate: string;
  type: string;
  amount: string;
  description: string | null;
  reference: string | null;
}

export default function PettyCashPage() {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const accountForm = useForm<PettyCashFormData>({
    resolver: zodResolver(pettyCashSchema),
    defaultValues: {
      name: "",
      shopId: "",
      branchId: "",
      openingBalance: "0.000",
    },
  });

  const transactionForm = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      pettyCashId: "",
      type: "deposit",
      amount: "",
      description: "",
      reference: "",
      bankAccountId: "",
    },
  });
  
  const transactionType = transactionForm.watch("type");

  const { data: pettyCashAccounts, isLoading } = useQuery<PettyCash[]>({
    queryKey: ["/api/petty-cash"],
  });

  const { data: transactions } = useQuery<PettyCashTransaction[]>({
    queryKey: ["/api/petty-cash-transactions"],
  });

  const { data: shops } = useQuery<Shop[]>({
    queryKey: ["/api/shops"],
  });
  
  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: PettyCashFormData) => apiRequest("POST", "/api/petty-cash", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash"] });
      toast({ title: "Petty cash account created successfully" });
      setIsAccountDialogOpen(false);
      accountForm.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormData) => apiRequest("POST", "/api/petty-cash-transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Transaction recorded successfully" });
      setIsTransactionDialogOpen(false);
      transactionForm.reset();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to record transaction", variant: "destructive" });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/petty-cash-transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash-transactions"] });
      toast({ title: "Transaction deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to delete transaction", variant: "destructive" });
    },
  });

  const totalBalance = pettyCashAccounts?.reduce(
    (sum, acc) => sum + parseFloat(acc.currentBalance || "0"),
    0
  ) || 0;

  const getShopName = (shopId: string) => {
    return shops?.find((s) => s.id === shopId)?.name || "Unknown";
  };

  const accountColumns = [
    { key: "name", header: "Name" },
    { key: "shopId", header: "Shop", render: (p: PettyCash) => getShopName(p.shopId) },
    {
      key: "openingBalance",
      header: "Opening",
      className: "text-right",
      render: (p: PettyCash) => <CurrencyDisplay amount={p.openingBalance} />,
    },
    {
      key: "currentBalance",
      header: "Current",
      className: "text-right",
      render: (p: PettyCash) => <CurrencyDisplay amount={p.currentBalance} />,
    },
  ];

  const transactionColumns = [
    {
      key: "transactionDate",
      header: "Date",
      render: (t: PettyCashTransaction) => new Date(t.transactionDate).toLocaleDateString(),
    },
    {
      key: "type",
      header: "Type",
      render: (t: PettyCashTransaction) => (
        <div className="flex items-center gap-1">
          {t.type === "deposit" ? (
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          ) : t.type === "return" ? (
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
          ) : (
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="capitalize">{t.type === "return" ? "Return to Bank" : t.type}</span>
        </div>
      ),
    },
    { key: "description", header: "Description", render: (t: PettyCashTransaction) => t.description || "-" },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (t: PettyCashTransaction) => (
        <CurrencyDisplay
          amount={t.amount}
          showSign
          className={t.type === "deposit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (t: PettyCashTransaction) => (
        isSuperAdmin ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Delete Transaction">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the petty cash transaction and revert any changes made to the bank balance and accounting records. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteTransactionMutation.mutate(t.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null
      )
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Petty Cash"
        description="Manage petty cash accounts and transactions"
      >
        <div className="flex gap-2">
          <Button onClick={() => setIsTransactionDialogOpen(true)} variant="outline" data-testid="button-new-transaction">
            <Plus className="h-4 w-4 mr-2" />
            Transaction
          </Button>
          <Button onClick={() => setIsAccountDialogOpen(true)} data-testid="button-add-account">
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <MetricCardsSkeleton count={1} />
      ) : (
        <MetricCard
          title="Total Petty Cash"
          value={totalBalance}
          icon={Wallet}
          isCurrency
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={3} cols={4} />
            ) : !pettyCashAccounts || pettyCashAccounts.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No petty cash accounts"
                description="Create a petty cash account to track small expenses."
              />
            ) : (
              <DataTable
                columns={accountColumns}
                data={pettyCashAccounts}
                getRowKey={(p) => p.id}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {!transactions || transactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No transactions"
                description="Record deposits and expenses."
              />
            ) : (
              <DataTable
                columns={transactionColumns}
                data={transactions.slice(0, 10)}
                getRowKey={(t) => t.id}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Petty Cash Account</DialogTitle>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit((d) => createAccountMutation.mutate(d))} className="space-y-4">
              <FormField
                control={accountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-account-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accountForm.control}
                name="shopId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-shop">
                          <SelectValue placeholder="Select shop" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {shops?.map((shop) => (
                          <SelectItem key={shop.id} value={shop.id}>
                            {shop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accountForm.control}
                name="openingBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance (RO)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.001" data-testid="input-opening-balance" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAccountDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAccountMutation.isPending} data-testid="button-save-account">
                  {createAccountMutation.isPending ? "Saving..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
          </DialogHeader>
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit((d) => createTransactionMutation.mutate(d))} className="space-y-4">
              <FormField
                control={transactionForm.control}
                name="pettyCashId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pettyCashAccounts?.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transactionForm.control}
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
                        <SelectItem value="deposit">Deposit (From Bank)</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal / Expense</SelectItem>
                        <SelectItem value="return">Return to Bank</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transactionForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (RO) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.001" data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(transactionType === "deposit" || transactionType === "return") && (
                <FormField
                  control={transactionForm.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{transactionType === "deposit" ? "Deduct From Bank Account *" : "Return To Bank Account *"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank-account">
                            <SelectValue placeholder="Select bank account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankAccounts?.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} - <CurrencyDisplay amount={acc.currentBalance} />
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
                control={transactionForm.control}
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
                <Button type="button" variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTransactionMutation.isPending} data-testid="button-save-transaction">
                  {createTransactionMutation.isPending ? "Saving..." : "Record"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
