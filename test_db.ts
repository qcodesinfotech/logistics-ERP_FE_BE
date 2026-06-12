import { db } from "./server/db";

async function main() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "order_expenses" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" varchar NOT NULL,
        "description" text NOT NULL,
        "qty" numeric(12, 3) DEFAULT '1.000' NOT NULL,
        "unit_rate" numeric(12, 3) DEFAULT '0.000' NOT NULL,
        "total" numeric(12, 3) DEFAULT '0.000' NOT NULL,
        "created_at" timestamp DEFAULT now()
      );
    `);
    console.log("Table 'order_expenses' created successfully (or already exists).");
  } catch (e) {
    console.error("Error creating table:", e);
  }
  process.exit(0);
}
main();
