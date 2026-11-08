// CivicSense AI - Phase 12R-4 Pre-Flight Backup
import fs from 'node:fs';
import path from 'node:path';
import { getPool, closePool } from '../server/db/connection.js';

async function backupDatabase() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const backupDir = path.resolve('server/data/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `supabase_backup_pre_remediation_${timestamp}.json`);

    const tables = [
      'tenants', 'users', 'incidents', 'work_orders', 'audit_logs',
      'telemetry_records', 'ward_datasets', 'ward_features', 'integration_settings',
      'schema_migrations'
    ];

    const backupData = {
      backupTimestamp: new Date().toISOString(),
      database: 'Supabase PostgreSQL 17.11',
      tables: {}
    };

    for (const table of tables) {
      const res = await client.query(`SELECT * FROM ${table};`);
      backupData.tables[table] = res.rows;
      console.log(`Table ${table}: ${res.rows.length} rows backed up.`);
    }

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`Backup successfully written to: ${backupFile}`);

    // Verify backup file exists and has size
    const stat = fs.statSync(backupFile);
    console.log(`Backup file size: ${stat.size} bytes.`);
  } finally {
    client.release();
    await closePool();
  }
}

backupDatabase().catch(console.error);
