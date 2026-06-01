import { db } from './server/db';
import { dispatchSheets, dispatchItems, dispatchOutletZoneOverrides, dispatchDeliveries } from './shared/schema';
import { eq, inArray } from 'drizzle-orm';

async function run() {
  try {
    const data = { date: "2026-05-31", fileName: "test.csv" };
    
    // Delete existing sheet for same date
    const [existing] = await db.select().from(dispatchSheets).where(eq(dispatchSheets.date, data.date));
    
    if (existing) {
      console.log("Found existing:", existing.id);
      const existingItems = await db.select({ id: dispatchItems.id })
        .from(dispatchItems)
        .where(eq(dispatchItems.sheetId, existing.id));
      
      const itemIds = existingItems.map(item => item.id);
      console.log("Existing items:", itemIds.length);
      
      if (itemIds.length > 0) {
        await db.delete(dispatchDeliveries)
          .where(inArray(dispatchDeliveries.dispatchItemId, itemIds));
      }
      
      await db.delete(dispatchOutletZoneOverrides).where(eq(dispatchOutletZoneOverrides.sheetId, existing.id));
      await db.delete(dispatchItems).where(eq(dispatchItems.sheetId, existing.id));
      await db.delete(dispatchSheets).where(eq(dispatchSheets.id, existing.id));
    }
    
    console.log("Inserting sheet...");
    const [sheet] = await db.insert(dispatchSheets).values(data).returning();
    console.log("Sheet inserted:", sheet.id);
    
    const items = [
      {
        sheetId: sheet.id,
        outletCode: "TEST",
        itemCode: "ITEM1",
        description: null,
        weight: "1.5",
        totalDelivered: null,
        remaining: null,
        remark: null,
        grnNumber: null,
      }
    ];
    console.log("Inserting items...");
    const inserted = await db.insert(dispatchItems).values(items).returning();
    console.log("Success!", inserted.length);
  } catch (e) {
    console.error("Create dispatch sheet error:", e);
  }
  process.exit(0);
}

run();
