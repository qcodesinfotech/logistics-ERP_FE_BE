const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");

async function run() {
  const sql = postgres("postgres://postgres:Qcodes%40123ZXCVBNM@213.210.36.52:5432/Logistics_ERP");
  
  const result = await sql`SELECT pod_url FROM dispatch_deliveries WHERE pod_url IS NOT NULL LIMIT 5`;
  console.log("dispatch_deliveries:", result);
  
  process.exit(0);
}
run();
