import { db } from "/Users/georgedoss/Documents/logistics-new/logistics-ERP_FE_BE/server/db";
import * as schema from "@shared/schema";

async function main() {
  try {
    const routesList = await db.select().from(schema.routes);
    console.log("ROUTES:");
    console.log(JSON.stringify(routesList, null, 2));
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
