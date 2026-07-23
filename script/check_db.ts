import { db } from "../server/db";
import { dispatchItems } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const items = await db.select().from(dispatchItems).limit(5);
  console.log(items.map(i => ({ itemCode: i.itemCode, desc: i.description })));
  process.exit(0);
}
main();
