import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage, getAuthToken } from "@/lib/queryClient";
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
import type { Company } from "@shared/schema";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  legalName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional().refine(
    (val) => !val || /^[0-9+\-\s()]*$/.test(val),
    { message: "Phone number can only contain numbers, +, -, spaces, and parentheses" }
  ),
  email: z.string().email().optional().or(z.literal("")),
  vatNumber: z.string().optional(),
  logo: z.string().optional(),
  status: z.string().default("active"),
});

type CompanyFormData = z.infer<typeof companySchema>;

export default function Companies() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const { toast } = useToast();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      legalName: "",
      address: "",
      phone: "",
      email: "",
      vatNumber: "",
      logo: "",
      status: "active",
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = getAuthToken();

      const response = await fetch("/api/upload/company-logo", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await response.json();
      form.setValue("logo", data.url);
      toast({ title: "Logo uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Failed to upload logo", variant: "destructive" });
    }
  };

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyFormData) => apiRequest("POST", "/api/companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company created successfully" });
      handleCloseDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CompanyFormData & { id: string }) =>
      apiRequest("PATCH", `/api/companies/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company updated successfully" });
      handleCloseDialog();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company deleted successfully" });
      setDeletingCompany(null);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCompany(null);
    form.reset();
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    form.reset({
      name: company.name,
      legalName: company.legalName || "",
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
      vatNumber: company.vatNumber || "",
      logo: company.logo || "",
      status: company.status,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: CompanyFormData) => {
    if (editingCompany) {
      updateMutation.mutate({ ...data, id: editingCompany.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: "name", header: "Name" },
    { key: "legalName", header: "Legal Name" },
    { key: "vatNumber", header: "VAT Number" },
    { key: "phone", header: "Phone" },
    {
      key: "status",
      header: "Status",
      render: (company: Company) => <StatusBadge status={company.status} />
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (company: Company) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(company);
            }}
            data-testid={`button-edit-company-${company.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingCompany(company);
            }}
            data-testid={`button-delete-company-${company.id}`}
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
        title="Companies"
        description="Manage parent companies in your organization"
      >
        <Button onClick={() => {
          setEditingCompany(null);
          form.reset({
            name: "",
            legalName: "",
            address: "",
            phone: "",
            email: "",
            vatNumber: "",
            logo: "",
            status: "active",
          });
          setIsDialogOpen(true);
        }} data-testid="button-add-company">
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : !companies || companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add your first company to get started with the organization structure."
            >
              <Button onClick={() => {
                setEditingCompany(null);
                form.reset({
                  name: "",
                  legalName: "",
                  address: "",
                  phone: "",
                  email: "",
                  vatNumber: "",
                  logo: "",
                  status: "active",
                });
                setIsDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            </EmptyState>
          ) : (
            <DataTable
              columns={columns}
              data={companies}
              getRowKey={(company) => company.id}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add New Company"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-legal-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-vat-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$" placeholder="email@example.com" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Logo</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          data-testid="input-company-logo"
                        />
                        {field.value && (
                          <div className="mt-2">
                            <img
                              src={field.value}
                              alt="Company Logo"
                              className="h-16 object-contain border rounded p-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive h-auto p-1 mt-1 text-xs"
                              onClick={() => form.setValue("logo", "")}
                            >
                              Remove Logo
                            </Button>
                          </div>
                        )}
                        <input type="hidden" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-company"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingCompany
                      ? "Update"
                      : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCompany} onOpenChange={() => setDeletingCompany(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCompany?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompany && deleteMutation.mutate(deletingCompany.id)}
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
