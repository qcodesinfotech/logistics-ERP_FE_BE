import { db } from "../server/db";
import { dispatchDeliveries } from "../shared/schema";
import { isNotNull } from "drizzle-orm";

async function run() {
  try {
    const list = await db.select({ id: dispatchDeliveries.id, podUrl: dispatchDeliveries.podUrl }).from(dispatchDeliveries).where(isNotNull(dispatchDeliveries.podUrl)).limit(10);
    console.log("dispatchDeliveries podUrls:", list);
  } catch (error) {
    console.error("Drizzle query failed:", error);
  }
  process.exit(0);
}
run();
