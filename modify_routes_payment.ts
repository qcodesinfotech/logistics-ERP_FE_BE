import * as fs from 'fs';

const filePath = './server/routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

const routeTarget = `app.put("/api/fmcg-invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { items, ...data } = req.body;
      const invoice = await storage.updateFmcgInvoice(req.params.id, data, items);
      res.json(invoice);
    } catch (e) {
      console.error("Update fmcg invoice error:", e);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });`;

const routeReplacement = `app.put("/api/fmcg-invoices/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { items, ...data } = req.body;
      const oldInvoice = await storage.getFmcgInvoice(req.params.id);
      const invoice = await storage.updateFmcgInvoice(req.params.id, data, items);
      
      // Handle payment and Chart of Accounts
      if (data.status === "paid" && oldInvoice?.status !== "paid") {
         try {
           // Create journal entry for payment
           const amount = parseFloat(invoice.totalAmount?.toString() || "0");
           if (amount > 0) {
             const accounts = await storage.getChartOfAccounts();
             const cashAccount = accounts.find((a: any) => a.accountCode === "1000"); // Cash
             const salesAccount = accounts.find((a: any) => a.accountCode === "4000"); // Sales Revenue
             
             if (cashAccount && salesAccount) {
               await storage.createJournalEntry({
                 date: new Date(),
                 referenceId: invoice.invoiceNumber,
                 sourceType: "customer_payment",
                 sourceId: invoice.id,
                 description: \`Payment received for Delivery Invoice \${invoice.invoiceNumber}\`,
                 status: "posted"
               } as any, [
                 { accountId: cashAccount.id, debit: amount, credit: 0, description: "Payment received" },
                 { accountId: salesAccount.id, debit: 0, credit: amount, description: "Sales revenue" }
               ] as any);
             }
           }
         } catch(accountErr) {
           console.error("Chart of accounts integration error:", accountErr);
         }
      }
      
      res.json(invoice);
    } catch (e) {
      console.error("Update fmcg invoice error:", e);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });`;

if (content.includes(routeTarget)) {
    content = content.replace(routeTarget, routeReplacement);
    fs.writeFileSync(filePath, content);
    console.log("Successfully updated invoice payment route");
} else {
    console.log("Could not find the target route in routes.ts");
}
