import * as fs from 'fs';

const filePath = './server/storage.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports to the first import block from "@shared/schema"
const importTarget = `} from "@shared/schema";`;
const importReplacement = `  fmcgInvoices, type FmcgInvoice, type InsertFmcgInvoice,\n  fmcgInvoiceItems, type FmcgInvoiceItem, type InsertFmcgInvoiceItem\n} from "@shared/schema";`;
if (content.includes(importTarget)) {
  content = content.replace(importTarget, importReplacement);
}

// 2. Update IStorage interface
const istorageTarget = `export interface IStorage {`;
if (content.includes(istorageTarget)) {
    const endIStorageRegex = /export interface IStorage \{[\s\S]*?\n\}/;
    const match = content.match(endIStorageRegex);
    if (match) {
        let interfaceBlock = match[0];
        // Add new methods before the closing brace
        interfaceBlock = interfaceBlock.replace(/\n\}$/, `\n\n  // ====================== FMCG DELIVERY INVOICES ======================\n  getFmcgInvoices(): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] })[]>;\n  getFmcgInvoice(id: string): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] }) | undefined>;\n  createFmcgInvoice(data: InsertFmcgInvoice, items: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice>;\n  updateFmcgInvoice(id: string, data: Partial<InsertFmcgInvoice>, items?: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice>;\n}`);
        content = content.replace(endIStorageRegex, interfaceBlock);
    }
}

// 3. Update DatabaseStorage class
const endOfFileTarget = `export const storage = new DatabaseStorage();`;
const dbStorageMethods = `
  // ====================== FMCG DELIVERY INVOICES ======================
  async getFmcgInvoices(): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] })[]> {
    const invoices = await db.select().from(fmcgInvoices).orderBy(desc(fmcgInvoices.createdAt));
    const allItems = await db.select().from(fmcgInvoiceItems);
    
    return invoices.map(invoice => ({
      ...invoice,
      items: allItems.filter(i => i.invoiceId === invoice.id)
    }));
  }

  async getFmcgInvoice(id: string): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] }) | undefined> {
    const [invoice] = await db.select().from(fmcgInvoices).where(eq(fmcgInvoices.id, id));
    if (!invoice) return undefined;
    
    const items = await db.select().from(fmcgInvoiceItems).where(eq(fmcgInvoiceItems.invoiceId, id));
    return { ...invoice, items };
  }

  async createFmcgInvoice(data: InsertFmcgInvoice, items: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice> {
    return await db.transaction(async (tx) => {
      const [invoice] = await tx.insert(fmcgInvoices).values(data).returning();
      
      if (items.length > 0) {
        const itemsWithId = items.map(item => ({ ...item, invoiceId: invoice.id }));
        await tx.insert(fmcgInvoiceItems).values(itemsWithId);
      }
      
      return invoice;
    });
  }

  async updateFmcgInvoice(id: string, data: Partial<InsertFmcgInvoice>, items?: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice> {
    return await db.transaction(async (tx) => {
      const [invoice] = await tx.update(fmcgInvoices)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(fmcgInvoices.id, id))
        .returning();
        
      if (items) {
        await tx.delete(fmcgInvoiceItems).where(eq(fmcgInvoiceItems.invoiceId, id));
        if (items.length > 0) {
          const itemsWithId = items.map(item => ({ ...item, invoiceId: invoice.id }));
          await tx.insert(fmcgInvoiceItems).values(itemsWithId);
        }
      }
      
      return invoice;
    });
  }
}

export const storage = new DatabaseStorage();`;

if (content.includes("}\n\nexport const storage = new DatabaseStorage();")) {
    content = content.replace("}\n\nexport const storage = new DatabaseStorage();", dbStorageMethods);
} else if (content.includes("}\nexport const storage = new DatabaseStorage();")) {
    content = content.replace("}\nexport const storage = new DatabaseStorage();", dbStorageMethods);
}

fs.writeFileSync(filePath, content);
console.log("Successfully modified storage.ts");
