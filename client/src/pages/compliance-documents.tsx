import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Eye, Download, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Upload, Trash2, History } from "lucide-react";
import { useGlobalScope } from "@/contexts/global-scope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest, queryClient, getAuthToken, getErrorMessage } from "@/lib/queryClient";
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
import type { ComplianceDocument, Employee } from "@shared/schema";
import { format } from "date-fns";

const DOCUMENT_CATEGORIES = [
  { value: "employee", label: "Employee Document" },
  { value: "office", label: "Office Document" },
];

const EMPLOYEE_DOC_TYPES = [
  "Passport",
  "Visa",
  "Work Permit",
  "National ID",
  "Residency Card",
  "Driving License",
  "Medical Card",
  "Other",
];

const OFFICE_DOC_TYPES = [
  "Trade License",
  "Rent Agreement",
  "Electricity Bill",
  "Water Bill",
  "Internet Bill",
  "Insurance",
  "Municipality License",
  "Other",
];

const documentSchema = z.object({
  category: z.string().min(1, "Category is required"),
  documentType: z.string().min(1, "Document type is required"),
  title: z.string().min(1, "Title is required"),
  documentNumber: z.string().optional(),
  employeeId: z.string().optional(),
  shopId: z.string().optional(),
  branchId: z.string().optional(),
  warehouseId: z.string().optional(),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  remarks: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

export default function ComplianceDocumentsPage() {
  const { toast } = useToast();
  const { currentShopId, currentBranchId, currentWarehouseId, currentShop, currentBranch, currentWarehouse } = useGlobalScope();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewComments, setReviewComments] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      category: "",
      documentType: "",
      title: "",
      documentNumber: "",
      employeeId: "",
      shopId: "",
      branchId: "",
      warehouseId: "",
      issueDate: "",
      expiryDate: "",
      remarks: "",
    },
  });

  const watchCategory = form.watch("category");

  const { data: documents = [], isLoading } = useQuery<ComplianceDocument[]>({
    queryKey: ["/api/compliance/documents", filterCategory, filterStatus, currentShopId, currentBranchId, currentWarehouseId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.append("category", filterCategory);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (currentShopId) params.append("shopId", currentShopId);
      if (currentBranchId) params.append("branchId", currentBranchId);
      if (currentWarehouseId) params.append("warehouseId", currentWarehouseId);
      const res = await apiRequest("GET", `/api/compliance/documents?${params.toString()}`);
      return res.json();
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Auto-populate scope values when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      form.setValue("shopId", currentShopId || "");
      form.setValue("branchId", currentBranchId || "");
      form.setValue("warehouseId", currentWarehouseId || "");
    }
  }, [isDialogOpen, currentShopId, currentBranchId, currentWarehouseId, form]);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["/api/compliance/documents", selectedDocument?.id, "audit"],
    queryFn: async () => {
      if (!selectedDocument?.id) return [];
      const res = await apiRequest("GET", `/api/compliance/documents/${selectedDocument.id}/audit`);
      return res.json();
    },
    enabled: isAuditDialogOpen && !!selectedDocument?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormValues) => {
      const formData = new FormData();
      formData.append("data", JSON.stringify(data));
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      const response = await fetch("/api/compliance/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/documents"] });
      setIsDialogOpen(false);
      setSelectedFile(null);
      form.reset();
      toast({ title: "Document uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: string; comments: string }) => {
      return apiRequest("PATCH", `/api/compliance/documents/${id}/review`, { status, reviewComments: comments });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/documents"] });
      setIsReviewDialogOpen(false);
      setSelectedDocument(null);
      setReviewComments("");
      toast({ title: "Document reviewed successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getErrorMessage(error) }); // Was: Failed to review document", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/compliance/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/documents"] });
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
      toast({ title: "Document deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: getErrorMessage(error) }); // Was: Failed to delete document", variant: "destructive" });
    },
  });

  const handleDownload = async (doc: ComplianceDocument) => {
    try {
      const response = await fetch(`/api/compliance/documents/${doc.id}/download`, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName || "document";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error) }); // Was: Failed to download document", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "expired":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
    }
  };

  const getExpiryStatus = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (diffDays <= 7) {
      return <Badge variant="destructive">Expires in {diffDays} days</Badge>;
    } else if (diffDays <= 30) {
      return <Badge className="bg-yellow-500">Expires in {diffDays} days</Badge>;
    }
    return null;
  };

  const columns = [
    {
      key: "title",
      header: "Document",
      render: (doc: ComplianceDocument) => (
        <div>
          <div className="font-medium">{doc.title}</div>
          <div className="text-sm text-muted-foreground">{doc.documentType}</div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (doc: ComplianceDocument) => (
        <Badge variant="outline" className="capitalize">{doc.category}</Badge>
      ),
    },
    {
      key: "employee",
      header: "Employee",
      render: (doc: ComplianceDocument) => {
        if (doc.category !== "employee" || !doc.employeeId) return "-";
        const emp = employees.find((e) => e.id === doc.employeeId);
        return emp ? emp.name : "-";
      },
    },
    {
      key: "status",
      header: "Status",
      render: (doc: ComplianceDocument) => getStatusBadge(doc.status),
    },
    {
      key: "expiryDate",
      header: "Expiry",
      render: (doc: ComplianceDocument) => (
        <div className="space-y-1">
          <div>{doc.expiryDate ? format(new Date(doc.expiryDate), "dd MMM yyyy") : "-"}</div>
          {doc.expiryDate && getExpiryStatus(doc.expiryDate)}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (doc: ComplianceDocument) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedDocument(doc);
              setIsViewDialogOpen(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {doc.filePath && (
            <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)}>
              <Download className="h-4 w-4" />
            </Button>
          )}
          {doc.status === "pending_review" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedDocument(doc);
                setIsReviewDialogOpen(true);
              }}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedDocument(doc);
              setIsAuditDialogOpen(true);
            }}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedDocument(doc);
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: DocumentFormValues) => {
    createMutation.mutate(data);
  };

  // Apply client-side search/filter on top of server-filtered docs
  const filteredDocuments = documents.filter((doc) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const titleMatch = doc.title?.toLowerCase().includes(q);
      const typeMatch = doc.documentType?.toLowerCase().includes(q);
      const empName = doc.employeeId ? employees.find((e) => e.id === doc.employeeId)?.name?.toLowerCase() || "" : "";
      const empMatch = empName.includes(q);
      const dateMatch = (doc.issueDate && doc.issueDate.includes(q)) || (doc.expiryDate && doc.expiryDate.includes(q));
      if (!titleMatch && !typeMatch && !empMatch && !dateMatch) return false;
    }
    if (filterEmployee && filterEmployee !== "all") {
      if (doc.employeeId !== filterEmployee) return false;
    }
    if (filterDateFrom && doc.expiryDate) {
      if (new Date(doc.expiryDate) < new Date(filterDateFrom)) return false;
    }
    if (filterDateTo && doc.expiryDate) {
      if (new Date(doc.expiryDate) > new Date(filterDateTo + "T23:59:59")) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Compliance Documents" description="Manage employee and office documents" />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Compliance Documents"
        description="Manage employee and office documents with expiry tracking"
      >
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Search by document name or employee..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="office">Office</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Expiry from:</label>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">to:</label>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-[150px]" />
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description="Upload your first compliance document to get started."
        >
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <DataTable columns={columns} data={filteredDocuments} getRowKey={(doc) => doc.id.toString()} />
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                          {DOCUMENT_CATEGORIES.map((cat) => (
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
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(watchCategory === "employee" ? EMPLOYEE_DOC_TYPES : OFFICE_DOC_TYPES).map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Title *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., John Doe - Passport" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., AB123456" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchCategory === "employee" && (
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.filter(emp => emp.id).map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <FormLabel>Upload File</FormLabel>
                <div className="mt-1 flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  {selectedFile && (
                    <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Uploading..." : "Upload Document"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <p className="font-medium">{selectedDocument.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Document Type</label>
                  <p>{selectedDocument.documentType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <Badge variant="outline" className="capitalize">{selectedDocument.category}</Badge>
                </div>
                {selectedDocument.category === "employee" && selectedDocument.employeeId && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Employee</label>
                    <p className="font-medium">{employees.find((e) => e.id === selectedDocument.employeeId)?.name || "-"}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div>{getStatusBadge(selectedDocument.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                  <p>{selectedDocument.issueDate ? format(new Date(selectedDocument.issueDate), "dd MMM yyyy") : "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                  <div className="space-y-1">
                    <p>{selectedDocument.expiryDate ? format(new Date(selectedDocument.expiryDate), "dd MMM yyyy") : "-"}</p>
                    {selectedDocument.expiryDate && getExpiryStatus(selectedDocument.expiryDate)}
                  </div>
                </div>
                {selectedDocument.documentNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Document Number</label>
                    <p>{selectedDocument.documentNumber}</p>
                  </div>
                )}
                {selectedDocument.fileName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Attached File</label>
                    <p>{selectedDocument.fileName}</p>
                  </div>
                )}
              </div>
              {selectedDocument.remarks && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Remarks</label>
                  <p className="text-sm">{selectedDocument.remarks}</p>
                </div>
              )}
              {selectedDocument.reviewComments && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Review Comments</label>
                  <p className="text-sm">{selectedDocument.reviewComments}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Review: <strong>{selectedDocument?.title}</strong></p>
            <div>
              <label className="text-sm font-medium">Comments</label>
              <Textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add review comments..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (selectedDocument) {
                    reviewMutation.mutate({ id: selectedDocument.id, status: "approved", comments: reviewComments });
                  }
                }}
                disabled={reviewMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={() => {
                  if (selectedDocument) {
                    reviewMutation.mutate({ id: selectedDocument.id, status: "rejected", comments: reviewComments });
                  }
                }}
                disabled={reviewMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAuditDialogOpen} onOpenChange={setIsAuditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document History</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No audit logs available</p>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="capitalize">{log.action}</Badge>
                      {log.notes && <p className="text-sm mt-1">{log.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {log.createdAt ? format(new Date(log.createdAt), "dd MMM yyyy HH:mm") : "-"}
                    </span>
                  </div>
                  {log.previousStatus && log.newStatus && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Status: {log.previousStatus} → {log.newStatus}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDocument?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedDocument && deleteMutation.mutate(selectedDocument.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
