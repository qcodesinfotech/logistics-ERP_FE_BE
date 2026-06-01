import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Plus, Pencil, Trash2, Calendar, DollarSign, Paperclip, CreditCard, ExternalLink, Loader2, Upload } from "lucide-react";
import { useGlobalScope } from "@/contexts/global-scope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
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
import type { ComplianceReminder, BankAccount } from "@shared/schema";
import { format, parseISO } from "date-fns";

const REMINDER_CATEGORIES = [
  { value: "rent", label: "Monthly Rent" },
  { value: "electricity", label: "Electricity Bill" },
  { value: "water", label: "Water Bill" },
  { value: "internet", label: "Internet Bill" },
  { value: "insurance", label: "Insurance" },
  { value: "custom", label: "Custom" },
];

const reminderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Category is required"),
  customCategory: z.string().optional(),
  frequency: z.string().default("monthly"),
  dueDayOfMonth: z.number().min(1).max(31).default(1),
  dueMonthOfYear: z.number().min(1).max(12).optional().nullable(),
  leadTimeDays: z.number().min(1).max(30).default(7),
  shopId: z.string().optional(),
  branchId: z.string().optional(),
  warehouseId: z.string().optional(),
  amount: z.string().optional(),
  remarks: z.string().optional(),
  isActive: z.boolean().default(true),
  attachmentPath: z.string().optional(),
  attachmentName: z.string().optional(),
});

type ReminderFormValues = z.infer<typeof reminderSchema>;

