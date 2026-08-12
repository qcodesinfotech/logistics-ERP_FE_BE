import { db } from "./server/db";
import { sql } from "drizzle-orm";
import 'dotenv/config';

async function main() {
  try {
    const result = await db.execute(sql`SELECT * FROM information_schema.tables WHERE table_name = 'delivery_docs' OR table_name = 'delivery_attachments';`);
    console.log("Tables found:", result.rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
main();
