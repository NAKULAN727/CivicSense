// CivicSense AI - Database Pre-Remediation Backup Script
import fs from 'node:fs';
import path from 'node:path';
import { getPool, closePool } from '../server/db/connection.js';

async function backupDatabase() {
  console.log("=== CREATING PRE-REMEDIATION DATABASE BACKUP ===");
  const pool = getPool();
  const client = await pool.connect();

  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const backupData = {
      timestamp: new Date().toISOString(),
      database: 'postgres',
      schema: 'public',
      tables: {}
    };

    for (const row of tablesRes.rows) {
      const tbl = row.table_name;
      const dataRes = await client.query(`SELECT * FROM "${tbl}";`);
      backupData.tables[tbl] = dataRes.rows;
      console.log(`Backed up table '${tbl}': ${dataRes.rows.length} rows.`);
    }

    const backupDir = path.resolve('server/data/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `pre_remediation_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`\nBackup successfully written to: ${backupFile}`);

    return backupFile;
  } finally {
    client.release();
    await closePool();
  }
}

backupDatabase().catch(console.error);
