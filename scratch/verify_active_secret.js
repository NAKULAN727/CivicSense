import { getPool, closePool } from '../server/db/connection.js';

async function verifySecret() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const s = await client.query("SELECT key_id, (secret IS NOT NULL AND length(secret) > 0) as has_secret FROM app_security.auth_secrets WHERE key_id = 'active';");
    console.log("Active secret configured:", s.rows[0]);
  } finally {
    client.release();
    await closePool();
  }
}

verifySecret().catch(console.error);

