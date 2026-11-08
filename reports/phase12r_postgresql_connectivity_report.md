# CivicSense AI — Phase 12R PostgreSQL Live Connection Validation Report

**Date of Diagnostic Audit:** November 9, 2026  
**Audited Target:** Supabase PostgreSQL Managed Database  
**Audited Configuration:** `DATABASE_URL` via `.env` / `server/config/environment.js`  
**Audit Type:** Non-Destructive, Non-Fabricated Connectivity & Identity Diagnosis  
**Final Status:** **POSTGRESQL CONNECTION BLOCKED**  

---

## 1. Executive Summary

An independent, non-destructive technical connectivity diagnosis was performed on the PostgreSQL database configuration provided for CivicSense AI.

### Core Findings:
1. **Direct Connection is IPv6-Only:** The configured direct hostname `db.tjuahmabbsfabazuvhdt.supabase.co` possesses **only an IPv6 (AAAA) record** (`2406:da18:1248:be00::a57f`) and **no IPv4 (A) record** (`queryA ENODATA`). Because the host environment operates on an IPv4 network stack without an active IPv6 route (`ENETUNREACH`), OS-level name resolution fails with `getaddrinfo ENOTFOUND db.tjuahmabbsfabazuvhdt.supabase.co`.
2. **Supabase Pooler is Reachable via IPv4:** The regional connection pooler for project `tjuahmabbsfabazuvhdt` (`aws-0-ap-southeast-1.pooler.supabase.com`, AWS Singapore) resolves to valid IPv4 addresses and accepts TCP connections on both port `5432` (session pooler) and port `6543` (transaction pooler).
3. **Database Authentication Rejected (28P01):** Connecting through the IPv4 pooler with username `postgres.tjuahmabbsfabazuvhdt` successfully routes to the real database instance, but is rejected by PostgreSQL with:
   `error: 28P01 password authentication failed for user "postgres"`.
   The password currently in `.env` does not match the active database password in the Supabase project.
4. **Safety Controls Preserved:** Zero application services were degraded to JSON silently. Zero credentials or passwords were leaked or committed. Zero migrations were executed.

---

## 2. Step 1 — Configuration Inspection

| Attribute | Configured Value | Validation Result |
| :--- | :--- | :--- |
| **Backend Loading** | `server/config/environment.js` | Loaded via `process.loadEnvFile('.env')` |
| **Protocol** | `postgresql:` | Valid standard PostgreSQL URI scheme |
| **Hostname** | `db.tjuahmabbsfabazuvhdt.supabase.co` | Extracted successfully; matches project ref `tjuahmabbsfabazuvhdt` |
| **Port** | `5432` | Standard PostgreSQL port; valid |
| **Database Name** | `postgres` | Standard default database name |
| **Username** | `postgres` | Standard default administrative user |
| **Password State** | Present in `.env` | Evaluates to non-placeholder string; not printed or exposed |
| **SSL Setting** | `ssl: { rejectUnauthorized: false }` | Required and correctly configured in `server/db/connection.js` |
| **Frontend Isolation** | `VITE_*` and `NEXT_PUBLIC_*` | Inspected; contains only public project URL and publishable anon key. Zero database credentials exposed. |

---

## 3. Step 2 — DNS Diagnosis

A granular DNS resolution audit was conducted on the configured direct hostname:

```
Hostname: db.tjuahmabbsfabazuvhdt.supabase.co
```

### DNS Diagnostic Records:
* **IPv4 (A Record) Query:**
  ```
  dns.resolve4('db.tjuahmabbsfabazuvhdt.supabase.co')
  Result: ENODATA (queryA ENODATA db.tjuahmabbsfabazuvhdt.supabase.co)
  ```
  *Conclusion: Host has NO IPv4 A records.*
* **IPv6 (AAAA Record) Query:**
  ```
  dns.resolve6('db.tjuahmabbsfabazuvhdt.supabase.co')
  Result: [ '2406:da18:1248:be00::a57f' ]
  ```
  *Conclusion: Host is an IPv6-only endpoint.*
* **OS Resolver (`getaddrinfo` / `dns.lookup`):**
  ```
  dns.lookup('db.tjuahmabbsfabazuvhdt.supabase.co')
  Result: ENOTFOUND (getaddrinfo ENOTFOUND db.tjuahmabbsfabazuvhdt.supabase.co)
  ```
* **IPv6 TCP Probe:**
  ```
  net.createConnection({ host: '2406:da18:1248:be00::a57f', port: 5432 })
  Result: ENETUNREACH (connect ENETUNREACH 2406:da18:1248:be00::a57f:5432)
  ```

### Failure Classification:
The failure is a **dual architectural blocker**:
1. **DNS Architecture:** Supabase has globally removed IPv4 A records from direct connection hostnames (`db.<project-ref>.supabase.co`) in favor of IPv6.
2. **Network Routing:** The local client network stack does not have an active IPv6 default gateway (`ENETUNREACH`).

---

## 4. Step 3 & 4 — Supabase Configuration & Pooler Diagnosis

### Project Reference Verification:
* Project Reference: `tjuahmabbsfabazuvhdt`
* Probed REST Endpoint: `https://tjuahmabbsfabazuvhdt.supabase.co/rest/v1/`
* Response Header: `sb-project-ref: tjuahmabbsfabazuvhdt`
* Status: **Active project verified** on Supabase infrastructure.

