import * as fs from 'fs';

const filePath = './server/storage.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update imports
const importTarget = `  routes\n} from "../shared/schema";`;
const importReplacement = `  routes,\n  fmcgInvoices, FmcgInvoice, InsertFmcgInvoice,\n  fmcgInvoiceItems, FmcgInvoiceItem, InsertFmcgInvoiceItem\n} from "../shared/schema";`;
if (content.includes(importTarget)) {
  content = content.replace(importTarget, importReplacement);
} else {
  console.log("Could not find import target.");
}

// 2. Update IStorage
const istorageTarget = `  deleteVehicleMaintenance(id: string): Promise<void>;\n}`;
const istorageReplacement = `  deleteVehicleMaintenance(id: string): Promise<void>;\n\n  // ====================== FMCG DELIVERY INVOICES ======================\n  getFmcgInvoices(): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] })[]>;\n  getFmcgInvoice(id: string): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] }) | undefined>;\n  createFmcgInvoice(data: InsertFmcgInvoice, items: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice>;\n  updateFmcgInvoice(id: string, data: Partial<InsertFmcgInvoice>, items?: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice>;\n}`;

if (content.includes("export interface IStorage {")) {
    // Find the end of IStorage interface
    const regex = /export interface IStorage \{[\s\S]*?\n\}/;
    const match = content.match(regex);
    if (match) {
        let interfaceBlock = match[0];
        interfaceBlock = interfaceBlock.replace(/\n\}$/, `\n\n  // ====================== FMCG DELIVERY INVOICES ======================\n  getFmcgInvoices(): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] })[]>;\n  getFmcgInvoice(id: string): Promise<(FmcgInvoice & { items: FmcgInvoiceItem[] }) | undefined>;\n  createFmcgInvoice(data: InsertFmcgInvoice, items: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice>;\n  updateFmcgInvoice(id: string, data: Partial<InsertFmcgInvoice>, items?: InsertFmcgInvoiceItem[]): Promise<FmcgInvoice>;\n}`);
        content = content.replace(regex, interfaceBlock);
    } else {
        console.log("Could not find end of IStorage");
    }
}

// 3. Update DatabaseStorage
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

const endOfFileTarget = `}\n\nexport const storage = new DatabaseStorage();`;
if (content.includes(endOfFileTarget)) {
  content = content.replace(endOfFileTarget, dbStorageMethods);
} else {
  console.log("Could not find end of DatabaseStorage.");
}

fs.writeFileSync(filePath, content);
console.log("Successfully modified storage.ts");
