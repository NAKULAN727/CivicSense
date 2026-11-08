import { getPool, closePool } from '../server/db/connection.js';

async function checkHmacSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT p.proname, n.nspname as schema_name 
      FROM pg_proc p 
      JOIN pg_namespace n ON n.oid = p.pronamespace 
      WHERE p.proname = 'hmac';
    `);
    console.log("hmac functions found:", res.rows);
  } finally {
    client.release();
    await closePool();
  }
}

checkHmacSchema().catch(console.error);
