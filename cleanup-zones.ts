import 'dotenv/config';
import { db } from "./server/db";
import { dispatchTruckAssignments, driverZones, routes } from "./shared/schema";
import { notInArray } from "drizzle-orm";

async function main() {
  const allRoutes = await db.select({ id: routes.id }).from(routes);
  const routeIds = allRoutes.map(r => r.id);

  if (routeIds.length > 0) {
    const deletedTrucks = await db.delete(dispatchTruckAssignments)
      .where(notInArray(dispatchTruckAssignments.zoneId, routeIds))
      .returning();
    console.log("Deleted invalid truck assignments:", deletedTrucks.length);

    const deletedDrivers = await db.delete(driverZones)
      .where(notInArray(driverZones.zoneId, routeIds))
      .returning();
    console.log("Deleted invalid driver assignments:", deletedDrivers.length);
  }
}
main().then(() => process.exit(0)).catch(console.error);
