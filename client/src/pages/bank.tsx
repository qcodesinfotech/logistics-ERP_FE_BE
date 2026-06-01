import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Banknote, Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
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
import type { BankAccount, BankTransaction, Company } from "@shared/schema";

const bankAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  companyId: z.string().min(1, "Company is required"),
  openingBalance: z.string().default("0.000"),
  status: z.string().default("active"),
});

const transactionSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.string().min(1, "Amount is required"),
  reference: z.string().optional(),
  description: z.string().optional(),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;
type TransactionFormData = z.infer<typeof transactionSchema>;

export default function Bank() {
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const { toast } = useToast();

  const accountForm = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      name: "",
      accountNumber: "",
      bankName: "",
      companyId: "",
      openingBalance: "0.000",
      status: "active",
    },
  });

  const transactionForm = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      bankAccountId: "",
      type: "deposit",
      amount: "",
      reference: "",
      description: "",
    },
  });

  const { data: bankAccounts, isLoading: isLoadingAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<BankTransaction[]>({
    queryKey: [selectedAccountId === "all" ? "/api/bank-transactions" : `/api/bank-transactions?accountId=${selectedAccountId}`],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: BankAccountFormData) => apiRequest("POST", "/api/bank-accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Bank account created successfully" });
      handleCloseAccountDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: (data: BankAccountFormData & { id: string }) =>
      apiRequest("PATCH", `/api/bank-accounts/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Bank account updated successfully" });
      handleCloseAccountDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bank-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Bank account deleted successfully" });
      setDeletingAccount(null);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormData) => apiRequest("POST", "/api/bank-transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Transaction recorded successfully" });
      handleCloseTransactionDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleCloseAccountDialog = () => {
    setIsAccountDialogOpen(false);
    setEditingAccount(null);
    accountForm.reset();
  };

  const handleCloseTransactionDialog = () => {
    setIsTransactionDialogOpen(false);
    transactionForm.reset();
  };

  const handleEditAccount = (account: BankAccount) => {
    setEditingAccount(account);
    accountForm.reset({
      name: account.name,
      accountNumber: account.accountNumber || "",
      bankName: account.bankName || "",
      companyId: account.companyId || "",
      openingBalance: account.openingBalance || "0.000",
      status: account.status,
    });
    setIsAccountDialogOpen(true);
  };

  const onSubmitAccount = (data: BankAccountFormData) => {
    if (editingAccount) {
      updateAccountMutation.mutate({ ...data, id: editingAccount.id });
    } else {
      createAccountMutation.mutate(data);
    }
  };

  const onSubmitTransaction = (data: TransactionFormData) => {
    createTransactionMutation.mutate(data);
  };

  const totalBalance = bankAccounts?.reduce(
    (sum, acc) => sum + parseFloat(acc.currentBalance || "0"),
    0
  ) || 0;

  const accountColumns = [
    { key: "name", header: "Account Name" },
    { key: "bankName", header: "Bank", render: (a: BankAccount) => a.bankName || "-" },
    { key: "accountNumber", header: "Account #", render: (a: BankAccount) => a.accountNumber || "-" },
    {
      key: "openingBalance",
      header: "Opening",
      className: "text-right",
      render: (a: BankAccount) => <CurrencyDisplay amount={a.openingBalance} />,
    },
    {
      key: "currentBalance",
      header: "Current",
      className: "text-right",
      render: (a: BankAccount) => <CurrencyDisplay amount={a.currentBalance} />,
    },
    {
      key: "status",
      header: "Status",
      render: (a: BankAccount) => <StatusBadge status={a.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (account: BankAccount) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEditAccount(account);
            }}
            data-testid={`button-edit-account-${account.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingAccount(account);
            }}
            data-testid={`button-delete-account-${account.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const transactionColumns = [
    {
      key: "transactionDate",
      header: "Date",
      render: (t: BankTransaction) => new Date(t.transactionDate!).toLocaleDateString(),
    },
    {
      key: "type",
      header: "Type",
      render: (t: BankTransaction) => (
        <div className="flex items-center gap-1">
          {t.type === "deposit" ? (
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="capitalize">{t.type}</span>
        </div>
      ),
    },
    { key: "reference", header: "Reference", render: (t: BankTransaction) => t.reference || "-" },
    { key: "description", header: "Description", render: (t: BankTransaction) => t.description || "-" },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (t: BankTransaction) => (
        <CurrencyDisplay
          amount={t.amount}
          showSign
          className={t.type === "deposit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Bank Accounts"
        description="Manage bank accounts and track transactions"
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

      {isLoadingAccounts ? (
        <MetricCardsSkeleton count={1} />
      ) : (
        <MetricCard
          title="Total Bank Balance"
          value={totalBalance}
          icon={Banknote}
          isCurrency
        />
      )}

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card>
            <CardContent className="pt-6">
              {isLoadingAccounts ? (
                <TableSkeleton rows={5} cols={7} />
              ) : !bankAccounts || bankAccounts.length === 0 ? (
                <EmptyState
                  icon={Banknote}
                  title="No bank accounts yet"
                  description="Add your first bank account to start tracking finances."
                >
                  <Button onClick={() => setIsAccountDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </EmptyState>
              ) : (
                <DataTable
                  columns={accountColumns}
                  data={bankAccounts}
                  getRowKey={(account) => account.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <CardTitle className="text-base">Transaction History</CardTitle>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {bankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {isLoadingTransactions ? (
                <TableSkeleton rows={5} cols={5} />
              ) : !transactions || transactions.length === 0 ? (
                <EmptyState
                  icon={Banknote}
                  title="No transactions yet"
                  description="Record deposits and withdrawals to track your cash flow."
                />
              ) : (
                <DataTable
                  columns={transactionColumns}
                  data={transactions}
                  getRowKey={(t) => t.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAccountDialogOpen} onOpenChange={handleCloseAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Edit Bank Account" : "Add Bank Account"}
            </DialogTitle>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(onSubmitAccount)} className="space-y-4">
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
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={accountForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-bank-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-account-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={accountForm.control}
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
                control={accountForm.control}
                name="openingBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance (BD)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.001" data-testid="input-opening-balance" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseAccountDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                  data-testid="button-save-account"
                >
                  {createAccountMutation.isPending || updateAccountMutation.isPending
                    ? "Saving..."
                    : editingAccount
                    ? "Update"
                    : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionDialogOpen} onOpenChange={handleCloseTransactionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
          </DialogHeader>
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit(onSubmitTransaction)} className="space-y-4">
              <FormField
                control={transactionForm.control}
                name="bankAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Account *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bank-account">
                          <SelectValue placeholder="Select account" />
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
                control={transactionForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-transaction-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
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
                    <FormLabel>Amount (BD) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.001" data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transactionForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                <Button type="button" variant="outline" onClick={handleCloseTransactionDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTransactionMutation.isPending}
                  data-testid="button-save-transaction"
                >
                  {createTransactionMutation.isPending ? "Saving..." : "Record Transaction"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAccount} onOpenChange={() => setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bank Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAccount?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteAccountMutation.mutate(deletingAccount.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
