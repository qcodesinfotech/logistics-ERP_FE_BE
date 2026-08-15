import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Users, Plus, Edit, Trash2, MapPin, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import type { Outlet } from "@shared/schema";

export default function VendorsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteVendorId, setDeleteVendorId] = useState<string | null>(null);

  // Query vendors (from outlets endpoint, filtering where isVendor === true)
  const { data: outletsList = [], isLoading } = useQuery<Outlet[]>({
    queryKey: ["/api/outlets"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/outlets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlets"] });
      toast({ title: "Vendor Customer deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete vendor", description: getErrorMessage(error), variant: "destructive" });
    }
  });

  const handleDelete = () => {
    if (deleteVendorId) {
      deleteMutation.mutate(deleteVendorId);
      setDeleteVendorId(null);
    }
  };

  const vendors = outletsList.filter(o => o.isVendor);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Vendor Customers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage logistics vendor customers.
          </p>
        </div>
        <Button onClick={() => setLocation("/logistics/vendors/new")} className="gap-2">
          <Plus className="h-4 w-4" /> Add Vendor Customer
        </Button>
      </div>

      {/* Vendors Table */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Vendor Customers List
              </CardTitle>
              <CardDescription>{vendors.length} vendor customer{vendors.length !== 1 ? "s" : ""}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading vendor customers...</div>
          ) : vendors.length === 0 ? (
            <div className="p-14 flex flex-col items-center gap-3 text-muted-foreground">
              <Users className="h-10 w-10 opacity-25" />
              <p className="text-sm">No vendor customers added yet.</p>
              <Button variant="outline" onClick={() => setLocation("/logistics/vendors/new")} className="gap-2 mt-1">
                <Plus className="h-4 w-4" /> Add Vendor Customer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Customer Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Phone / Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow 
                    key={vendor.id} 
                    onClick={() => setLocation(`/logistics/vendors/${vendor.id}`)}
                    className="cursor-pointer hover:bg-accent/30 transition-colors"
                  >
                    <TableCell>
                      <div className="font-medium">{vendor.name}</div>
                      {vendor.address && <div className="text-xs text-muted-foreground truncate max-w-[250px]">{vendor.address}</div>}
                    </TableCell>
                    <TableCell>
                      {vendor.code ? (
                        <Badge variant="outline" className="font-mono text-xs">{vendor.code}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{vendor.phone || vendor.contactPhone || "—"}</div>
                      {vendor.contactPerson && <div className="text-xs text-muted-foreground">{vendor.contactPerson}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={vendor.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}
                      >
                        {vendor.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/logistics/vendors/${vendor.id}`)} title="View Details">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/logistics/vendors/${vendor.id}/edit`)} title="Edit Vendor Customer">
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteVendorId(vendor.id)} title="Delete Vendor Customer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteVendorId} onOpenChange={(o) => !o && setDeleteVendorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vendor customer record and its synced outlet. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
