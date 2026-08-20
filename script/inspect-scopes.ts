import { db } from "../server/db";
import { companies, branches } from "../shared/schema";

async function run() {
  console.log("=== COMPANIES ===");
  const allCompanies = await db.select().from(companies);
  console.log(JSON.stringify(allCompanies.map(c => ({ id: c.id, name: c.name })), null, 2));

  console.log("\n=== BRANCHES ===");
  const allBranches = await db.select().from(branches);
  console.log(JSON.stringify(allBranches.map(b => ({ id: b.id, name: b.name, shopId: b.shopId })), null, 2));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
