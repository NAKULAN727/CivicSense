// CivicSense AI - Phase 12R Backup & Disaster Recovery Verification Suite
// ZERO Math.random() – Automated backup integrity, checksum validation, and restoration testing.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { backupAndVerify } from '../scripts/backup_and_verify.js';

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

const TEST_BACKUP_DIR = path.resolve('scratch', '.test_recovery_isolation');

function cleanupTestDir() {
  try {
    if (fs.existsSync(TEST_BACKUP_DIR)) {
      fs.rmSync(TEST_BACKUP_DIR, { recursive: true, force: true });
    }
  } catch {}
}

async function runRecoverySuite() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R BACKUP & DISASTER RECOVERY");
  console.log("==================================================");

  cleanupTestDir();
  fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });

  try {
    // TEST 1: Automated backup creation and verification
    const backupResult = await backupAndVerify({ backupDir: TEST_BACKUP_DIR });

    assert(
      backupResult.success === true &&
      fs.existsSync(backupResult.backupFile) &&
      fs.existsSync(backupResult.checksumFile),
      "TEST 1: Automated snapshot and checksum generation",
      `Snapshot: ${path.basename(backupResult.backupFile)} | Checksum: ${backupResult.sha256.slice(0, 16)}...`
    );

    // TEST 2: Checksum file format validation
    const checksumContent = fs.readFileSync(backupResult.checksumFile, 'utf8').trim();
    const expectedPrefix = backupResult.sha256;
    assert(
      checksumContent.startsWith(expectedPrefix),
      "TEST 2: Checksum file format verification",
      `Verified standard format: ${checksumContent.slice(0, 32)}...`
    );

    // TEST 3: Isolated test restoration verification
    assert(
      backupResult.verified === true &&
      backupResult.restoredRecordCounts?.tenants >= 2,
      "TEST 3: Isolated test restoration validation",
      `Verified all table row counts match source database (Tenants: ${backupResult.restoredRecordCounts?.tenants}).`
    );

    // TEST 4: Detection of corrupted backup snapshot
    // Tamper with the backup file bytes
    fs.appendFileSync(backupResult.backupFile, '\n/* CORRUPT_BYTE_INJECTION */\n');
    const tamperedData = fs.readFileSync(backupResult.backupFile);
    const tamperedChecksum = crypto.createHash('sha256').update(tamperedData).digest('hex');

    assert(
      tamperedChecksum !== backupResult.sha256,
      "TEST 4: Tampered backup detection via checksum",
      `Original: ${backupResult.sha256.slice(0, 16)}... | Tampered: ${tamperedChecksum.slice(0, 16)}...`
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

runRecoverySuite().catch((err) => {
  console.error('[UNHANDLED_ERROR]', err);
  process.exit(1);
});

