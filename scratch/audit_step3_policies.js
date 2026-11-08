// CivicSense AI - Phase 12R Step 3: RLS Policy Inspection
import { getPool, closePool } from '../server/db/connection.js';

async function inspectPolicies() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // 1. Check pg_class for relrowsecurity and relforcerowsecurity
    const tableSecurity = await client.query(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
        AND c.relname IN ('incidents', 'work_orders', 'audit_logs', 'telemetry_records', 'ward_datasets', 'integration_settings', 'users', 'tenants')
      ORDER BY c.relname;
    `);

    console.log("TABLE_SECURITY_STATUS:");
    console.table(tableSecurity.rows);

    // 2. Query pg_policies for all policies on tenant tables
    const policies = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    console.log("\nPOLICIES_COUNT:", policies.rows.length);
    for (const p of policies.rows) {
      console.log(`\nTable: ${p.tablename} | Policy: ${p.policyname} | Cmd: ${p.cmd} | Permissive: ${p.permissive}`);
      console.log(`Roles: ${JSON.stringify(p.roles)}`);
      console.log(`QUAL: ${p.qual}`);
      console.log(`WITH CHECK: ${p.with_check}`);
    }

  } finally {
    client.release();
    await closePool();
  }
}

inspectPolicies().catch(console.error);

