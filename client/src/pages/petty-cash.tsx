import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wallet, Plus, ArrowUpCircle, ArrowDownCircle, Trash2, ArrowRightLeft, Upload, FileText, Printer, Download, Receipt, Paperclip, ExternalLink, CheckCircle, Image as ImageIcon, X } from "lucide-react";
import * as XLSX from "xlsx";
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
import type { PettyCash, Shop, Branch, BankAccount } from "@shared/schema";

interface EligibleUser {
  id: string;
  name: string;
  username: string;
  role: string;
  status: string;
}

const pettyCashSchema = z.object({
  name: z.string().min(1, "Name is required"),
  userId: z.string().optional(),
  openingBalance: z.string().default("0.000"),
});

const transactionSchema = z.object({
  pettyCashId: z.string().min(1, "Petty cash account is required"),
  type: z.enum(["withdrawal", "deposit", "return"]),
  transactionDate: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
  reference: z.string().optional(),
  bankAccountId: z.string().optional(),
}).refine((data) => {
  // Only for deposits (refund reimbursement from bank), bank account is required
  if (data.type === "deposit" && !data.bankAccountId) {
    return false;
  }
  return true;
}, {
  message: "Bank account is required for refund reimbursements",
  path: ["bankAccountId"],
});

type PettyCashFormData = z.infer<typeof pettyCashSchema>;
type TransactionFormData = z.infer<typeof transactionSchema>;

