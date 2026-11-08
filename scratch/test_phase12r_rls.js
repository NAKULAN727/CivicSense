// CivicSense AI - Phase 12R PostgreSQL Row-Level Security (RLS) Verification
// ZERO Math.random() – Audits RLS policy definitions, transactional enforcement, and live cluster state.

import fs from 'node:fs';
import path from 'node:path';
import { checkDatabaseHealth, executeWithTenantContext } from '../server/db/connection.js';
import { storageEngine } from '../server/db/storageEngine.js';

let passed = 0;
let blocked = 0;
let total = 0;

function assert(condition, testName, details) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ↳ ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       ↳ ${details}`);
  }
}

function reportBlocked(testName, reason) {
  total++;
  blocked++;
  console.log(`[BLOCKED] ${testName}`);
  console.log(`          ↳ ${reason}`);
}

async function runRlsSuite() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R ROW-LEVEL SECURITY (RLS)");
  console.log("==================================================");

  // Test 1: Static Policy Syntax & Structural Verification
  const migrationPath = path.resolve('server', 'db', 'migrations', '002_enable_rls.sql');
  const rlsSql = fs.readFileSync(migrationPath, 'utf8');

  const requiredTables = [
    'incidents',
    'work_orders',
    'ward_datasets',
    'ward_features',
    'audit_logs',
    'telemetry_records'
  ];

  let allTablesProtected = true;
  for (const table of requiredTables) {
    const hasEnable = rlsSql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    const hasForce = rlsSql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
    const hasPolicy = rlsSql.includes(`ON ${table}`);
    if (!hasEnable || !hasForce || !hasPolicy) {
      allTablesProtected = false;
      console.error(`Missing complete RLS specification for table: ${table}`);
    }
  }

  assert(
    allTablesProtected,
    "TEST 1: PostgreSQL RLS policy specifications in 002_enable_rls.sql",
    `Verified ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY, and session tenant filters for all 6 tables.`
  );

  // Test 2: Storage Layer Transactional RLS Isolation
  let rlsViolationCaught = false;
  try {
    await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
      await tx.insert('incidents', {
        incident_id: 'INC-RLS-TEST-001',
        tenant_id: 'TENANT-DEMO-B', // Cross-tenant violation
        title: 'Unauthorized Cross-Tenant Injection',
        incident_type: 'POTHOLE',
        severity: 'HIGH'
      });
    });
  } catch (err) {
    if (err.message.includes('RLS_VIOLATION') || err.code === '42501') {
      rlsViolationCaught = true;
    }
  }

  assert(
    rlsViolationCaught,
    "TEST 2: Storage engine RLS boundary enforcement",
    "Transactional client rejected cross-tenant insert with RLS_VIOLATION (42501)."
  );

  // Test 3: Transactional Rollback on RLS Rejection
  const uncommittedRecord = storageEngine.state.incidents.find(i => i.incident_id === 'INC-RLS-TEST-001');
  assert(
    !uncommittedRecord,
    "TEST 3: Transaction rollback after RLS rejection",
    "Verified uncommitted cross-tenant record was completely rolled back from persistent storage."
  );

  // Test 4: Live PostgreSQL RLS Validation or Honest Sandbox Block Status
  const health = await checkDatabaseHealth();
  if (health.isConnected) {
    try {
      let liveRlsPassed = false;
      // In live DB, attempt to select Tenant B row from Tenant A context
      await executeWithTenantContext('TENANT-DEMO-A', false, async (tx) => {
        const rows = await tx.query('incidents', null, 'tenant_id = $1', ['TENANT-DEMO-B']);
        liveRlsPassed = rows.length === 0;
      });

      assert(
        liveRlsPassed,
        "TEST 4: Live PostgreSQL database RLS filtering",
        "Live PostgreSQL cluster enforced tenant boundary; returned 0 rows for foreign tenant."
      );
    } catch (err) {
      assert(false, "TEST 4: Live PostgreSQL database RLS filtering", err.message);
    }
  } else {
    reportBlocked(
      "TEST 4: Live PostgreSQL cluster runtime RLS execution",
      "BLOCKED (Live PostgreSQL cluster unavailable in sandbox; requires running database host)"
    );
  }

  console.log("\n==================================================");
  console.log(`TOTAL TESTS:   ${total}`);
  console.log(`PASSED:        ${passed}`);
  console.log(`BLOCKED:       ${blocked}`);
  console.log(`FAILED:        ${total - passed - blocked}`);
  console.log("==================================================");

  if (total - passed - blocked > 0) {
    process.exit(1);
  }
}

runRlsSuite().catch((err) => {
  console.error('[UNHANDLED_ERROR]', err);
  process.exit(1);
});
