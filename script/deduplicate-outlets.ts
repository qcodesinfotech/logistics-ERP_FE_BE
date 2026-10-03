import "dotenv/config";
import { db } from "../server/db";
import { outlets } from "../shared/schema";
import { sql } from "drizzle-orm";

async function run() {
  const all = await db.select().from(outlets);
  const byCode: Record<string, any[]> = {};
  for (const o of all) {
    const c = (o.code || "").trim().toLowerCase();
    if (!c) continue;
    if (!byCode[c]) byCode[c] = [];
    byCode[c].push(o);
  }

  const dupCodes = Object.entries(byCode).filter(([_, v]) => v.length > 1);
  console.log(`Starting merge for ${dupCodes.length} duplicate outlet codes...`);

  const tables = [
    "dispatch_items",
    "dispatch_deliveries",
    "dispatch_outlet_zone_overrides",
    "outlet_zones",
    "dispatch_outlet_sequences",
    "delivery_docs",
    "dispatch_outlet_truck_assignments",
    "dispatch_pending_quantities",
    "contract_invoices",
    "contract_monthly_usage",
    "fmcg_invoices",
    "contracts"
  ];

  let mergedCount = 0;
  let deletedDups = 0;

  for (const [code, list] of dupCodes) {
    // Sort to find best canonical
    list.sort((a, b) => {
      // 1. Has coordinates
      const aHasCoords = !!(a.latitude && a.longitude && a.latitude.trim() !== "");
      const bHasCoords = !!(b.latitude && b.longitude && b.latitude.trim() !== "");
      if (aHasCoords && !bHasCoords) return -1;
      if (!aHasCoords && bHasCoords) return 1;

      // 2. Has brand
      const aHasBrand = !!a.brandId;
      const bHasBrand = !!b.brandId;
      if (aHasBrand && !bHasBrand) return -1;
      if (!aHasBrand && bHasBrand) return 1;

      // 3. Name quality (not starting with "Outlet ")
      const aGeneric = (a.name || "").startsWith("Outlet ");
      const bGeneric = (b.name || "").startsWith("Outlet ");
      if (!aGeneric && bGeneric) return -1;
      if (aGeneric && !bGeneric) return 1;

      // 4. Earliest creation
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });

    const canonical = list[0];
    const duplicates = list.slice(1);

    // Merge attributes from duplicates into canonical
    let updatedCanonical = false;
    for (const dup of duplicates) {
      if (!canonical.clientId && dup.clientId) { canonical.clientId = dup.clientId; updatedCanonical = true; }
      if (!canonical.brandId && dup.brandId) { canonical.brandId = dup.brandId; updatedCanonical = true; }
      if (!canonical.routeId && dup.routeId) { canonical.routeId = dup.routeId; updatedCanonical = true; }
      if ((!canonical.latitude || canonical.latitude.trim() === "") && dup.latitude && dup.latitude.trim() !== "") {
        canonical.latitude = dup.latitude;
        updatedCanonical = true;
      }
      if ((!canonical.longitude || canonical.longitude.trim() === "") && dup.longitude && dup.longitude.trim() !== "") {
        canonical.longitude = dup.longitude;
        updatedCanonical = true;
      }
      if (!canonical.phone && dup.phone) { canonical.phone = dup.phone; updatedCanonical = true; }
      if (!canonical.email && dup.email) { canonical.email = dup.email; updatedCanonical = true; }
      if (!canonical.address && dup.address) { canonical.address = dup.address; updatedCanonical = true; }
      if (!canonical.contactPerson && dup.contactPerson) { canonical.contactPerson = dup.contactPerson; updatedCanonical = true; }
      if (!canonical.contactPhone && dup.contactPhone) { canonical.contactPhone = dup.contactPhone; updatedCanonical = true; }
    }

    if (updatedCanonical) {
      const escapeStr = (s: string | null | undefined) => s ? `'${s.replace(/'/g, "''")}'` : 'NULL';
      await db.execute(sql.raw(`
        UPDATE outlets SET 
          client_id = ${canonical.clientId ? `'${canonical.clientId}'` : 'NULL'},
          brand_id = ${canonical.brandId ? `'${canonical.brandId}'` : 'NULL'},
          route_id = ${canonical.routeId ? `'${canonical.routeId}'` : 'NULL'},
          latitude = ${canonical.latitude ? `'${canonical.latitude}'` : 'NULL'},
          longitude = ${canonical.longitude ? `'${canonical.longitude}'` : 'NULL'},
          phone = ${escapeStr(canonical.phone)},
          email = ${escapeStr(canonical.email)},
          address = ${escapeStr(canonical.address)},
          contact_person = ${escapeStr(canonical.contactPerson)},
          contact_phone = ${escapeStr(canonical.contactPhone)}
        WHERE id = '${canonical.id}'
      `));
    }

    // Remap foreign keys from duplicate IDs to canonical ID
    for (const dup of duplicates) {
      for (const t of tables) {
        await db.execute(sql.raw(`UPDATE ${t} SET outlet_id = '${canonical.id}' WHERE outlet_id = '${dup.id}'`));
      }
      await db.execute(sql.raw(`DELETE FROM outlets WHERE id = '${dup.id}'`));
      deletedDups++;
    }
    mergedCount++;
  }

  console.log(`Successfully merged ${mergedCount} outlet codes, deleted ${deletedDups} duplicate rows.`);

  const remaining = await db.select().from(outlets);
  console.log(`Remaining total outlets in DB: ${remaining.length}`);
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
