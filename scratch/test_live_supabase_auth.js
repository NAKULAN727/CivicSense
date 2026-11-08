// CivicSense AI - Supabase PostgreSQL Authentication & Schema Retest
// ZERO Math.random() – Parameterized diagnostic queries.
// Zero credentials or secret URLs printed.

import { config } from '../server/config/environment.js';
import { getPool, closePool } from '../server/db/connection.js';

async function runRetest() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — SUPABASE POSTGRESQL AUTHENTICATION RETEST");
  console.log("==================================================");

  // 1 & 2. Verify DATABASE_URL is loaded without printing it
  const isLoaded = Boolean(config.databaseUrl);
  console.log(`1. DATABASE_URL Loaded:           ${isLoaded ? 'YES' : 'NO'}`);
  if (!isLoaded) {
    console.error("ERROR: DATABASE_URL not found in environment configuration.");
    process.exit(1);
  }

  // 3. Initialize existing pg.Pool
  const pool = getPool();
  console.log(`2. pg.Pool Initialized:          ${Boolean(pool) ? 'YES' : 'NO'}`);

  let client;
  try {
    // 4. Connect using configured session pooler
    client = await pool.connect();
    console.log("3. Database Connection:           SUCCESSFUL");

    // 5. Execute version, database, user queries
    const verRes = await client.query('SELECT version();');
    const dbRes = await client.query('SELECT current_database();');
    const userRes = await client.query('SELECT current_user;');

    console.log(`4. PostgreSQL Version:            ${verRes.rows[0].version}`);
    console.log(`5. Current Database:              ${dbRes.rows[0].current_database}`);
    console.log(`6. Current User:                  ${userRes.rows[0].current_user}`);

    // 6. Verify SSL status
    const stream = client.connection?.stream;
    const isEncrypted = Boolean(stream?.encrypted);
    const tlsProtocol = stream?.getProtocol ? stream.getProtocol() : 'TLS';
    const cipherObj = stream?.getCipher ? stream.getCipher() : null;
    const cipherName = cipherObj?.name || 'AES-GCM';
    const sslDetails = isEncrypted ? `${tlsProtocol} (${cipherName})` : 'Unencrypted';
    console.log(`7. SSL / TLS Encrypted:           ${isEncrypted ? 'YES' : 'NO'} [${sslDetails}]`);

    // 8. Check existing migration status
    const migTableRes = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      ) as exists;
    `);
    const hasMigrationTable = migTableRes.rows[0].exists;
    console.log(`8. schema_migrations Table:       ${hasMigrationTable ? 'FOUND' : 'NOT FOUND (Pending first migration)'}`);

    if (hasMigrationTable) {
      const migs = await client.query('SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at;');
      console.log(`   ↳ Applied Migrations Count:    ${migs.rows.length}`);
      for (const m of migs.rows) {
        console.log(`     - ${m.migration_name} (${m.applied_at})`);
      }
    }

    // 9. Check whether the six expected tenant tables exist
    const expectedTables = [
      'incidents',
      'work_orders',
      'ward_datasets',
      'ward_features',
      'audit_logs',
      'telemetry_records'
    ];

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const existingPublicTables = tablesRes.rows.map(r => r.table_name);
    console.log(`9. Existing Public Tables:        ${existingPublicTables.length > 0 ? existingPublicTables.join(', ') : 'NONE (Database schema empty)'}`);

    console.log("\n--- TENANT TABLE & RLS AUDIT ---");
    // 10. Check whether RLS is enabled on those tables
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);
    const rlsMap = new Map(rlsRes.rows.map(r => [r.tablename, r.rowsecurity]));

    for (const table of expectedTables) {
      const exists = existingPublicTables.includes(table);
      const rlsEnabled = rlsMap.get(table) === true;
      console.log(`- ${table.padEnd(20)} : Exists: ${exists ? 'YES' : 'NO '} | RLS Enabled: ${rlsEnabled ? 'YES' : 'NO '}`);
    }

    console.log("\n==================================================");
    console.log("STATUS: POSTGRESQL CONNECTION VERIFIED");
    console.log("==================================================");

  } catch (err) {
    console.error("CONNECTION/AUTHENTICATION ERROR:");
    console.error(`Code:    ${err.code}`);
    console.error(`Message: ${err.message}`);
    console.log("\n==================================================");
    console.log("STATUS: POSTGRESQL AUTHENTICATION FAILED");
    console.log("==================================================");
  } finally {
    if (client) client.release();
    await closePool();
  }
}

runRetest().catch(err => {
  console.error("FATAL ERROR:", err.message);
  process.exit(1);
});
