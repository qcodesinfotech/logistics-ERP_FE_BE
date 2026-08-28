const postgres = require("postgres");

async function run() {
  const sql = postgres("postgres://postgres:Qcodes%40123ZXCVBNM@213.210.36.52:5432/Logistics_ERP");
  
  try {
    const warehouses = await sql`SELECT * FROM warehouses`;
    console.log("=== WAREHOUSES ===");
    console.log(JSON.stringify(warehouses, null, 2));

    const shops = await sql`SELECT * FROM shops`;
    console.log("=== SHOPS ===");
    console.log(JSON.stringify(shops, null, 2));

    const branches = await sql`SELECT * FROM branches`;
    console.log("=== BRANCHES ===");
    console.log(JSON.stringify(branches, null, 2));
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    process.exit(0);
  }
}
run();
