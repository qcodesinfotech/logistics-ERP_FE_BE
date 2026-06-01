import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Printer } from "lucide-react";

type PrintFormat = "a4" | "thermal";

const TRANSLATIONS = {
  en: {
    invoice: "INVOICE",
    customerDetails: "Customer Details",
    name: "Name",
    phone: "Phone",
    address: "Address",
    email: "Email",
    invNo: "Inv. No",
    date: "Date",
    lpoNo: "LPO No",
    salesPerson: "Sales Person",
    slNo: "Sl.No",
    particulars: "Particulars",
    pkgQty: "QTY",
    unitPrice: "Rate",
    offer: "Offer",
    vat: "VAT",
    totalAmount: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    grandTotal: "Grand Total",
    paymentHistory: "Payment History",
    remainingBalance: "Remaining Balance",
    amountInWords: "Amount in Words",
    termsCondition: "Terms & Conditions",
    bankAccount: "Bank Account",
    for: "For",
    sreOrg: "Signature",
    offerProduct: "Offer Product",
    normalSale: "Normal Sale",
    replacement: "Replacement",
    returnedItems: "Returned Items",
    termsText: "Items sold cannot be returned.",
    terms1:"There is no warranty unless specified",
    terms2:"All returned products for warranty should be in their Original condition and accompanied by the original Invoices.",
    returnReceipt: "Return Receipt",
    originalSale: "Original Sale",
    balanceReduction: "Balance Reduction",
    cashRefund: "Cash Refund",
    storeCredit: "Store Credit",
    reason: "Reason",
    supplierDetails: "Supplier Details",
    quotation: "QUOTATION",
    serviceTicket: "SERVICE TICKET",
    deviceDetails: "Device Details",
    problem: "Problem",
    technician: "Technician",
  },
  ar: {
    invoice: "فاتورة ضريبية",
    customerDetails: "بيانات العميل",
    name: "الاسم",
    phone: "الهاتف",
    address: "العنوان",
    email: "البريد الإلكتروني",
    invNo: "رقم الفاتورة",
    date: "التاريخ",
    lpoNo: "رقم طلب الشراء",
    salesPerson: "البائع",
    slNo: "م",
    particulars: "البيان",
    pkgQty: "الكمية",
    unitPrice: "السعر",
    offer: "خصم",
    vat: "الضريبة",
    totalAmount: "الإجمالي",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    grandTotal: "الإجمالي النهائي",
    paymentHistory: "سجل الدفعات",
    remainingBalance: "المبلغ المتبقي",
    amountInWords: "المبلغ بالحروف",
    termsCondition: "الشروط والأحكام",
    bankAccount: "الحساب البنكي",
    for: "عن",
    sreOrg: "التوقيع",
    offerProduct: "منتج عرض",
    normalSale: "بيع عادي",
    replacement: "استبدال",
    returnedItems: "المواد المرجعة",
    termsText: "البضاعة المباعة لا ترد ولا تستبدل",
    returnReceipt: "إيصال مرتجع",
    originalSale: "الفاتورة الأصلية",
    balanceReduction: "خصم من الرصيد",
    cashRefund: "استرداد نقدي",
    storeCredit: "رصيد دائن",
    supplierDetails: "بيانات المورد",
    quotation: "عرض سعر",
    serviceTicket: "تذكرة صيانة",
    deviceDetails: "تفاصيل الجهاز",
    problem: "المشكلة",
    technician: "الفني",
    reason: "السبب",
    terms1:"لا يوجد ضمان إلا إذا تم تحديد ذلك.",
    terms2:"يجب أن تكون جميع المنتجات المُعادة ضمن الضمان بحالتها الأصلية ومرفقة بالفواتير الأصلية.",
  }
};

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: string;
  total: string;
  serialNumber?: string;
  isReplacement?: boolean;
  isReplacedOriginal?: boolean;
  replacementNumber?: string;
  vatRate?: number;
  vatAmount?: string;
  discount?: string;
  warrantyDays?: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: string;
  vatAmount: string;
  discount?: string;
  total: string;
  paymentMethod?: string;
  cashAmount?: string;
  cardAmount?: string;
  creditAmount?: string;
  previousBalance?: string;
  newBalance?: string;
  notes?: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopVatNumber?: string;
  shopLogo?: string;
  originalSaleNumber?: string;
  refundAmount?: string;
  arReductionAmount?: string;
  paidPortionReturn?: string;
  returnType?: "refund" | "credit";
  reason?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    branchName?: string;
  };
  // Service Ticket specific fields
  deviceDetails?: {
    type: string;
    brand: string;
    model: string;
    serial?: string;
  };
  problemDescription?: string;
  technicianName?: string;
  status?: string;
  expectedDate?: string;
  receivedDate?: string;
  deliveredDate?: string;
  serviceDescription?: string;
  attachments?: string[];
  managerSignature?: string;
  companyStamp?: string;
}

export interface StatementItem {
  date: string;
  type: string;
  reference: string;
  description: string;
  debit?: string | number; // For customer statement (Invoiced) or supplier (Paid)
  credit?: string | number; // For customer statement (Paid) or supplier (Purchased)
  balance: string | number;
}

export interface StatementData {
  title: string;
  startDate?: string;
  endDate?: string;
  generatedOn?: string;
  customerDetails: {
    name: string;
    phone?: string;
    address?: string;
  };
  shopDetails: {
    name?: string;
    address?: string;
    phone?: string;
    logo?: string;
    vatNumber?: string;
  };
  items: StatementItem[];
  summary: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  amountInWords?: string;
  type: "customer_statement" | "supplier_statement";
}



interface InvoicePrinterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceData: InvoiceData | null;
  invoiceType?: "sales" | "service" | "return" | "purchase" | "purchase-return" | "quotation";
  language?: "en" | "ar";
}

const formatCurrency = (value: string | number | null | undefined): string => {
  const num = parseFloat(String(value || 0));
  return `${num.toFixed(3)} BD`;
};

// Helper to get full URL for images
const getFullUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const origin = window.location.origin;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
};

