// CivicSense AI - Phase 12R Tamper-Resistant Audit Log Verification
// Tests SHA-256 hash chaining, out-of-band HMAC-SHA256 signatures, and forgery resistance.
// ZERO Math.random() – Deterministic event sequences and cryptographic verification.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { StorageEngine } from '../server/db/storageEngine.js';

let passed = 0;
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

const TEST_DIR = path.resolve('scratch', '.test_audit_isolation');

function cleanupTestDir() {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {}
}

async function runAuditSuite() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R TAMPER-RESISTANT AUDIT");
  console.log("==================================================");

  cleanupTestDir();
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const testKey = 'TEST_SECRET_AUDIT_KEY_9876543210';
  process.env.AUDIT_SIGNING_KEY = testKey;

  try {
    const engine = new StorageEngine(TEST_DIR);

    // TEST 1: Creation of audit log entries with SHA-256 chain and HMAC signatures
    await engine.executeTransaction('TENANT-DEMO-A', true, async (tx) => {
      await tx.insert('audit_logs', {
        event_id: 'AUD-TEST-001',
        tenant_id: 'TENANT-DEMO-A',
        timestamp: '2026-10-07T10:00:00.000Z',
        actor_id: 'USER-ALPHA-01',
        event_type: 'USER_LOGIN',
        resource: '/api/auth/login',
        result: 'SUCCESS',
        request_id: 'req-001',
        details: { method: 'PASSWORD' }
      });

      await tx.insert('audit_logs', {
        event_id: 'AUD-TEST-002',
        tenant_id: 'TENANT-DEMO-A',
        timestamp: '2026-10-07T10:05:00.000Z',
        actor_id: 'USER-ALPHA-01',
        event_type: 'INCIDENT_CREATED',
        resource: '/api/incidents/civic-123',
        result: 'SUCCESS',
        request_id: 'req-002',
        details: { incidentId: 'civic-123', severity: 'HIGH' }
      });

      await tx.insert('audit_logs', {
        event_id: 'AUD-TEST-003',
        tenant_id: 'TENANT-DEMO-A',
        timestamp: '2026-10-07T10:10:00.000Z',
        actor_id: 'USER-ALPHA-01',
        event_type: 'WORK_ORDER_DISPATCHED',
        resource: '/api/work-orders/wo-456',
        result: 'SUCCESS',
        request_id: 'req-003',
        details: { workOrderId: 'wo-456' }
      });
    });

    const logsA = engine.state.audit_logs.filter(l => l.tenant_id === 'TENANT-DEMO-A');
    assert(
      logsA.length === 3 &&
      Boolean(logsA[0].current_hash) &&
      Boolean(logsA[0].hmac_signature),
      "TEST 1: Cryptographic audit chaining with HMAC checkpoints",
      `Created 3 audit records with SHA-256 current_hash and HMAC signatures.`
    );

    // TEST 2: Valid audit chain verification
    const validVerify = engine.verifyAuditChain('TENANT-DEMO-A');
    assert(
      validVerify.isValid === true && validVerify.recordCount === 3,
      "TEST 2: Clean audit chain verification",
      `Verified 3 records. Zero discrepancies found.`
    );

    // TEST 3: Direct event tampering detection (SHA-256 hash mismatch)
    // Attacker modifies details of record 2 in place
    engine.state.audit_logs[1].details.severity = 'LOW'; // Originally HIGH
    const directTamperVerify = engine.verifyAuditChain('TENANT-DEMO-A');

    assert(
      directTamperVerify.isValid === false && directTamperVerify.reason?.includes('Tamper detected'),
      "TEST 3: Attribute tampering detection (SHA-256)",
      `Caught tamper: ${directTamperVerify.reason}`
    );

    // Restore original detail
    engine.state.audit_logs[1].details.severity = 'HIGH';

    // TEST 4: Sophisticated attacker recomputes SHA-256 hashes without signing key
    // Attacker modifies actor_id and re-hashes the SHA-256 chain
    engine.state.audit_logs[1].actor_id = 'IMPOSTER-ACTOR-99';
    let prevHash = engine.state.audit_logs[0].current_hash;

    for (let i = 1; i < engine.state.audit_logs.length; i++) {
      const rec = engine.state.audit_logs[i];
      rec.previous_hash = prevHash;
      const hashPayload = `${prevHash}|${rec.event_id}|${rec.timestamp}|${rec.actor_id}|${rec.event_type}|${JSON.stringify(rec.details || {})}`;
      rec.current_hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
      prevHash = rec.current_hash;
    }

    // Now SHA-256 hashes match the chain, BUT attacker has not updated or cannot forge the HMAC signature
    const hmacBreachVerify = engine.verifyAuditChain('TENANT-DEMO-A');

    assert(
      hmacBreachVerify.isValid === false && hmacBreachVerify.reason?.includes('HMAC checkpoint violation'),
      "TEST 4: Hash chain recomputation attack detection (HMAC Checkpoint)",
      `Caught recomputation: ${hmacBreachVerify.reason}`
    );

    // TEST 5: Tenant Isolation for Audit Logs
    await engine.executeTransaction('TENANT-DEMO-B', true, async (tx) => {
      await tx.insert('audit_logs', {
        event_id: 'AUD-TEST-B-001',
        tenant_id: 'TENANT-DEMO-B',
        timestamp: '2026-10-07T11:00:00.000Z',
        actor_id: 'USER-BETA-01',
        event_type: 'USER_LOGIN',
        resource: '/api/auth/login',
        result: 'SUCCESS',
        request_id: 'req-b-001',
        details: {}
      });
    });

    let queriedLogsForB = [];
    await engine.executeTransaction('TENANT-DEMO-B', false, async (tx) => {
      queriedLogsForB = await tx.query('audit_logs');
    });

    assert(
      queriedLogsForB.length === 1 && queriedLogsForB[0].tenant_id === 'TENANT-DEMO-B',
      "TEST 5: Tenant isolation in audit query",
      `Tenant B query returned only Tenant B records (1 record; zero cross-tenant leakage).`
    );

  } finally {
    cleanupTestDir();
  }

  console.log("\n==================================================");
  console.log(`TOTAL TESTS:   ${total}`);
  console.log(`PASSED:        ${passed}`);
  console.log(`FAILED:        ${total - passed}`);
  console.log("==================================================");

  if (total - passed > 0) {
    process.exit(1);
  }
}

runAuditSuite().catch((err) => {
  console.error('[UNHANDLED_ERROR]', err);
  process.exit(1);
});

