// CivicSense AI - Phase 12R-2 Step-by-Step Migration Deployment
// Executes migration 001 and 002 within atomic transactions and records history.
// ZERO destructive SQL – Strictly additive deployment.

import fs from 'node:fs';
import path from 'node:path';
import { getPool, closePool } from '../server/db/connection.js';

const MIGRATIONS_DIR = path.resolve('server', 'db', 'migrations');

async function deployMigrations() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R-2 MIGRATION DEPLOYMENT");
  console.log("==================================================");

  const pool = getPool();
  if (!pool) {
    throw new Error("PostgreSQL connection pool could not be initialized.");
  }

  const client = await pool.connect();
  try {
    // 1. Create migration history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("[STEP 3.0] Verified schema_migrations history table.");

    // 2. Execute Migration 001: Initial Relational Schema
    const mig001Name = '001_initial_enterprise_schema.sql';
    const check001 = await client.query('SELECT migration_name FROM schema_migrations WHERE migration_name = $1;', [mig001Name]);
    
    if (check001.rows.length === 0) {
      console.log(`[STEP 3.1] Executing ${mig001Name}...`);
      const sql001 = fs.readFileSync(path.join(MIGRATIONS_DIR, mig001Name), 'utf8');
      
      await client.query('BEGIN;');
      try {
        await client.query(sql001);
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1);', [mig001Name]);
        await client.query('COMMIT;');
        console.log(`[STEP 3.1 SUCCESS] ${mig001Name} applied cleanly and committed.`);
      } catch (err) {
        await client.query('ROLLBACK;');
        throw new Error(`Migration 001 failed: ${err.message}`);
      }
    } else {
      console.log(`[STEP 3.1 NOTICE] ${mig001Name} was already recorded in schema_migrations.`);
    }

    // Intermediate Verification: Verify expected tables created
    const expectedTables = [
      'tenants',
      'users',
      'incidents',
      'work_orders',
      'ward_datasets',
      'ward_features',
      'audit_logs',
      'telemetry_records',
      'integration_settings'
    ];

    const tablesRes001 = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tablesAfter001 = tablesRes001.rows.map(r => r.table_name);
    console.log(`[STEP 3.2] Public tables present after Migration 001: ${tablesAfter001.length}`);
    for (const t of expectedTables) {
      if (!tablesAfter001.includes(t)) {
        throw new Error(`POST-001 VALIDATION ERROR: Table '${t}' was not created!`);
      }
    }
    console.log(`[STEP 3.2 SUCCESS] All ${expectedTables.length} expected tables verified.`);

    // 3. Execute Migration 002: Enable Row-Level Security
    const mig002Name = '002_enable_rls.sql';
    const check002 = await client.query('SELECT migration_name FROM schema_migrations WHERE migration_name = $1;', [mig002Name]);

    if (check002.rows.length === 0) {
      console.log(`[STEP 3.3] Executing ${mig002Name}...`);
      const sql002 = fs.readFileSync(path.join(MIGRATIONS_DIR, mig002Name), 'utf8');

      await client.query('BEGIN;');
      try {
        await client.query(sql002);
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1);', [mig002Name]);
        await client.query('COMMIT;');
        console.log(`[STEP 3.3 SUCCESS] ${mig002Name} applied cleanly and committed.`);
      } catch (err) {
        await client.query('ROLLBACK;');
        throw new Error(`Migration 002 failed: ${err.message}`);
      }
    } else {
      console.log(`[STEP 3.3 NOTICE] ${mig002Name} was already recorded in schema_migrations.`);
    }

    // 4. Verify RLS policies on tables
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    console.log(`[STEP 3.4 SUCCESS] Verified ${policiesRes.rows.length} Row-Level Security policies deployed.`);
    for (const p of policiesRes.rows) {
      console.log(`  - Table: ${p.tablename.padEnd(20)} Policy: ${p.policyname.padEnd(30)} Command: ${p.cmd}`);
    }

    // 5. Verify schema_migrations state
    const allMigs = await client.query('SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at;');
    console.log("\n[STEP 3.5] Applied Migrations in Database:");
    for (const m of allMigs.rows) {
      console.log(`  - ${m.migration_name} (${m.applied_at.toISOString()})`);
    }

    console.log("\nDEPLOYMENT RESULT: ALL MIGRATIONS DEPLOYED AND RECORDED CLEANLY.");
    console.log("==================================================");

  } finally {
    client.release();
    await closePool();
  }
}

deployMigrations().catch(err => {
  console.error("MIGRATION DEPLOYMENT FAILED:", err.message);
  process.exit(1);
});

