# CivicSense AI — Phase 12 Independent Technical Verification Audit
## Read-Only Inspection of Storage, Identity Federation, ERP Integration & Resilience

**Audit Authority:** Antigravity Autonomous Systems & Platform Architecture Team  
**Audit Type:** Independent, Read-Only, Non-Destructive Technical Audit  
**Date:** October 2026 (Audit Timestamp: 2026-11-08T22:55:00+05:30)  
**Final Verdict:** **`ENTERPRISE SANDBOX VERIFIED`**  
*(Architecture implemented and verified in sandbox; Production deployment blocked pending live infrastructure configuration)*

---

## 1. Executive Summary

This independent technical audit was conducted to verify whether Phase 12 enterprise capabilities in CivicSense AI are **genuinely operational in production runtime** or **architecturally implemented within sandbox boundaries**.

### 1.1 Key Audit Findings
1. **PostgreSQL vs JSON Storage:**
   - **PostgreSQL is dormant.** While PostgreSQL connection pooling (`server/db/connection.js`), migration runner (`server/db/migrationRunner.js`), and SQL DDL schemas (`server/db/migrations/*.sql`) are fully implemented, `DATABASE_URL` is unconfigured (`null`).
   - The application services (`incidentService`, `workOrderService`, `auditService`, `wardService`, `telemetryService`) **do not execute SQL queries**. They directly invoke `storageEngine.js`, which reads and writes an in-memory database serialized to `server/data/persistent_db.json`.
   - **Classification:** **`JSON_ONLY`** in active runtime; **`POSTGRESQL_CONFIGURED_NOT_CONNECTED`** in code structure.
2. **PostgreSQL Row-Level Security (RLS):**
   - PostgreSQL RLS policies are **fully specified** in `002_enable_rls.sql` with `FORCE ROW LEVEL SECURITY` and `USING` / `WITH CHECK` clauses across all 7 tenant tables.
   - However, because no live PostgreSQL cluster is connected, these migrations have **not been executed against a real database instance**. RLS is currently enforced via JavaScript emulation in `storageEngine.js`.
   - **Status:** `RLS SQL IMPLEMENTED`, `RLS MIGRATIONS UNEXECUTED`, `RLS RUNTIME VERIFIED (POSTGRESQL) = BLOCKED`.
3. **OpenID Connect (OIDC) Identity Federation:**
   - Authorization Code Flow with PKCE (S256), state/nonce verification, claim mapping, and token lifecycle methods are fully implemented in `server/auth/oidcService.js`.
   - However, no external OIDC provider (Keycloak, Entra ID, Auth0) is configured. The runtime operates under `AUTH_MODE = SANDBOX`, and the health API correctly reports `OIDC: NOT CONFIGURED`.
   - **Classification:** **`OIDC_CODE_PRESENT_NOT_CONFIGURED`** (Level 2).
4. **Municipal ERP Integration:**
   - Provider-neutral adapter with HMAC-SHA256 request signing, exponential backoff with jitter, and circuit breaker pattern is fully implemented and sandbox-tested.
   - Real ERP endpoint is **DISABLED** and unconfigured (`ERP_STATUS.DISABLED`, `ERP_BASE_URL=null`).
   - **Classification:** **`ADAPTER IMPLEMENTED`**, **`SANDBOX TESTED`**, `REAL ERP CONNECTION = NOT CONFIGURED`.
5. **Backup & Disaster Recovery:**
   - Comprehensive procedures are documented in `docs/backup_and_disaster_recovery.md`.
   - However, no automated backup scripts, cron jobs, or snapshot pipelines exist on the filesystem. No actual restore test has been executed against a live database.
   - **Status:** **`RESTORE TEST = NOT VERIFIED`**.
6. **Disk Persistence & Data Loss Risks:**
   - `server/data/persistent_db.json` provides single-process disk persistence.
   - **Critical Vulnerability Identified:** If `persistent_db.json` experiences single-byte corruption or invalid JSON formatting, `storageEngine.js` catches the error and **resets the database to seed data**, wiping all operational records. Furthermore, it lacks file locking, making it unsafe for clustered multi-process deployments.
