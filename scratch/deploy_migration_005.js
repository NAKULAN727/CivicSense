// CivicSense AI - Phase 12R Deploy Migration 005
import fs from 'node:fs';
import path from 'node:path';
import { getPool, closePool } from '../server/db/connection.js';

async function deployMigration005() {
  const pool = getPool();
  const client = await pool.connect();
  console.log("=== EXECUTING MIGRATION 005_HARDEN_RLS_CRYPTOGRAPHIC_CONTEXT.SQL ===");

  try {
    const migFile = '005_harden_rls_cryptographic_context.sql';
    const migPath = path.resolve('server', 'db', 'migrations', migFile);
    const sql = fs.readFileSync(migPath, 'utf8');

    await client.query("BEGIN;");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING;",
      [migFile]
    );
    await client.query("COMMIT;");
    console.log("SUCCESS: Migration 005 deployed and committed successfully!");

    // Verify policies
    const polRes = await client.query(`
      SELECT tablename, policyname, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log(`\nVerified ${polRes.rows.length} updated policies:`);
    for (const p of polRes.rows) {
      console.log(`Table: ${p.tablename} | Policy: ${p.policyname}`);
      console.log(`  QUAL: ${p.qual}`);
    }

  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration 005 failed, rolled back:", err.message);
    throw err;
  } finally {
    client.release();
    await closePool();
  }
}

deployMigration005().catch(console.error);

