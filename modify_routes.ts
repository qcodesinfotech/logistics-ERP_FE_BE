import * as fs from 'fs';

const filePath = './server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Add Fmcg Invoice auto-generation to delivery patch
const patchTarget = `app.patch("/api/dispatch/items/:id/delivery", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.updateDispatchDelivery(req.params.id, { ...req.body, driverId: req.user?.id });
      res.json(result);`;

const patchReplacement = `app.patch("/api/dispatch/items/:id/delivery", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const result = await storage.updateDispatchDelivery(req.params.id, { ...req.body, driverId: req.user?.id });
      
      // Auto-generate fmcg invoice logic
      if (req.body.status === "delivered" || req.body.status === "partial") {
        try {
          const [dispatchItem] = await db.select().from(schema.dispatchItems).where(eq(schema.dispatchItems.id, req.params.id));
          if (dispatchItem && dispatchItem.toNo && dispatchItem.outletId) {
            // check if invoice exists
            let [invoice] = await db.select().from(schema.fmcgInvoices).where(
              and(
                eq(schema.fmcgInvoices.toNo, dispatchItem.toNo),
                eq(schema.fmcgInvoices.outletId, dispatchItem.outletId)
              )
            );
            
            if (!invoice) {
               invoice = await storage.createFmcgInvoice({
                 invoiceNumber: \`FMCG-\${Date.now()}\`,
                 toNo: dispatchItem.toNo,
                 outletId: dispatchItem.outletId,
                 status: "pending"
               } as any, []);
            }
            
            // check if item already added
            const [existingItem] = await db.select().from(schema.fmcgInvoiceItems).where(
              and(
                eq(schema.fmcgInvoiceItems.invoiceId, invoice.id),
                eq(schema.fmcgInvoiceItems.dispatchItemId, dispatchItem.id)
              )
            );
            
            if (!existingItem) {
              await db.insert(schema.fmcgInvoiceItems).values({
                invoiceId: invoice.id,
                dispatchItemId: dispatchItem.id,
                dispatchDeliveryId: result.id,
                stockNo: dispatchItem.itemCode || "N/A",
                itemName: dispatchItem.description || "N/A",
                packSize: dispatchItem.storageType || dispatchItem.uom || "N/A",
                requestedQty: dispatchItem.requestedQty ? String(dispatchItem.requestedQty) : "0",
                deliveredQty: req.body.deliveredQty ? String(req.body.deliveredQty) : "0"
              });
            } else {
               await db.update(schema.fmcgInvoiceItems).set({
                 deliveredQty: req.body.deliveredQty ? String(req.body.deliveredQty) : "0"
               }).where(eq(schema.fmcgInvoiceItems.id, existingItem.id));
            }
          }
        } catch(invoiceErr) {
          console.error("Auto invoice generation error:", invoiceErr);
        }
      }

      res.json(result);`;

if (content.includes(patchTarget)) {
    content = content.replace(patchTarget, patchReplacement);
} else {
    console.log("Could not find patch target.");
}

// Add new API routes for FMCG Invoices
const endpoints = `
  // ==================== FMCG INVOICES ====================
  app.get("/api/fmcg-invoices", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const invoices = await storage.getFmcgInvoices();
      res.json(invoices);
    } catch (e) {
      console.error("Get fmcg invoices error:", e);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/fmcg-invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const invoice = await storage.getFmcgInvoice(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      res.json(invoice);
    } catch (e) {
      console.error("Get fmcg invoice error:", e);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.put("/api/fmcg-invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { items, ...data } = req.body;
      const invoice = await storage.updateFmcgInvoice(req.params.id, data, items);
      res.json(invoice);
    } catch (e) {
      console.error("Update fmcg invoice error:", e);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });
`;

const insertTarget = `  // Advanced Driver Management APIs`;
if (content.includes(insertTarget)) {
    content = content.replace(insertTarget, endpoints + "\n" + insertTarget);
} else {
    console.log("Could not find insert target.");
}

fs.writeFileSync(filePath, content);
console.log("Successfully modified routes.ts");
