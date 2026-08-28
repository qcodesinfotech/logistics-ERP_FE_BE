import { db } from "../server/db";
import { shops } from "../shared/schema";

async function run() {
  try {
    const allShops = await db.select().from(shops);
    console.log("=== ALL SHOPS IN DATABASE ===");
    console.log(JSON.stringify(allShops, null, 2));
  } catch (err) {
    console.error("Error inspecting shops:", err);
  } finally {
    process.exit(0);
  }
}
run();