export default function ComplianceRemindersPage() {
  const { toast } = useToast();
  const { currentShopId, currentBranchId, currentWarehouseId, currentShop, currentBranch, currentWarehouse } = useGlobalScope();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ComplianceReminder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentBankId, setPaymentBankId] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: "",
      category: "",
      customCategory: "",
      frequency: "monthly",
      dueDayOfMonth: 1,
      dueMonthOfYear: 1,
      leadTimeDays: 7,
      shopId: "",
      branchId: "",
      warehouseId: "",
      amount: "",
      remarks: "",
      isActive: true,
      attachmentPath: "",
      attachmentName: "",
    },
  });

  const selectedFrequency = form.watch("frequency");
  const selectedCategory = form.watch("category");

  const { data: reminders = [], isLoading } = useQuery<ComplianceReminder[]>({
    queryKey: ["/api/compliance/reminders", currentShopId, currentBranchId, currentWarehouseId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentShopId) params.append("shopId", currentShopId);
      if (currentBranchId) params.append("branchId", currentBranchId);
      if (currentWarehouseId) params.append("warehouseId", currentWarehouseId);
      const res = await apiRequest("GET", `/api/compliance/reminders?${params.toString()}`);
      return res.json();
    },
  });

  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  // Auto-populate scope values when dialog opens
  useEffect(() => {
    if (isDialogOpen && !isEditing) {
      form.setValue("shopId", currentShopId || "");
      form.setValue("branchId", currentBranchId || "");
      form.setValue("warehouseId", currentWarehouseId || "");
    }
  }, [isDialogOpen, isEditing, currentShopId, currentBranchId, currentWarehouseId, form]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/compliance-reminder", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      form.setValue("attachmentPath", data.url);
      form.setValue("attachmentName", data.filename);
      toast({ title: "File uploaded successfully" });
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: ReminderFormValues) => {
      return apiRequest("POST", "/api/compliance/reminders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/reminders"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Reminder created successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getErrorMessage(error) }); // Was: Failed to create reminder", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReminderFormValues> }) => {
      return apiRequest("PATCH", `/api/compliance/reminders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/reminders"] });
      setIsDialogOpen(false);
      setSelectedReminder(null);
      setIsEditing(false);
      form.reset();
      toast({ title: "Reminder updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getErrorMessage(error) }); // Was: Failed to update reminder", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/compliance/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/reminders"] });
      setIsDeleteDialogOpen(false);
      setSelectedReminder(null);
      toast({ title: "Reminder deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getErrorMessage(error) });
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, bankAccountId, notes }: { id: string; bankAccountId: string; notes?: string }) => {
      return apiRequest("POST", `/api/compliance/reminders/${id}/pay`, { bankAccountId, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/reminders"] });
      setIsPayDialogOpen(false);
      setSelectedReminder(null);
      setPaymentBankId("");
      setPaymentNotes("");
      toast({ title: "Reminder paid successfully", description: "Next due date has been updated." });
    },
    onError: (error: unknown) => {
      toast({ title: "Payment failed", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/compliance/reminders/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/reminders"] });
    },
  });

  const handleEdit = (reminder: ComplianceReminder) => {
    setSelectedReminder(reminder);
    setIsEditing(true);
    form.reset({
      title: reminder.title,
      category: reminder.category,
      frequency: reminder.frequency || "monthly",
      dueDayOfMonth: reminder.dueDayOfMonth || 1,
      dueMonthOfYear: reminder.dueMonthOfYear || 1,
      leadTimeDays: reminder.leadTimeDays || 7,
      shopId: reminder.shopId || "",
      branchId: reminder.branchId || "",
      warehouseId: reminder.warehouseId || "",
      amount: reminder.amount || "",
      remarks: reminder.remarks || "",
      isActive: reminder.isActive ?? true,
      attachmentPath: reminder.attachmentPath || "",
      attachmentName: reminder.attachmentName || "",
      customCategory: reminder.customCategory || "",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedReminder(null);
    setIsEditing(false);
    form.reset();
    setIsDialogOpen(true);
  };

  const getDueBadge = (reminder: ComplianceReminder) => {
    if (!reminder.nextDueDate) return null;
    const dueDate = parseISO(reminder.nextDueDate);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.ceil((dueDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (diffDays <= (reminder.leadTimeDays || 7)) {
      return <Badge className="bg-yellow-500">Due Soon</Badge>;
    }
    return null;
  };

  const columns = [
    {
      key: "title",
      header: "Reminder",
      render: (reminder: ComplianceReminder) => (
        <div>
          <div className="font-medium flex items-center gap-2">
            {reminder.title}
            {reminder.attachmentPath && (
              <a href={reminder.attachmentPath} target="_blank" rel="noopener noreferrer" title={reminder.attachmentName || "View attachment"}>
                <Paperclip className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer" />
              </a>
            )}
          </div>
          <div className="text-sm text-muted-foreground capitalize">
            {reminder.category === 'custom' ? reminder.customCategory : reminder.category}
          </div>
        </div>
      ),
    },
    {
      key: "frequency",
      header: "Frequency",
      render: (reminder: ComplianceReminder) => (
        <Badge variant="outline" className="capitalize">{reminder.frequency}</Badge>
      ),
    },
    {
      key: "dueDayOfMonth",
      header: "Due On",
      render: (reminder: ComplianceReminder) => (
        <span className="text-sm">
          {reminder.frequency === 'yearly' ? (
            <>Day {reminder.dueDayOfMonth} of Month {reminder.dueMonthOfYear}</>
          ) : (
            <>Day {reminder.dueDayOfMonth} of month</>
          )}
        </span>
      ),
    },
    {
      key: "nextDueDate",
      header: "Next Due",
      render: (reminder: ComplianceReminder) => (
        <div className="space-y-1">
          <div>{reminder.nextDueDate ? format(parseISO(reminder.nextDueDate), "dd MMM yyyy") : "-"}</div>
          {getDueBadge(reminder)}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (reminder: ComplianceReminder) => (
        <span className="font-mono">
          {reminder.amount ? `${parseFloat(reminder.amount).toFixed(3)} BD` : "-"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (reminder: ComplianceReminder) => (
        <Switch
          checked={reminder.isActive ?? false}
          onCheckedChange={(checked) => {
            toggleActiveMutation.mutate({ id: reminder.id, isActive: checked });
          }}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (reminder: ComplianceReminder) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary-foreground hover:bg-primary"
            onClick={() => {
              setSelectedReminder(reminder);
              setPaymentBankId("");
              setIsPayDialogOpen(true);
            }}
            disabled={!reminder.amount || parseFloat(reminder.amount) <= 0}
          >
            <DollarSign className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleEdit(reminder)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedReminder(reminder);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: ReminderFormValues) => {
    if (isEditing && selectedReminder) {
      updateMutation.mutate({ id: selectedReminder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Compliance Reminders" description="Manage recurring compliance reminders" />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Compliance Reminders"
        description="Manage recurring monthly reminders for rent, utilities, and other compliance items"
      >
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Reminder
        </Button>
      </PageHeader>

      {reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No reminders"
          description="Create your first compliance reminder to get started."
        >
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <DataTable columns={columns} data={reminders} getRowKey={(reminder) => reminder.id.toString()} />
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Reminder" : "Create Reminder"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Main Branch Rent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REMINDER_CATEGORIES.filter(cat => cat.value).map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedCategory === 'custom' && (
                  <FormField
                    control={form.control}
                    name="customCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Category Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter category name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dueDayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{selectedFrequency === "yearly" ? "Due Day" : "Due Day of Month"}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedFrequency === "yearly" && (
                  <FormField
                    control={form.control}
                    name="dueMonthOfYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Month of Year</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(parseInt(val))} 
                          value={field.value?.toString() || "1"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i + 1} value={(i + 1).toString()}>
                                {format(new Date(2024, i, 1), "MMMM")}
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
                  name="leadTimeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notify Days Before</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <FormLabel>Shop</FormLabel>
                  <Input value={currentShop?.name || "Not selected"} disabled className="mt-1 bg-muted" />
                </div>
                <div>
                  <FormLabel>Branch</FormLabel>
                  <Input value={currentBranch?.name || "Not selected"} disabled className="mt-1 bg-muted" />
                </div>
                <div>
                  <FormLabel>Warehouse</FormLabel>
                  <Input value={currentWarehouse?.name || "Not selected"} disabled className="mt-1 bg-muted" />
                </div>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (BD)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="0.000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Additional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Attachment</FormLabel>
                <div className="flex gap-2 items-center">
                  <Input
                    type="file"
                    className="hidden"
                    id="attachment-upload"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById("attachment-upload")?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {form.watch("attachmentName") || "Attach Photo/File"}
                  </Button>
                </div>
                {form.watch("attachmentPath") && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate">{form.watch("attachmentName")}</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        form.setValue("attachmentPath", "");
                        form.setValue("attachmentName", "");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {isEditing ? "Update" : "Create"} Reminder
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedReminder?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedReminder && deleteMutation.mutate(selectedReminder.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Reminder: {selectedReminder?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground font-medium uppercase">Total Amount</p>
                <p className="text-2xl font-bold font-mono">
                  {selectedReminder?.amount ? `${parseFloat(selectedReminder.amount).toFixed(3)} BD` : "0.000 BD"}
                </p>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Bank Account *</label>
              <Select onValueChange={setPaymentBankId} value={paymentBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account: BankAccount) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bankName} - {account.accountNumber} ({parseFloat(account.currentBalance || "0").toFixed(3)} BD)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Notes</label>
              <Input 
                placeholder="Method, reference, etc." 
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
            <Button 
              disabled={!paymentBankId || payMutation.isPending}
              onClick={() => selectedReminder && payMutation.mutate({ 
                id: selectedReminder.id, 
                bankAccountId: paymentBankId,
                notes: paymentNotes
              })}
            >
              {payMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Process Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