export function InvoicePrinter({
  open,
  onOpenChange,
  invoiceData,
  invoiceType = "sales",
  language = "en",
}: InvoicePrinterProps) {
  const [printFormat, setPrintFormat] = useState<PrintFormat>("a4");

  if (!invoiceData) return null;

  const handlePrint = () => {
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        console.error("Popup blocked");
        alert("Please allow popups for this site to print.");
        return;
      }

      const content = printFormat === "thermal"
        ? ((invoiceType === "return" || invoiceType === "purchase-return") ? generateThermalReturnHTML(invoiceData, invoiceType, language) : generateThermalHTML(invoiceData, invoiceType, language))
        : ((invoiceType === "return" || invoiceType === "purchase-return") ? generateA4ReturnHTML(invoiceData, invoiceType, language) : generateA4HTML(invoiceData, invoiceType, language));

      printWindow.document.write(content);
      printWindow.document.close();
    } catch (error) {
      console.error("Print generation error:", error);
      alert("Error generating print preview. Please check console for details.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Print Format</Label>
            <Select value={printFormat} onValueChange={(v) => setPrintFormat(v as PrintFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4 Paper (Standard Printer)</SelectItem>
                <SelectItem value="thermal">Thermal Receipt (58mm/80mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 bg-muted rounded-lg text-sm">
            {printFormat === "a4" ? (
              <div>
                <p className="font-medium">A4 Format</p>
                <p className="text-muted-foreground">Full-size invoice suitable for standard printers. Includes all details with professional layout.</p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Thermal Receipt Format</p>
                <p className="text-muted-foreground">Compact receipt for thermal printers (58mm or 80mm width). Optimized for quick printing.</p>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-3 text-sm">
            <p className="font-medium">Invoice: {invoiceData.invoiceNumber}</p>
            <p className="text-muted-foreground">Items: {invoiceData.items.length}</p>
            <p className="text-muted-foreground">Total: {formatCurrency(invoiceData.total)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatementPrinter({
  open,
  onOpenChange,
  data,
  language = "en",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: StatementData | null;
  language?: "en" | "ar";
}) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>{data.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative bg-gray-50">
          <iframe
            srcDoc={generateStatementHTML(data, language).replace(
              // Remove auto-print for preview
              '<script>window.onload = function() { window.print(); }</script>',
              ''
            )}
            className="w-full h-full border-none"
            title="Statement Preview"
          />
        </div>

        <DialogFooter className="p-4 border-t gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(generateStatementHTML(data, language));
              printWindow.document.close();
            }
          }}>
            <Printer className="w-4 h-4 mr-2" />
            Print Statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateA4HTML(data: InvoiceData, type: string, language: "en" | "ar" = "en"): string {
  // Helper to format currency
  const format = (val: any) => parseFloat(String(val || 0)).toFixed(3);

  const labels = TRANSLATIONS[language];
  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';

  const logoUrl = getFullUrl(data.shopLogo || '/invoice-logo.png');
  const numberToWords = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num) || num === 0) return "Zero";
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n: number): string => {
      if (n < 0) return "Minus " + inWords(Math.abs(n));
      if (n === 0) return "";
      if (n < 20) return a[n];
      if (n < 100) {
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? "-" + a[digit] : " ");
      }
      if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 === 0 ? "" : "and " + inWords(n % 100));
      if (n < 1000000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 !== 0 ? inWords(n % 1000) : "");
      return inWords(Math.floor(n / 1000000)) + "Million " + (n % 1000000 !== 0 ? inWords(n % 1000000) : "");
    };
    const str = num.toFixed(3);
    const [whole, decimal] = str.split('.');
    let output = inWords(parseInt(whole)) || "Zero ";
    output += "Omani Rials";
    if (parseInt(decimal) > 0) output += " and " + parseInt(decimal) + " Baisa";
    return output + " Only";
  };

  const itemsHTML = data.items.map((item, index) => {
    // Calculate VAT: use stored vatAmount if available, otherwise compute 5% of the total
    const itemTotal = parseFloat(item.total);
    const computedVat = item.vatAmount
      ? parseFloat(String(item.vatAmount))
      : itemTotal * 0.05;
    const vatRate = item.vatRate !== undefined ? item.vatRate : 5;
    const vatDisplay = `${format(computedVat)} (${vatRate}%)`;

    return `
    <tr style="text-align: center;">
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">${index + 1}</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px; text-align: ${textAlign}; font-weight: bold;">
        ${item.name}
        ${item.isReplacement ? `<div style="font-size: 10px; font-weight: normal; color: #16a34a;">${labels.replacement}</div>` : ''}
        ${item.serialNumber ? `<div style="font-size: 10px; font-weight: normal; color: #6b7280;">S.No: ${item.serialNumber}</div>` : ''}
      </td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">${item.quantity}</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">${format(item.unitPrice)}</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px; color: #ef4444;">${format(item.discount)}</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">${vatDisplay}</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">${format(item.total)}</td>
    </tr>
  `;
  }).join('');

  // Spacer rows to fill space if few items
  const spacerRows = Array.from({ length: Math.max(0, 2 - data.items.length) }).map(() => `
    <tr>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 6px 4px;">&nbsp;</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${language}">
      <head>
        <title>Invoice - ${data.invoiceNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 20px; color: black; max-width: 900px; margin: 0 auto; position: relative; }
          
          /* Watermark */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.05;
            z-index: -1;
            width: 80%;
            pointer-events: none;
          }
          
          .header { text-align: center; margin-bottom: 12px; }
          .city { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
          .contact { font-size: 12px; margin-bottom: 10px; }
          .invoice-title { font-size: 24px; font-weight: bold; margin-bottom: 12px; }
          
          .info-container { display: flex; gap: 12px; margin-bottom: 16px; }
          .info-box { flex: 1; border: 1px solid #e5e7eb; padding: 12px; border-radius: 2px; }
          
          .info-header { font-weight: bold; margin-bottom: 8px; font-size: 14px; }
          
          .row { display: flex; margin-bottom: 4px; font-size: 13px; align-items: baseline; }
          .label { width: 100px; font-weight: 600; color: #374151; }
          .value { flex: 1; font-weight: 600; text-align: right; }
          
          /* Right side info box specific styles */
          .info-box.right .row { border-bottom: 0; padding-bottom: 4px; margin-bottom: 6px; }
          .info-box.right .label { width: 120px; }
          .info-box.right .value { text-align: left; }
          
          /* Grid for right box info */
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
          .grid-item { border: 1px solid #e5e7eb; padding: 6px; font-size: 12px; }
          .grid-label { font-weight: bold; display: block; margin-bottom: 2px; }
          
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 0; }
          th { background-color: #f9fafb; border: 1px solid #d1d5db; padding: 6px 4px; font-weight: bold; }
          
          .totals-section { width: 100%; font-size: 13px; }
          .totals-row td { padding: 4px 6px; border: 1px solid #d1d5db; }
          .totals-label { text-align: right; font-weight: bold; }
          .totals-value { text-align: right; font-weight: bold; width: 150px; }
          
          .amount-words-row { border: 1px solid #d1d5db; padding: 10px; font-weight: bold; font-size: 13px; margin-top: -1px; }
          
          .footer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 16px; }
          .footer-box { border: 1px solid #d1d5db; padding: 12px; height: 110px; font-size: 12px; }
          .footer-title { font-weight: bold; margin-bottom: 8px; font-size: 13px; }
          
          @media print {
            body { padding: 0; margin: 0; }
            .watermark { opacity: 0.05 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${logoUrl ? `
          <div style="position: absolute; top: 40px; ${isRtl ? 'right' : 'left'}: 40px; width: 100px;">
           <img src="${logoUrl}" alt="Logo" style="width: 100%; object-fit: contain;" onerror="if (this.src.indexOf('/invoice-logo.png') === -1) { this.src = '/invoice-logo.png'; } else { this.style.display='none'; }">
          </div>
          <div class="watermark">
            <img src="${logoUrl}" alt="Watermark" style="width: 100%; object-fit: contain; filter: grayscale(100%);" onerror="if (this.src.indexOf('/invoice-logo.png') === -1) { this.src = '/invoice-logo.png'; } else { this.style.display='none'; }">
          </div>
        ` : ''}
      
        <div class="header">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${data.shopName || "Company Name"}</h1>
          <div class="city">${data.shopAddress || "Address"}</div>
          <div class="contact">Mobile: ${data.shopPhone || "N/A"} ${data.shopVatNumber ? `| VAT No: ${data.shopVatNumber}` : ''}</div>
          <div class="invoice-title">${type === 'quotation' ? labels.quotation : type === 'service' ? labels.serviceTicket : labels.invoice}</div>
        </div>
        
        <div class="info-container">
          <!-- Customer Details (Left) -->
          <div class="info-box">
             <div class="info-header" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">${type === 'purchase' ? labels.supplierDetails : labels.customerDetails}:</div>
             <div style="display: flex; flex-direction: column; gap: 4px;">
                <div class="row">
                  <span class="label">${labels.name}:</span>
                  <span class="value">${data.customerName || "Walk-in Customer"}</span>
                </div>
                <div class="row">
                  <span class="label">${labels.phone}:</span>
                  <span class="value">${data.customerPhone || "N/A"}</span>
                </div>
                <div class="row">
                  <span class="label">${labels.address}:</span>
                  <span class="value">${data.customerAddress || "N/A"}</span>
                </div>
             </div>
          </div>
          
          <!-- Invoice Info (Right) -->
          <div class="info-box right" style="padding: 0; border: 0;">
            <div class="info-grid">
               <div class="grid-item">
                 <span class="grid-label">${labels.invNo}</span>
                 <div>${data.invoiceNumber}</div>
               </div>
               <div class="grid-item">
                 <span class="grid-label">${labels.date}</span>
                 <div>${data.date}</div>
               </div>
            </div>
            ${type === 'service' ? `
            <div class="grid-item" style="margin-top: -1px;">
               <div style="display: flex; gap: 8px;">
                 <strong>Received:</strong> <span>${data.receivedDate || ""}</span>
               </div>
            </div>
             <div class="grid-item" style="margin-top: -1px;">
               <div style="display: flex; gap: 8px;">
                 <strong>${data.deliveredDate ? 'Delivered:' : 'Expected:'}</strong> <span>${data.deliveredDate || data.expectedDate || ""}</span>
               </div>
            </div>
             <div class="grid-item" style="margin-top: -1px; grid-column: span 2;">
               <div style="display: flex; gap: 8px;">
                 <strong>${labels.technician}:</strong> <span>${data.technicianName || "None"}</span>
               </div>
            </div>
            ` : `
            <div class="grid-item" style="margin-top: -1px;">
               <div style="display: flex; gap: 8px;">
                 <strong>${labels.lpoNo}:</strong> <span>${data.originalSaleNumber || ""}</span>
               </div>
            </div>
             <div class="grid-item" style="margin-top: -1px;">
               <div style="display: flex; gap: 8px;">
                 <strong>${labels.salesPerson}:</strong> <span>Admin</span>
               </div>
            </div>
            `}
          </div>
        </div>
          
          
          <!-- Service Ticket Extra Details -->
          ${type === 'service' && data.deviceDetails ? `
          <div style="margin-bottom: 16px; border: 1px solid #d1d5db; padding: 10px; border-radius: 4px; background-color: #f9fafb;">
             <div style="font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 8px; font-size: 14px;">${labels.deviceDetails}</div>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="font-size: 13px;"><strong style="color: #4b5563;">Device:</strong> <span style="font-weight: 600;">${data.deviceDetails.type} ${data.deviceDetails.brand} ${data.deviceDetails.model}</span></div>
                <div style="font-size: 13px;"><strong style="color: #4b5563;">S/N:</strong> <span style="font-family: monospace;">${data.deviceDetails.serial || '-'}</span></div>
                <div style="grid-column: span 2; font-size: 13px;">
                  <strong style="color: #4b5563;">${labels.problem}:</strong> 
                  <div style="margin-top: 2px; padding: 6px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; min-height: 30px;">
                    ${data.problemDescription || 'No problem description provided.'}
                  </div>
                </div>
             </div>
          </div>
          ` : ''}

          <!-- Service Description (Work Done) -->
          ${type === 'service' && data.serviceDescription ? `
          <div style="margin-bottom: 16px; border: 1px solid #d1d5db; padding: 10px; border-radius: 4px;">
             <div style="font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 8px; font-size: 14px;">Service Description (Work Done)</div>
             <div style="font-size: 13px; line-height: 1.4;">
                ${data.serviceDescription}
             </div>
          </div>
          ` : ''}

          <table>
          <thead>
            <tr>
              <th style="width: 5%;">${labels.slNo}</th>
              <th style="width: 35%; text-align: ${textAlign};">${labels.particulars}</th>
              <th style="width: 8%; margin-left: 20px;">${labels.pkgQty}</th>
              <th style="width: 12%;">${labels.unitPrice}</th>
              <th style="width: 12%;">${labels.discount}</th>
              <th style="width: 13%;">${labels.vat}</th>
              <th style="width: 15%;">${labels.totalAmount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
            ${spacerRows}
          </tbody>
        </table>
        
        <div class="totals-section">
          <table class="totals-table">
            <tr class="totals-row">
               <td colspan="6" class="totals-label">${labels.subtotal}</td>
               <td class="totals-value">${format(data.subtotal)}</td>
            </tr>
            <tr class="totals-row">
               <td colspan="6" class="totals-label" style="color: #ef4444;">${labels.discount}</td>
               <td class="totals-value" style="color: #ef4444;">-${format(data.discount)}</td>
            </tr>
             <tr class="totals-row">
               <td colspan="6" class="totals-label">${labels.vat}</td>
               <td class="totals-value">${format(data.vatAmount)}</td>
            </tr>
            <tr class="totals-row">
               <td colspan="6" class="totals-label" style="font-size: 16px;">${labels.grandTotal}</td>
               <td class="totals-value" style="font-size: 16px;">${format(data.total)}</td>
            </tr>
             <tr class="totals-row">
               <td colspan="6" class="totals-label" style="color: #16a34a;">${labels.paymentHistory}: Paid</td>
               <td class="totals-value" style="color: #16a34a;">
                ${format(parseFloat(data.cashAmount || '0') + parseFloat(data.cardAmount || '0'))}
               </td>
            </tr>
            <tr class="totals-row">
               <td colspan="6" class="totals-label" style="color: #dc2626;">${labels.remainingBalance}</td>
               <td class="totals-value" style="color: #dc2626;">${format(data.newBalance || data.creditAmount)}</td>
            </tr>
          </table>
          <div class="amount-words-row">
             ${labels.amountInWords}: <span style="font-weight: normal; margin-${isRtl ? 'right' : 'left'}: 8px;">${numberToWords(data.total)}</span>
          </div>
        </div>
        
        <div class="footer-grid">
           <div class="footer-box">
              <div class="footer-title">${labels.termsCondition}:</div>
              <ul style={{ color: "#4b5563"}}>
  <li>${labels.terms1}</li>
  <li>${labels.terms2}</li>
</ul>

           </div>
           
           <div class="footer-box">
              <div class="footer-title">${labels.bankAccount}:</div>
              ${data.bankDetails ? `
              <div style="margin-bottom: 8px;">${labels.name}: ${data.bankDetails.accountName || 'N/A'}</div>
              <div style="margin-bottom: 8px;">Bank: ${data.bankDetails.bankName || 'N/A'}</div>
              <div>A/C No: ${data.bankDetails.accountNumber || 'N/A'}</div>
              ` : `
              <div style="margin-bottom: 8px;">${labels.name}: N/A</div>
              <div style="margin-bottom: 8px;">Bank: N/A</div>
              <div>A/C No: N/A</div>
              `}
           </div>
           
           <div class="footer-box" style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px;">
              <div class="footer-title" style="margin-bottom: 8px;">${labels.for} ${data.shopName || 'Top Tecno'}:</div>
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: 100%;">
                ${data.managerSignature ? `
                  <div style="position: relative; width: 120px; height: 50px;">
                    <img src="${getFullUrl(data.managerSignature)}" alt="Signature" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                  </div>
                ` : '<div style="height: 50px; border-bottom: 1px dashed #ccc; width: 80%;"></div>'}
                
                ${data.companyStamp ? `
                  <div style="width: 70px; height: 70px; opacity: 0.8; margin-top: 5px;">
                    <img src="${getFullUrl(data.companyStamp)}" alt="Stamp" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                  </div>
                ` : '<div style="height: 70px;"></div>'}
              </div>
           </div>
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
}

function generateThermalHTML(data: InvoiceData, type: string, language: "en" | "ar" = "en"): string {
  // Helper to format currency
  const format = (val: any) => parseFloat(String(val || 0)).toFixed(3);
  const labels = TRANSLATIONS[language];

  const logoUrl = getFullUrl(data.shopLogo || '/invoice-logo.png');

  // Number to words helper (reused from A4, could be extracted to shared helper if needed)
  const numberToWords = (amount: number | string): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num) || num === 0) return "Zero";
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const inWords = (n: number): string => {
      if (n < 0) return "Minus " + inWords(Math.abs(n));
      if (n === 0) return "";
      if (n < 20) return a[n];
      if (n < 100) {
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? "-" + a[digit] : " ");
      }
      if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 === 0 ? "" : "and " + inWords(n % 100));
      if (n < 1000000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 !== 0 ? inWords(n % 1000) : "");
      return inWords(Math.floor(n / 1000000)) + "Million " + (n % 1000000 !== 0 ? inWords(n % 1000000) : "");
    };
    const str = num.toFixed(3);
    const [whole, decimal] = str.split('.');
    let output = inWords(parseInt(whole)) || "Zero ";
    output += "Rial";
    if (parseInt(decimal) > 0) output += " and " + parseInt(decimal) + " Baisa";
    return output + " Only";
  };

  const itemsHTML = data.items.map((item, index) => {
    // Calculate line item discount if meaningful data exists, otherwise 0
    const itemSubtotal = parseFloat(item.unitPrice) * item.quantity;
    const itemTotal = parseFloat(item.total);
    const itemDiscount = itemSubtotal > itemTotal ? (itemSubtotal - itemTotal).toFixed(3) : "0.000";

    return `
    <tr>
      <td style="vertical-align: top;">${index + 1}</td>
      <td style="vertical-align: top; text-align: left;">
        <div style="font-weight: bold;">${item.name}</div>
        ${item.serialNumber ? `<div style="font-size: 10px; color: #666;">${item.serialNumber}</div>` : ''}
      </td>
      <td style="vertical-align: top; text-align: center;">${item.quantity}</td>
      <td style="vertical-align: top; text-align: right;">${format(item.unitPrice)}</td>
      <td style="vertical-align: top; text-align: center;">${itemDiscount}</td>
      <td style="vertical-align: top; text-align: right;">${format(item.total)}</td>
    </tr>
  `}).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${data.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 14px; 
            width: 80mm; 
            max-width: 80mm;
            padding: 5px; 
            margin: 0 auto;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .logo { display: block; margin: 0 auto 5px auto; height: 60px; width: auto; max-width: 100%; object-fit: contain; }
          .shop-name { font-weight: bold; font-size: 18px; text-transform: uppercase; margin-bottom: 2px; }
          .shop-details { font-size: 14px; margin-bottom: 2px; }
          
          .divider { border-bottom: 1px solid #000; margin: 5px 0; }
          .thick-divider { border-bottom: 2px solid #000; margin: 5px 0; }
          
          .invoice-title { text-align: center; font-weight: bold; font-size: 18px; margin: 5px 0; }
          .invoice-number { text-align: center; font-weight: bold; font-size: 20px; margin-bottom: 5px; }
          
          .info-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; }
          
          .customer-section { margin: 5px 0; }
          .customer-label { font-weight: bold; }
          
          table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 14px; }
          th { border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 2px 0; text-align: center; font-weight: bold; }
          td { padding: 4px 0; }
          
          .summary-table { width: 100%; margin-top: 5px; font-size: 16px; }
          .summary-row td { padding: 4px 0; text-align: right; }
          .summary-label { font-weight: bold; text-align: left !important; }
          
          .payment-history { margin-top: 10px; border-top: 2px solid #000; padding-top: 5px; }
          .payment-header { font-weight: bold; margin-bottom: 2px; }
          
          .amount-words { margin-top: 5px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; font-weight: bold; font-size: 14px; }
          
          .footer { text-align: center; margin-top: 15px; font-weight: bold; font-size: 15px; }
          
          @media print {
            body { margin: 0; padding: 0; width: 80mm; }
            @page { margin: 0; size: 80mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoUrl}" alt="Logo" class="logo" onerror="this.style.display='none'" />
          <div class="shop-name">${data.shopName || 'Logistics ERP'}</div>
          ${data.shopAddress ? `<div class="shop-details">${data.shopAddress}</div>` : ''}
          <div class="shop-details">
             ${data.shopPhone ? `Mobile: ${data.shopPhone}` : ''} 
             ${data.shopVatNumber ? ` | VAT: ${data.shopVatNumber}` : ''}
          </div>
        </div>
        
        <div class="thick-divider"></div>
        
        <div class="invoice-title">${type === 'quotation' ? labels.quotation : type === 'service' ? labels.serviceTicket : labels.invoice}</div>
        <div class="invoice-number">${data.invoiceNumber}</div>
        
        <div class="info-row">
           <span>Date: ${data.date}</span>
           ${type !== 'service' && data.originalSaleNumber ? `<span>LPO No: ${data.originalSaleNumber}</span>` : ''}
        </div>
        
        <div class="thick-divider"></div>
        
        <div class="customer-section">
           <div class="customer-label">Customer</div>
           <div>Name: ${data.customerName || 'Walk-in'}</div>
           ${data.customerPhone ? `<div>Phone: ${data.customerPhone}</div>` : ''}
           ${data.customerAddress ? `<div>Address: ${data.customerAddress}</div>` : ''}
        </div>
        ${type === 'service' && data.deviceDetails ? `
        <div class="divider"></div>
        <div class="customer-section">
           <div class="customer-label">Service Details</div>
           <div>Device: ${data.deviceDetails.type} ${data.deviceDetails.brand}</div>
           <div>Model: ${data.deviceDetails.model}</div>
           ${data.deviceDetails.serial ? `<div>S/N: ${data.deviceDetails.serial}</div>` : ''}
           ${data.technicianName ? `<div>Technician: ${data.technicianName}</div>` : ''}
           <div>Received: ${data.receivedDate || ""}</div>
           <div>${data.deliveredDate ? 'Delivered:' : 'Expected:'} ${data.deliveredDate || data.expectedDate || ""}</div>
           ${data.problemDescription ? `<div style="margin-top:2px;"><strong>Problem:</strong> ${data.problemDescription}</div>` : ''}
           ${data.serviceDescription ? `<div style="margin-top:2px;"><strong>Work Done:</strong> ${data.serviceDescription}</div>` : ''}
        </div>
        ` : ''}
        
        <div class="thick-divider"></div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: left;">SL</th>
              <th style="width: 40%; text-align: left;">Item</th>
              <th style="width: 10%;">Qty</th>
              <th style="width: 15%; text-align: right;">Price</th>
              <th style="width: 10%;">Dis</th>
              <th style="width: 20%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
        
        <div class="thick-divider"></div>
        
        <table class="summary-table">
           <tr class="summary-row">
              <td class="summary-label">Sub Total:</td>
              <td style="font-weight: bold;">${format(data.subtotal)}</td>
           </tr>
           <tr class="summary-row">
              <td class="summary-label">Discount:</td>
              <td>${format(data.discount || 0)}</td>
           </tr>
           <tr class="summary-row">
              <td class="summary-label">VAT:</td>
              <td>${format(data.vatAmount)}</td>
           </tr>
           <tr class="summary-row" style="font-size: 16px;">
              <td class="summary-label">Grand Total:</td>
              <td style="font-weight: bold;">${format(data.total)}</td>
           </tr>
        </table>
        
        <div class="payment-history">
           <div class="payment-header">Payment History:</div>
           <div class="info-row">
              <span>${data.date} (${data.paymentMethod ? data.paymentMethod.toUpperCase() : 'CASH'})</span>
              <span>${format(data.cashAmount || data.cardAmount || data.total)}</span>
           </div>
           
           <div class="info-row" style="margin-top: 5px; font-size: 14px; color: #dc2626;">
              <span>Remaining Balance:</span>
              <span>${format(Math.max(0, parseFloat(data.total) - parseFloat(data.cashAmount || "0") - parseFloat(data.cardAmount || "0")))}</span>
           </div>
        </div>
        
        <div class="amount-words">
           Amount In Words: ${numberToWords(data.total)}
        </div>
        
        ${data.bankDetails ? `
        <div class="divider"></div>
        <div style="font-size: 11px; margin-top: 5px;">
          <div style="font-weight: bold;">${labels.bankAccount}:</div>
          <div>${data.bankDetails.bankName}</div>
          <div>${data.bankDetails.accountName}</div>
          <div>A/C: ${data.bankDetails.accountNumber}</div>
        </div>
        ` : ''}
        
        <div class="footer">
           Thank you for your business!
        </div>
        
        <script>
           // Close window after print
           window.onload = function() { 
              window.print();
              // window.onafterprint = function() { window.close(); };
           }
        </script>
      </body>
    </html>
  `;
}


function generateA4ReturnHTML(data: InvoiceData, type: string, language: "en" | "ar" = "en"): string {
  // Helper to format currency
  const format = (val: any) => parseFloat(String(val || 0)).toFixed(3);

  const labels = TRANSLATIONS[language];
  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';

  const logoUrl = getFullUrl(data.shopLogo || '/invoice-logo.png');

  const itemsHTML = data.items.map((item, index) => {
    return `
    <tr style="text-align: center;">
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">${index + 1}</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px; text-align: ${textAlign}; font-weight: bold;">
        ${item.name}
        ${item.serialNumber ? `<div style="font-size: 10px; font-weight: normal; color: #6b7280;">S.No: ${item.serialNumber}</div>` : ''}
      </td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">${item.quantity}</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">${format(item.unitPrice)}</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px; font-weight: bold;">${format(item.total)}</td>
    </tr>
  `;
  }).join('');

  // Spacer rows to fill space
  const spacerRows = Array.from({ length: Math.max(0, 3 - data.items.length) }).map(() => `
    <tr>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">&nbsp;</td>
      <td style="border: 1px solid #d1d5db; padding: 12px 8px;">&nbsp;</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${language}">
      <head>
        <title>Return Receipt - ${data.invoiceNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: black; max-width: 900px; margin: 0 auto; position: relative; }
          
          /* Watermark */
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.05;
            z-index: -1;
            width: 80%;
            pointer-events: none;
          }
          
          .header { text-align: center; margin-bottom: 24px; }
          .city { font-weight: bold; font-size: 14px; margin-bottom: 4px; }
          .contact { font-size: 12px; margin-bottom: 12px; }
          .invoice-title { font-size: 32px; font-weight: bold; margin-bottom: 16px; color: #dc2626; }
          
          .info-container { display: flex; gap: 20px; margin-bottom: 24px; }
          .info-box { flex: 1; border: 1px solid #e5e7eb; padding: 16px; border-radius: 2px; }
          
          .info-header { font-weight: bold; margin-bottom: 12px; font-size: 14px; }
          
          .row { display: flex; margin-bottom: 4px; font-size: 13px; align-items: baseline; }
          .label { width: 100px; font-weight: 600; color: #374151; }
          .value { flex: 1; font-weight: 600; text-align: ${textAlign === 'left' ? 'right' : 'left'}; }
          
          /* Right side info box specific styles */
          .info-box.right .row { border-bottom: 0; padding-bottom: 4px; margin-bottom: 8px; }
          .info-box.right .label { width: 120px; }
          .info-box.right .value { text-align: left; }
          
          /* Grid for right box info */
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
          .grid-item { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; }
          .grid-label { font-weight: bold; display: block; margin-bottom: 4px; }
          
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 0; }
          th { background-color: #f9fafb; border: 1px solid #d1d5db; padding: 10px 8px; font-weight: bold; }
          
          .totals-section { width: 100%; font-size: 13px; margin-top: 16px; }
          .totals-container { display: flex; justify-content: flex-end; }
          .totals-box { width: 300px; border: 1px solid #d1d5db; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #d1d5db; }
          .totals-row:last-child { border-bottom: 0; }
          .totals-label { font-weight: bold; }
          .totals-value { font-weight: bold; font-family: monospace; }
          
          .footer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 24px; }
          .footer-box { border: 1px solid #d1d5db; padding: 16px; height: 120px; font-size: 13px; text-align: center; }
          .footer-title { font-weight: bold; margin-bottom: 32px; font-size: 14px; }
          
          @media print {
            body { padding: 0; margin: 0; }
            .watermark { opacity: 0.05 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${logoUrl ? `
          <div style="position: absolute; top: 40px; ${isRtl ? 'right' : 'left'}: 40px; width: 100px;">
           <img src="${logoUrl}" alt="Logo" style="width: 100%; object-fit: contain;" onerror="if (this.src.indexOf('/invoice-logo.png') === -1) { this.src = '/invoice-logo.png'; } else { this.style.display='none'; }">
          </div>
          <div class="watermark">
            <img src="${logoUrl}" alt="Watermark" style="width: 100%; object-fit: contain; filter: grayscale(100%);" onerror="if (this.src.indexOf('/invoice-logo.png') === -1) { this.src = '/invoice-logo.png'; } else { this.style.display='none'; }">
          </div>
        ` : ''}
      
        <div class="header">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${data.shopName || "Company Name"}</h1>
          <div class="city">${data.shopAddress || "Address"}</div>
          <div class="contact">Mobile: ${data.shopPhone || "N/A"} ${data.shopVatNumber ? `| VAT No: ${data.shopVatNumber}` : ''}</div>
          <div class="invoice-title">${labels.returnReceipt}</div>
        </div>
        
        <div class="info-container">
          <!-- Details (Left) -->
          <div class="info-box">
             <div class="info-header" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">${type === 'purchase-return' ? labels.supplierDetails : labels.customerDetails}:</div>
             <div style="display: flex; flex-direction: column; gap: 4px;">
                <div class="row">
                  <span class="label">${labels.name}:</span>
                  <span class="value">${data.customerName || "Walk-in"}</span>
                </div>
                <div class="row">
                  <span class="label">${labels.phone}:</span>
                  <span class="value">${data.customerPhone || "N/A"}</span>
                </div>
                <div class="row">
                  <span class="label">${labels.address}:</span>
                  <span class="value">${data.customerAddress || "N/A"}</span>
                </div>
             </div>
          </div>
          
          <!-- Return Info (Right) -->
          <div class="info-box right" style="padding: 0; border: 0;">
            <div class="info-grid">
               <div class="grid-item">
                 <span class="grid-label">${labels.returnReceipt} No</span>
                 <div>${data.invoiceNumber}</div>
               </div>
               <div class="grid-item">
                 <span class="grid-label">${labels.date}</span>
                 <div>${data.date}</div>
               </div>
            </div>
            <div class="grid-item" style="margin-top: -1px;">
               <div style="display: flex; gap: 8px;">
                 <strong>${labels.originalSale}:</strong> <span>${data.originalSaleNumber || "-"}</span>
               </div>
            </div>
             <div class="grid-item" style="margin-top: -1px;">
               <div style="display: flex; gap: 8px;">
                 <strong>${labels.salesPerson}:</strong> <span>Admin</span>
               </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">${labels.slNo}</th>
              <th style="width: 50%; text-align: ${textAlign};">${labels.particulars}</th>
              <th style="width: 10%;">${labels.pkgQty}</th>
              <th style="width: 15%;">${labels.unitPrice}</th>
              <th style="width: 20%;">${labels.totalAmount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
            ${spacerRows}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-container">
            <div class="totals-box">
              ${data.arReductionAmount && parseFloat(data.arReductionAmount) > 0 ? `
                <div class="totals-row">
                  <span class="totals-label">${labels.balanceReduction}:</span>
                  <span class="totals-value">-${format(data.arReductionAmount)}</span>
                </div>
              ` : ''}
              
              ${data.refundAmount && parseFloat(data.refundAmount) > 0 ? `
                <div class="totals-row" style="color: #16a34a;">
                  <span class="totals-label">${labels.cashRefund}:</span>
                  <span class="totals-value">${format(data.refundAmount)}</span>
                </div>
              ` : ''}

              ${data.paidPortionReturn && parseFloat(data.paidPortionReturn) > 0 ? `
                <div class="totals-row" style="color: #2563eb;">
                  <span class="totals-label">${labels.storeCredit}:</span>
                  <span class="totals-value">${format(data.paidPortionReturn)}</span>
                </div>
              ` : ''}
              
              <div class="totals-row" style="background-color: #f9fafb; font-size: 16px;">
                <span class="totals-label">${labels.totalAmount}:</span>
                <span class="totals-value">${format(data.total)}</span>
              </div>
            </div>
          </div>
        </div>

        ${data.reason ? `
          <div style="margin-top: 24px; padding: 12px; border: 1px solid #d1d5db; background-color: #f9fafb; font-size: 13px;">
            <span style="font-weight: bold; color: #374151;">${labels.reason}:</span> ${data.reason}
          </div>
        ` : ''}

        ${data.bankDetails ? `
          <div style="margin-top: 16px; padding: 12px; border: 1px solid #d1d5db; background-color: #f9fafb; font-size: 13px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${labels.bankAccount}:</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
              <div><strong>Bank:</strong> ${data.bankDetails.bankName}</div>
              <div><strong>Name:</strong> ${data.bankDetails.accountName}</div>
              <div><strong>A/C No:</strong> ${data.bankDetails.accountNumber}</div>
            </div>
          </div>
        ` : ''}

        <div class="footer-grid">
          <div class="footer-box">
            <div class="footer-title">Received By</div>
            <div style="border-top: 1px dashed #d1d5db; margin-top: 40px;"></div>
          </div>
          <div class="footer-box">
            <div class="footer-title">Authorized By</div>
            <div style="border-top: 1px dashed #d1d5db; margin-top: 40px;"></div>
          </div>
          <div class="footer-box">
            <div class="footer-title">Shop Seal</div>
            <div style="margin-top: 20px;"></div>
          </div>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px;">
          Thank you for your business. This is a computer generated return receipt.
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
}

function generateThermalReturnHTML(data: InvoiceData, type: string, language: "en" | "ar" = "en"): string {
  const labels = TRANSLATIONS[language];
  const itemsHTML = data.items.map(item => `
    <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #ccc;">
      <div style="font-weight: bold;">${item.name}</div>
      ${item.serialNumber ? `<div style="font-size: 10px; color: #666;">S/N: ${item.serialNumber}</div>` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span>${item.quantity} x ${formatCurrency(item.unitPrice)}</span>
        <span style="font-family: monospace;">${formatCurrency(item.total)}</span>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Return Receipt - ${data.invoiceNumber}</title>
         <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            width: 80mm; 
            max-width: 80mm;
            padding: 10px; 
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #000; }
          .header h1 { font-size: 16px; margin-bottom: 3px; }
          .info { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #000; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .items { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #000; }
          .totals { margin-bottom: 10px; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; }
          @media print {
            html, body {
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              margin: 0 !important;
              padding: 5px !important;
            }
            @page { 
              size: 80mm auto; 
              margin: 0mm; 
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${labels.returnReceipt}</h1>
          <p>${data.invoiceNumber}</p>
        </div>

        <div class="info">
          <div class="info-row">
            <span>Date:</span>
            <span>${data.date}</span>
          </div>
          <div class="info-row">
            <span>Original Sale:</span>
            <span>${data.originalSaleNumber || '-'}</span>
          </div>
           ${data.customerName && data.customerName !== 'Walk-in Customer' ? `
            <div class="info-row">
              <span>${type === 'purchase-return' ? 'Supplier' : 'Customer'}:</span>
              <span>${data.customerName}</span>
            </div>
          ` : ''}
        </div>

        <div class="items">
          ${itemsHTML}
        </div>

        <div class="totals">
          ${data.arReductionAmount && parseFloat(data.arReductionAmount) > 0 ? `
            <div class="totals-row">
              <span>Bal. Reduction:</span>
              <span>-${formatCurrency(data.arReductionAmount)}</span>
            </div>
          ` : ''}
          
          ${data.refundAmount && parseFloat(data.refundAmount) > 0 ? `
            <div class="totals-row" style="font-weight: bold;">
              <span>Cash Refund:</span>
              <span>${formatCurrency(data.refundAmount)}</span>
            </div>
          ` : ''}

          ${data.paidPortionReturn && parseFloat(data.paidPortionReturn) > 0 ? `
            <div class="totals-row" style="font-weight: bold;">
              <span>Store Credit:</span>
              <span>${formatCurrency(data.paidPortionReturn)}</span>
            </div>
          ` : ''}
        </div>

        ${data.reason ? `
          <div style="margin-bottom: 10px; font-size: 11px;">
            <span style="font-weight: bold;">Reason:</span> ${data.reason}
          </div>
        ` : ''}

        <div class="footer">
          <p>This receipt is proof of return.</p>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
}

export function generateStatementHTML(data: StatementData, language: "en" | "ar" = "en"): string {
  const labels = TRANSLATIONS[language];
  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';

  // Format helpers
  const format = (val: any) => parseFloat(String(val || 0)).toFixed(3);

  const logoUrl = getFullUrl(data.shopDetails.logo || '/invoice-logo.png');

  const itemsHTML = data.items.map(item => `
    <tr style="text-align: center;">
      <td style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">${item.date}</td>
      <td style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">${item.type}</td>
      <td style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-family: monospace;">${item.reference}</td>
      <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">${item.debit ? format(item.debit) : '-'}</td>
      <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">${item.credit ? format(item.credit) : '-'}</td>
      <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">${format(item.balance)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${language}">
      <head>
        <title>${data.title} - ${data.customerDetails.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: black; max-width: 900px; margin: 0 auto; position: relative; }
          .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; z-index: -1; width: 60%; pointer-events: none; }
          .header { text-align: center; margin-bottom: 32px; }
          .title { font-size: 28px; font-weight: bold; text-transform: uppercase; margin: 16px 0; }
          
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px; }
          .info-box { border: 1px solid #d1d5db; padding: 20px; }
          .info-title { font-weight: bold; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: #4b5563; }
          .info-row { display: flex; margin-bottom: 6px; font-size: 14px; }
          .info-label { width: 100px; color: #6b7280; }
          .info-val { flex: 1; font-weight: 600; text-align: right; }
          
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
          th { background-color: #f9fafb; border: 1px solid #d1d5db; padding: 10px; font-weight: bold; text-align: center; }
          
          .summary-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
          .summary-box { width: 350px; border: 1px solid #d1d5db; }
          .summary-row { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          .summary-row:last-child { border-bottom: 0; background-color: #f3f4f6; font-weight: bold; font-size: 16px; }
          
          .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; font-size: 12px; }
          .footer-col { border: 1px solid #d1d5db; padding: 16px; height: 100px; }
          
          @media print {
            body { padding: 0; }
            .watermark { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
         <div class="watermark">
            <img src="${logoUrl}" alt="Watermark" style="width: 100%; object-fit: contain; filter: grayscale(100%);">
         </div>
      
         <div class="header">
            ${logoUrl ? `<div style="margin-bottom: 20px;"><img src="${logoUrl}" alt="Logo" style="height: 80px; object-fit: contain;" onerror="if (this.src.indexOf('/invoice-logo.png') === -1) { this.src = '/invoice-logo.png'; } else { this.style.display='none'; }" /></div>` : ''}
            <div style="font-size: 20px; font-weight: bold;">${data.shopDetails.name || 'Company Name'}</div>
            <div style="color: #4b5563;">${data.shopDetails.address || ''}</div>
            <div style="color: #4b5563;">${data.shopDetails.phone ? `Phone: ${data.shopDetails.phone}` : ''} ${data.shopDetails.vatNumber ? `| VAT: ${data.shopDetails.vatNumber}` : ''}</div>
            <div class="title">${data.title}</div>
         </div>
         
         <div class="info-grid">
            <div class="info-box">
               <div class="info-title">${data.type === 'supplier_statement' ? labels.supplierDetails : labels.customerDetails}</div>
               <div class="info-row"><span class="info-label">${labels.name}:</span><span class="info-val">${data.customerDetails.name}</span></div>
               <div class="info-row"><span class="info-label">${labels.phone}:</span><span class="info-val">${data.customerDetails.phone || '-'}</span></div>
               <div class="info-row"><span class="info-label">${labels.address}:</span><span class="info-val">${data.customerDetails.address || '-'}</span></div>
            </div>
            
            <div class="info-box">
               <div class="info-title">Statement Details</div>
               <div class="info-row"><span class="info-label">Period:</span><span class="info-val">${data.startDate || 'All Time'} - ${data.endDate || 'Present'}</span></div>
               <div class="info-row"><span class="info-label">Generated:</span><span class="info-val">${data.generatedOn || new Date().toLocaleDateString()}</span></div>
            </div>
         </div>
         
         <table>
            <thead>
               <tr>
                  <th>${labels.date}</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
               </tr>
            </thead>
            <tbody>
               ${itemsHTML}
            </tbody>
         </table>
         
         <div class="summary-section">
            <div class="summary-box">
               ${data.summary.map(row => `
                  <div class="summary-row" style="${row.color ? `color: ${row.color}` : ''}">
                     <span>${row.label}</span>
                     <span>${format(row.value)}</span>
                  </div>
               `).join('')}
            </div>
         </div>
         
         <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
}

export type { InvoiceData, InvoiceItem };