export interface UploadedAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export function parseAttachments(reference?: string | null): UploadedAttachment[] {
  if (!reference) return [];
  const trimmed = reference.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any, idx: number) => {
            if (typeof item === "string") {
              const fileName = item.split("/").pop() || `File ${idx + 1}`;
              return { name: fileName, url: item };
            }
            return {
              name: item.name || item.url?.split("/").pop() || `File ${idx + 1}`,
              url: item.url,
              type: item.type,
              size: item.size,
            };
          })
          .filter(a => !!a.url);
      }
    } catch {
      // fallback
    }
  }
  if (trimmed.startsWith("/uploads") || trimmed.startsWith("http")) {
    const urls = trimmed.split(",").map(u => u.trim()).filter(Boolean);
    return urls.map((u, idx) => ({
      name: u.split("/").pop() || `File ${idx + 1}`,
      url: u,
    }));
  }
  return [];
}

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
      userId: "",
      openingBalance: "0.000",
    },
  });

  const transactionForm = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      pettyCashId: "",
      type: "withdrawal",
      transactionDate: new Date().toISOString().split("T")[0],
      amount: "",
      description: "",
      reference: "",
      bankAccountId: "",
    },
  });
  
  const transactionType = transactionForm.watch("type");

  const [isRefundClaimOpen, setIsRefundClaimOpen] = useState(false);
  const [claimAccountId, setClaimAccountId] = useState<string>("all");
  const [claimStartDate, setClaimStartDate] = useState<string>("");
  const [claimEndDate, setClaimEndDate] = useState<string>("");

  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingBill(true);
    let successCount = 0;
    try {
      const newAttachments: UploadedAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const res = await apiRequest("POST", "/api/upload/receipt", formData);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || `Failed to upload ${file.name}`);
        }
        const data = await res.json();
        newAttachments.push({
          name: data.filename || file.name,
          url: data.url,
          type: file.type,
          size: file.size,
        });
        successCount++;
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      toast({ title: `${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully` });
    } catch (err: any) {
      console.error("Upload receipt error:", err);
      toast({ title: err.message || "Failed to upload receipt", variant: "destructive" });
    } finally {
      setIsUploadingBill(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const { data: pettyCashAccounts, isLoading } = useQuery<PettyCash[]>({
    queryKey: ["/api/petty-cash"],
  });

  const myPettyCashAccount = useMemo(
    () => pettyCashAccounts?.find(acc => (acc as any).userId === user?.id),
    [pettyCashAccounts, user?.id]
  );

  const { data: transactions } = useQuery<PettyCashTransaction[]>({
    queryKey: ["/api/petty-cash-transactions"],
  });

  const { data: eligibleUsers = [] } = useQuery<EligibleUser[]>({
    queryKey: ["/api/petty-cash/eligible-users"],
  });

  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  const handleSelectStaff = (userId: string) => {
    setSelectedStaffId(userId);
    accountForm.setValue("userId", userId);
    const staff = eligibleUsers.find(u => u.id === userId);
    if (staff) {
      const roleName = staff.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const accountName = `${staff.name || staff.username} - ${roleName}`;
      accountForm.setValue("name", accountName);
    }
  };

  useEffect(() => {
    if (isTransactionDialogOpen && pettyCashAccounts && pettyCashAccounts.length > 0) {
      if (!transactionForm.getValues("pettyCashId")) {
        const myAccount = pettyCashAccounts.find(acc => (acc as any).userId === user?.id);
        if (myAccount) {
          transactionForm.setValue("pettyCashId", myAccount.id);
        } else if (pettyCashAccounts.length === 1) {
          transactionForm.setValue("pettyCashId", pettyCashAccounts[0].id);
        }
      }
    }
  }, [isTransactionDialogOpen, pettyCashAccounts, user, transactionForm]);

  useEffect(() => {
    if (isRefundClaimOpen && pettyCashAccounts && pettyCashAccounts.length > 0 && claimAccountId === "all") {
      const myAccount = pettyCashAccounts.find(acc => (acc as any).userId === user?.id);
      if (myAccount && user?.role !== "super_admin" && user?.role !== "admin") {
        setClaimAccountId(myAccount.id);
      }
    }
  }, [isRefundClaimOpen, pettyCashAccounts, user, claimAccountId]);

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const createAccountMutation = useMutation({
    mutationFn: (data: PettyCashFormData) =>
      apiRequest("POST", "/api/petty-cash", {
        name: data.name.trim(),
        userId: data.userId || undefined,
        openingBalance: data.openingBalance || "0.000",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/petty-cash"] });
      toast({ title: "Petty cash account created successfully" });
      setIsAccountDialogOpen(false);
      setSelectedStaffId("");
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
      setAttachments([]);
      transactionForm.reset();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to record transaction", variant: "destructive" });
    },
  });

  const handleRecordTransaction = (formData: TransactionFormData) => {
    let refValue = formData.reference || "";
    if (attachments.length === 1) {
      refValue = attachments[0].url;
    } else if (attachments.length > 1) {
      refValue = JSON.stringify(attachments.map(a => ({ name: a.name, url: a.url })));
    }
    createTransactionMutation.mutate({
      ...formData,
      reference: refValue || undefined,
    });
  };

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

  const claimTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (t.type !== "withdrawal") return false;
      if (claimAccountId !== "all" && t.pettyCashId !== claimAccountId) return false;
      if (claimStartDate && new Date(t.transactionDate) < new Date(claimStartDate)) return false;
      if (claimEndDate) {
        const end = new Date(claimEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.transactionDate) > end) return false;
      }
      return true;
    });
  }, [transactions, claimAccountId, claimStartDate, claimEndDate]);

  const totalClaimAmount = useMemo(() => {
    return claimTransactions.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  }, [claimTransactions]);

  const handleExportClaimExcel = () => {
    if (claimTransactions.length === 0) {
      toast({ title: "No transactions to export", variant: "destructive" });
      return;
    }
    const accountName = claimAccountId === "all" ? "All Accounts" : (pettyCashAccounts?.find(a => a.id === claimAccountId)?.name || "Account");
    const data = claimTransactions.map((t, idx) => {
      const atts = parseAttachments(t.reference);
      const receiptLinks = atts.length > 0
        ? atts.map(a => a.url.startsWith("http") ? a.url : `${window.location.origin}${a.url}`).join(" | ")
        : (t.reference ? (t.reference.startsWith("/uploads") ? `${window.location.origin}${t.reference}` : t.reference) : "None");

      return {
        "Sl No": idx + 1,
        "Date": new Date(t.transactionDate).toLocaleDateString(),
        "Account": pettyCashAccounts?.find(a => a.id === t.pettyCashId)?.name || "Petty Cash",
        "Description": t.description || "-",
        "Amount (BD)": parseFloat(t.amount || "0").toFixed(3),
        "Receipt / Reference": receiptLinks,
      };
    });

    // Add total row
    data.push({
      "Sl No": "" as any,
      "Date": "",
      "Account": "",
      "Description": "TOTAL CLAIM AMOUNT",
      "Amount (BD)": totalClaimAmount.toFixed(3),
      "Receipt / Reference": "",
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Refund Claim");
    XLSX.writeFile(wb, `Petty_Cash_Claim_${accountName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Refund claim exported to Excel" });
  };

  const handlePrintClaim = () => {
    window.print();
  };

  const accountColumns = [
    {
      key: "name",
      header: "Account Name",
      render: (p: PettyCash) => {
        const isMyAccount = (p as any).userId === user?.id;
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
            {isMyAccount && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Your Account
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "userId",
      header: "Linked Staff / Login ID",
      render: (p: PettyCash) => {
        const staff = eligibleUsers.find((u) => u.id === (p as any).userId);
        if (!staff) return <span className="text-muted-foreground text-xs italic">Unlinked</span>;
        return (
          <div className="text-xs">
            <div className="font-medium text-slate-800 dark:text-slate-200">
              {staff.name} <span className="text-muted-foreground font-mono">({staff.username})</span>
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              {staff.role.replace(/_/g, " ")}
            </div>
          </div>
        );
      },
    },
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
      key: "reference",
      header: "Bill / Receipt",
      render: (t: PettyCashTransaction) => {
        const atts = parseAttachments(t.reference);
        if (atts.length === 0) {
          if (!t.reference) return <span className="text-muted-foreground text-xs">-</span>;
          return <span className="text-xs font-mono">{t.reference}</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {atts.map((att, i) => {
              const isPdf = att.url.toLowerCase().endsWith(".pdf");
              return (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:underline border border-indigo-200"
                  title={att.name}
                >
                  {isPdf ? (
                    <FileText className="h-3 w-3 text-red-500 shrink-0" />
                  ) : (
                    <Paperclip className="h-3 w-3 text-indigo-500 shrink-0" />
                  )}
                  <span className="truncate max-w-[110px]">{att.name}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              );
            })}
          </div>
        );
      },
    },
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
          <Button onClick={() => setIsRefundClaimOpen(true)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Receipt className="h-4 w-4 mr-2 text-indigo-600" />
            Claim Refund
          </Button>
          <Button
            onClick={() => {
              setAttachments([]);
              transactionForm.reset({
                transactionDate: new Date().toISOString().split("T")[0],
                type: "withdrawal",
                amount: "",
                description: "",
                reference: "",
                pettyCashId: myPettyCashAccount?.id || (pettyCashAccounts?.[0]?.id ?? ""),
              });
              setIsTransactionDialogOpen(true);
            }}
            variant="outline"
            data-testid="button-new-transaction"
          >
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              Open Petty Cash Account
            </DialogTitle>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit((d) => createAccountMutation.mutate(d))} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <FormLabel className="text-xs font-semibold">Select Eligible Staff Member / Position *</FormLabel>
                <Select
                  value={selectedStaffId}
                  onValueChange={handleSelectStaff}
                >
                  <FormControl>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Supervisor, Manager, or Admin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {eligibleUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">({u.username})</span>
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {u.role.replace(/_/g, " ")}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Links this account to the staff member's login ID for tracking and refunds.
                </p>
              </div>

              <FormField
                control={accountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold">Account Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Kamaljit - Supervisor LMD"
                        className="h-9 text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={accountForm.control}
                name="openingBalance"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold">Opening Balance (BD)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        className="h-9 text-xs font-mono"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAccountDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createAccountMutation.isPending || !accountForm.watch("name")}
                  className="bg-primary text-white"
                >
                  {createAccountMutation.isPending ? "Creating..." : "Create Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTransactionDialogOpen}
        onOpenChange={(open) => {
          setIsTransactionDialogOpen(open);
          if (!open) {
            setAttachments([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
          </DialogHeader>
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit(handleRecordTransaction)} className="space-y-4">
              {(!pettyCashAccounts || pettyCashAccounts.length === 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center justify-between gap-2">
                  <span>No petty cash accounts created yet. Please create an account first.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
                    onClick={() => {
                      setIsTransactionDialogOpen(false);
                      setIsAccountDialogOpen(true);
                    }}
                  >
                    + Add Account
                  </Button>
                </div>
              )}
              <FormField
                control={transactionForm.control}
                name="pettyCashId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account">
                          <SelectValue placeholder={(!pettyCashAccounts || pettyCashAccounts.length === 0) ? "No accounts found (Create account first)" : "Select account"} />
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
                    <FormLabel>Transaction Nature *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="withdrawal">Expense (Daily Spent)</SelectItem>
                        <SelectItem value="deposit">Refund Reimbursement (From Bank upon Claim Approval)</SelectItem>
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
                    <FormLabel>Date of Transaction *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-9 text-xs" />
                    </FormControl>
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
                      <Input {...field} type="number" step="0.001" placeholder="e.g. 15.500" data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {transactionType === "deposit" && (
                <FormField
                  control={transactionForm.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deduct Refund From Bank Account *</FormLabel>
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
                      <Textarea {...field} data-testid="input-description" placeholder="e.g. Fuel expense, delivery parking, truck wash" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormLabel>Bills / Receipts / PDFs (Attachments)</FormLabel>

                {attachments.length > 0 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900 rounded-md border text-xs">
                    {attachments.map((att, idx) => {
                      const isPdf = att.url.toLowerCase().endsWith(".pdf") || att.type === "application/pdf";
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white dark:bg-slate-800 rounded border">
                          <div className="flex items-center gap-2 min-w-0">
                            {isPdf ? (
                              <FileText className="h-4 w-4 text-red-500 shrink-0" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={att.name}>
                              {att.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 text-[11px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
                            >
                              View
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-slate-400 hover:text-red-600"
                              onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                              title="Remove attachment"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingBill}
                  >
                    <Upload className="h-4 w-4" />
                    {isUploadingBill
                      ? "Uploading..."
                      : attachments.length > 0
                      ? "Add More Bills / PDFs"
                      : "Upload Bill / Receipt / PDF"}
                  </Button>
                  {attachments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {attachments.length} file{attachments.length > 1 ? "s" : ""} attached
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Upload pump receipts, bills, or diesel invoice PDFs (supports multiple images & PDFs up to 10MB each).
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTransactionMutation.isPending || isUploadingBill} data-testid="button-save-transaction">
                  {createTransactionMutation.isPending ? "Saving..." : "Record"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Refund Claim Dialog */}
      <Dialog open={isRefundClaimOpen} onOpenChange={setIsRefundClaimOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="print:hidden">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Receipt className="h-5 w-5 text-indigo-600" />
                  Petty Cash Refund Claim Statement
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate an itemized claim statement with date, description, receipt attachments, and amounts for manager/supervisor reimbursement.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {totalClaimAmount > 0 && claimAccountId !== "all" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      transactionForm.setValue("pettyCashId", claimAccountId);
                      transactionForm.setValue("type", "deposit");
                      transactionForm.setValue("amount", totalClaimAmount.toFixed(3));
                      transactionForm.setValue("description", `Approved claim refund for ${pettyCashAccounts?.find(a => a.id === claimAccountId)?.name || "Staff"}`);
                      setIsRefundClaimOpen(false);
                      setIsTransactionDialogOpen(true);
                    }}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve & Disburse Refund
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportClaimExcel}
                  className="gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintClaim}
                  className="gap-1.5 text-xs"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  Print Voucher
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Filters (hidden in print) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-xs print:hidden">
            <div>
              <label className="block text-slate-500 mb-1 font-semibold">Petty Cash Account</label>
              <Select value={claimAccountId} onValueChange={setClaimAccountId}>
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950">
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {pettyCashAccounts?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1 font-semibold">From Date</label>
              <Input
                type="date"
                value={claimStartDate}
                onChange={(e) => setClaimStartDate(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1 font-semibold">To Date</label>
              <Input
                type="date"
                value={claimEndDate}
                onChange={(e) => setClaimEndDate(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          {/* Printable Statement Area */}
          <div className="flex-1 overflow-y-auto space-y-4 print:p-0 print:m-0">
            <div className="border rounded-md p-4 bg-white dark:bg-slate-950 print:border-none print:p-0">
              <div className="flex justify-between items-start border-b pb-3 mb-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">EXPENSE REFUND CLAIM VOUCHER</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Account: <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {claimAccountId === "all" ? "All Individual Accounts" : pettyCashAccounts?.find(a => a.id === claimAccountId)?.name}
                    </span>
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-muted-foreground">Generated Date: <span className="font-medium text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString()}</span></p>
                  <p className="text-muted-foreground">Generated By: <span className="font-medium text-slate-800 dark:text-slate-200">{user?.name || user?.username || "Supervisor"}</span></p>
                </div>
              </div>

              {claimTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No expense transactions found for the selected account and date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold">
                        <th className="py-2 px-3 text-left w-12">#</th>
                        <th className="py-2 px-3 text-left w-24">Date</th>
                        <th className="py-2 px-3 text-left">Description</th>
                        <th className="py-2 px-3 text-left w-28">Bill / Receipt</th>
                        <th className="py-2 px-3 text-right w-28">Amount (BD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {claimTransactions.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono">{new Date(item.transactionDate).toLocaleDateString()}</td>
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{item.description || "-"}</td>
                          <td className="py-2 px-3">
                            {(() => {
                              const atts = parseAttachments(item.reference);
                              if (atts.length > 0) {
                                return (
                                  <>
                                    <div className="flex flex-wrap items-center gap-1 print:hidden">
                                      {atts.map((att, i) => {
                                        const isPdf = att.url.toLowerCase().endsWith(".pdf");
                                        return (
                                          <a
                                            key={i}
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 hover:underline border border-blue-200"
                                            title={att.name}
                                          >
                                            {isPdf ? (
                                              <FileText className="h-3 w-3 text-red-500 shrink-0" />
                                            ) : (
                                              <Paperclip className="h-3 w-3 text-blue-500 shrink-0" />
                                            )}
                                            <span className="truncate max-w-[80px]">{att.name}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                    <span className="hidden print:inline text-[11px] text-slate-700">
                                      {atts.length} Attached ({atts.map(a => a.name).join(", ")})
                                    </span>
                                  </>
                                );
                              }
                              if (item.reference) {
                                return <span className="font-mono text-[11px]">{item.reference}</span>;
                              }
                              return <span className="text-muted-foreground italic">None</span>;
                            })()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {parseFloat(item.amount || "0").toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-bold bg-slate-50 dark:bg-slate-900">
                        <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                          Total Claim Amount:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          {totalClaimAmount.toFixed(3)} BD
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Signatures section for printed claim voucher */}
              <div className="mt-8 pt-6 border-t border-dashed grid grid-cols-3 gap-6 text-xs text-center">
                <div>
                  <div className="border-b border-slate-400 h-10 mb-1"></div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Claimant Signature</p>
                  <p className="text-[10px] text-muted-foreground">(Supervisor / Manager)</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-10 mb-1"></div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Verified By</p>
                  <p className="text-[10px] text-muted-foreground">(Operations Head)</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 h-10 mb-1"></div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Approved for Refund</p>
                  <p className="text-[10px] text-muted-foreground">(Accounts & Finance)</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsRefundClaimOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