### Regional Infrastructure Mapping:
* IPv6 CIDR prefix `2406:da18::/35` resolves to **AWS Region `ap-southeast-1` (Singapore)**.
* Supabase Official IPv4 Pooler Host: `aws-0-ap-southeast-1.pooler.supabase.com`.

### Pooler Diagnostic Probes:
* **IPv4 DNS Resolution:**
  ```
  A Records: [ '54.255.219.82', '52.77.146.31', '52.74.252.201' ]
  ```
* **TCP Port 5432 (Session Pooler):** Connected successfully (`TCP connect to 5432 SUCCESS`).
* **TCP Port 6543 (Transaction Pooler):** Connected successfully (`TCP connect to 6543 SUCCESS`).
* **Tenant Gateway Routing:** When authenticating with username format `postgres.tjuahmabbsfabazuvhdt`, the pooler recognized the tenant.
* **Database Engine Authentication Response:**
  ```
  error: 28P01 password authentication failed for user "postgres"
  ```
  *PostgreSQL error code `28P01` confirms the connection reached the database engine, but the password provided was rejected.*

---

## 5. Step 5 — Migration Readiness

Because the database connection is currently blocked by credential rejection at the database engine, **zero migrations were run** and the database was left completely untouched.

### Local Migration Asset Readiness:
* Migration files are verified in [`server/db/migrations/`](file:///e:/CivicSenseAI/server/db/migrations/):
  * `001_initial_enterprise_schema.sql` (Validated syntax, 9 normalized tables).
  * `002_enable_rls.sql` (Validated syntax, Row-Level Security policies with `FORCE ROW LEVEL SECURITY`).
  * `003_rollback_rls.sql` (Reversible rollback script).
  * `004_rollback_schema.sql` (Reversible rollback script).
* The migration runner [`server/db/migrationRunner.js`](file:///e:/CivicSenseAI/server/db/migrationRunner.js) will automatically apply pending migrations and record entries in `schema_migrations` as soon as valid database credentials are confirmed.

---

## 6. Resolution Pathway to Unblock Live Connection

To unblock live PostgreSQL connectivity, two specific adjustments are required:

### 1. Connection Pooler Configuration (IPv4 Compatibility)
Because Supabase direct connections (`db.<ref>.supabase.co`) are IPv6-only, update the connection host in `.env` to the Supabase IPv4 Pooler:
```
# For Session Mode (Port 5432) - Recommended for persistent backends:
DATABASE_URL=postgresql://postgres.tjuahmabbsfabazuvhdt:[ACCURATE-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

# OR For Transaction Mode (Port 6543):
DATABASE_URL=postgresql://postgres.tjuahmabbsfabazuvhdt:[ACCURATE-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```
*(Notice the username format: `postgres.<project-ref>` is required by the pooler).*

### 2. Verify Database Password
The current password in `.env` triggered PostgreSQL error `28P01: password authentication failed`.
* Navigate to **Supabase Dashboard** -> **Project Settings** -> **Database**.
* Under **Database password**, reset or copy the accurate database password.
* Place the accurate password into the pooler connection string in `.env`.

---

## 7. Diagnostic Matrix & Verdict

| Inspection Area | Observed Evidence | Technical Assessment |
| :--- | :--- | :--- |
| **Backend Configuration** | `.env` loaded into `config.databaseUrl` | **PASS (Configured)** |
| **Frontend Credential Leakage** | `VITE_*` and `NEXT_PUBLIC_*` contain no secrets | **PASS (Clean)** |
| **Direct DNS (IPv4 A Record)** | `queryA ENODATA` | **BLOCKED (IPv6 Only)** |
| **Direct DNS (IPv6 AAAA Record)** | `2406:da18:1248:be00::a57f` | **CONFIRMED** |
| **Direct TCP Connectivity** | `ENETUNREACH` | **BLOCKED (No IPv6 route)** |
| **Pooler DNS (IPv4 A Record)** | `[ 54.255.219.82, 52.77.146.31, 52.74.252.201 ]` | **PASS (Resolves)** |
| **Pooler TCP Connectivity** | Ports `5432` and `6543` connected | **PASS (Reachable)** |
| **Pooler Tenant Routing** | Tenant `tjuahmabbsfabazuvhdt` located | **PASS (Valid Ref)** |
| **Database Authentication** | `28P01 password authentication failed` | **BLOCKED (Password Mismatch)** |
| **Fail-Safe Integrity** | Refused silent switch to JSON; threw `HTTP 503` | **PASS (Fail-Safe Active)** |

---

```
===================================================================================
FINAL DIAGNOSTIC VERDICT:
POSTGRESQL CONNECTION BLOCKED
===================================================================================

ROOT CAUSE:
1. Network Layer: Direct host db.tjuahmabbsfabazuvhdt.supabase.co lacks an IPv4
   A record (IPv6 only), causing ENOTFOUND on standard IPv4 resolver.
2. Gateway Layer: Regional IPv4 pooler aws-0-ap-southeast-1.pooler.supabase.com
   is reachable and routes to the project.
3. Auth Layer: PostgreSQL rejected credentials with error 28P01 (password mismatch).

REQUIRED ACTION:
Update .env with the IPv4 pooler URL and the accurate database password:
DATABASE_URL=postgresql://postgres.tjuahmabbsfabazuvhdt:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
===================================================================================
```

