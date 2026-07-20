import 'dotenv/config';
import { db } from "./server/db";
import { dispatchTruckAssignments, routes, zones } from "./shared/schema";

async function main() {
  const trucks = await db.select().from(dispatchTruckAssignments);
  console.log("Truck Assignments:", trucks);
  
  const allRoutes = await db.select().from(routes);
  console.log("Routes:", allRoutes);

  const allZones = await db.select().from(zones);
  console.log("Zones:", allZones);
}
main().then(() => process.exit(0)).catch(console.error);
