import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function test() {
    const result = await db.execute(sql`SELECT current_database() as db`);
    console.log('✅ Connected to DB:', (result.rows[0] as any).db);
    process.exit(0);
}
test().catch(e => { console.error('❌ Connection failed:', e.message); process.exit(1); });
