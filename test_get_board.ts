import { storage } from "./server/storage";

async function main() {
  try {
    const sheetId = "b951bc5c-55ce-4b44-9187-951ab86207e7";
    console.log("Calling getDispatchBoard for sheetId:", sheetId);
    const result = await storage.getDispatchBoard(sheetId);
    console.log("Success! Result keys:", Object.keys(result));
  } catch (err: any) {
    console.error("EXACT ERROR in getDispatchBoard:", err);
  } finally {
    process.exit(0);
  }
}

main();
