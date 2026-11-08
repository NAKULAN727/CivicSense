// CivicSense AI - Phase 12 Persistent Storage Engine & RLS Transaction Manager
// Relational persistence with atomic transactions, rollback support, and Row-Level Security (RLS).
// Survives server restarts by persisting to disk at server/data/persistent_db.json.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve('server', 'data');
const DB_FILE = path.join(DATA_DIR, 'persistent_db.json');
const BAK_FILE = path.join(DATA_DIR, 'persistent_db.json.bak');

// Initial seed data for tenants and users
const INITIAL_TENANTS = [
  {
    tenant_id: 'TENANT-DEMO-A',
    tenant_name: 'Sandbox Municipality Alpha',
    label: 'SANDBOX TENANT',
    status: 'ACTIVE',
    is_sandbox: true,
    configuration: {
      jurisdiction: 'Alpha Municipal District',
      timezone: 'Asia/Kolkata',
      dispatchAutoApproval: false,
      allowedDepartments: [
        'Highways / Roads & Pavement Maintenance',
        'Solid Waste Management',
        'Stormwater / Drainage Department'
      ]
    },
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    tenant_id: 'TENANT-DEMO-B',
    tenant_name: 'Sandbox Municipality Beta',
    label: 'SANDBOX TENANT',
    status: 'ACTIVE',
    is_sandbox: true,
    configuration: {
      jurisdiction: 'Beta Zonal Area',
      timezone: 'Asia/Kolkata',
      dispatchAutoApproval: false,
      allowedDepartments: [
        'Highways / Roads & Pavement Maintenance',
        'Solid Waste Management',
        'Stormwater / Drainage Department'
      ]
    },
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  }
];