7. **Audit Log Integrity:**
   - SHA-256 forward hash chaining is operational and verified across existing records (7 records in Tenant A).
   - **Security Finding:** Because hashes are unkeyed SHA-256 without digital signatures or external WORM anchoring, an attacker with write access to `persistent_db.json` can retroactively alter a record and recompute all subsequent hashes undetected.
8. **Test Suites & Regression Baseline:**
   - `test_phase12_enterprise_suite.js`: **22 / 22 Passed (100%)**
   - `test_phase11_security_suite.js`: **20 / 20 Passed (100%)**
   - `test_phase11_94_regression.py`: **9 / 9 Metrics Exact Match (0 Regressions)**
   - `npm run build`: **Clean Vite 8.2.0 build (Exit Code 0)**
   - Secrets Audit: **0 committed secrets, 0 `Math.random()` calls**

---

## 2. Files Inspected

| File Path | Lines | Role / Architectural Purpose | Observation |
| :--- | :---: | :--- | :--- |
| `server/db/connection.js` | 133 | PostgreSQL `pg.Pool` manager & RLS context wrapper | Code implemented; dormant when `DATABASE_URL` is null |
| `server/db/storageEngine.js` | 469 | JSON-backed atomic storage & RLS emulation engine | **Active production storage backend**; writes to JSON |
| `server/db/migrationRunner.js` | 120 | Reversible database migration runner | Implemented; unexecuted against real PostgreSQL |
| `server/db/migrations/001_initial_enterprise_schema.sql` | 154 | Relational DDL for 7 normalized tables | Well-formed PostgreSQL DDL; unexecuted |
| `server/db/migrations/002_enable_rls.sql` | 130 | RLS policies with `FORCE ROW LEVEL SECURITY` | Well-formed PostgreSQL RLS; unexecuted |
| `server/db/migrations/003_rollback_rls.sql` | 45 | Teardown script for RLS policies | Reversible rollback DDL |
| `server/db/migrations/004_rollback_schema.sql` | 35 | Teardown script for relational tables | Reversible rollback DDL |
| `server/config/environment.js` | 64 | Environment variable loader | Reads `DATABASE_URL` (null), `OIDC_*` (null), `ERP_*` (null) |
| `.env.example` | 45 | Safe environment template | Placeholders only; no committed secrets |
| `server/services/incidentService.js` | 220 | Incident CRUD service | Directly imports and uses `storageEngine.js` (No SQL) |
| `server/services/workOrderService.js` | 299 | Work order dispatch and idempotency service | Directly imports and uses `storageEngine.js` (No SQL) |
| `server/services/auditService.js` | 95 | Audit log service with hash chain verification | Directly imports and uses `storageEngine.js` (No SQL) |
| `server/services/wardService.js` | 273 | GeoJSON ingestion & ray-casting routing | Directly imports and uses `storageEngine.js` (No SQL) |
| `server/services/telemetryService.js` | 65 | Anonymized operational latency logger | Directly imports and uses `storageEngine.js` (No SQL) |
| `server/auth/oidcService.js` | 290 | OIDC PKCE S256 & ID token validation | Fully coded; unconfigured in runtime |
| `server/auth/rbacService.js` | 104 | 6-tier RBAC & privilege escalation prevention | Active and enforced across all routes |
| `server/adapters/enterpriseErpAdapter.js` | 280 | Enterprise ERP proxy with HMAC & circuit breaker | Fully coded; `status: DISABLED` by default |
| `server/data/persistent_db.json` | 450 | Local disk persistence store (14,879 bytes) | Holds live operational records for sandbox |
| `docs/backup_and_disaster_recovery.md` | 258 | Disaster recovery, PITR, & export runbook | Procedural documentation; no automated scripts |
| `src/components/MunicipalOperationsPanel.jsx` | 816 | Operations UI & Enterprise Admin Panel | Accurately presents sandbox status badges |

---

## 3. PostgreSQL Runtime Evidence

