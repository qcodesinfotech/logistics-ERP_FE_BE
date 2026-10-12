import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Banknote, Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, ShieldAlert, CheckCircle2, Calendar, AlertCircle } from "lucide-react";
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
  DialogDescription,
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
import { useAuth } from "@/contexts/auth-context";
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
  bankCharges: z.string().optional(),
  transactionDate: z.string().min(1, "Transaction date is required"),
  reference: z.string().optional(),
  description: z.string().optional(),
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;
type TransactionFormData = z.infer<typeof transactionSchema>;

export default function Bank() {
  const { user } = useAuth();
  const isManagement = user && ["super_admin", "admin", "manager"].includes(user.role);

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<BankTransaction | null>(null);
  const [pendingTransactionData, setPendingTransactionData] = useState<TransactionFormData | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalModalMessage, setApprovalModalMessage] = useState("");
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
      bankCharges: "",
      transactionDate: new Date().toISOString().split("T")[0],
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

  const updateTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormData & { id: string }) =>
      apiRequest("PATCH", `/api/bank-transactions/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Transaction updated successfully" });
      handleCloseTransactionDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bank-transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Transaction deleted and balance adjusted" });
      setDeletingTransaction(null);
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
    setEditingTransaction(null);
    setPendingTransactionData(null);
    transactionForm.reset({
      bankAccountId: "",
      type: "deposit",
      amount: "",
      bankCharges: "",
      transactionDate: new Date().toISOString().split("T")[0],
      reference: "",
      description: "",
    });
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
    setPendingTransactionData(data);
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmTransaction = () => {
    if (!pendingTransactionData) return;
    if (editingTransaction) {
      updateTransactionMutation.mutate({ ...pendingTransactionData, id: editingTransaction.id });
    } else {
      createTransactionMutation.mutate(pendingTransactionData);
    }
    setIsConfirmDialogOpen(false);
  };

  const handleEditTransaction = (t: BankTransaction) => {
    if (!isManagement) {
      setApprovalModalMessage("Editing bank transactions requires Management (Manager or Admin) approval.");
      setIsApprovalModalOpen(true);
      return;
    }
    setEditingTransaction(t);
    transactionForm.reset({
      bankAccountId: t.bankAccountId,
      type: t.type as "deposit" | "withdrawal",
      amount: t.amount?.toString() || "",
      bankCharges: (t as any).bankCharges ? String((t as any).bankCharges) : "",
      transactionDate: t.transactionDate
        ? new Date(t.transactionDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      reference: t.reference || "",
      description: t.description || "",
    });
    setIsTransactionDialogOpen(true);
  };

  const handleDeleteTransaction = (t: BankTransaction) => {
    if (!isManagement) {
      setApprovalModalMessage("Deleting bank transactions requires Management (Manager or Admin) approval.");
      setIsApprovalModalOpen(true);
      return;
    }
    setDeletingTransaction(t);
  };

  const totalBalance = bankAccounts?.reduce(
    (sum, acc) => {
      const cur = parseFloat(acc.currentBalance || "0");
      const open = parseFloat(acc.openingBalance || "0");
      return sum + (cur !== 0 ? cur : open);
    },
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
    {
      key: "bankCharges",
      header: "Bank Charges",
      className: "text-right",
      render: (t: BankTransaction) => {
        const charges = parseFloat((t as any).bankCharges || "0");
        return charges > 0 ? (
          <CurrencyDisplay amount={charges.toFixed(3)} className="text-amber-600 dark:text-amber-400 font-medium" />
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      },
    },
    {
      key: "totalEffect",
      header: "Total Deducted / Added",
      className: "text-right",
      render: (t: BankTransaction) => {
        const amt = parseFloat(t.amount?.toString() || "0");
        const charges = t.type === "withdrawal" ? parseFloat((t as any).bankCharges || "0") : 0;
        const total = t.type === "deposit" ? amt : amt + charges;
        return (
          <CurrencyDisplay
            amount={total.toFixed(3)}
            showSign
            className={t.type === "deposit" ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}
          />
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (t: BankTransaction) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Edit Transaction (Requires Management Approval)"
            onClick={(e) => {
              e.stopPropagation();
              handleEditTransaction(t);
            }}
            data-testid={`button-edit-transaction-${t.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-700"
            title="Delete Transaction (Requires Management Approval)"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTransaction(t);
            }}
            data-testid={`button-delete-transaction-${t.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
            <DialogTitle>
              {editingTransaction ? "Edit Bank Transaction" : "New Transaction"}
            </DialogTitle>
            {editingTransaction && (
              <DialogDescription className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" />
                Management Approval Verified ({user?.role?.toUpperCase()})
              </DialogDescription>
            )}
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
                            {account.name} ({account.bankName || "Bank"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
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
                  name="transactionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Date *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-transaction-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className={`grid gap-4 ${transactionForm.watch("type") === "withdrawal" ? "md:grid-cols-2" : "grid-cols-1"}`}>
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
                {transactionForm.watch("type") === "withdrawal" && (
                  <FormField
                    control={transactionForm.control}
                    name="bankCharges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Charges (BD)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            data-testid="input-bank-charges"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              {transactionForm.watch("type") === "withdrawal" && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Transaction Value:</span>
                    <span className="font-medium text-foreground">
                      {parseFloat(transactionForm.watch("amount") || "0").toFixed(3)} BD
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Bank Charges:</span>
                    <span className="font-medium text-foreground">
                      {parseFloat(transactionForm.watch("bankCharges") || "0").toFixed(3)} BD
                    </span>
                  </div>
                  <div className="border-t border-amber-200 dark:border-amber-900/50 pt-1.5 flex justify-between font-semibold text-red-600 dark:text-red-400">
                    <span>Total to Deduct from Account (Value + Charges):</span>
                    <span>
                      {(
                        parseFloat(transactionForm.watch("amount") || "0") +
                        parseFloat(transactionForm.watch("bankCharges") || "0")
                      ).toFixed(3)} BD
                    </span>
                  </div>
                </div>
              )}
              <FormField
                control={transactionForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Cheque #, Transfer ID" data-testid="input-reference" />
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
                      <Textarea {...field} placeholder="Enter transaction description..." data-testid="input-description" />
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
                  data-testid="button-save-transaction"
                >
                  Review & Confirm
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog before saving */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm Transaction Details
            </DialogTitle>
            <DialogDescription>
              Please verify the transaction details below before saving.
            </DialogDescription>
          </DialogHeader>

          {pendingTransactionData && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Bank Account:</span>
                  <span className="font-semibold text-right">
                    {bankAccounts?.find((a) => a.id === pendingTransactionData.bankAccountId)?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span
                    className={`font-semibold capitalize px-2 py-0.5 rounded text-xs ${
                      pendingTransactionData.type === "deposit"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {pendingTransactionData.type}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {new Date(pendingTransactionData.transactionDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-base text-primary">
                    <CurrencyDisplay amount={pendingTransactionData.amount} />
                  </span>
                </div>
                {pendingTransactionData.type === "withdrawal" && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Bank Charges:</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        <CurrencyDisplay
                          amount={parseFloat(pendingTransactionData.bankCharges || "0").toFixed(3)}
                        />
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed">
                      <span className="text-muted-foreground font-semibold">Total Deducted from Account:</span>
                      <span className="font-bold text-base text-red-600 dark:text-red-400">
                        <CurrencyDisplay
                          amount={(
                            parseFloat(pendingTransactionData.amount || "0") +
                            parseFloat(pendingTransactionData.bankCharges || "0")
                          ).toFixed(3)}
                        />
                      </span>
                    </div>
                  </>
                )}
                {pendingTransactionData.reference && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-medium">{pendingTransactionData.reference}</span>
                  </div>
                )}
                <div className="pt-2 border-t text-sm">
                  <span className="text-muted-foreground block mb-1">Description:</span>
                  <span className="text-foreground whitespace-pre-wrap font-normal">
                    {pendingTransactionData.description || "No description provided"}
                  </span>
                </div>
              </div>

              {editingTransaction && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded text-xs border border-amber-200 dark:border-amber-900/30">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>This modification will adjust the bank account balance and ledger entries accordingly.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex sm:justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Back / Edit
            </Button>
            <Button
              type="button"
              disabled={createTransactionMutation.isPending || updateTransactionMutation.isPending}
              onClick={handleConfirmTransaction}
              data-testid="button-confirm-save-transaction"
            >
              {createTransactionMutation.isPending || updateTransactionMutation.isPending
                ? "Saving..."
                : editingTransaction
                ? "Confirm & Update"
                : "Confirm & Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Management Approval Required Modal */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              Management Approval Required
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {approvalModalMessage || "Modifying or deleting bank transactions requires Manager or Administrator approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
            Current role: <span className="font-semibold uppercase">{user?.role || "Staff"}</span>. Please sign in as a Manager or Administrator to perform this operation.
          </div>
          <DialogFooter>
            <Button onClick={() => setIsApprovalModalOpen(false)}>Understood</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Bank Transaction Dialog */}
      <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Delete Bank Transaction
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete this {deletingTransaction?.type} of{" "}
                <strong>
                  <CurrencyDisplay amount={deletingTransaction?.amount} />
                </strong>{" "}
                dated{" "}
                <strong>
                  {deletingTransaction?.transactionDate
                    ? new Date(deletingTransaction.transactionDate).toLocaleDateString()
                    : ""}
                </strong>
                ?
              </p>
              <p className="text-xs text-muted-foreground">
                This will automatically reverse the balance adjustment on the bank account and remove associated accounting journal entries. Management authorization is confirmed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTransaction && deleteTransactionMutation.mutate(deletingTransaction.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? "Deleting..." : "Delete Transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
