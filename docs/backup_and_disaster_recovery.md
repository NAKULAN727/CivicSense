# CivicSense AI — Enterprise Database Backup, Disaster Recovery & Retention Architecture
**Phase 12 Enterprise Foundation**  
**Classification:** Municipal Enterprise Infrastructure Standard  
**Revision:** 12.0.0  
**Effective Date:** October 2026

---

## 1. Executive Summary & Objective

CivicSense AI operates as a mission-critical multi-tenant municipal perception and dispatch platform. This document establishes the formal procedures for database backup, point-in-time recovery (PITR), schema migration rollbacks, tenant data retention, and disaster recovery execution.

All backup and restoration workflows strictly preserve:
1. **Multi-Tenant Row-Level Security (RLS)** isolation boundaries.
2. **Cryptographic SHA-256 hash chain integrity** across audit logs.
3. **Deterministic incident and work order identification** (`INC-...`, `WO-...`).
4. **Zero credential leakage** across backups and export artifacts.

---

## 2. Backup Strategy & Architecture

CivicSense AI leverages a tiered enterprise backup architecture combining physical write-ahead log (WAL) archiving and logical snapshot dumps.

### 2.1 Backup Cadence & Retention Schedule

| Backup Tier | Cadence | Retention Window | Storage Medium | Encryption Standard |
| :--- | :--- | :--- | :--- | :--- |
| **Continuous WAL Archiving** | Real-time (< 16MB segments) | 14 Days | S3/GCS Coldline (WORM enabled) | AES-256-GCM / KMS Customer Key |
| **Daily Full Logical Snapshot** | Every 24 hours (01:00 UTC) | 30 Days | Geo-Redundant Object Storage | KMS Enforced Encryption |
| **Weekly Master Snapshot** | Every Sunday (02:00 UTC) | 90 Days | Offsite Air-Gapped Cold Vault | Customer Managed Key (CMK) |
| **Annual Audit Archive** | Annual (Dec 31 23:59 UTC) | 7 Years (Compliance) | Immutable WORM Bucket | Hardware Security Module (HSM) |

### 2.2 Full Database Backup Execution (`pg_dump`)

Full backups utilize PostgreSQL's custom binary archive format (`-Fc`) with parallel compression:

```bash
# Set secure environment variables (Never hardcode credentials)
export PGHOST="${DB_HOST:-localhost}"
export PGPORT="${DB_PORT:-5432}"
export PGDATABASE="${DB_NAME:-civicsense_db}"
export PGUSER="${DB_USER:-civicsense_admin}"
export BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
export BACKUP_DIR="/var/backups/civicsense"

# Execute custom-format compressed backup with object ownership preservation
pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  -Fc \
  -Z 9 \
  -f "${BACKUP_DIR}/civicsense_full_${BACKUP_TIMESTAMP}.dump"

# Generate SHA-256 checksum for backup integrity verification
sha256sum "${BACKUP_DIR}/civicsense_full_${BACKUP_TIMESTAMP}.dump" > "${BACKUP_DIR}/civicsense_full_${BACKUP_TIMESTAMP}.dump.sha256"

# Verify dump archive structure
pg_restore -l "${BACKUP_DIR}/civicsense_full_${BACKUP_TIMESTAMP}.dump" > /dev/null
echo "Full backup completed and validated successfully: ${BACKUP_TIMESTAMP}"
```

---

## 3. Point-In-Time Recovery (PITR) Strategy

Point-in-time recovery enables the database to be restored to any specified millisecond prior to a data corruption incident, software regression, or operator error.

### 3.1 Recovery Objectives

- **Recovery Point Objective (RPO):** $\le 5\text{ minutes}$ (maximum allowable data loss window).
- **Recovery Time Objective (RTO):** $\le 30\text{ minutes}$ (maximum allowable recovery duration).

### 3.2 WAL Archiving Configuration (`postgresql.conf`)

