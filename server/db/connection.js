// CivicSense AI - Phase 12 Database Connection & Transaction Manager
// Manages PostgreSQL connection pooling, RLS context, and graceful fallback.

import pg from 'pg';
import crypto from 'node:crypto';
import { config } from '../config/environment.js';

const { Pool } = pg;

let pool = null;
let isConnectedToPostgres = false;

/**
 * Checks if DATABASE_URL contains placeholder tokens.
 */
export function isPlaceholderDatabaseUrl(url) {
  if (!url || typeof url !== 'string') return true;
  return url.includes('[YOUR-PASSWORD]') || url.includes('<') || url.includes('YOUR_PASSWORD');
}

/**
 * Checks whether the server is explicitly operating in local sandbox storage mode.
 */
export function isSandboxStorageMode() {
  if (process.env.CIVICSENSE_STORAGE_MODE === 'SANDBOX' || process.env.STORAGE_MODE === 'SANDBOX') {
    return true;
  }
  return !config.databaseUrl || isPlaceholderDatabaseUrl(config.databaseUrl);
}

/**
 * Initializes or returns the PostgreSQL connection pool.
 */
export function getPool() {
  if (pool) return pool;

  if (config.databaseUrl && !isPlaceholderDatabaseUrl(config.databaseUrl)) {
    const isSupabaseOrRemote = config.databaseUrl.includes('supabase.co') || 
                               config.databaseUrl.includes('supabase.com') ||
                               config.databaseUrl.includes('pooler.supabase') ||
                               config.databaseUrl.includes('sslmode=require') || 
                               config.databaseUrl.includes('ssl=true');

    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: isSupabaseOrRemote ? { rejectUnauthorized: false } : undefined
    });

    pool.on('error', (err) => {
      console.warn('[DB_POOL_WARNING] Unexpected client error on idle PostgreSQL client:', err.message);
    });
  }

  return pool;
}

/**
 * Probes PostgreSQL connection readiness.
 * Returns { isConnected: boolean, status: string, error?: string }
 */
export async function checkDatabaseHealth() {
  if (isSandboxStorageMode()) {
    return {
      isConnected: false,
      status: 'NOT_CONFIGURED',
      engine: 'LOCAL_PERSISTENT_ENGINE',
      notice: isPlaceholderDatabaseUrl(config.databaseUrl)
        ? 'PostgreSQL DATABASE_URL contains placeholder password; replace [YOUR-PASSWORD] in .env to connect to Supabase.'
        : 'PostgreSQL DATABASE_URL not active; local file-backed persistent transaction store active.'
    };
  }

  const p = getPool();
  if (!p) {
    return {
      isConnected: false,
      status: 'NOT_CONFIGURED',
      engine: 'LOCAL_PERSISTENT_ENGINE'
    };
  }

  try {
    const client = await p.connect();
    try {
      const res = await client.query('SELECT NOW() AS current_time, version();');
      isConnectedToPostgres = true;
      return {
        isConnected: true,
        status: 'CONNECTED',
        engine: 'POSTGRESQL_RLS',
        serverTime: res.rows[0]?.current_time,
        version: res.rows[0]?.version
      };
    } finally {
      client.release();
    }
  } catch (err) {
    isConnectedToPostgres = false;
    return {
      isConnected: false,
      status: 'UNAVAILABLE',
      engine: 'LOCAL_PERSISTENT_ENGINE',
      error: err.message
    };
  }
}

/**
 * Creates a transactional client wrapper around pg.Client
 * providing parameterized SQL, RLS validation, and consistent CRUD helpers.
 */
function createPgTransactionalClient(client, tenantId, isSuperAdmin) {
  return {
    isPostgres: true,
    rawClient: client,

    /**
     * Executes raw parameterized SQL statement.
     */
    sql: async (queryText, params = []) => {
      return client.query(queryText, params);
    },

    /**
     * Queries rows from a table with tenant RLS enforcement and optional SQL WHERE clause.
     */
    query: async (tableName, filterFn, sqlWhereClause = '', sqlParams = []) => {
      let queryStr = `SELECT * FROM ${tableName}`;
      if (sqlWhereClause) {
        queryStr += ` WHERE ${sqlWhereClause}`;
      }
      const res = await client.query(queryStr, sqlParams);
      let rows = res.rows || [];
      if (typeof filterFn === 'function') {
        rows = rows.filter(filterFn);
      }
      return rows;
    },

    /**
     * Inserts a record using parameterized SQL.
     */
    insert: async (tableName, record) => {
      // Database-level RLS precondition check
      if (record.tenant_id && !isSuperAdmin && record.tenant_id !== tenantId) {
        const err = new Error(
          `RLS_VIOLATION: Cannot insert record with tenant_id '${record.tenant_id}' in tenant context '${tenantId}'.`
        );
        err.code = '42501'; // PostgreSQL insufficient_privilege
        err.status = 403;
        throw err;
      }

      const keys = Object.keys(record);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => {
        const val = record[k];
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });

      const queryStr = `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders}) RETURNING *;`;
      const res = await client.query(queryStr, values);
      return res.rows[0];
    },

    /**
     * Updates a record using parameterized SQL.
     */
    update: async (tableName, idField, idValue, updates) => {
      const keys = Object.keys(updates);
      if (keys.length === 0) return null;

      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
      const values = keys.map(k => {
        const val = updates[k];
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });
      values.push(idValue);

      const hasUpdatedAt = ['incidents', 'work_orders', 'tenants', 'users', 'integration_settings'].includes(tableName) && !keys.includes('updated_at');
      const updatedSql = hasUpdatedAt ? ', updated_at = NOW()' : '';
      const queryStr = `UPDATE ${tableName} SET ${setClauses}${updatedSql} WHERE "${idField}" = $${values.length} RETURNING *;`;
      const res = await client.query(queryStr, values);
      return res.rows[0] || null;
    },

    /**
     * Deletes a record by ID using parameterized SQL.
     */
    delete: async (tableName, idField, idValue) => {
      const queryStr = `DELETE FROM ${tableName} WHERE "${idField}" = $1 RETURNING *;`;
      const res = await client.query(queryStr, [idValue]);
      return res.rows[0] || null;
    }
  };
}

