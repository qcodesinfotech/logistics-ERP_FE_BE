import { db } from "../server/db.ts";
import { dispatchItems, dispatchSheets } from "../shared/schema.ts";
import { eq, desc } from "drizzle-orm";

async function main() {
  const latestSheet = await db.query.dispatchSheets.findFirst({
    orderBy: [desc(dispatchSheets.createdAt)]
  });
  if (!latestSheet) { console.log("No sheets"); return; }
  console.log("Latest sheet date:", latestSheet.date);
  
  const items = await db.select().from(dispatchItems).where(eq(dispatchItems.sheetId, latestSheet.id)).limit(5);
  console.log(items.map(i => ({ itemCode: i.itemCode, desc: i.description })));
  process.exit(0);
}
main().catch(console.error);
