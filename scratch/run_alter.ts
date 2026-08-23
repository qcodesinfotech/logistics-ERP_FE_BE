import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    console.log("Adding column...");
    await db.execute(sql`ALTER TABLE "dispatch_sheets" ADD COLUMN IF NOT EXISTS "client_id" varchar;`);
    console.log("Done!");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}

run();
