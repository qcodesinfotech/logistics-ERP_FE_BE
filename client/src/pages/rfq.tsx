import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { FileText, Plus, Calculator, MapPin, RefreshCw, Trash2, ArrowRight, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getErrorMessage } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Rfq, Location, Client } from "@shared/schema";

// Form Schema
const rfqFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  transitRoute: z.string().min(1, "Transit route summary is required"),
  transportationCharges: z.string().optional().transform((v) => v ? parseFloat(v) : 0),
  outsourcedTruckCost: z.string().optional().transform((v) => v ? parseFloat(v) : 0),
  noOfTrips: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined && v !== "" && !isNaN(Number(v))) ? parseInt(String(v)) : 1),
  noOfTrucks: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined && v !== "" && !isNaN(Number(v))) ? parseInt(String(v)) : 1),
  status: z.enum(["pending", "approved", "rejected", "converted", "cancelled"]),
  cargoType: z.string().optional(),
  truckType: z.string().optional(),
  freightType: z.string().optional(),
  routeLegs: z.array(z.object({
    originCountry: z.string().min(1, "Country required"),
    originCity: z.string().min(1, "City required"),
    destinationCountry: z.string().min(1, "Country required"),
    destinationCity: z.string().min(1, "City required"),
    loadingDate: z.string().optional(),
    offloadingDate: z.string().optional(),
    transitDays: z.number().optional()
  })).default([]),
  detentionChargesPerDay: z.string().transform((v) => parseFloat(v) || 0).optional(),
  extraCharges: z.array(z.object({
    name: z.string().min(1, "Name required"),
    qty: z.number().min(0).default(1),
    unitRate: z.number().min(0).default(0),
    cost: z.number().min(0)
  })).default([]),
  cargoDetails: z.string().optional(),
  temperatureRequirement: z.string().optional(),
  weight: z.string().optional(),
  volume: z.string().optional(),
  requestedPickupDate: z.string().optional(),
  requestedDeliveryDate: z.string().optional(),
  additionalRequirements: z.string().optional(),
  notes: z.string().optional(),
});

type RfqFormData = z.input<typeof rfqFormSchema>;

const quotationRevisionSchema = z.object({
  sellingRate: z.string().min(1, "Transportation Charges are required").transform((v) => parseFloat(v) || 0),
  outsourcedTruckCost: z.string().optional().transform((v) => v ? parseFloat(v) : 0),
  noOfTrips: z.string().transform((v) => parseInt(v) || 1),
  noOfTrucks: z.string().transform((v) => parseInt(v) || 1),
  cargoType: z.string().optional(),
  truckType: z.string().optional(),
  freightType: z.string().optional(),
  detentionChargesPerDay: z.string().optional().transform((v) => v ? parseFloat(v) : 0),
  cargoDetails: z.string().optional(),
  temperatureRequirement: z.string().optional(),
  weight: z.string().optional(),
  volume: z.string().optional(),
  additionalCharges: z.array(z.object({
    name: z.string().min(1, "Name required"),
    qty: z.number().min(0).default(1),
    unitRate: z.number().min(0).default(0),
    cost: z.number().min(0)
  })).default([]),
});

type QuotationRevisionData = z.input<typeof quotationRevisionSchema>;

const locationSchema = z.object({
  code: z.string().min(1, "Location code is required"),
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  latitude: z.string().optional().transform(v => v ? parseFloat(v) : null),
  longitude: z.string().optional().transform(v => v ? parseFloat(v) : null),
});

