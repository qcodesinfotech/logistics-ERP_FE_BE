import { db } from "../server/db";
import * as schema from "../shared/schema";

async function main() {
  try {
    const items = await db.select().from(schema.dispatchItems).limit(5);
    console.log("Sample items:");
    items.forEach(i => {
      console.log(`Item: ${i.itemCode}, desc: ${i.description}, Qty: ${i.requestedQty}, Weight: ${i.weight}, UOM: ${i.uom}`);
    });
  } catch (e: any) {
    console.error("Error:", e);
  }
}

main().then(() => process.exit(0));
