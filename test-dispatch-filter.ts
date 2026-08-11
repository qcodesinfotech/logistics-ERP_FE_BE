import { db } from "./server/db";
import { dispatchSheets } from "./shared/schema";
import { storage } from "./server/storage";

async function main() {
  const sheets = await db.select().from(dispatchSheets).limit(1);
  if (sheets.length === 0) {
    console.log("No sheets found");
    process.exit(0);
  }
  const board = await storage.getDispatchBoard(sheets[0].id);
  const z = board.zones[0];
  console.log("Zone ID:", z.zoneId);
  console.log("Trucks:", JSON.stringify(z.trucks, null, 2));
  console.log("Outlet 0:", JSON.stringify(z.outlets[0], null, 2));
  process.exit(0);
}

main().catch(console.error);
