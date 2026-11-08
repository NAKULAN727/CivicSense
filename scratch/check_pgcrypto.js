import { getPool, closePool } from '../server/db/connection.js';

async function checkCrypto() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM pg_available_extensions WHERE name = 'pgcrypto';");
    console.log("pgcrypto available:", res.rows);
    const ext = await client.query("SELECT * FROM pg_extension WHERE extname = 'pgcrypto';");
    console.log("pgcrypto installed:", ext.rows);
    if (ext.rows.length === 0) {
      console.log("Installing pgcrypto extension...");
      await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
      console.log("pgcrypto extension created successfully!");
    }
    // Test hmac function
    const hmacTest = await client.query("SELECT encode(hmac('test-data', 'test-secret', 'sha256'), 'hex') as signature;");
    console.log("HMAC test output:", hmacTest.rows[0]);
  } finally {
    client.release();
    await closePool();
  }
}

checkCrypto().catch(console.error);
