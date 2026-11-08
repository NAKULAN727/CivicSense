// CivicSense AI - Phase 12R-2 Database Pre-Flight Check
// Validates target database identity, clean state, and absence of unexpected tables before migration.

import { config } from '../server/config/environment.js';
import { getPool, closePool } from '../server/db/connection.js';

async function preflight() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R-2 DATABASE PRE-FLIGHT CHECK");
  console.log("==================================================");

  const pool = getPool();
  if (!pool) {
    throw new Error("Failed to initialize database connection pool.");
  }

  const client = await pool.connect();
  try {
    const dbRes = await client.query('SELECT current_database(), current_user, version();');
    const { current_database, current_user, version } = dbRes.rows[0];

    console.log(`Database Name:       ${current_database}`);
    console.log(`Current User:        ${current_user}`);
    console.log(`Engine Version:      ${version}`);

    // Check existing tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const existingTables = tablesRes.rows.map(r => r.table_name);
    console.log(`Public Tables Count: ${existingTables.length}`);
    if (existingTables.length > 0) {
      console.log(`Existing Tables:     ${existingTables.join(', ')}`);
      throw new Error(`ABORT: Database contains ${existingTables.length} unexpected existing tables. Pre-flight requires a clean or known state.`);
    }

    // Check schema_migrations
    const migRes = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'schema_migrations'
      ) as has_migs;
    `);

    console.log(`schema_migrations:   ${migRes.rows[0].has_migs ? 'EXISTS' : 'NONE'}`);

    console.log("\nPRE-FLIGHT STATUS:   READY FOR MIGRATION (Clean target database verified)");
    console.log("==================================================");
  } finally {
    client.release();
    await closePool();
  }
}

preflight().catch(err => {
  console.error("PRE-FLIGHT FAILED:", err.message);
  process.exit(1);
});