### 3.1 Runtime Probe Results
Executing `checkDatabaseHealth()` from `server/db/connection.js`:
```json
{
  "isConnected": false,
  "status": "NOT_CONFIGURED",
  "engine": "LOCAL_PERSISTENT_ENGINE",
  "notice": "PostgreSQL DATABASE_URL not set; local file-backed persistent transaction store active."
}
```

Direct network socket probe to `127.0.0.1:5432`:
```
psql: error: connection to server at "127.0.0.1", port 5432 failed: Permission denied (0x0000271D/10013)
```

### 3.2 Answers to Mandated Questions

- **A. Does the application actually connect to PostgreSQL?**  
  **NO.** `DATABASE_URL` is not set in environment or configuration. No TCP connection is opened.
- **B. Is `pg.Pool` instantiated and used by production services?**  
  **NO.** `pg.Pool` is conditionally constructed only when `DATABASE_URL` exists. Production services do not import `connection.js`.
- **C. Do incident CRUD operations execute SQL queries?**  
  **NO.** `incidentService.js` performs array operations on `storageEngine.state.incidents`.
- **D. Do work-order operations execute SQL queries?**  
  **NO.** `workOrderService.js` performs array operations on `storageEngine.state.work_orders`.
- **E. Are audit events stored in PostgreSQL?**  
  **NO.** `auditService.js` pushes records to `storageEngine.state.audit_logs`.
- **F. Is `persistent_db.json` the actual active storage backend?**  
  **YES.** It is the sole persistent store that survives process restarts.
- **G. Is PostgreSQL only an unused adapter or optional configuration?**  
  **YES.** PostgreSQL connectivity and schema migrations exist as dormant code.
- **H. Does the application silently fall back to JSON storage?**  
  **YES.** Services directly bypass PostgreSQL and utilize `storageEngine.js` by default.

### 3.3 Storage Classification Verdict
**Classification: `JSON_ONLY`** (Active runtime) / **`POSTGRESQL_CONFIGURED_NOT_CONNECTED`** (Code artifacts present).  
*Level 5 (`POSTGRESQL_OPERATIONAL_PERSISTENCE_VERIFIED`) is strictly denied.*

---

## 4. PostgreSQL Row-Level Security (RLS) Evidence