In production environments, PostgreSQL write-ahead logs are continuously shipped to immutable object storage:

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f'
archive_timeout = 300 # Forces archive rotation every 5 minutes if idle
```

### 3.3 PITR Restoration Procedure

To restore the cluster to a specific point in time (e.g., prior to a known corruption event at `2026-10-07 14:32:00 UTC`):

1. **Halt application backend instances:**
   ```bash
   systemctl stop civicsense-backend
   ```

2. **Initialize fresh database cluster or stop target instance:**
   ```bash
   systemctl stop postgresql
   mv /var/lib/postgresql/data /var/lib/postgresql/data_corrupt_backup
   ```

3. **Restore baseline logical snapshot or file-level backup:**
   ```bash
   pg_basebackup -h backup-host -D /var/lib/postgresql/data -U replicator -v -P
   ```

4. **Configure recovery signal and recovery target:**
   Create `/var/lib/postgresql/data/recovery.signal`:
   ```bash
   touch /var/lib/postgresql/data/recovery.signal
   ```

   Append recovery parameters to `/var/lib/postgresql/data/postgresql.conf`:
   ```ini
   restore_command = 'cp /mnt/wal_archive/%f %p'
   recovery_target_time = '2026-10-07 14:32:00 UTC'
   recovery_target_action = 'promote'
   ```

5. **Start PostgreSQL to trigger WAL replay:**
   ```bash
   systemctl start postgresql
   ```

6. **Validate recovery state:**
   ```sql
   SELECT pg_is_in_recovery(); -- Returns false once recovery target is reached and promoted
   SELECT MAX(created_at) FROM incidents;
   ```

---

## 4. Migration Execution & Rollback Procedures

CivicSense AI maintains versioned migrations in `server/db/migrations/`:
- `001_initial_enterprise_schema.sql` (Tables, Foreign Keys, Indexes)
- `002_enable_rls.sql` (Row-Level Security Policies)
- `003_rollback_rls.sql` (Teardown RLS)
- `004_rollback_schema.sql` (Teardown Schema)

### 4.1 Automated Migration Runner

Execute forward migrations:
```bash
node server/db/migrationRunner.js up
```

Execute rollback:
```bash
node server/db/migrationRunner.js down
```

### 4.2 Manual Migration Rollback Procedure

If automated rollback is interrupted, execute discrete rollback scripts inside a transaction:

```bash
# 1. Disable Row-Level Security Policies
psql -U civicsense_admin -d civicsense_db -f server/db/migrations/003_rollback_rls.sql

# 2. Revert Schema Objects
psql -U civicsense_admin -d civicsense_db -f server/db/migrations/004_rollback_schema.sql
```

Verification after rollback:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Expected: Empty or baseline tables only
```

---

## 5. Enterprise Data Retention Policies

To comply with municipal statutory obligations, privacy laws (DPDP / GDPR), and performance requirements, the following retention schedules are strictly enforced:

| Data Entity | Retention Duration | Purge Strategy | Justification |
| :--- | :--- | :--- | :--- |
| **Tenants & Municipalities** | Indefinite / Active Contract | Soft Delete (`is_active = FALSE`) | Contractual identity integrity |
| **User Identities & Credentials** | Duration of employment + 90 days | Soft Delete (`is_active = FALSE`) | Access audit trail traceability |
| **Incidents & Evidence** | 5 Years | Partitioned table archival | Infrastructure defect legal warranty |
| **Work Orders & Lifecycle Logs** | 7 Years | Cold storage export | Municipal financial audit compliance |
| **Ward Boundaries** | Indefinite (Versioned) | Status marked `SUPERSEDED` | Historical geospatial reporting |
| **Operational Telemetry** | 90 Days | Rolling automated purge (`DELETE WHERE created_at < NOW() - INTERVAL '90 days'`) | Performance monitoring & latency SLA |
| **Security Audit Logs** | 365 Days minimum | Immutable WORM cold storage | Non-repudiation and forensic audit |

---

## 6. Tenant-Scoped Data Export Protocol

Enterprise tenants have the right to export all tenant-owned records without exposing another municipality's records.

### 6.1 Programmatic API Export

Administrators holding the `DATA_EXPORT` permission (`TENANT_ADMIN` or `SUPER_ADMIN`) can export all tenant records via:

```http
GET /api/admin/export HTTP/1.1
Host: civicsense.internal:5000
Authorization: Bearer <ADMIN_BEARER_TOKEN>
```

