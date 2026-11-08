// CivicSense AI - Phase 12 Database Migration Runner
// Applies and tracks PostgreSQL migrations with rollback capabilities.

import fs from 'node:fs';
import path from 'node:path';
import { getPool } from './connection.js';

const MIGRATIONS_DIR = path.resolve('server', 'db', 'migrations');

export async function runMigrations() {
  const pool = getPool();
  if (!pool) {
    return {
      success: true,
      mode: 'LOCAL_PERSISTENT_ENGINE',
      appliedCount: 0,
      appliedMigrations: [],
      status: 'SKIPPED_LOCAL_ENGINE',
      message: 'PostgreSQL migrations not applied: using local sandbox storage engine with embedded relational schema.'
    };
  }

  const client = await pool.connect();
  try {
    // Ensure migrations history table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
      .sort();

    const applied = [];

    for (const file of files) {
      const checkRes = await client.query(
        'SELECT migration_name FROM schema_migrations WHERE migration_name = $1;',
        [file]
      );

      if (checkRes.rows.length === 0) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN;');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (migration_name) VALUES ($1);',
            [file]
          );
          await client.query('COMMIT;');
          applied.push(file);
        } catch (err) {
          await client.query('ROLLBACK;');
          throw new Error(`Failed to apply migration '${file}': ${err.message}`);
        }
      }
    }

    return {
      success: true,
      mode: 'POSTGRESQL',
      appliedCount: applied.length,
      appliedMigrations: applied,
      message: applied.length > 0 
        ? `Successfully applied ${applied.length} pending migration(s).` 
        : 'Database schema is up to date.'
    };
  } finally {
    client.release();
  }
}

export async function rollbackMigration(rollbackFileName) {
  const pool = getPool();
  if (!pool) {
    return {
      success: true,
      mode: 'LOCAL_PERSISTENT_ENGINE',
      message: `Rollback ${rollbackFileName} simulated on local persistent engine.`
    };
  }

  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, rollbackFileName), 'utf8');
    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');
    return { success: true, rollback: rollbackFileName };
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

