// CivicSense AI - Phase 12R Database Pre-Remediation Backup
import { getPool, closePool } from '../server/db/connection.js';
import fs from 'node:fs';

async function backupDatabaseState() {
  const pool = getPool();
  const client = await pool.connect();
  console.log("=== PHASE 12R-4: PRE-REMEDIATION DATABASE BACKUP ===");

  try {
    const backup = {
      timestamp: new Date().toISOString(),
      databaseVersion: '',
      tables: {},
      policies: [],
      roles: []
    };

    const vRes = await client.query("SELECT version();");
    backup.databaseVersion = vRes.rows[0].version;

    // 1. Get all public tables and row counts
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const t of tablesRes.rows) {
      const countRes = await client.query(`SELECT count(*) FROM "${t.table_name}";`);
      backup.tables[t.table_name] = {
        rowCount: parseInt(countRes.rows[0].count, 10)
      };
    }
    console.log("Tables and row counts captured:", backup.tables);

    // 2. Capture policies
    const polRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    backup.policies = polRes.rows;
    console.log("Existing policies captured:", polRes.rows.length);

    // 3. Capture roles
    const rolesRes = await client.query(`
      SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls
      FROM pg_roles 
      WHERE rolname IN ('postgres', 'civicsense_app_role', 'authenticated', 'anon', 'service_role')
      ORDER BY rolname;
    `);
    backup.roles = rolesRes.rows;

    fs.writeFileSync('scratch/db_pre_remediation_backup.json', JSON.stringify(backup, null, 2));
    console.log("Pre-remediation database state saved to scratch/db_pre_remediation_backup.json.");

  } finally {
    client.release();
    await closePool();
  }
}

backupDatabaseState().catch(console.error);