/**
 * Executes a transactional operation with PostgreSQL Row-Level Security (RLS) context.
 * Enforces:
 *   SET LOCAL app.current_tenant_id = $1;
 *   SET LOCAL app.is_super_admin = $2;
 * Commits on success, rolls back on error.
 * 
 * FAIL-SAFE RULE: If a real DATABASE_URL is configured but PostgreSQL is unavailable,
 * this function throws DATABASE_UNAVAILABLE and REFUSES silent fallback to JSON storage.
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {boolean} isSuperAdmin - True if super-admin bypass is authorized
 * @param {Function} callback - Async function(client) => Promise<any>
 */
export async function executeWithTenantContext(tenantId, isSuperAdmin = false, callback) {
  const isPostgresConfigured = !isSandboxStorageMode();

  if (isPostgresConfigured) {
    const p = getPool();
    if (!p) {
      const err = new Error('DATABASE_UNAVAILABLE: PostgreSQL is configured but connection pool is uninitialized.');
      err.status = 503;
      err.code = 'DATABASE_UNAVAILABLE';
      throw err;
    }

    let client;
    try {
      client = await p.connect();
      isConnectedToPostgres = true;
    } catch (connErr) {
      isConnectedToPostgres = false;
      const err = new Error(
        `DATABASE_UNAVAILABLE: Failed to connect to PostgreSQL: ${connErr.message}. Safe failover prevented silent fallback to JSON storage.`
      );
      err.status = 503;
      err.code = 'DATABASE_UNAVAILABLE';
      throw err;
    }

    try {
      await client.query('BEGIN;');
      
      // 1. Authenticate cryptographic session context (RULE 3 & RULE 4)
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = crypto.randomBytes(16).toString('hex');
      const message = `${tenantId || ''}:${isSuperAdmin ? 'true' : 'false'}:${timestamp}:${nonce}`;
      const signature = crypto
        .createHmac('sha256', config.databaseSessionSecret)
        .update(message)
        .digest('hex');

      await client.query(
        "SELECT app_security.authenticate_context($1, $2, $3, $4, $5);",
        [tenantId || '', Boolean(isSuperAdmin), timestamp, nonce, signature]
      );

      // Legacy fallback setting in case any non-migrated views query custom GUCs
      await client.query(
        "SELECT set_config('app.current_tenant_id', $1, true), set_config('app.is_super_admin', $2, true);",
        [tenantId || '', isSuperAdmin ? 'true' : 'false']
      );

      // 2. Drop privileges to non-superuser civicsense_app_role (RULE 2)
      // Removes BYPASSRLS privileges from application operations
      await client.query('SET LOCAL ROLE civicsense_app_role;');

      const txClient = createPgTransactionalClient(client, tenantId, isSuperAdmin);
      const result = await callback(txClient);
      await client.query('COMMIT;');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackErr) {
        console.warn('[DB_ROLLBACK_WARN] Rollback failed:', rollbackErr.message);
      }
      throw err;
    } finally {
      // 3. Pool hygiene and connection state sanitization (RULE 5)
      try {
        await client.query("SELECT app_security.clear_context();");
        await client.query("RESET ALL; RESET ROLE;");
        client.release();
      } catch (cleanupErr) {
        console.warn('[DB_POOL_HYGIENE_WARN] Failed to reset connection state; evicting connection:', cleanupErr.message);
        try {
          client.release(cleanupErr);
        } catch {}
      }
    }
  }

  // SANDBOX MODE: Use storageEngine's persistent transactional executor
  const { storageEngine } = await import('./storageEngine.js');
  return storageEngine.executeTransaction(tenantId, isSuperAdmin, callback);
}

/**
 * Closes pool connections (for shutdown / testing).
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    isConnectedToPostgres = false;
  }
}

