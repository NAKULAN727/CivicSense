import { getPool, closePool } from '../server/db/connection.js';

async function checkExtensions() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const exts = await client.query('SELECT extname FROM pg_extension;');
    console.log('Extensions:', exts.rows.map(r => r.extname));

    const hmacCheck = await client.query(`
      SELECT p.proname, n.nspname as nsp 
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname IN ('hmac', 'digest', 'crypt');
    `);
    console.log('Cryptographic functions:', hmacCheck.rows);

    // Check schemas
    const schemas = await client.query('SELECT nspname FROM pg_namespace ORDER BY nspname;');
    console.log('Schemas:', schemas.rows.map(r => r.nspname));

  } finally {
    client.release();
    await closePool();
  }
}

checkExtensions().catch(console.error);

