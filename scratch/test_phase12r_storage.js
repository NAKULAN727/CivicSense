// CivicSense AI - Phase 12R Storage Fail-Safe, Quarantine & File Locking Verification
// ZERO Math.random() – Uses deterministic state checks in isolated test directory.

import fs from 'node:fs';
import path from 'node:path';
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

const TEST_DIR = path.resolve('scratch', '.test_storage_isolation');

function cleanupTestDir() {
  try {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {}
}

async function runStorageSuite() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R STORAGE FAIL-SAFE & LOCKING");
  console.log("==================================================");

  cleanupTestDir();
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const testDbFile = path.join(TEST_DIR, 'persistent_db.json');
  const testBakFile = path.join(TEST_DIR, 'persistent_db.json.bak');

  try {
    // TEST 1: Atomic write persistence
    const engine1 = new StorageEngine(TEST_DIR);
    await engine1.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
      await tx.insert('incidents', {
        incident_id: 'INC-STORAGE-TEST-001',
        tenant_id: 'TENANT-DEMO-A',
        title: 'Storage Atomic Test',
        incident_type: 'POTHOLE',
        severity: 'LOW'
      });
    });

    assert(
      fs.existsSync(testDbFile),
      "TEST 1: Atomic persistence to disk",
      "persistent_db.json written via atomic temp-rename mechanism."
    );

    // TEST 2: Inter-process file locking
    const lockAcquired = engine1.acquireLock(1000);
    const lockCollision = engine1.acquireLock(200); // Should fail while lock is held
    engine1.releaseLock();
    const lockReacquired = engine1.acquireLock(1000);
    engine1.releaseLock();

    assert(
      lockAcquired === true && lockCollision === false && lockReacquired === true,
      "TEST 2: Inter-process file locking protocol",
      "Exclusive file locking prevents concurrent process write races; released cleanly."
    );

    // TEST 3: Corrupt JSON Quarantine
    const corruptContent = '{"tenants": [ INVALID JSON TRUNCATED CONTENT ...';
    fs.writeFileSync(testDbFile, corruptContent, 'utf8');

    // Remove .bak file so we test raw corruption quarantine without backup
    if (fs.existsSync(testBakFile)) fs.unlinkSync(testBakFile);

    const engineCorrupt = new StorageEngine(TEST_DIR);

    // Check for quarantine file
    const files = fs.readdirSync(TEST_DIR);
    const quarantineFiles = files.filter(f => f.includes('persistent_db.json.corrupt.'));

    assert(
      quarantineFiles.length > 0,
      "TEST 3: Corrupt JSON quarantine file generation",
      `Corrupted file safely quarantined to: ${quarantineFiles[0]}`
    );

    // TEST 4: Catastrophic reset prevention (Raw corrupt file must NOT be overwritten)
    const diskContentAfterInit = fs.readFileSync(testDbFile, 'utf8');
    assert(
      diskContentAfterInit === corruptContent && engineCorrupt.isQuarantined === true,
      "TEST 4: Catastrophic reset prevention",
      "Corrupted database file on disk was NOT overwritten with seed data. isQuarantined=true."
    );

    // TEST 5: Automatic recovery from valid .bak file
    cleanupTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Write a corrupt main DB file
    fs.writeFileSync(testDbFile, corruptContent, 'utf8');

    // Write a valid backup file (.bak) with a specific incident
    const validBakData = {
      tenants: [{ tenant_id: 'TENANT-DEMO-A', tenant_name: 'Alpha Municipality' }],
      users: [],
      incidents: [
        {
          incident_id: 'INC-RECOVERED-FROM-BAK-001',
          tenant_id: 'TENANT-DEMO-A',
          title: 'Resurrected Incident from Backup'
        }
      ],
      work_orders: [],
      ward_datasets: [],
      ward_features: [],
      audit_logs: [],
      telemetry_records: [],
      integration_settings: []
    };
    fs.writeFileSync(testBakFile, JSON.stringify(validBakData, null, 2), 'utf8');

    const engineRecovered = new StorageEngine(TEST_DIR);
    const foundRecoveredIncident = engineRecovered.state.incidents.find(
      i => i.incident_id === 'INC-RECOVERED-FROM-BAK-001'
    );

    assert(
      foundRecoveredIncident && foundRecoveredIncident.title === 'Resurrected Incident from Backup',
      "TEST 5: Automatic recovery from .bak file",
      "Successfully recovered state from .bak file upon detecting corrupt primary store."
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

runStorageSuite().catch((err) => {
  console.error('[UNHANDLED_ERROR]', err);
  process.exit(1);
});

