import { storage } from "../server/storage";

async function run() {
  try {
    const board = await storage.getDispatchBoard("57c38e5f-57b5-43d1-8dba-0e246cb1d4f9");
    console.log("drizzle board:", JSON.stringify(board, null, 2));
  } catch (error) {
    console.error("Drizzle query failed:", error);
  }
  process.exit(0);
}
run();