### 4.1 SQL Implementation Review
Migration file `server/db/migrations/002_enable_rls.sql` demonstrates sound DDL:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY` applied to all 7 tables.
- Restrictive policies bound to `NULLIF(current_setting('app.current_tenant_id', true), '')` with super-admin bypass flags.
- Covers `SELECT`, `INSERT`, `UPDATE`, and `DELETE` via `FOR ALL` with both `USING` and `WITH CHECK` clauses.

### 4.2 Runtime RLS Status
Because no PostgreSQL server is accessible, these policies have never been loaded into a PostgreSQL catalog:
- **`RLS SQL IMPLEMENTED`:** **VERIFIED**
- **`RLS MIGRATIONS EXECUTED`:** **UNEXECUTED**
- **`RLS RUNTIME VERIFIED (POSTGRESQL)`:** **BLOCKED**

*(Note: Tenant isolation is verified at runtime solely via JavaScript filtering inside `storageEngine.js`).*

---

## 5. OIDC Authentication Verification

### 5.1 Protocol Implementation Review (`server/auth/oidcService.js`)
- **PKCE S256:** Cryptographic code_verifier (32 bytes random) and code_challenge (SHA-256 base64url) generated via `crypto.randomBytes`.
- **Validation:** Enforces signature, issuer (`iss`), audience (`aud`), expiration (`exp`), and nonce match.
- **Protocol Gap:** ID token signature verification uses symmetric HMAC (`HS256`) against a pre-shared secret. It **lacks asymmetric JWKS fetching** (`RS256` via `/.well-known/openid-configuration` and `/certs`), which is the standard for enterprise Keycloak and Microsoft Entra ID deployments.

### 5.2 Runtime Status
- `OIDC_ISSUER`: `null`
- `OIDC_CLIENT_ID`: `null`
- `OIDC_CLIENT_SECRET`: `null`
- Active Auth Mode: `SANDBOX`
- Health Endpoint Output: `OIDC_FEDERATION: NOT_CONFIGURED`
- Initiating SSO: `buildAuthorizationUrl()` safely throws HTTP 503 (`OIDC_NOT_CONFIGURED`).

### 5.3 OIDC Classification Verdict
**Classification: `OIDC_CODE_PRESENT_NOT_CONFIGURED`** (Level 2).  
*Sandbox authentication is operational; enterprise SSO is dormant.*

---

## 6. Municipal ERP Integration Verification

### 6.1 Adapter Implementation Review (`server/adapters/enterpriseErpAdapter.js`)
- **HMAC Signing:** Computes `X-Signature` using `timestamp.METHOD.path.body` hashed with `ERP_CLIENT_SECRET`.
- **Circuit Breaker:** Implements `CLOSED`, `OPEN`, and `HALF_OPEN` states. Trips after 3 failures; enforces 30-second cooldown.
- **Exponential Backoff:** Retries up to 3 times with exponential backoff and jitter.

### 6.2 Runtime Status
- Real ERP endpoint: `null`
- Administrative Enablement: `false`
- Outbound Traffic: Zero external network requests dispatched.
- All operations route through the local `sandboxAdapter.js`.

### 6.3 ERP Classification Verdict
- **Adapter Implemented:** **YES**
- **Sandbox Tested:** **YES**
- **Real Endpoint Configured:** **NO**
- **Real Connection Verified:** **NO**
- **Real Work Order Round-Trip:** **NO**
- **Classification:** **`REAL ERP CONNECTION = NOT CONFIGURED`**.

---

## 7. Backup and Disaster Recovery Verification

### 7.1 Documentation vs Automation
- **Documentation:** `docs/backup_and_disaster_recovery.md` provides an enterprise runbook covering `pg_dump -Fc`, WAL archiving, PITR configuration, and tenant export.
- **Automation:** **Zero automated backup scripts exist.** There are no cron jobs, systemd timers, or scheduled task runners in the codebase.
- **Live Database Dumps:** No `.dump` or `.tar` backup files exist on disk.
- **Restore Testing:** No restore has been tested against a temporary or staging database.

### 7.2 Backup & Restore Classification Verdict
**Classification: `RESTORE TEST = NOT VERIFIED`** / **`BACKUP AUTOMATION = DOCUMENTATION ONLY`**.

---

## 8. Disk Persistence & Storage Engine Assessment

### 8.1 Inspection of `persistent_db.json`
- **Location:** `server/data/persistent_db.json`
- **File Size:** 14,879 bytes
- **Row Counts:**
  - `tenants`: 2 (`TENANT-DEMO-A`, `TENANT-DEMO-B`)
  - `users`: 9 (Covering all 6 roles)
  - `incidents`: 5
  - `work_orders`: 2
  - `ward_datasets`: 1
  - `ward_features`: 1
  - `audit_logs`: 7
  - `telemetry_records`: 1
  - `integration_settings`: 0

### 8.2 Operational Resilience Analysis
| Evaluation Parameter | Assessment | Risk Level | Observation / Mechanism |
| :--- | :---: | :---: | :--- |
| **Data Survival Across Restart** | Verified | Low (Sandbox) | Disk write + reload verified in Test A |
| **Atomic Write Behavior** | Verified | Low (Sandbox) | Writes to `.tmp.[timestamp]` then `renameSync` |
| **Crash Recovery** | Partial | Medium | In-memory writes lost if process dies before `persistToDisk()` |
| **Concurrent Write Safety** | **Failed** | **High** | No file locking (`flock`); multi-process execution causes race conditions |
| **File Corruption Handling** | **Failed** | **Critical** | Invalid JSON triggers **full store wipe and reset to seed data** |
| **Production Suitability** | **Unsuitable**| **Critical** | Entire store kept in RAM; unindexed full-array scans; event-loop blocking |

---

## 9. Audit Log Integrity Verification

### 9.1 Hash Chain Verification
- **Genesis Root:** `GENESIS_HASH_CHAIN_ROOT_0000000000000000000000000000000000000000`
- **Algorithm:** SHA-256 over `previous_hash | event_id | timestamp | actor_id | event_type | details`
- **Live Verification Result:**
  - Tenant A: 7 records verified. Head hash: `d3537a1d6ba86486359c77d060980413ffa3ccbd627aec967d3523cf26f1c703`. Integrity: **VALID**.
  - Tenant B: 0 records present. Integrity: **VALID** (clean genesis).

### 9.2 Attack Model & Immutability Analysis
> [!WARNING]
> **Cryptographic Finding:** Unkeyed SHA-256 hash chaining provides **tamper-evidence**, not **tamper-resistance**.
> An attacker or rogue administrator with filesystem write access to `persistent_db.json` (or write access to PostgreSQL) can modify an audit record, calculate its new SHA-256 hash, and cascade the re-calculation forward through all subsequent records. The resulting chain will pass `verifyAuditChain` with zero discrepancies. True non-repudiation requires HMAC with an HSM-managed key, asymmetric digital signatures, or external WORM/ledger anchoring.

---

## 10. Automated Security and Regression Tests

### 10.1 Test Execution Matrix

| Test Suite | Command | Exit Code | Total | Passed | Failed | Blocked |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Phase 12 Enterprise Suite** | `node scratch/test_phase12_enterprise_suite.js` | **0** | 22 | 22 | 0 | 0* |
| **Phase 11 Security Suite** | `node scratch/test_phase11_security_suite.js` | **0** | 20 | 20 | 0 | 0 |
| **94-Image CV Regression** | `python scratch/test_phase11_94_regression.py` | **0** | 9 | 9 | 0 | 0 |
| **Secrets & Random Audit** | `python scratch/audit_secrets_and_random.py` | **0** | 2 | 2 | 0 | 0 |
| **Frontend Production Build** | `npm run build` | **0** | N/A | N/A | 0 | 0 |

*\*Note: Test F in Phase 12 validates RLS in `storageEngine.js`, not in live PostgreSQL.*

### 10.2 94-Image Computer Vision Regression Metrics
All 9 benchmark categories match the reference baseline with zero discrepancy:
- Flood screening ($\ge 5\%$): **30 / 32**
- Significant waterlogging: **25 / 32**
- Road D40 defect ($\text{conf} \ge 0.50$): **12 / 32**
- Any road defect ($\text{conf} \ge 0.25$): **17 / 32**
- Raw waste detections: **24 / 30**
- Arbitrated waste detections: **22 / 30**
- Flood cross-waste: **5 / 32**
- Pothole cross-waste: **10 / 32**
- Water-filled pothole fusion: **9 / 9**
- **Measured Regressions:** **0**

---

## 11. Failed, Blocked and Unverified Capabilities

| Capability Domain | Target Level | Verified Level | Root Cause / Block Reason |
| :--- | :---: | :---: | :--- |
| **PostgreSQL Connectivity** | Operational | **NOT CONFIGURED** | `DATABASE_URL` unset; services use JSON engine |
| **PostgreSQL RLS Runtime** | Verified | **BLOCKED** | No live database running or accessible |
| **Enterprise OIDC SSO** | Operational | **NOT CONFIGURED** | No external IdP registered; `AUTH_MODE=SANDBOX` |
| **OIDC JWKS Key Rotation** | Implemented | **NOT IMPLEMENTED** | Uses symmetric HMAC; lacks asymmetric JWKS fetch |
| **Real Municipal ERP** | Operational | **NOT CONFIGURED** | No authorized municipal endpoint or credentials |
| **Backup Restoration** | Verified | **NOT VERIFIED** | Documentation only; no automated scripts or restore run |
| **Multi-Process Concurrency** | Production | **UNSUPPORTED** | `storageEngine.js` lacks multi-process file locks |

---

## 12. Critical Security & Architectural Findings

1. **PostgreSQL Is Dormant:** The system is marketed as having PostgreSQL persistence, but in runtime, 100% of mutations hit `persistent_db.json`. PostgreSQL code is currently a non-functional wrapper.
2. **Catastrophic Reset on JSON Parse Error:** `storageEngine.js` (lines 200-203) wipes all existing records and restores initial seed data if any read error occurs on `persistent_db.json`.
3. **Audit Chain Re-Write Vulnerability:** Audit hash chaining uses standard SHA-256 without a keyed HMAC or asymmetric digital signature, allowing anyone with file access to rewrite history undetectably.
4. **OIDC Lacks Asymmetric JWKS:** Enterprise identity federation (Keycloak / Entra ID) standardly uses RS256/ES256 with key rotation via JWKS. CivicSense currently only implements symmetric HS256 validation.
5. **Lack of Automated Backup Pipeline:** Disaster recovery exists solely as a Markdown document without executable scripts or automated snapshot schedules.

---

## 13. Production Readiness Gaps

```
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│     ENTERPRISE SANDBOX          │      CURRENT CIVICSENSE         │     PRODUCTION DEPLOYMENT       │
│         REQUIREMENTS            │            STATUS               │          REQUIREMENTS           │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ • Local multi-tenant isolation  │ [✓] Implemented (storageEngine) │ • PostgreSQL RLS active in DB   │
│ • Deterministic RBAC (6 roles)  │ [✓] Implemented & Enforced      │ • Enterprise IdP (OIDC JWKS)    │
│ • Safe non-production ERP mode  │ [✓] Disabled by default         │ • Authorized ERP integration    │
│ • 0 secret leaks in frontend    │ [✓] Verified clean              │ • Automated encrypted backups   │
│ • 0 regressions in AI pipeline  │ [✓] Verified 94-image parity    │ • High-availability cluster     │
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

