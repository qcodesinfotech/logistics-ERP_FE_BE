import { db, pool } from "./server/db";
import { routes, brands, outlets } from "./shared/schema";
import fs from "fs";
import { eq } from "drizzle-orm";

async function main() {
  try {
    const data = JSON.parse(fs.readFileSync("./seed-data.json", "utf8"));

    // Extract unique Routes
    const uniqueRouteNames = Array.from(new Set(data.map((item: any) => `Route ${item.route}`)));
    const routeMap = new Map(); // Name to ID
    
    for (const routeName of uniqueRouteNames) {
      // Check if exists
      const existing = await db.select().from(routes).where(eq(routes.name, routeName));
      if (existing.length > 0) {
        routeMap.set(routeName, existing[0].id);
      } else {
        const [inserted] = await db.insert(routes).values({ name: routeName }).returning();
        routeMap.set(routeName, inserted.id);
      }
    }
    console.log("Routes seeded:", routeMap.size);

    // Extract unique Brands
    const uniqueBrandNames = Array.from(new Set(data.map((item: any) => item.brand)));
    const brandMap = new Map(); // Name to ID

    for (const brandName of uniqueBrandNames) {
       // Check if exists
       const existing = await db.select().from(brands).where(eq(brands.name, brandName as string));
       if (existing.length > 0) {
         brandMap.set(brandName, existing[0].id);
       } else {
         const [inserted] = await db.insert(brands).values({ name: brandName as string }).returning();
         brandMap.set(brandName, inserted.id);
       }
    }
    console.log("Brands seeded:", brandMap.size);

    // Insert Outlets
    for (const item of data) {
      const routeId = routeMap.get(`Route ${item.route}`);
      const brandId = brandMap.get(item.brand);

      // Check if outlet exists by shop number (code) or name
      const existing = await db.select().from(outlets).where(eq(outlets.code, item.shopNumber));
      
      if (existing.length === 0) {
        await db.insert(outlets).values({
          name: item.outletName,
          code: item.shopNumber,
          routeId,
          brandId,
          status: "active"
        });
      } else {
        // Update if exists
        await db.update(outlets)
          .set({ routeId, brandId, name: item.outletName })
          .where(eq(outlets.id, existing[0].id));
      }
    }
    
    console.log("Outlets seeded successfully.");
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    await pool.end();
  }
}

main();
