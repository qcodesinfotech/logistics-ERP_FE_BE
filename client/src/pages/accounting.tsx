import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, BookOpen, TrendingUp, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency";
import type { ChartOfAccount, JournalEntry } from "@shared/schema";

export default function Accounting() {
  const { toast } = useToast();
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showJournalDialog, setShowJournalDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({
    accountCode: "",
    name: "",
    accountType: "asset",
    description: "",
  });
  const [journalLines, setJournalLines] = useState([
    { accountId: "", debit: 0, credit: 0, description: "" },
    { accountId: "", debit: 0, credit: 0, description: "" },
  ]);
  const [journalDescription, setJournalDescription] = useState("");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<ChartOfAccount[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const { data: journalEntries = [], isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries"],
  });

  const { data: trialBalance } = useQuery({
    queryKey: ["/api/reports/trial-balance"],
  });

  const { data: profitLoss } = useQuery({
    queryKey: ["/api/reports/profit-loss"],
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ["/api/reports/balance-sheet"],
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof newAccount) => {
      return apiRequest("POST", "/api/chart-of-accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chart-of-accounts"] });
      setShowAccountDialog(false);
      setNewAccount({ accountCode: "", name: "", accountType: "asset", description: "" });
      toast({ title: "Account created successfully" });
    },
  });

  const createJournalMutation = useMutation({
    mutationFn: async (data: { description: string; lines: typeof journalLines }) => {
      return apiRequest("POST", "/api/journal-entries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/profit-loss"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/balance-sheet"] });
      setShowJournalDialog(false);
      setJournalLines([
        { accountId: "", debit: 0, credit: 0, description: "" },
        { accountId: "", debit: 0, credit: 0, description: "" },
      ]);
      setJournalDescription("");
      toast({ title: "Journal entry created successfully" });
    },
  });

  const handleAddLine = () => {
    setJournalLines([...journalLines, { accountId: "", debit: 0, credit: 0, description: "" }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...journalLines];
    updated[index] = { ...updated[index], [field]: value };
    setJournalLines(updated);
  };

  const totalDebits = journalLines.reduce((sum, line) => sum + (parseFloat(line.debit.toString()) || 0), 0);
  const totalCredits = journalLines.reduce((sum, line) => sum + (parseFloat(line.credit.toString()) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const accountTypeColors: Record<string, string> = {
    asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    equity: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    revenue: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Accounting</h1>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-account">
                <Plus className="w-4 h-4 mr-2" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Code</Label>
                  <Input
                    data-testid="input-account-code"
                    value={newAccount.accountCode}
                    onChange={(e) => setNewAccount({ ...newAccount, accountCode: e.target.value })}
                    placeholder="e.g., 1001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    data-testid="input-account-name"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="Account name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={newAccount.accountType}
                    onValueChange={(value) => setNewAccount({ ...newAccount, accountType: value })}
                  >
                    <SelectTrigger data-testid="select-account-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    data-testid="input-account-description"
                    value={newAccount.description}
                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <Button
                  data-testid="button-save-account"
                  onClick={() => createAccountMutation.mutate(newAccount)}
                  disabled={createAccountMutation.isPending || !newAccount.accountCode || !newAccount.name}
                  className="w-full"
                >
                  Create Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showJournalDialog} onOpenChange={setShowJournalDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-journal">
                <FileText className="w-4 h-4 mr-2" />
                New Journal Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create Journal Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    data-testid="input-journal-description"
                    value={journalDescription}
                    onChange={(e) => setJournalDescription(e.target.value)}
                    placeholder="Journal entry description"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Lines</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                      <Plus className="w-3 h-3 mr-1" />
                      Add Line
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journalLines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select
                              value={line.accountId}
                              onValueChange={(value) => updateLine(index, "accountId", value)}
                            >
                              <SelectTrigger data-testid={`select-line-account-${index}`}>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id}>
                                    {acc.accountCode} - {acc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              data-testid={`input-line-debit-${index}`}
                              value={line.debit || ""}
                              onChange={(e) => updateLine(index, "debit", parseFloat(e.target.value) || 0)}
                              className="font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              data-testid={`input-line-credit-${index}`}
                              value={line.credit || ""}
                              onChange={(e) => updateLine(index, "credit", parseFloat(e.target.value) || 0)}
                              className="font-mono"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              data-testid={`input-line-description-${index}`}
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="font-mono font-semibold">{formatCurrency(totalDebits)}</TableCell>
                        <TableCell className="font-mono font-semibold">{formatCurrency(totalCredits)}</TableCell>
                        <TableCell>
                          {isBalanced ? (
                            <Badge className="bg-green-100 text-green-800">Balanced</Badge>
                          ) : (
                            <Badge variant="destructive">Unbalanced</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <Button
                  data-testid="button-save-journal"
                  onClick={() => createJournalMutation.mutate({ description: journalDescription, lines: journalLines })}
                  disabled={createJournalMutation.isPending || !isBalanced || journalLines.every(l => !l.accountId)}
                  className="w-full"
                >
                  Post Journal Entry
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts" data-testid="tab-accounts">
            <BookOpen className="w-4 h-4 mr-2" />
            Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="journal" data-testid="tab-journal">
            <FileText className="w-4 h-4 mr-2" />
            Journal Entries
          </TabsTrigger>
          <TabsTrigger value="trial-balance" data-testid="tab-trial-balance">
            <Scale className="w-4 h-4 mr-2" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <TrendingUp className="w-4 h-4 mr-2" />
            Financial Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No accounts found. Create your first account to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                        <TableCell className="font-mono">{account.accountCode}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <Badge className={accountTypeColors[account.accountType] || ""}>
                            {account.accountType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(parseFloat(account.balance || "0"))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Journal Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
              ) : journalEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No journal entries found. Create your first entry to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((entry: any) => (
                      <TableRow key={entry.id} data-testid={`row-journal-${entry.id}`}>
                        <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                        <TableCell>
                          {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>{entry.description || "-"}</TableCell>
                        <TableCell>{entry.reference || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.totalAmount ? parseFloat(entry.totalAmount).toFixed(3) : "0.000"} RO
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === "posted" ? "default" : "secondary"}>
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {trialBalance ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(trialBalance as any).accounts?.map((acc: any) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-mono">{acc.accountCode}</TableCell>
                          <TableCell>{acc.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(acc.debit) > 0 ? formatCurrency(parseFloat(acc.debit)) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(acc.credit) > 0 ? formatCurrency(parseFloat(acc.credit)) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(parseFloat((trialBalance as any).totalDebits || "0"))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(parseFloat((trialBalance as any).totalCredits || "0"))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-center">
                    {(trialBalance as any).isBalanced ? (
                      <Badge className="bg-green-100 text-green-800">Trial Balance is Balanced</Badge>
                    ) : (
                      <Badge variant="destructive">Trial Balance is NOT Balanced</Badge>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Loading trial balance...</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
              </CardHeader>
              <CardContent>
                {profitLoss ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Revenue</h4>
                      {(profitLoss as any).revenue?.length > 0 ? (
                        <ul className="space-y-1">
                          {(profitLoss as any).revenue.map((item: any, i: number) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.name}</span>
                              <span className="font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No revenue accounts</p>
                      )}
                      <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                        <span>Total Revenue</span>
                        <span className="font-mono">{formatCurrency(parseFloat((profitLoss as any).totalRevenue || "0"))}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Expenses</h4>
                      {(profitLoss as any).expenses?.length > 0 ? (
                        <ul className="space-y-1">
                          {(profitLoss as any).expenses.map((item: any, i: number) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.name}</span>
                              <span className="font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No expense accounts</p>
                      )}
                      <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                        <span>Total Expenses</span>
                        <span className="font-mono">{formatCurrency(parseFloat((profitLoss as any).totalExpenses || "0"))}</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-4 border-t-2">
                      <span>Net Income</span>
                      <span className="font-mono">{formatCurrency(parseFloat((profitLoss as any).netIncome || "0"))}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Balance Sheet</CardTitle>
              </CardHeader>
              <CardContent>
                {balanceSheet ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Assets</h4>
                      {(balanceSheet as any).assets?.length > 0 ? (
                        <ul className="space-y-1">
                          {(balanceSheet as any).assets.map((item: any, i: number) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.name}</span>
                              <span className="font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No asset accounts</p>
                      )}
                      <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                        <span>Total Assets</span>
                        <span className="font-mono">{formatCurrency(parseFloat((balanceSheet as any).totalAssets || "0"))}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Liabilities</h4>
                      {(balanceSheet as any).liabilities?.length > 0 ? (
                        <ul className="space-y-1">
                          {(balanceSheet as any).liabilities.map((item: any, i: number) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.name}</span>
                              <span className="font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No liability accounts</p>
                      )}
                      <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                        <span>Total Liabilities</span>
                        <span className="font-mono">{formatCurrency(parseFloat((balanceSheet as any).totalLiabilities || "0"))}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Equity</h4>
                      {(balanceSheet as any).equity?.length > 0 ? (
                        <ul className="space-y-1">
                          {(balanceSheet as any).equity.map((item: any, i: number) => (
                            <li key={i} className="flex justify-between">
                              <span>{item.name}</span>
                              <span className="font-mono">{formatCurrency(parseFloat(item.amount || "0"))}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No equity accounts</p>
                      )}
                      <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                        <span>Total Equity</span>
                        <span className="font-mono">{formatCurrency(parseFloat((balanceSheet as any).totalEquity || "0"))}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
