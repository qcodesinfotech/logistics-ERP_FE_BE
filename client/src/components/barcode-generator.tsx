import { useState, useRef, useEffect } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Barcode } from "lucide-react";
import type { Product } from "@shared/schema";

interface BarcodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  selectedProductIds?: string[];
}

type CodeType = "barcode" | "qrcode" | "both";
type LabelSize = "small" | "medium" | "large" | "custom";

interface LabelDimensions {
  width: number;
  height: number;
  fontSize: number;
  barcodeHeight: number;
  qrSize: number;
}

const LABEL_SIZES: Record<LabelSize, LabelDimensions> = {
  small: { width: 150, height: 100, fontSize: 10, barcodeHeight: 30, qrSize: 50 },
  medium: { width: 200, height: 130, fontSize: 12, barcodeHeight: 40, qrSize: 70 },
  large: { width: 280, height: 180, fontSize: 14, barcodeHeight: 50, qrSize: 100 },
  custom: { width: 200, height: 130, fontSize: 12, barcodeHeight: 40, qrSize: 70 },
};

export function BarcodeGenerator({
  open,
  onOpenChange,
  products,
  selectedProductIds = [],
}: BarcodeGeneratorProps) {
  const [codeType, setCodeType] = useState<CodeType>("barcode");
  const [labelSize, setLabelSize] = useState<LabelSize>("medium");
  const [customDimensions, setCustomDimensions] = useState<LabelDimensions>(LABEL_SIZES.medium);
  const [includeBoxBarcode, setIncludeBoxBarcode] = useState(true);
  const [generatedLabels, setGeneratedLabels] = useState<JSX.Element[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const productsToGenerate = selectedProductIds.length > 0
    ? products.filter(p => selectedProductIds.includes(p.id))
    : products;

  const dimensions = labelSize === "custom" ? customDimensions : LABEL_SIZES[labelSize];

  useEffect(() => {
    if (open) {
      setGeneratedLabels([]);
    }
  }, [open]);

  const generateBarcode = (value: string): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      try {
        JsBarcode(canvas, value, {
          format: "CODE128",
          width: 2,
          height: dimensions.barcodeHeight,
          displayValue: true,
          fontSize: dimensions.fontSize - 2,
          margin: 5,
        });
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        resolve("");
      }
    });
  };

  const generateQRCode = async (value: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(value, {
        width: dimensions.qrSize,
        margin: 1,
      });
    } catch (e) {
      return "";
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const labels: JSX.Element[] = [];

    for (const product of productsToGenerate) {
      const singleBarcode = product.barcode || product.productCode || "";
      const boxBarcode = product.boxBarCode || "";

      if (singleBarcode) {
        const label = await createLabel(product, singleBarcode, "Single", product.id + "-single");
        if (label) labels.push(label);
      }

      if (includeBoxBarcode && boxBarcode) {
        const label = await createLabel(product, boxBarcode, "Box", product.id + "-box");
        if (label) labels.push(label);
      }
    }

    setGeneratedLabels(labels);
    setIsGenerating(false);
  };

  const createLabel = async (
    product: Product,
    codeValue: string,
    type: "Single" | "Box",
    key: string
  ): Promise<JSX.Element | null> => {
    let barcodeImg = "";
    let qrImg = "";

    if (codeType === "barcode" || codeType === "both") {
      barcodeImg = await generateBarcode(codeValue);
    }
    if (codeType === "qrcode" || codeType === "both") {
      qrImg = await generateQRCode(codeValue);
    }

    return (
      <div
        key={key}
        className="label-item border rounded p-2 bg-white flex flex-col items-center justify-center"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          pageBreakInside: "avoid",
        }}
      >
        <div
          className="font-semibold text-center truncate w-full"
          style={{ fontSize: dimensions.fontSize }}
        >
          {product.name}
        </div>
        <div
          className="text-gray-600 text-center"
          style={{ fontSize: dimensions.fontSize - 2 }}
        >
          Code: {product.productCode || "N/A"}
        </div>
        <div
          className="text-xs text-gray-500"
          style={{ fontSize: dimensions.fontSize - 3 }}
        >
          ({type})
        </div>
        <div className="flex gap-2 items-center mt-1">
          {barcodeImg && (
            <img src={barcodeImg} alt="barcode" style={{ height: dimensions.barcodeHeight + 20 }} />
          )}
          {qrImg && (
            <img src={qrImg} alt="qrcode" style={{ width: dimensions.qrSize, height: dimensions.qrSize }} />
          )}
        </div>
      </div>
    );
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product Labels</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            .labels-container { 
              display: flex; 
              flex-wrap: wrap; 
              gap: 10px; 
              justify-content: flex-start;
            }
            .label-item { 
              border: 1px solid #ccc; 
              border-radius: 4px; 
              padding: 8px; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center;
              page-break-inside: avoid;
            }
            @media print {
              .label-item { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">${printContent}</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Generate Barcodes & QR Codes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Products Selected</Label>
              <div className="text-sm text-muted-foreground">
                {selectedProductIds.length > 0
                  ? `${selectedProductIds.length} product(s) selected`
                  : `All ${products.length} products`}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Code Type</Label>
              <Select value={codeType} onValueChange={(v) => setCodeType(v as CodeType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="barcode">Barcode Only</SelectItem>
                  <SelectItem value="qrcode">QR Code Only</SelectItem>
                  <SelectItem value="both">Both Barcode & QR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Label Size</Label>
              <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (150x100)</SelectItem>
                  <SelectItem value="medium">Medium (200x130)</SelectItem>
                  <SelectItem value="large">Large (280x180)</SelectItem>
                  <SelectItem value="custom">Custom Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {labelSize === "custom" && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-muted rounded-lg">
              <div className="space-y-1">
                <Label className="text-xs">Width (px)</Label>
                <Input
                  type="number"
                  value={customDimensions.width}
                  onChange={(e) =>
                    setCustomDimensions({ ...customDimensions, width: parseInt(e.target.value) || 200 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Height (px)</Label>
                <Input
                  type="number"
                  value={customDimensions.height}
                  onChange={(e) =>
                    setCustomDimensions({ ...customDimensions, height: parseInt(e.target.value) || 130 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={customDimensions.fontSize}
                  onChange={(e) =>
                    setCustomDimensions({ ...customDimensions, fontSize: parseInt(e.target.value) || 12 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Barcode Height</Label>
                <Input
                  type="number"
                  value={customDimensions.barcodeHeight}
                  onChange={(e) =>
                    setCustomDimensions({ ...customDimensions, barcodeHeight: parseInt(e.target.value) || 40 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">QR Size</Label>
                <Input
                  type="number"
                  value={customDimensions.qrSize}
                  onChange={(e) =>
                    setCustomDimensions({ ...customDimensions, qrSize: parseInt(e.target.value) || 70 })
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeBox"
              checked={includeBoxBarcode}
              onCheckedChange={(checked) => setIncludeBoxBarcode(checked as boolean)}
            />
            <Label htmlFor="includeBox" className="text-sm">
              Include Box Barcodes (generate both single and box labels)
            </Label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={isGenerating || productsToGenerate.length === 0}>
              {isGenerating ? "Generating..." : "Generate Labels"}
            </Button>
            {generatedLabels.length > 0 && (
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print Labels
              </Button>
            )}
          </div>

          {generatedLabels.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="text-sm text-muted-foreground mb-3">
                Preview ({generatedLabels.length} labels generated)
              </div>
              <div
                ref={printRef}
                className="flex flex-wrap gap-3 justify-start"
                style={{ maxHeight: "400px", overflowY: "auto" }}
              >
                {generatedLabels}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
