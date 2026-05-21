import { db } from './server/db.ts';
import { storage } from './server/storage.ts';

async function run() {
  try {
    const stats = await storage.getDashboardStats();
    console.log("Pending Receivables:", stats.pendingReceivables);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
