import cron from "node-cron";
import { db } from "./db";
import { contracts } from "../shared/schema";
import { storage } from "./storage";
import { eq } from "drizzle-orm";
import { addMonths, format } from "date-fns";
import { log } from "./index";

export function setupCronJobs() {
  // Run every day at midnight
  cron.schedule("0 0 * * *", async () => {
    log("Running daily contract invoice generation cron job...");
    try {
      await autoGenerateInvoices();
    } catch (error) {
      log(`Error in autoGenerateInvoices: ${error}`, "error");
    }
  });
}

async function autoGenerateInvoices() {
  const today = new Date();

  // Fetch all active contracts
  const activeContracts = await db.select().from(contracts).where(eq(contracts.status, "active"));

  for (const contract of activeContracts) {
    let shouldGenerate = false;
    let periodStart: Date;
    let periodEnd: Date;

    if (contract.nextInvoiceDate) {
      if (new Date(contract.nextInvoiceDate) <= today) {
        shouldGenerate = true;
        periodStart = contract.lastInvoicedDate ? new Date(contract.lastInvoicedDate) : (contract.startDate ? new Date(contract.startDate) : new Date(contract.nextInvoiceDate));
        periodEnd = new Date(contract.nextInvoiceDate);
      } else {
        continue;
      }
    } else if (contract.startDate && new Date(contract.startDate) <= today) {
      // If it doesn't have a nextInvoiceDate but startDate has passed by 1 month
      const firstInvoiceDate = addMonths(new Date(contract.startDate), 1);
      if (firstInvoiceDate <= today) {
        shouldGenerate = true;
        periodStart = new Date(contract.startDate);
        periodEnd = firstInvoiceDate;
      } else {
        continue;
      }
    } else {
      continue;
    }

    if (shouldGenerate) {
      log(`Generating invoice(s) for contract ${contract.id} (${contract.name})`);
      
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      try {
        if (contract.invoiceGenerationType === "outlet" && contract.linkedOutlets && Array.isArray(contract.linkedOutlets) && contract.linkedOutlets.length > 0) {
          // Generate separate invoices per outlet
          for (const outletId of contract.linkedOutlets as string[]) {
            await storage.calculateContractUsage(contract.id, periodStartStr, periodEndStr, outletId);
            await storage.generateContractInvoice(contract.id, periodStartStr, periodEndStr, outletId);
          }
        } else {
          // Brand-wise (single invoice)
          await storage.calculateContractUsage(contract.id, periodStartStr, periodEndStr);
          await storage.generateContractInvoice(contract.id, periodStartStr, periodEndStr);
        }

        // Update contract dates
        const nextDate = addMonths(periodEnd, 1);
        await db.update(contracts).set({
          lastInvoicedDate: periodEndStr as any,
          nextInvoiceDate: format(nextDate, "yyyy-MM-dd") as any
        }).where(eq(contracts.id, contract.id));

      } catch (err) {
        log(`Failed to generate invoice for contract ${contract.id}: ${err}`, "error");
      }
    }
  }
}
