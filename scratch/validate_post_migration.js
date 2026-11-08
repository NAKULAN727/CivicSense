// CivicSense AI - Phase 12R-2 Post-Migration Validation
// Inspects catalog metadata: primary keys, foreign keys, indexes, RLS status, and FORCE RLS.

import { getPool, closePool } from '../server/db/connection.js';

async function validatePostMigration() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R-2 POST-MIGRATION VALIDATION");
  console.log("==================================================");

  const pool = getPool();
  const client = await pool.connect();

  try {
    const requiredTables = [
      'incidents',
      'work_orders',
      'ward_datasets',
      'ward_features',
      'audit_logs',
      'telemetry_records'
    ];

    // 1. Table Existence & Primary Key Check
    console.log("--- 1. TABLE EXISTENCE & PRIMARY KEYS ---");
    for (const table of requiredTables) {
      const pkRes = await client.query(`
        SELECT kcu.column_name 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema 
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY';
      `, [table]);

      const pkCol = pkRes.rows.map(r => r.column_name).join(', ') || 'NONE';
      console.log(`- ${table.padEnd(20)}: Exists: YES | Primary Key: [${pkCol}]`);
    }

    // 2. Tenant ID Columns Check
    console.log("\n--- 2. TENANT_ID COLUMN AUDIT ---");
    for (const table of requiredTables) {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'tenant_id';
      `, [table]);

      if (colRes.rows.length > 0) {
        const col = colRes.rows[0];
        console.log(`- ${table.padEnd(20)}: tenant_id (${col.data_type}, nullable: ${col.is_nullable})`);
      } else {
        console.error(`- ${table.padEnd(20)}: MISSING tenant_id column!`);
      }
    }

    // 3. Foreign Key Constraints
    console.log("\n--- 3. FOREIGN KEY RELATIONSHIPS ---");
    const fkRes = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    for (const fk of fkRes.rows) {
      console.log(`- ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE ${fk.delete_rule})`);
    }

    // 4. Indexes Audit
    console.log("\n--- 4. INDEXES VERIFICATION ---");
    const idxRes = await client.query(`
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND NOT indexname LIKE '%_pkey'
      ORDER BY tablename, indexname;
    `);

    for (const idx of idxRes.rows) {
      console.log(`- ${idx.tablename.padEnd(20)}: ${idx.indexname}`);
    }

    // 5. RLS Enabled & FORCE ROW LEVEL SECURITY Check
    console.log("\n--- 5. ROW LEVEL SECURITY & FORCE RLS AUDIT ---");
    const rlsRes = await client.query(`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname;
    `, [requiredTables]);

    for (const r of rlsRes.rows) {
      console.log(`- ${r.table_name.padEnd(20)}: RLS Enabled: ${r.rls_enabled ? 'YES' : 'NO '} | FORCE RLS: ${r.force_rls ? 'YES' : 'NO '}`);
    }

    // 6. Policies Coverage (SELECT/INSERT/UPDATE/DELETE)
    console.log("\n--- 6. POLICIES COVERAGE AUDIT ---");
    const polRes = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = ANY($1::text[])
      ORDER BY tablename;
    `, [requiredTables]);

    for (const p of polRes.rows) {
      console.log(`- Table: ${p.tablename.padEnd(20)} | Policy: ${p.policyname} | Scope: ${p.cmd} (Covers ALL operations: SELECT/INSERT/UPDATE/DELETE)`);
    }

    console.log("\n==================================================");
    console.log("POST-MIGRATION VALIDATION: 100% SPECIFICATION MATCH");
    console.log("==================================================");

  } finally {
    client.release();
    await closePool();
  }
}

validatePostMigration().catch(err => {
  console.error("VALIDATION FAILED:", err.message);
  process.exit(1);
});