CivicSense AI meets 100% of the requirements for an **Enterprise Sandbox**, but fails the criteria for a Production Deployment Candidate.

---

## 14. Recommended Remediation Roadmap

1. **Phase 12.1 — True PostgreSQL Service Integration:**
   - Update services (`incidentService`, `workOrderService`, etc.) to route through `executeWithTenantContext()` in `connection.js` when `DATABASE_URL` is configured, running real SQL parameterized queries against PostgreSQL.
   - Run `node server/db/migrationRunner.js up` during deployment.
2. **Phase 12.2 — Asymmetric OIDC JWKS Integration:**
   - Extend `server/auth/oidcService.js` to fetch public keys from `{OIDC_ISSUER}/.well-known/openid-configuration` and verify `RS256` tokens with key caching and rotation.
3. **Phase 12.3 — Audit Log Cryptographic Hardening & Automated Backup:**
   - Key audit chain hashes with an HMAC secret or digital signature stored outside the database.
   - Create automated backup scripts (`scripts/backup_database.sh`) with verified restoration tests.
   - Fix `storageEngine.js` to abort with a fatal error on corrupt JSON rather than wiping the database.

---

## 15. Final Verdict

### Selection: **`B. ENTERPRISE SANDBOX VERIFIED`**

```
========================================================================================
                          INDEPENDENT AUDIT FINAL VERDICT
========================================================================================

  AUDIT CLASSIFICATION:
  ---------------------
  [   ] A. ARCHITECTURE IMPLEMENTED – RUNTIME NOT VERIFIED
  [ X ] B. ENTERPRISE SANDBOX VERIFIED
  [   ] C. CONTROLLED INTEGRATION TESTING READY
  [   ] D. PRODUCTION DEPLOYMENT CANDIDATE
  [   ] E. BLOCKED – CRITICAL GAPS FOUND

  JUSTIFICATION:
  --------------
  • The application is exceptionally well-engineered for a secure enterprise sandbox.
  • All 42 automated security tests pass with 100% success.
  • Computer vision pipeline maintains exact 0-regression parity across 94 images.
  • Zero secret leaks, zero Math.random(), and strict safe defaults (ERP disabled,
    OIDC safe fallback) protect against accidental production compromise.
  • Production deployment candidate status cannot be awarded because PostgreSQL,
    real OIDC, real ERP, and automated backup restoration are not operational in runtime.
========================================================================================
```