export default function RfqPage() {
  const [location, setLocation] = useLocation();
  const [isRfqDialogOpen, setIsRfqDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [actioningRfqId, setActioningRfqId] = useState<string | null>(null);
  const [isQuickClientDialogOpen, setIsQuickClientDialogOpen] = useState(false);
  const [isQuotationRevisionDialogOpen, setIsQuotationRevisionDialogOpen] = useState(false);
  const [revisingQuotation, setRevisingQuotation] = useState<any>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approvingQuotation, setApprovingQuotation] = useState<any>(null);
  const [approvePrice, setApprovePrice] = useState("");
  const [approveExtraCharges, setApproveExtraCharges] = useState<any[]>([]);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientCompany, setQuickClientCompany] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");
  const [quickClientEmail, setQuickClientEmail] = useState("");
  const [rfqStatusFilter, setRfqStatusFilter] = useState<string>("all");

  const { toast } = useToast();

  // Queries
  const { data: rfqsList, isLoading: isRfqsLoading } = useQuery<Rfq[]>({
    queryKey: ["/api/rfqs"],
  });

  const { data: quotationsList, isLoading: isQuotationsLoading } = useQuery<any[]>({
    queryKey: ["/api/quotations"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: locationsList } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const quickAddClientMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/clients", data),
    onSuccess: (newClient: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Customer added successfully!" });
      form.setValue("customerId", newClient.id);
      setIsQuickClientDialogOpen(false);
      setQuickClientName("");
      setQuickClientCompany("");
      setQuickClientPhone("");
      setQuickClientEmail("");
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  // Forms
  const form = useForm<RfqFormData>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      customerId: "",
      transitRoute: "",
      transportationCharges: "0",
      outsourcedTruckCost: "0",
      noOfTrips: "1",
      noOfTrucks: "1",
      status: "pending",
      cargoType: "",
      truckType: "",
      freightType: "",
      routeLegs: [],
      detentionChargesPerDay: "0",
      extraCharges: [],
      cargoDetails: "",
      temperatureRequirement: "",
      weight: "0.000",
      volume: "0.000",
      requestedPickupDate: "",
      requestedDeliveryDate: "",
      additionalRequirements: "",
      notes: "",
    },
  });

  const { fields: routeFields, append: appendRoute, remove: removeRoute } = useFieldArray({
    control: form.control,
    name: "routeLegs",
  });

  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control: form.control,
    name: "extraCharges",
  });

  const locationForm = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: "",
      name: "",
      address: "",
      latitude: "",
      longitude: "",
    },
  });

  const revisionForm = useForm<QuotationRevisionData>({
    resolver: zodResolver(quotationRevisionSchema),
    defaultValues: {
      sellingRate: "0.000",
      outsourcedTruckCost: "0.000",
      noOfTrips: "1",
      noOfTrucks: "1",
      cargoType: "",
      truckType: "",
      freightType: "",
      detentionChargesPerDay: "0.000",
      cargoDetails: "",
      temperatureRequirement: "",
      weight: "0.000",
      volume: "0.000",
      additionalCharges: [],
    }
  });

  const { fields: revisionExtraFields, append: appendRevisionExtra, remove: removeRevisionExtra } = useFieldArray({
    control: revisionForm.control,
    name: "additionalCharges"
  });

  const handleRevisionSubmit = (data: any) => {
    const totalExtra = data.additionalCharges?.reduce((sum: number, c: any) => sum + (parseFloat(c.cost) || 0), 0) || 0;
    const total = (parseFloat(data.sellingRate) + totalExtra).toFixed(3);

    reviseQuotationMutation.mutate({
      id: revisingQuotation.id,
      data: {
        sellingRate: parseFloat(data.sellingRate).toFixed(3),
        outsourcedTruckCost: parseFloat(data.outsourcedTruckCost).toFixed(3),
        noOfTrips: parseInt(data.noOfTrips) || 1,
        noOfTrucks: parseInt(data.noOfTrucks) || 1,
        cargoType: data.cargoType,
        truckType: data.truckType,
        freightType: data.freightType,
        detentionChargesPerDay: parseFloat(data.detentionChargesPerDay || "0").toFixed(3),
        cargoDetails: data.cargoDetails,
        temperatureRequirement: data.temperatureRequirement,
        weight: data.weight,
        volume: data.volume,
        additionalCharges: data.additionalCharges,
        total: total,
      }
    }, {
      onSuccess: () => {
        setIsQuotationRevisionDialogOpen(false);
      }
    });
  };

  // Watch fields for live calculations
  const watchedTransportation = form.watch("transportationCharges");
  const watchedOutsourced = form.watch("outsourcedTruckCost");
  const watchedExtraCharges = form.watch("extraCharges");
  const watchedRevisionTruckType = revisionForm.watch("truckType");

  const calcTotal = () => {
    const t = parseFloat(String(watchedTransportation)) || 0;
    const extra = watchedExtraCharges?.reduce((sum, item) => sum + (Number(item.cost) || 0), 0) || 0;
    return t + extra;
  };

  const calcMargin = () => {
    const total = calcTotal();
    const out = parseFloat(String(watchedOutsourced)) || 0;
    return total - out;
  };

  // Mutations
  const createRfqMutation = useMutation({
    mutationFn: (data: any) => {
      const extraTotal = data.extraCharges?.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0) || 0;
      const total = parseFloat(data.transportationCharges) + extraTotal;
      const payload = {
        ...data,
        origins: data.routeLegs,
        rfqNumber: data.rfqNumber || `RFQ-${Date.now()}`,
        totalCharges: total.toFixed(3),
        transportationCharges: parseFloat(data.transportationCharges).toFixed(3),
        outsourcedTruckCost: parseFloat(data.outsourcedTruckCost || 0).toFixed(3),
        noOfTrips: parseInt(String(data.noOfTrips)) || 1,
        noOfTrucks: parseInt(String(data.noOfTrucks)) || 1,
        detentionChargesPerDay: parseFloat(data.detentionChargesPerDay || 0).toFixed(3),
        weight: data.weight ? parseFloat(data.weight).toFixed(3) : "0.000",
        volume: data.volume ? parseFloat(data.volume).toFixed(3) : "0.000",
        requestedPickupDate: data.requestedPickupDate ? new Date(data.requestedPickupDate).toISOString() : null,
        requestedDeliveryDate: data.requestedDeliveryDate ? new Date(data.requestedDeliveryDate).toISOString() : null,
      };
      return apiRequest(selectedRfq ? "PUT" : "POST", selectedRfq ? `/api/rfqs/${selectedRfq.id}` : "/api/rfqs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      toast({ title: selectedRfq ? "RFQ updated successfully" : "RFQ created successfully" });
      setIsRfqDialogOpen(false);
      setSelectedRfq(null);
      form.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteRfqMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/rfqs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      toast({ title: "RFQ deleted successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/rfqs/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      toast({ title: "Status updated successfully" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location created successfully" });
      setIsLocationDialogOpen(false);
      locationForm.reset();
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const convertToQuotationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/rfqs/${id}/convert-to-quotation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "RFQ converted to Quotation successfully!" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const quickBookMutation = useMutation({
    mutationFn: async (rfqId: string) => {
      // 1. Convert RFQ to Quotation
      const res = await apiRequest("POST", `/api/rfqs/${rfqId}/convert-to-quotation`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to convert RFQ to Quotation");
      }
      const quotation = await res.json();

      // 2. Approve the generated quotation
      const approveRes = await apiRequest("POST", `/api/quotations/${quotation.id}/approve`);
      if (!approveRes.ok) {
        const err = await approveRes.json();
        throw new Error(err.error || "Failed to approve Quotation");
      }

      // 3. Convert Quotation to Booking Order
      const bookingRes = await apiRequest("POST", `/api/quotations/${quotation.id}/convert-to-booking`);
      if (!bookingRes.ok) {
        const err = await bookingRes.json();
        throw new Error(err.error || "Failed to convert Quotation to Booking Order");
      }
      return bookingRes.json();
    },
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ 
        title: "RFQ instantly converted to Booking Order!", 
        description: "Rate sheet created & customer booking generated. Ready to assign fleet and dispatch.",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs font-semibold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={() => setLocation(`/logistics/dispatch?orderId=${newOrder?.id || ""}`)}
          >
            Dispatch Order
          </Button>
        )
      });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
    onSettled: () => {
      setActioningRfqId(null);
    }
  });

  const approveQuotationMutation = useMutation({
    mutationFn: ({ id, sellingRate, additionalCharges }: { id: string, sellingRate?: string, additionalCharges?: any[] }) => apiRequest("POST", `/api/quotations/${id}/approve`, { sellingRate, additionalCharges }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "Quotation approved successfully!" });
      setIsApproveDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const updateQuotationStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => 
      apiRequest("PATCH", `/api/quotations/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "Quotation status updated successfully!" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const convertQuotationToBookingMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quotations/${id}/convert-to-booking`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Quotation converted to Customer Booking Order!" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const reviseQuotationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("POST", `/api/quotations/${id}/revise`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      toast({ title: "Quotation revised, new version generated!" });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });
  const convertToOrderMutation = useMutation({
    mutationFn: (rfq: Rfq) => {
      // Find origin and destination location details to populate cargo route
      const origin = locationsList?.find(l => l.id === rfq.originLocationId);
      const destination = locationsList?.find(l => l.id === rfq.destinationLocationId);
      
      const initialCharges = [];
      if (rfq.transportationCharges && parseFloat(String(rfq.transportationCharges)) > 0) {
        initialCharges.push({
          description: "Main Transportation Charge",
          qty: 1,
          unitRate: parseFloat(String(rfq.transportationCharges)),
          total: parseFloat(String(rfq.transportationCharges)).toFixed(3)
        });
      }
      if (rfq.extraCharges && Array.isArray(rfq.extraCharges) && rfq.extraCharges.length > 0) {
        initialCharges.push(...rfq.extraCharges.map((c: any) => ({
          description: c.name || "",
          qty: 1,
          unitRate: c.cost || 0,
          total: parseFloat(String(c.cost || 0)).toFixed(3)
        })));
      }
      
      const payload = {
        orderNumber: `ORD-${Date.now()}`,
        customerId: rfq.customerId,
        rfqId: rfq.id,
        cargoDetails: rfq.cargoDetails || `Cargo transit from ${origin?.name || 'Origin'} to ${destination?.name || 'Destination'} (via ${rfq.transitRoute || 'direct'})`,
        weight: rfq.weight || "0.000",
        volume: rfq.volume || "0.000",
        temperatureRequirement: rfq.temperatureRequirement || "",
        customerReference: rfq.additionalRequirements || "",
        specialInstructions: rfq.notes || "",
        loadType: rfq.freightType || "FTL",
        documents: [],
        pickupLocationId: rfq.originLocationId,
        deliveryLocationId: rfq.destinationLocationId,
        status: "pending",
        zoneId: null,
        cargoType: rfq.cargoType,
        truckType: rfq.truckType,
        freightType: rfq.freightType,
        detentionChargesPerDay: rfq.detentionChargesPerDay,
        routeLegs: rfq.origins,
        grandTotal: rfq.totalCharges,
        charges: initialCharges,
        orderDate: new Date().toISOString(),
        paymentDueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        truckOwnership: "rented",
        truckModel: "",
        truckPlateNumber: "",
        chassisNumber: "",
        driverName: "",
        driverContact: "",
      };
      return apiRequest("POST", "/api/orders", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "RFQ converted to Order successfully! Go to Order Book to dispatch." });
    },
    onError: (error: unknown) => {
      toast({ title: getErrorMessage(error), variant: "destructive" });
    },
  });

  const formatCurrency = (val: any) => {
    const num = parseFloat(String(val)) || 0;
    return `${num.toFixed(3)} BD`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="RFQ System" 
        description="Calculate pre-order transit margins, clearance charges, toll fees, and request client quotes."
      >
        <Button onClick={() => {
          setSelectedRfq(null);
          form.reset({
            customerId: "",
            transitRoute: "",
            transportationCharges: "0",
            outsourcedTruckCost: "0",
            noOfTrips: "1",
            noOfTrucks: "1",
            status: "pending",
            cargoType: "",
            truckType: "",
            freightType: "",
            routeLegs: [],
            detentionChargesPerDay: "0",
            extraCharges: [],
            cargoDetails: "",
            temperatureRequirement: "",
            weight: "0.000",
            volume: "0.000",
            requestedPickupDate: "",
            requestedDeliveryDate: "",
            additionalRequirements: "",
            notes: "",
          });
          setIsViewOnly(false);
          setCurrentStep(1);
          setIsRfqDialogOpen(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" /> Create Enquiry
        </Button>
      </PageHeader>

      {/* Workflow Navigation Tracker */}
      <div className="flex items-center gap-2 border bg-card/40 p-3 rounded-lg shadow-sm w-fit bg-slate-50/50">
        <Link href="/logistics/rfq">
          <Button 
            variant="default"
            className="h-8 px-3 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-indigo-600 text-[10px] mr-2 font-bold shadow-sm">1</span>
            RFQ & Enquiry
          </Button>
        </Link>
        <div className="h-[2px] w-6 bg-slate-200" />
        <Link href="/logistics/orders">
          <Button 
            variant="outline"
            className="h-8 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border bg-slate-100 text-slate-600 text-[10px] mr-2 font-bold">2</span>
            Order Book
          </Button>
        </Link>
        <div className="h-[2px] w-6 bg-slate-200" />
        <Link href="/logistics/dispatch">
          <Button 
            variant="outline"
            className="h-8 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border bg-slate-100 text-slate-600 text-[10px] mr-2 font-bold">3</span>
            Trip Dispatch
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="enquiries" className="space-y-6">
        <TabsList className="grid w-[400px] grid-cols-2 bg-muted/60">
          <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="enquiries">
          <div className="space-y-6">
            <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" /> Active Rate Quotations
                  </CardTitle>
                  <CardDescription>
                    Transit costing worksheets for active sales/bidding pipelines.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Status:</span>
                  <Select value={rfqStatusFilter} onValueChange={setRfqStatusFilter}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending Review</SelectItem>
                      <SelectItem value="converted">Converted to Quotation</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isRfqsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading RFQs...</div>
                ) : !rfqsList || rfqsList.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                    <span>No RFQs created yet. Create one to begin rate worksheets.</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RFQ Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Trips / Trucks</TableHead>
                        <TableHead>Charges Summary</TableHead>
                        <TableHead>Profit Margin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rfqsList.filter(r => rfqStatusFilter === "all" || r.status === rfqStatusFilter).map((rfq) => {
                        const client = clientsList?.find(c => c.id === rfq.customerId);
                        const trans = parseFloat(String(rfq.transportationCharges)) || 0;
                        const extraTotal = (rfq.extraCharges as any[])?.reduce((sum: number, item: any) => sum + (Number(item.cost) || 0), 0) || 0;
                        const out = parseFloat(String(rfq.outsourcedTruckCost)) || 0;
                        const total = parseFloat(String(rfq.totalCharges)) || 0;
                        const margin = total - out;

                        return (
                          <TableRow key={rfq.id}>
                            <TableCell className="font-semibold">{rfq.rfqNumber}</TableCell>
                            <TableCell>{client?.companyName || client?.name || "Unknown"}</TableCell>
                            <TableCell>
                              <div className="font-medium">{rfq.transitRoute}</div>
                              {rfq.freightType && <div className="text-xs text-muted-foreground">Type: {rfq.freightType} | Truck: {rfq.truckType}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{rfq.noOfTrips || 1} Trip(s)</div>
                              <div className="text-xs text-muted-foreground">{rfq.noOfTrucks || 1} Truck(s)</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-primary">{formatCurrency(total)}</div>
                              <div className="text-xs text-muted-foreground">Base: {formatCurrency(trans)} | Extra: {formatCurrency(extraTotal)}</div>
                            </TableCell>
                            <TableCell>
                              <div className={`font-semibold ${margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {formatCurrency(margin)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select 
                                defaultValue={rfq.status} 
                                onValueChange={(val) => updateStatusMutation.mutate({ id: rfq.id, status: val })}
                              >
                                <SelectTrigger className={`h-8 w-[140px] text-xs ${rfq.status === 'converted' ? 'text-blue-600 bg-blue-50 border-blue-200' : rfq.status === 'cancelled' ? 'text-red-600 bg-red-50 border-red-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending Review</SelectItem>
                                  <SelectItem value="converted">Converted to Quotation</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              {rfq.status === "pending" && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/5"
                                  onClick={() => convertToQuotationMutation.mutate(rfq.id)}
                                  disabled={convertToQuotationMutation.isPending}
                                >
                                  Convert to Quotation
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" title="View Details" onClick={() => {
                                setSelectedRfq(rfq);
                                form.reset({
                                  customerId: rfq.customerId,
                                  transitRoute: rfq.transitRoute || "",
                                  transportationCharges: String(rfq.transportationCharges),
                                  outsourcedTruckCost: String(rfq.outsourcedTruckCost),
                                  noOfTrips: String(rfq.noOfTrips || 1),
                                  noOfTrucks: String(rfq.noOfTrucks || 1),
                                  status: rfq.status as any,
                                  cargoType: rfq.cargoType || "",
                                  truckType: rfq.truckType || "",
                                  freightType: rfq.freightType || "",
                                  routeLegs: (rfq.origins as any[]) || [],
                                  detentionChargesPerDay: String(rfq.detentionChargesPerDay || "0"),
                                  extraCharges: (rfq.extraCharges as any[]) || [],
                                  cargoDetails: rfq.cargoDetails || "",
                                  temperatureRequirement: rfq.temperatureRequirement || "",
                                  weight: String(rfq.weight || "0.000"),
                                  volume: String(rfq.volume || "0.000"),
                                  requestedPickupDate: rfq.requestedPickupDate ? new Date(rfq.requestedPickupDate).toISOString().split('T')[0] : "",
                                  requestedDeliveryDate: rfq.requestedDeliveryDate ? new Date(rfq.requestedDeliveryDate).toISOString().split('T')[0] : "",
                                  additionalRequirements: rfq.additionalRequirements || "",
                                  notes: rfq.notes || "",
                                });
                                setIsViewOnly(true);
                                setIsRfqDialogOpen(true);
                              }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setSelectedRfq(rfq);
                                form.reset({
                                  customerId: rfq.customerId,
                                  transitRoute: rfq.transitRoute || "",
                                  transportationCharges: String(rfq.transportationCharges),
                                  outsourcedTruckCost: String(rfq.outsourcedTruckCost),
                                  noOfTrips: String(rfq.noOfTrips || 1),
                                  noOfTrucks: String(rfq.noOfTrucks || 1),
                                  status: rfq.status as any,
                                  cargoType: rfq.cargoType || "",
                                  truckType: rfq.truckType || "",
                                  freightType: rfq.freightType || "",
                                  routeLegs: (rfq.origins as any[]) || [],
                                  detentionChargesPerDay: String(rfq.detentionChargesPerDay || "0"),
                                  extraCharges: (rfq.extraCharges as any[]) || [],
                                  cargoDetails: rfq.cargoDetails || "",
                                  temperatureRequirement: rfq.temperatureRequirement || "",
                                  weight: String(rfq.weight || "0.000"),
                                  volume: String(rfq.volume || "0.000"),
                                  requestedPickupDate: rfq.requestedPickupDate ? new Date(rfq.requestedPickupDate).toISOString().split('T')[0] : "",
                                  requestedDeliveryDate: rfq.requestedDeliveryDate ? new Date(rfq.requestedDeliveryDate).toISOString().split('T')[0] : "",
                                  additionalRequirements: rfq.additionalRequirements || "",
                                  notes: rfq.notes || "",
                                });
                                setIsViewOnly(false);
                                setIsRfqDialogOpen(true);
                              }}>
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:text-red-600"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this RFQ?")) {
                                    deleteRfqMutation.mutate(rfq.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quotations">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Active Quotations & Proposals
                </CardTitle>
                <CardDescription>
                  Customer-facing pricing proposals converted from RFQ worksheets.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isQuotationsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading Quotations...</div>
              ) : !quotationsList || quotationsList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                  <span>No Quotations converted yet. Convert an RFQ to create a Quotation.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Cargo details</TableHead>
                      <TableHead>Trips / Trucks</TableHead>
                      <TableHead>Rate & Charges</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationsList.map((q) => {
                      const client = clientsList?.find(c => c.id === q.customerId);
                      const sellingRate = parseFloat(q.sellingRate || "0");
                      const total = parseFloat(q.total || "0");
                      const validity = q.validUntil ? new Date(q.validUntil).toLocaleDateString() : 'N/A';

                      return (
                        <TableRow key={q.id}>
                          <TableCell className="font-medium">
                            {q.quotationNumber}
                            {q.version > 1 && <span className="text-xs text-muted-foreground ml-1">(v{q.version})</span>}
                          </TableCell>
                          <TableCell>{client?.companyName || client?.name || "Unknown"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{q.cargoDetails}</TableCell>
                          <TableCell>
                            <div className="font-medium">{q.noOfTrips || 1} Trip(s)</div>
                            <div className="text-xs text-muted-foreground">{q.noOfTrucks || 1} Truck(s)</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-primary">{formatCurrency(total)}</div>
                            <div className="text-xs text-muted-foreground">Selling Price: {formatCurrency(sellingRate)}</div>
                          </TableCell>
                          <TableCell>{validity}</TableCell>
                          <TableCell>
                            <StatusBadge status={q.status} />
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="View & Print Quotation Document" 
                              onClick={() => {
                                const rfq = rfqsList?.find(r => r.id === q.rfqId);
                                setSelectedRfq(rfq || null);
                                form.reset({
                                  customerId: q.customerId,
                                  transitRoute: rfq?.transitRoute || q.cargoDetails || "",
                                  transportationCharges: String(q.sellingRate),
                                  outsourcedTruckCost: String(rfq?.outsourcedTruckCost || "0"),
                                  noOfTrips: String(q.noOfTrips || rfq?.noOfTrips || 1),
                                  noOfTrucks: String(q.noOfTrucks || rfq?.noOfTrucks || 1),
                                  status: q.status as any,
                                  cargoType: q.cargoType || rfq?.cargoType || "general",
                                  truckType: q.truckType || rfq?.truckType || "",
                                  freightType: q.freightType || rfq?.freightType || "",
                                  routeLegs: (rfq?.origins as any[]) || [],
                                  detentionChargesPerDay: String(rfq?.detentionChargesPerDay || "0"),
                                  extraCharges: (q.additionalCharges as any[]) || [],
                                  cargoDetails: q.cargoDetails || "",
                                  temperatureRequirement: q.temperatureRequirement || "",
                                  weight: String(q.weight || "0.000"),
                                  volume: String(q.volume || "0.000"),
                                  requestedPickupDate: rfq?.requestedPickupDate ? new Date(rfq.requestedPickupDate).toISOString().split('T')[0] : "",
                                  requestedDeliveryDate: rfq?.requestedDeliveryDate ? new Date(rfq.requestedDeliveryDate).toISOString().split('T')[0] : "",
                                  additionalRequirements: rfq?.additionalRequirements || "",
                                  notes: rfq?.notes || "",
                                });
                                setIsViewOnly(true);
                                setIsRfqDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 text-blue-500" />
                            </Button>

                             {q.status === "pending" && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-medium"
                                  onClick={() => {
                                    setApprovingQuotation(q);
                                    setApprovePrice(String(q.sellingRate || "0.000"));
                                    setApproveExtraCharges((q.additionalCharges || []).map((c: any) => {
                                      const isDefault = ["Toll charges", "Border crossing", "Custom clearance"].includes(c.name);
                                      return { 
                                        ...c, 
                                        type: isDefault ? c.name : "Others", 
                                        customName: isDefault ? "" : c.name, 
                                        qty: c.qty || 1 
                                      };
                                    }));
                                    setIsApproveDialogOpen(true);
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-xs text-amber-600 font-medium"
                                  onClick={() => {
                                    setRevisingQuotation(q);
                                    const rfq = rfqsList?.find(r => r.id === q.rfqId);
                                    revisionForm.reset({
                                      sellingRate: String(q.sellingRate || "0.000"),
                                      outsourcedTruckCost: String(q.outsourcedTruckCost || rfq?.outsourcedTruckCost || "0.000"),
                                      noOfTrips: String(q.noOfTrips || rfq?.noOfTrips || 1),
                                      noOfTrucks: String(q.noOfTrucks || rfq?.noOfTrucks || 1),
                                      cargoType: q.cargoType || rfq?.cargoType || "",
                                      truckType: q.truckType || rfq?.truckType || "",
                                      freightType: q.freightType || rfq?.freightType || "",
                                      detentionChargesPerDay: String(q.detentionChargesPerDay || rfq?.detentionChargesPerDay || "0.000"),
                                      cargoDetails: q.cargoDetails || rfq?.cargoDetails || "",
                                      temperatureRequirement: q.temperatureRequirement || rfq?.temperatureRequirement || "",
                                      weight: String(q.weight || rfq?.weight || "0.000"),
                                      volume: String(q.volume || rfq?.volume || "0.000"),
                                      additionalCharges: (q.additionalCharges as any[]) || [],
                                    });
                                    setIsQuotationRevisionDialogOpen(true);
                                  }}
                                >
                                  Revise
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-xs text-red-500 hover:text-red-600 font-medium"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to cancel this quotation?")) {
                                      updateQuotationStatusMutation.mutate({ id: q.id, status: "cancelled" });
                                    }
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}

                            {q.status === "approved" && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-medium"
                                  onClick={() => convertQuotationToBookingMutation.mutate(q.id)}
                                >
                                  Convert to Booking
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-xs text-amber-600 font-medium"
                                  onClick={() => {
                                    setRevisingQuotation(q);
                                    const rfq = rfqsList?.find(r => r.id === q.rfqId);
                                    revisionForm.reset({
                                      sellingRate: String(q.sellingRate || "0.000"),
                                      outsourcedTruckCost: String(q.outsourcedTruckCost || rfq?.outsourcedTruckCost || "0.000"),
                                      noOfTrips: String(q.noOfTrips || rfq?.noOfTrips || 1),
                                      noOfTrucks: String(q.noOfTrucks || rfq?.noOfTrucks || 1),
                                      cargoType: q.cargoType || rfq?.cargoType || "",
                                      truckType: q.truckType || rfq?.truckType || "",
                                      freightType: q.freightType || rfq?.freightType || "",
                                      detentionChargesPerDay: String(q.detentionChargesPerDay || rfq?.detentionChargesPerDay || "0.000"),
                                      cargoDetails: q.cargoDetails || rfq?.cargoDetails || "",
                                      temperatureRequirement: q.temperatureRequirement || rfq?.temperatureRequirement || "",
                                      weight: String(q.weight || rfq?.weight || "0.000"),
                                      volume: String(q.volume || rfq?.volume || "0.000"),
                                      additionalCharges: (q.additionalCharges as any[]) || [],
                                    });
                                    setIsQuotationRevisionDialogOpen(true);
                                  }}
                                >
                                  Revise
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-xs text-red-500 hover:text-red-600 font-medium"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to cancel this quotation?")) {
                                      updateQuotationStatusMutation.mutate({ id: q.id, status: "cancelled" });
                                    }
                                  }}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}

                            {q.status === "converted" && (
                              <span className="text-xs text-muted-foreground italic font-medium px-2 py-1 bg-slate-100 rounded-md">
                                Converted to Booking
                              </span>
                            )}

                            {q.status === "cancelled" && (
                              <span className="text-xs text-red-500 italic font-medium px-2 py-1 bg-red-50 rounded-md">
                                Cancelled
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* RFQ Creation / Modification Dialog */}
      <Dialog open={isRfqDialogOpen} onOpenChange={setIsRfqDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle>{isViewOnly ? "View Quotation Document" : selectedRfq ? "Modify RFQ Worksheet" : "Calculate Logistics RFQ"}</DialogTitle>
            <DialogDescription>
              Build a comprehensive freight costing worksheet for transit routes.
            </DialogDescription>
          </DialogHeader>
          {!isViewOnly ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createRfqMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <FormLabel className="text-sm font-medium">Client / Customer *</FormLabel>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="h-auto p-0 text-xs text-primary font-medium hover:underline"
                          onClick={() => setIsQuickClientDialogOpen(true)}
                        >
                          + Quick Add Customer
                        </Button>
                      </div>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientsList?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.companyName || "No Company"})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <FormField
                  control={form.control}
                  name="transitRoute"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Transit Route / Border Crossings *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Muscat - Haima - Salalah Highway Route" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transportationCharges"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Price (BD)</FormLabel>
                      <FormControl>
                        <Input placeholder="0.000" type="number" step="0.001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />






                <FormField
                  control={form.control}
                  name="cargoType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Cargo Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Hazardous">Hazardous</SelectItem>
                          <SelectItem value="Fragile">Fragile</SelectItem>
                          <SelectItem value="Perishable">Perishable</SelectItem>
                          <SelectItem value="Cold Chain">Cold Chain</SelectItem>
                          <SelectItem value="Flatbed / Oversized">Flatbed / Oversized</SelectItem>
                          <SelectItem value="Dry Van">Dry Van</SelectItem>
                          <SelectItem value="Assorted">Assorted</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="truckType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Truck Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Flatbed">Flatbed</SelectItem>
                          <SelectItem value="Reefer">Reefer</SelectItem>
                          <SelectItem value="Box Truck">Box Truck</SelectItem>
                          <SelectItem value="Curtain Sider">Curtain Sider</SelectItem>
                          <SelectItem value="Lowboy">Lowboy</SelectItem>
                          <SelectItem value="Container Carrier">Container Carrier</SelectItem>
                          <SelectItem value="Tanker">Tanker</SelectItem>
                          <SelectItem value="Pickup Truck">Pickup Truck</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="noOfTrucks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. of Trucks *</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="noOfTrips"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. of Trips *</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="freightType"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Freight Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Freight Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FTL">FTL (Full Truck Load)</SelectItem>
                          <SelectItem value="LTL">LTL (Less than Truck Load)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cargoDetails"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Cargo Details / Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Palletized cargo, heavy machinery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="temperatureRequirement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature Requirement</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. -18C, Frozen, Ambient" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (Tons)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0.000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="volume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume (CBM)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0.000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="requestedPickupDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Pickup Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requestedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requested Delivery Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additionalRequirements"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Quotation Terms / Special Requirements</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. GPS tracking, border escort required" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Input placeholder="Internal notes or comments" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dynamic Lists */}
              <div className="space-y-4 pt-4 border-t">
                {/* Route Legs */}
                <div className="p-4 border rounded-md bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <FormLabel className="text-base font-semibold">Origin & Destination Routes</FormLabel>
                      <p className="text-xs text-muted-foreground">Add multiple transit legs with loading and offloading dates.</p>
                    </div>
                    {!isViewOnly && (
                      <Button type="button" variant="outline" size="sm" onClick={() => appendRoute({ originCountry: "", originCity: "", destinationCountry: "", destinationCity: "", loadingDate: "", offloadingDate: "", transitDays: 0 })}>
                        <Plus className="h-3 w-3 mr-1" /> Add Route Leg
                      </Button>
                    )}
                  </div>
                  {routeFields.map((field, index) => (
                    <div key={field.id} className="mb-4 p-4 border rounded-md relative bg-background/50">
                      <Button type="button" variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-100 text-red-500 hover:bg-red-200 border shadow-sm z-10" onClick={() => removeRoute(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <FormField control={form.control} name={`routeLegs.${index}.originCountry`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Origin Country</FormLabel><FormControl><Input placeholder="Country" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.originCity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Origin City</FormLabel><FormControl><Input placeholder="City" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.destinationCountry`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Dest. Country</FormLabel><FormControl><Input placeholder="Country" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.destinationCity`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Dest. City</FormLabel><FormControl><Input placeholder="City" className="h-8 text-xs" {...field} /></FormControl></FormItem>
                        )} />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
                        <FormField control={form.control} name={`routeLegs.${index}.loadingDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Loading</FormLabel><FormControl><Input type="date" className="h-8 text-xs" {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const offload = form.getValues(`routeLegs.${index}.offloadingDate`);
                              if (e.target.value && offload) {
                                const days = Math.ceil((new Date(offload).getTime() - new Date(e.target.value).getTime()) / (1000 * 3600 * 24));
                                form.setValue(`routeLegs.${index}.transitDays`, days > 0 ? days : 0);
                              }
                            }}
                          /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.offloadingDate`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Offloading</FormLabel><FormControl><Input type="date" className="h-8 text-xs" {...field} 
                            onChange={(e) => {
                              field.onChange(e);
                              const load = form.getValues(`routeLegs.${index}.loadingDate`);
                              if (e.target.value && load) {
                                const days = Math.ceil((new Date(e.target.value).getTime() - new Date(load).getTime()) / (1000 * 3600 * 24));
                                form.setValue(`routeLegs.${index}.transitDays`, days > 0 ? days : 0);
                              }
                            }}
                          /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name={`routeLegs.${index}.transitDays`} render={({ field }) => (
                          <FormItem><FormLabel className="text-[10px] uppercase text-muted-foreground font-semibold">Transit Days</FormLabel><FormControl><Input type="number" className="h-8 text-xs" {...field} readOnly /></FormControl></FormItem>
                        )} />
                      </div>
                    </div>
                  ))}
                </div>


              </div>

              <DialogFooter className="pt-4 print:hidden">
                <Button type="button" variant="outline" onClick={() => setIsRfqDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRfqMutation.isPending}>
                  {createRfqMutation.isPending ? "Saving..." : "Save Enquiry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          ) : (
            <div className="space-y-6">
              {/* Professional RFQ View */}
              <div className="border p-6 sm:p-8 rounded-md bg-white text-black text-sm relative print:border-none print:p-0 print:w-full">
                <div className="text-center border-b-2 border-slate-200 pb-4 mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-800">Request For Quotation</h2>
                  <p className="text-slate-500 mt-1">Ref: {selectedRfq?.id ? `RFQ-${selectedRfq.id}` : 'DRAFT'} | Date: {new Date().toLocaleDateString()}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Customer Information</h3>
                    <p className="mb-1"><span className="font-semibold inline-block w-20">Client:</span> {clientsList?.find(c => c.id === form.getValues().customerId)?.name || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-20">Company:</span> {clientsList?.find(c => c.id === form.getValues().customerId)?.companyName || "N/A"}</p>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Cargo Specifications</h3>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Cargo Details:</span> {form.getValues().cargoDetails || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Cargo Type:</span> {form.getValues().cargoType || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Truck Type:</span> {form.getValues().truckType || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Freight Type:</span> {form.getValues().freightType || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Temperature:</span> {form.getValues().temperatureRequirement || "N/A"}</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Weight/Vol:</span> {form.getValues().weight || "0.000"} Tons / {form.getValues().volume || "0.000"} CBM</p>
                    <p className="mb-1"><span className="font-semibold inline-block w-24">Trips/Trucks:</span> {form.getValues().noOfTrips || 1} Trip(s) / {form.getValues().noOfTrucks || 1} Truck(s)</p>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Transit Route & Legs</h3>
                  <p className="mb-1"><span className="font-semibold">Main Route Summary:</span> {form.getValues().transitRoute}</p>
                  <p className="mb-1">
                    <span className="font-semibold">Requested Dates:</span> Pickup: {(() => {
                      const pickupDate = form.getValues().requestedPickupDate;
                      return pickupDate ? new Date(pickupDate).toLocaleDateString() : 'N/A';
                    })()} | Delivery: {(() => {
                      const deliveryDate = form.getValues().requestedDeliveryDate;
                      return deliveryDate ? new Date(deliveryDate).toLocaleDateString() : 'N/A';
                    })()}
                  </p>
                  {form.getValues().additionalRequirements && (
                    <p className="mb-3"><span className="font-semibold">Special Terms:</span> {form.getValues().additionalRequirements}</p>
                  )}
                  
                  {(() => {
                    const legs = form.getValues().routeLegs;
                    return legs && legs.length > 0 ? (
                      <table className="w-full border-collapse text-xs mt-2">
                        <thead>
                          <tr className="bg-slate-100 border-y-2 border-slate-200 text-left text-slate-700">
                            <th className="p-2 font-bold">Origin</th>
                            <th className="p-2 font-bold">Destination</th>
                            <th className="p-2 font-bold">Loading Date</th>
                            <th className="p-2 font-bold">Offloading Date</th>
                            <th className="p-2 font-bold text-center">Transit Days</th>
                          </tr>
                        </thead>
                        <tbody>
                          {legs.map((leg: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2">{leg.originCity}, {leg.originCountry}</td>
                              <td className="p-2">{leg.destinationCity}, {leg.destinationCountry}</td>
                              <td className="p-2">{leg.loadingDate ? new Date(leg.loadingDate).toLocaleDateString() : 'N/A'}</td>
                              <td className="p-2">{leg.offloadingDate ? new Date(leg.offloadingDate).toLocaleDateString() : 'N/A'}</td>
                              <td className="p-2 text-center">{leg.transitDays || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null;
                  })()}
                </div>

                <div className="mb-4">
                  <h3 className="font-bold text-slate-800 border-b pb-1 mb-2 uppercase text-xs tracking-wider">Quotation Breakdown (BD)</h3>
                  <table className="w-full border-collapse mt-2">
                    <tbody>
                      <tr className="border-b bg-slate-100 text-slate-700 text-xs uppercase tracking-wider">
                        <th className="p-2 text-left font-bold">Description</th>
                        <th className="p-2 text-right font-bold">Qty</th>
                        <th className="p-2 text-right font-bold">Unit Rate</th>
                        <th className="p-2 text-right font-bold">Total (BD)</th>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Base Transportation Cost</td>
                        <td className="p-3 text-right text-slate-500">-</td>
                        <td className="p-3 text-right text-slate-500">-</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(parseFloat(String(form.getValues().transportationCharges)) || 0)}</td>
                      </tr>
                      {(() => {
                        const extraCharges = form.getValues().extraCharges;
                        return extraCharges?.map((charge: any, idx: number) => (
                          <tr key={idx} className="border-b text-slate-600 bg-slate-50/50">
                            <td className="p-3 pl-6">+ {charge.name}</td>
                            <td className="p-3 text-right text-sm">{charge.qty || 1}</td>
                            <td className="p-3 text-right text-sm">{formatCurrency(parseFloat(String(charge.unitRate)) || 0)}</td>
                            <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(parseFloat(String(charge.cost)) || 0)}</td>
                          </tr>
                        )) || null;
                      })()}
                      <tr className="bg-slate-100 font-bold text-lg border-y-2 border-slate-200">
                        <td className="p-4 uppercase text-slate-800">Total Estimated Amount</td>
                        <td className="p-4 text-right text-emerald-700">{formatCurrency(calcTotal())}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  {form.getValues().detentionChargesPerDay && parseFloat(String(form.getValues().detentionChargesPerDay)) > 0 && (
                    <p className="text-xs text-red-600 mt-4 italic font-medium">* Note: Detention charges apply at {formatCurrency(parseFloat(String(form.getValues().detentionChargesPerDay)))} per day after allowed free time.</p>
                  )}

                  {form.getValues().notes && (
                    <p className="text-xs text-muted-foreground mt-4 italic font-medium">* Notes: {form.getValues().notes}</p>
                  )}
                </div>
              </div>
              <DialogFooter className="print:hidden border-t pt-4">
                <Button type="button" onClick={() => window.print()} className="mr-auto" variant="outline">
                  <Printer className="h-4 w-4 mr-2" /> Print Document
                </Button>
                <Button type="button" onClick={() => setIsRfqDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quotation Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>Approve Quotation</DialogTitle>
            <DialogDescription>
              Please confirm the final selling price before approving this quotation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selling Price (BD) *</label>
              <Input 
                type="number" 
                step="0.001" 
                value={approvePrice} 
                onChange={(e) => setApprovePrice(e.target.value)} 
                placeholder="0.000"
              />
            </div>
            
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Extra Charges</label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setApproveExtraCharges([...approveExtraCharges, { type: "Toll charges", customName: "", cost: 0, qty: 1 }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Charge
                </Button>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {approveExtraCharges.map((charge, index) => (
                  <div key={index} className="flex gap-2 items-center bg-slate-50 p-2 rounded border">
                    <Select 
                      value={charge.type || ""} 
                      onValueChange={(val) => {
                        const newCharges = [...approveExtraCharges];
                        newCharges[index].type = val;
                        if (val !== "Others") {
                          newCharges[index].name = val;
                        }
                        setApproveExtraCharges(newCharges);
                      }}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-xs shrink-0">
                        <SelectValue placeholder="Charge Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Toll charges">Toll charges</SelectItem>
                        <SelectItem value="Border crossing">Border crossing</SelectItem>
                        <SelectItem value="Custom clearance">Custom clearance</SelectItem>
                        <SelectItem value="Others">Others...</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {charge.type === "Others" && (
                      <Input 
                        placeholder="Custom Name" 
                        className="text-xs h-8 flex-1 min-w-[100px]"
                        value={charge.customName || ""}
                        onChange={(e) => {
                          const newCharges = [...approveExtraCharges];
                          newCharges[index].customName = e.target.value;
                          setApproveExtraCharges(newCharges);
                        }}
                      />
                    )}
                    
                    {(!charge.type || charge.type !== "Others") && <div className="flex-1" />}

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Qty</span>
                      <Input 
                        type="number"
                        min="1"
                        className="text-xs h-8 w-16"
                        value={charge.qty || ""}
                        onChange={(e) => {
                          const newCharges = [...approveExtraCharges];
                          newCharges[index].qty = parseInt(e.target.value) || 1;
                          setApproveExtraCharges(newCharges);
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Cost</span>
                      <Input 
                        type="number"
                        step="0.001"
                        className="text-xs h-8 w-24"
                        value={charge.cost || ""}
                        onChange={(e) => {
                          const newCharges = [...approveExtraCharges];
                          newCharges[index].cost = parseFloat(e.target.value) || 0;
                          setApproveExtraCharges(newCharges);
                        }}
                      />
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-red-500 shrink-0 ml-1"
                      onClick={() => {
                        const newCharges = [...approveExtraCharges];
                        newCharges.splice(index, 1);
                        setApproveExtraCharges(newCharges);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-sm font-bold mt-2 pt-2 border-t bg-slate-100 p-2 rounded">
                <span>Total Amount:</span>
                <span className="text-emerald-700">
                  {(parseFloat(approvePrice || "0") + approveExtraCharges.reduce((sum, c) => sum + (Number(c.cost) || 0), 0)).toFixed(3)} BD
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (parseFloat(approvePrice) <= 0) {
                  toast({ title: "Please enter a valid selling price greater than 0", variant: "destructive" });
                  return;
                }
                if (approvingQuotation) {
                  approveQuotationMutation.mutate({ 
                    id: approvingQuotation.id, 
                    sellingRate: approvePrice,
                    additionalCharges: approveExtraCharges.map(c => ({
                      name: c.type === "Others" ? (c.customName || "Other Charge") : (c.type || "Toll charges"),
                      cost: c.cost,
                      qty: c.qty || 1
                    }))
                  });
                }
              }}
              disabled={approveQuotationMutation.isPending}
            >
              {approveQuotationMutation.isPending ? "Approving..." : "Confirm & Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quotation Revision Dialog */}
      <Dialog open={isQuotationRevisionDialogOpen} onOpenChange={setIsQuotationRevisionDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revise Quotation: {revisingQuotation?.quotationNumber}</DialogTitle>
            <DialogDescription>
              Update the pricing, truck type, trips count, and additional charges for this quotation. A new version will be generated.
            </DialogDescription>
          </DialogHeader>
          <Form {...revisionForm}>
            <form onSubmit={revisionForm.handleSubmit(handleRevisionSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={revisionForm.control}
                  name="sellingRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Transportation Charges (BD) *
                        {!watchedRevisionTruckType && <span className="text-[10px] text-red-500 ml-2 font-normal">(Select Truck Type first)</span>}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" disabled={!watchedRevisionTruckType} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="outsourcedTruckCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outsourced Cost (BD) (Optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" disabled={!watchedRevisionTruckType} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="noOfTrips"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. of Trips *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="noOfTrucks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. of Trucks *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="cargoType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Cargo Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Hazardous">Hazardous</SelectItem>
                          <SelectItem value="Fragile">Fragile</SelectItem>
                          <SelectItem value="Perishable">Perishable</SelectItem>
                          <SelectItem value="Cold Chain">Cold Chain</SelectItem>
                          <SelectItem value="Flatbed / Oversized">Flatbed / Oversized</SelectItem>
                          <SelectItem value="Dry Van">Dry Van</SelectItem>
                          <SelectItem value="Assorted">Assorted</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="truckType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Truck Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Flatbed">Flatbed</SelectItem>
                          <SelectItem value="Reefer">Reefer</SelectItem>
                          <SelectItem value="Box Truck">Box Truck</SelectItem>
                          <SelectItem value="Curtain Sider">Curtain Sider</SelectItem>
                          <SelectItem value="Lowboy">Lowboy</SelectItem>
                          <SelectItem value="Container Carrier">Container Carrier</SelectItem>
                          <SelectItem value="Tanker">Tanker</SelectItem>
                          <SelectItem value="Pickup Truck">Pickup Truck</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="freightType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Freight Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Freight Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FTL">FTL (Full Truck Load)</SelectItem>
                          <SelectItem value="LTL">LTL (Less than Truck Load)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="detentionChargesPerDay"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Detention Charges / Day (BD)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.001" placeholder="0.000" disabled={!watchedRevisionTruckType} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="cargoDetails"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Cargo Details / Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Palletized cargo, heavy machinery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={revisionForm.control}
                  name="temperatureRequirement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature Requirement</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. -18C, Ambient" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={revisionForm.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (Tons)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0.000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={revisionForm.control}
                    name="volume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume (CBM)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0.000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Revision Extra Charges */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <FormLabel className="text-base font-semibold">Additional / Extra Charges</FormLabel>
                    <p className="text-xs text-muted-foreground">Add specific operational costs or extra delivery charges.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={!watchedRevisionTruckType} onClick={() => appendRevisionExtra({ name: "Toll", qty: 1, unitRate: 0, cost: 0 })}>
                    <Plus className="h-3 w-3 mr-1" /> Add Charge
                  </Button>
                </div>
                {revisionExtraFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-3 items-end mb-3 bg-background/50 p-2 rounded-md border">
                    <FormField control={revisionForm.control} name={`additionalCharges.${index}.name`} render={({ field: f }) => {
                      const predefined = ["Toll", "Port", "Border Crossing", "Customs Fee"];
                      const isPredefined = predefined.includes(f.value);

                      return (
                        <FormItem className="col-span-12 sm:col-span-4">
                          <FormLabel className="text-xs">Charge Type</FormLabel>
                          {isPredefined || !f.value ? (
                            <Select onValueChange={(val) => {
                              if (val === "Other") {
                                f.onChange("Other charge");
                              } else {
                                f.onChange(val);
                              }
                            }} value={f.value || ""}>
                              <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {predefined.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                <SelectItem value="Other">Other (Custom)</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex gap-1">
                              <FormControl>
                                <Input 
                                  className="h-8 text-xs" 
                                  {...f} 
                                  placeholder="Enter charge name..." 
                                  autoFocus 
                                  onBlur={(e) => f.onChange(e.target.value.trim())} 
                                />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground shrink-0 border" 
                                onClick={() => f.onChange("")}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                    
                    <FormField control={revisionForm.control} name={`additionalCharges.${index}.qty`} render={({ field: f }) => (
                      <FormItem className="col-span-4 sm:col-span-2">
                        <FormLabel className="text-xs">Qty</FormLabel>
                        <FormControl><Input type="number" className="h-8 text-xs" {...f} onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          f.onChange(val);
                          const rate = revisionForm.getValues(`additionalCharges.${index}.unitRate`) || 0;
                          revisionForm.setValue(`additionalCharges.${index}.cost`, val * rate);
                        }} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={revisionForm.control} name={`additionalCharges.${index}.unitRate`} render={({ field: f }) => (
                      <FormItem className="col-span-4 sm:col-span-3">
                        <FormLabel className="text-xs">Unit Rate (BD)</FormLabel>
                        <FormControl><Input type="number" step="0.001" className="h-8 text-xs" {...f} onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          f.onChange(val);
                          const qty = revisionForm.getValues(`additionalCharges.${index}.qty`) || 0;
                          revisionForm.setValue(`additionalCharges.${index}.cost`, val * qty);
                        }} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={revisionForm.control} name={`additionalCharges.${index}.cost`} render={({ field: f }) => (
                      <FormItem className="col-span-3 sm:col-span-2">
                        <FormLabel className="text-xs">Total (BD)</FormLabel>
                        <FormControl><Input type="number" step="0.001" className="h-8 text-xs bg-slate-50 font-semibold" readOnly {...f} /></FormControl>
                      </FormItem>
                    )} />
                    <div className="col-span-1 sm:col-span-1 flex justify-end pb-0.5">
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 h-8 w-8 p-0 border bg-white hover:bg-red-50" onClick={() => removeRevisionExtra(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsQuotationRevisionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={reviseQuotationMutation.isPending}>
                  {reviseQuotationMutation.isPending ? "Saving..." : "Save Revision"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Location Quick Add Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Register Location</DialogTitle>
            <DialogDescription>
              Register terminal hubs, distribution points or custom client addresses.
            </DialogDescription>
          </DialogHeader>
          <Form {...locationForm}>
            <form onSubmit={locationForm.handleSubmit(d => createLocationMutation.mutate(d))} className="space-y-4">
              <FormField
                control={locationForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. MCT-WHSE-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={locationForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Muscat Central Warehouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={locationForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Road 23, Al Ghubrah, Muscat, Oman" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={locationForm.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="23.5859" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={locationForm.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="58.4059" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLocationMutation.isPending}>
                  {createLocationMutation.isPending ? "Creating..." : "Save Location"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Customer Dialog */}
      <Dialog open={isQuickClientDialogOpen} onOpenChange={setIsQuickClientDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Quick Add Customer</DialogTitle>
            <DialogDescription>
              Quickly register a new client account to select in rate worksheets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer/Client Name *</label>
              <Input 
                value={quickClientName} 
                onChange={(e) => setQuickClientName(e.target.value)} 
                placeholder="e.g. Abdullah Salem"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name (Optional)</label>
              <Input 
                value={quickClientCompany} 
                onChange={(e) => setQuickClientCompany(e.target.value)} 
                placeholder="e.g. Hidd Trading W.L.L"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number (Optional)</label>
              <Input 
                value={quickClientPhone} 
                onChange={(e) => setQuickClientPhone(e.target.value)} 
                placeholder="e.g. +973 33445566"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address (Optional)</label>
              <Input 
                type="email"
                value={quickClientEmail} 
                onChange={(e) => setQuickClientEmail(e.target.value)} 
                placeholder="e.g. accounts@hiddtrading.com"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsQuickClientDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => {
                if (!quickClientName.trim()) {
                  toast({ title: "Customer Name is required", variant: "destructive" });
                  return;
                }
                quickAddClientMutation.mutate({
                  name: quickClientName,
                  companyName: quickClientCompany || null,
                  phone: quickClientPhone || null,
                  email: quickClientEmail || null,
                  status: "active"
                });
              }}
              disabled={quickAddClientMutation.isPending}
            >
              {quickAddClientMutation.isPending ? "Adding..." : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
