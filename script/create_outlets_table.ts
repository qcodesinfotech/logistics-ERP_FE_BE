import { pool } from "../server/db";

async function main() {
  const client = await pool.connect();
  try {
    console.log("Creating outlets table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS outlets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id varchar NOT NULL,
        name text NOT NULL,
        code text,
        phone text,
        email text,
        address text,
        latitude decimal(10, 7),
        longitude decimal(10, 7),
        contact_person text,
        contact_phone text,
        branch_id varchar,
        status text NOT NULL DEFAULT 'active',
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("Created outlets table.");

    console.log("Creating outlet_zones table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS outlet_zones (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        outlet_id varchar NOT NULL,
        zone_id varchar NOT NULL
      );
    `);
    console.log("Created outlet_zones table.");

  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    client.release();
    pool.end();
  }
}

main();