**Export Response Schema (`civicsense_tenant_<tenant_id>_export.json`):**
```json
{
  "exportMetadata": {
    "tenantId": "TENANT-DEMO-A",
    "tenantName": "Sandbox Municipality Alpha",
    "exportedAt": "2026-10-07T14:35:00.000Z",
    "schemaVersion": "12.0.0",
    "exportedBy": "ADM-DEMO-A-01",
    "securityClassification": "RESTRICTED_TENANT_CONFIDENTIAL"
  },
  "incidents": [ ... ],
  "workOrders": [ ... ],
  "wardDatasets": [ ... ],
  "telemetry": [ ... ],
  "auditSummary": {
    "totalAuditEvents": 142,
    "chainIntegrityVerified": true,
    "lastHash": "8f4c2e...b9a1"
  }
}
```

### 6.2 Database-Level Tenant Export (`COPY`)

To export tenant records directly from PostgreSQL with tenant context enforced:

```sql
-- Begin tenant-isolated transaction
BEGIN;
SET LOCAL app.current_tenant_id = 'TENANT-DEMO-A';

\copy (SELECT * FROM incidents WHERE tenant_id = current_setting('app.current_tenant_id')) TO '/tmp/tenant_a_incidents.csv' WITH CSV HEADER;
\copy (SELECT * FROM work_orders WHERE tenant_id = current_setting('app.current_tenant_id')) TO '/tmp/tenant_a_work_orders.csv' WITH CSV HEADER;
\copy (SELECT * FROM audit_logs WHERE tenant_id = current_setting('app.current_tenant_id')) TO '/tmp/tenant_a_audit_logs.csv' WITH CSV HEADER;

COMMIT;
```

---

## 7. Disaster Recovery Runbook

### 7.1 Severity Classifications

| Severity | Definition | Target RTO | Target RPO | Escalation Path |
| :--- | :--- | :--- | :--- | :--- |
| **P1 — Critical** | Primary DB unavailable, cluster failure, data corruption | < 30 min | < 5 min | Lead Architect, Platform Security Officer |
| **P2 — Major** | Degraded connection pool, elevated latency, replica desync | < 2 hours | < 15 min | Database Administrator, Backend Team |
| **P3 — Minor** | Schema migration failure, non-critical query failure | < 6 hours | Zero loss | Systems Engineer |

### 7.2 Emergency Failover & Restoration Runbook (P1)

```
[ALERT DETECTED] Database Cluster Host Dead / Data Storage Corrupted
  │
  ├── 1. ISOLATE: Stop all application backends to prevent split-brain writes
  │      systemctl stop civicsense-backend
  │
  ├── 2. ASSESS: Identify latest valid snapshot and WAL segment
  │      aws s3 ls s3://civicsense-db-backups/full/ --human-readable
  │
  ├── 3. PROVISION: Spin up recovery standby node or switch to hot replica
  │      pg_ctl promote -D /var/lib/postgresql/standby_data
  │
  ├── 4. RESTORE: If rebuilding from snapshot:
  │      pg_restore -h localhost -p 5432 -U civicsense_admin -d civicsense_db -v -c <latest_dump>
  │
  ├── 5. RE-APPLY RLS: Validate RLS policies are enabled on all tables
  │      SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
  │      (Verify rowsecurity = TRUE for all tenant tables)
  │
  ├── 6. AUDIT CHAIN VERIFICATION: Verify cryptographic tamper evidence
  │      node -e "import('./server/services/auditService.js').then(m => console.log(m.verifyAuditChain('TENANT-DEMO-A')))"
  │
  ├── 7. SMOKE TEST: Execute test suite
  │      node scratch/test_phase12_enterprise_suite.js
  │
  └── 8. RESUME TRAFFIC: Restart application services
         systemctl start civicsense-backend
```

---

## 8. Verification & Sign-Off Checklist

- [x] Full backup mechanism tested with `pg_dump -Fc`.
- [x] Multi-tenant isolation verified with RLS active on all tenant tables.
- [x] Zero plain text secrets in backups or export files.
- [x] Migration forward (`001`, `002`) and rollback (`003`, `004`) verified idempotent.
- [x] Tamper-evident SHA-256 audit log hash verification function implemented.
- [x] Tenant data export conforms to strict tenant isolation boundary.