const INITIAL_USERS = [
  // Tenant A Users
  {
    user_id: 'OP-DEMO-A-01',
    tenant_id: 'TENANT-DEMO-A',
    email: 'operator.alpha@civicsense.gov',
    display_name: 'R. Kumar (Field Technician)',
    role: 'OPERATOR',
    department: 'Zone 1 Engineering & Works',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    user_id: 'SUP-DEMO-A-01',
    tenant_id: 'TENANT-DEMO-A',
    email: 'supervisor.alpha@civicsense.gov',
    display_name: 'S. Meenakshi (Zonal Dispatch Supervisor)',
    role: 'SUPERVISOR',
    department: 'Alpha Command Center',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    user_id: 'ADM-DEMO-A-01',
    tenant_id: 'TENANT-DEMO-A',
    email: 'admin.alpha@civicsense.gov',
    display_name: 'Dr. A. Ramanathan (Spatial & Systems Administrator)',
    role: 'TENANT_ADMIN',
    department: 'Alpha Municipal IT & Operations',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    user_id: 'AUD-DEMO-A-01',
    tenant_id: 'TENANT-DEMO-A',
    email: 'auditor.alpha@civicsense.gov',
    display_name: 'M. Shanthi (Municipal Compliance Auditor)',
    role: 'AUDITOR',
    department: 'Municipal Oversight & Transparency',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    user_id: 'RO-DEMO-A-01',
    tenant_id: 'TENANT-DEMO-A',
    email: 'observer.alpha@civicsense.gov',
    display_name: 'K. Priya (Civic Observer)',
    role: 'READ_ONLY',
    department: 'Public Information Desk',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  // Super Admin (Cross-Tenant Systems Administrator)
  {
    user_id: 'SUPER-ADMIN-01',
    tenant_id: 'TENANT-DEMO-A',
    email: 'superadmin@civicsense.gov',
    display_name: 'Central Platform Architect (Super Admin)',
    role: 'SUPER_ADMIN',
    department: 'State Smart City Mission Directorate',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  // Tenant B Users
  {
    user_id: 'OP-DEMO-B-01',
    tenant_id: 'TENANT-DEMO-B',
    email: 'operator.beta@civicsense.gov',
    display_name: 'V. Anand (Field Technician)',
    role: 'OPERATOR',
    department: 'Zone 2 Maintenance Division',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    user_id: 'SUP-DEMO-B-01',
    tenant_id: 'TENANT-DEMO-B',
    email: 'supervisor.beta@civicsense.gov',
    display_name: 'P. Lakshmi (Zonal Dispatch Supervisor)',
    role: 'SUPERVISOR',
    department: 'Beta Command Center',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  },
  {
    user_id: 'ADM-DEMO-B-01',
    tenant_id: 'TENANT-DEMO-B',
    email: 'admin.beta@civicsense.gov',
    display_name: 'K. Suresh (Spatial & Systems Administrator)',
    role: 'TENANT_ADMIN',
    department: 'Beta Municipal IT & Operations',
    is_sandbox_user: true,
    created_at: '2026-10-07T00:00:00.000Z',
    updated_at: '2026-10-07T00:00:00.000Z'
  }
];

class StorageEngine {
  constructor(customDataDir = null) {
    this.dataDir = customDataDir ? path.resolve(customDataDir) : DATA_DIR;
    this.dbFile = path.join(this.dataDir, 'persistent_db.json');
    this.bakFile = path.join(this.dataDir, 'persistent_db.json.bak');
    this.lockFile = path.join(this.dataDir, 'persistent_db.json.lock');
    this.isQuarantined = false;

    this.state = {
      tenants: [],
      users: [],
      incidents: [],
      work_orders: [],
      ward_datasets: [],
      ward_features: [],
      audit_logs: [],
      telemetry_records: [],
      integration_settings: []
    };
    this.isInitialized = false;
    this.ensureInitialized();
  }

  acquireLock(timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const fd = fs.openSync(this.lockFile, 'wx');
        fs.writeFileSync(fd, `${process.pid}:${Date.now()}`, 'utf8');
        fs.closeSync(fd);
        return true;
      } catch (err) {
        if (err.code === 'EEXIST') {
          // Check for stale lock (older than 30 seconds)
          try {
            const stats = fs.statSync(this.lockFile);
            if (Date.now() - stats.mtimeMs > 30000) {
              fs.unlinkSync(this.lockFile);
              continue;
            }
          } catch {}
          // Wait briefly before retry
          const waitEnd = Date.now() + 50;
          while (Date.now() < waitEnd) {}
        } else {
          return false;
        }
      }
    }
    return false;
  }

  releaseLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch {}
  }

  ensureInitialized() {
    if (this.isInitialized) return;

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.state = {
          tenants: parsed.tenants || [...INITIAL_TENANTS],
          users: parsed.users || [...INITIAL_USERS],
          incidents: parsed.incidents || [],
          work_orders: parsed.work_orders || [],
          ward_datasets: parsed.ward_datasets || [],
          ward_features: parsed.ward_features || [],
          audit_logs: parsed.audit_logs || [],
          telemetry_records: parsed.telemetry_records || [],
          integration_settings: parsed.integration_settings || []
        };
        this.isInitialized = true;
        return;
      } catch (e) {
        // CORRUPTION RECOVERY PROTOCOL (Phase 12R-4):
        // 1. Quarantine corrupted file immediately so historical raw bytes are preserved
        const quarantineFile = `${this.dbFile}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(this.dbFile, quarantineFile);
          console.error(`[STORAGE_ENGINE_ALERT] Corrupted database quarantined to: ${quarantineFile}`);
        } catch (copyErr) {
          console.error('[STORAGE_ENGINE_ALERT] Failed to quarantine corrupt file:', copyErr.message);
        }

        // 2. Attempt recovery from recent .bak file if available
        if (fs.existsSync(this.bakFile)) {
          try {
            const bakRaw = fs.readFileSync(this.bakFile, 'utf8');
            const bakParsed = JSON.parse(bakRaw);
            this.state = {
              tenants: bakParsed.tenants || [...INITIAL_TENANTS],
              users: bakParsed.users || [...INITIAL_USERS],
              incidents: bakParsed.incidents || [],
              work_orders: bakParsed.work_orders || [],
              ward_datasets: bakParsed.ward_datasets || [],
              ward_features: bakParsed.ward_features || [],
              audit_logs: bakParsed.audit_logs || [],
              telemetry_records: bakParsed.telemetry_records || [],
              integration_settings: bakParsed.integration_settings || []
            };
            this.isInitialized = true;
            console.log('[STORAGE_ENGINE_RECOVERY] Successfully recovered database state from backup file (.bak).');
            return;
          } catch (bakErr) {
            console.error('[STORAGE_ENGINE_RECOVERY_FAILED] Backup file (.bak) also corrupt:', bakErr.message);
          }
        }

        // 3. Catastrophic reset prevention: If NO valid backup exists, DO NOT OVERWRITE the corrupt file on disk!
        console.warn('[STORAGE_ENGINE_HALT] No valid backup found. Retaining quarantined file intact on disk. Operating in memory-only safe state.');
        this.isQuarantined = true;
        this.state.tenants = [...INITIAL_TENANTS];
        this.state.users = [...INITIAL_USERS];
        this.isInitialized = true;
        return;
      }
    }

    // Initialize with fresh seed data only when no DB_FILE previously existed
    this.state.tenants = [...INITIAL_TENANTS];
    this.state.users = [...INITIAL_USERS];
    this.persistToDisk();
    this.isInitialized = true;
  }

  persistToDisk() {
    if (this.isQuarantined) {
      console.warn('[STORAGE_ENGINE_REFUSAL] Refusing to persist to disk while in quarantined state to prevent overwriting corrupted file.');
      return;
    }

    const locked = this.acquireLock();
    try {
      const tmpFile = `${this.dbFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf8');

      // Maintain rolling backup before replacement
      if (fs.existsSync(this.dbFile)) {
        try {
          fs.copyFileSync(this.dbFile, this.bakFile);
        } catch {}
      }

      fs.renameSync(tmpFile, this.dbFile);
    } catch (e) {
      console.error('[STORAGE_ENGINE_CRITICAL] Failed to persist database to disk:', e.message);
    } finally {
      if (locked) {
        this.releaseLock();
      }
    }
  }

  cloneState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Executes an atomic database transaction with RLS context.
   * If an exception occurs, rolls back changes completely.
   */
  async executeTransaction(tenantId, isSuperAdmin = false, callback) {
    this.ensureInitialized();
    const backupState = this.cloneState();

    const context = {
      tenantId: tenantId || null,
      isSuperAdmin: Boolean(isSuperAdmin)
    };

    const transactionalClient = {
      // Query helper
      query: async (tableName, filterFn) => {
        return this.queryTable(tableName, filterFn, context);
      },
      // Insert helper
      insert: async (tableName, record) => {
        return this.insertRecord(tableName, record, context);
      },
      // Update helper
      update: async (tableName, idField, idValue, updates) => {
        return this.updateRecord(tableName, idField, idValue, updates, context);
      },
      // Delete helper
      delete: async (tableName, idField, idValue) => {
        return this.deleteRecord(tableName, idField, idValue, context);
      }
    };

    try {
      const result = await callback(transactionalClient);
      this.persistToDisk();
      return result;
    } catch (err) {
      // ROLLBACK: Restore previous state
      this.state = backupState;
      throw err;
    }
  }

  /**
   * Enforces Row-Level Security on select queries.
   */
  queryTable(tableName, filterFn, context) {
    const table = this.state[tableName];
    if (!Array.isArray(table)) {
      throw new Error(`DATABASE_ERROR: Table '${tableName}' does not exist.`);
    }

    return table.filter((row) => {
      // RLS Check: If table has tenant_id, apply row-level security
      if (row.tenant_id && !context.isSuperAdmin) {
        if (!context.tenantId || row.tenant_id !== context.tenantId) {
          return false; // Filtered out by database RLS
        }
      }
      return filterFn ? filterFn(row) : true;
    });
  }

  /**
   * Enforces Row-Level Security on inserts.
   */
  insertRecord(tableName, record, context) {
    const table = this.state[tableName];
    if (!Array.isArray(table)) {
      throw new Error(`DATABASE_ERROR: Table '${tableName}' does not exist.`);
    }

    // RLS Enforcement: Record's tenant_id must match transaction tenant context
    if (record.tenant_id && !context.isSuperAdmin) {
      if (record.tenant_id !== context.tenantId) {
        const err = new Error(
          `RLS_VIOLATION: Cannot insert record with tenant_id '${record.tenant_id}' in tenant context '${context.tenantId}'.`
        );
        err.code = '42501'; // PostgreSQL insufficient_privilege code
        err.status = 403;
        throw err;
      }
    }

    // Special handling for audit log hash chaining
    if (tableName === 'audit_logs') {
      const tenantLogs = table.filter(l => l.tenant_id === record.tenant_id);
      const previousHash = tenantLogs.length > 0 
        ? tenantLogs[tenantLogs.length - 1].current_hash 
        : 'GENESIS_HASH_CHAIN_ROOT_0000000000000000000000000000000000000000';

      const hashPayload = `${previousHash}|${record.event_id}|${record.timestamp}|${record.actor_id}|${record.event_type}|${JSON.stringify(record.details || {})}`;
      const currentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      record.previous_hash = previousHash;
      record.current_hash = currentHash;

      // Phase 12R-5: Cryptographic HMAC checkpoint using out-of-band signing key
      const signingKey = process.env.AUDIT_SIGNING_KEY || 'CIVICSENSE_DEFAULT_ENTERPRISE_AUDIT_SIGNING_KEY_2026';
      const hmacSignature = crypto
        .createHmac('sha256', signingKey)
        .update(`${currentHash}|${previousHash}|${record.event_id}|${record.tenant_id}`)
        .digest('hex');
      record.hmac_signature = hmacSignature;
    }

    table.push(record);
    return record;
  }

  /**
   * Enforces Row-Level Security on updates.
   */
  updateRecord(tableName, idField, idValue, updates, context) {
    const table = this.state[tableName];
    if (!Array.isArray(table)) {
      throw new Error(`DATABASE_ERROR: Table '${tableName}' does not exist.`);
    }

    const row = table.find(r => r[idField] === idValue);
    if (!row) {
      return null;
    }

    // RLS Check: Must belong to tenant context
    if (row.tenant_id && !context.isSuperAdmin) {
      if (row.tenant_id !== context.tenantId) {
        const err = new Error(
          `RLS_VIOLATION: Cannot update record owned by '${row.tenant_id}' from tenant context '${context.tenantId}'.`
        );
        err.code = '42501';
        err.status = 403;
        throw err;
      }
    }

    Object.assign(row, updates, { updated_at: new Date().toISOString() });
    return row;
  }

  /**
   * Enforces Row-Level Security on deletes.
   */
  deleteRecord(tableName, idField, idValue, context) {
    const table = this.state[tableName];
    if (!Array.isArray(table)) {
      throw new Error(`DATABASE_ERROR: Table '${tableName}' does not exist.`);
    }

    const idx = table.findIndex(r => r[idField] === idValue);
    if (idx === -1) return false;

    const row = table[idx];
    if (row.tenant_id && !context.isSuperAdmin) {
      if (row.tenant_id !== context.tenantId) {
        const err = new Error(
          `RLS_VIOLATION: Cannot delete record owned by '${row.tenant_id}' from tenant context '${context.tenantId}'.`
        );
        err.code = '42501';
        err.status = 403;
        throw err;
      }
    }

    table.splice(idx, 1);
    return true;
  }

  /**
   * Verifies tamper-evident audit log hash chain for a tenant.
   */
  verifyAuditChain(tenantId) {
    const logs = this.state.audit_logs
      .filter(l => l.tenant_id === tenantId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (logs.length === 0) {
      return { isValid: true, recordCount: 0, message: 'No audit records present for tenant.' };
    }

    let expectedPrevHash = 'GENESIS_HASH_CHAIN_ROOT_0000000000000000000000000000000000000000';

    for (let i = 0; i < logs.length; i++) {
      const record = logs[i];

      if (record.previous_hash !== expectedPrevHash) {
        return {
          isValid: false,
          recordCount: logs.length,
          brokenAtRecordId: record.event_id,
          reason: `Hash chain broken at index ${i}: stored previous_hash '${record.previous_hash}' does not match expected '${expectedPrevHash}'.`
        };
      }

      const hashPayload = `${expectedPrevHash}|${record.event_id}|${record.timestamp}|${record.actor_id}|${record.event_type}|${JSON.stringify(record.details || {})}`;
      const recomputedHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      if (recomputedHash !== record.current_hash) {
        return {
          isValid: false,
          recordCount: logs.length,
          brokenAtRecordId: record.event_id,
          reason: `Tamper detected at record ${record.event_id}: hash '${record.current_hash}' does not match recomputed '${recomputedHash}'.`
        };
      }

      // Phase 12R-5: Verify HMAC checkpoint signature if present
      if (record.hmac_signature) {
        const signingKey = process.env.AUDIT_SIGNING_KEY || 'CIVICSENSE_DEFAULT_ENTERPRISE_AUDIT_SIGNING_KEY_2026';
        const expectedHmac = crypto
          .createHmac('sha256', signingKey)
          .update(`${record.current_hash}|${record.previous_hash}|${record.event_id}|${record.tenant_id}`)
          .digest('hex');

        if (expectedHmac !== record.hmac_signature) {
          return {
            isValid: false,
            recordCount: logs.length,
            brokenAtRecordId: record.event_id,
            reason: `HMAC checkpoint violation at record ${record.event_id}: signature does not match audit signing key. Potential hash chain recomputation detected.`
          };
        }
      }

      expectedPrevHash = record.current_hash;
    }

    return {
      isValid: true,
      recordCount: logs.length,
      latestHash: expectedPrevHash,
      message: 'Tamper-evident audit chain fully verified. Zero discrepancies found.'
    };
  }

  /**
   * Exports tenant data cleanly according to tenant-specific export controls (Section 7).
   */
  exportTenantData(tenantId) {
    return {
      tenantId,
      exportTimestamp: new Date().toISOString(),
      incidents: this.state.incidents.filter(i => i.tenant_id === tenantId),
      workOrders: this.state.work_orders.filter(w => w.tenant_id === tenantId),
      wardDatasets: this.state.ward_datasets.filter(d => d.tenant_id === tenantId),
      auditLogs: this.state.audit_logs.filter(a => a.tenant_id === tenantId),
      telemetry: this.state.telemetry_records.filter(t => t.tenant_id === tenantId)
    };
  }

  /**
   * Resets all tables to clean state (for test automation only).
   */
  resetForTesting() {
    this.state = {
      tenants: [...INITIAL_TENANTS],
      users: [...INITIAL_USERS],
      incidents: [],
      work_orders: [],
      ward_datasets: [],
      ward_features: [],
      audit_logs: [],
      telemetry_records: [],
      integration_settings: []
    };
    this.persistToDisk();
  }
}

export { StorageEngine };
export const storageEngine = new StorageEngine();

