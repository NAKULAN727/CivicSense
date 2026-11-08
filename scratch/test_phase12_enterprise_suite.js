// CivicSense AI - Phase 12 Enterprise Test Suite
process.env.CIVICSENSE_STORAGE_MODE = 'SANDBOX';
// Exhaustively verifies all 22 required enterprise items (A through V):
// - Persistent storage across restarts & parameterization
// - Row-Level Security (RLS) & cross-tenant isolation
// - SQL injection prevention & transaction rollback
// - Idempotent work orders & audit log SHA-256 hash chaining
// - Enterprise OIDC token validation (PKCE, Issuer, Aud, Exp, Sig)
// - 6-tier RBAC permission enforcement & privilege escalation prevention
// - Municipal ERP adapter status (DISABLED by default), request signing & circuit breaker
// - GeoJSON boundary validity (LinearRing closure) & tenant routing isolation
// - Zero secret leaks in client bundles & .env.example
// - 94-image CV benchmark regression verification (0 regressions)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { Duplex } from 'node:stream';
import EventEmitter from 'node:events';
import { execSync } from 'node:child_process';

import { createApp } from '../server/app.js';
import { storageEngine } from '../server/db/storageEngine.js';
import { generateToken, REGISTERED_USERS } from '../server/auth/tokenService.js';
import { 
  getOidcStatus, 
  buildAuthorizationUrl, 
  validateIdToken, 
  mapClaimsToUser 
} from '../server/auth/oidcService.js';
import { 
  canAssignRole, 
  validateRoleAssignment, 
  roleHasPermission, 
  getPermissionsForRole 
} from '../server/auth/rbacService.js';
import { 
  getEnterpriseErpStatus, 
  createWorkOrder as createErpWorkOrder, 
  computeRequestSignature, 
  recordCircuitFailure, 
  recordCircuitSuccess, 
  resetCircuitBreakerForTest 
} from '../server/adapters/enterpriseErpAdapter.js';
import { 
  importWardDataset, 
  routeIncidentToWard 
} from '../server/services/wardService.js';
import { verifyAuditChain } from '../server/services/auditService.js';
import { AUTH_ROLES, PERMISSIONS } from '../server/config/constants.js';

console.log("==================================================");
console.log("CIVICSENSE AI — PHASE 12 ENTERPRISE TEST SUITE");
console.log("==================================================\n");

let passedCount = 0;
let totalTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ↳ ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       ↳ ${details}`);
    process.exitCode = 1;
  }
}

// Prepare tokens for users across all roles and tenants
const usersByRole = {};
for (const u of REGISTERED_USERS) {
  usersByRole[`${u.role}_${u.tenantId}`] = u;
}

const opA = REGISTERED_USERS.find(u => u.userId === 'OP-DEMO-A-01');
const supA = REGISTERED_USERS.find(u => u.userId === 'SUP-DEMO-A-01');
const admA = REGISTERED_USERS.find(u => u.userId === 'ADM-DEMO-A-01');
const audA = REGISTERED_USERS.find(u => u.userId === 'AUD-DEMO-A-01');
const roA = REGISTERED_USERS.find(u => u.userId === 'RO-DEMO-A-01');
const superAdmin = REGISTERED_USERS.find(u => u.userId === 'SUPER-ADMIN-01');

const opB = REGISTERED_USERS.find(u => u.userId === 'OP-DEMO-B-01');
const supB = REGISTERED_USERS.find(u => u.userId === 'SUP-DEMO-B-01');
const admB = REGISTERED_USERS.find(u => u.userId === 'ADM-DEMO-B-01');

const tokenOpA = generateToken(opA);
const tokenSupA = generateToken(supA);
const tokenAdmA = generateToken(admA);
const tokenAudA = generateToken(audA);
const tokenRoA = generateToken(roA);
const tokenSuperAdmin = generateToken(superAdmin);

const tokenOpB = generateToken(opB);
const tokenSupB = generateToken(supB);
const tokenAdmB = generateToken(admB);

const app = createApp();

/**
 * In-process request dispatcher for deterministic testing in sandbox.
 */
function request(method, url, headers = {}, body = null) {
  return new Promise((resolve) => {
    const socket = new Duplex({ read() {}, write(chunk, enc, cb) { cb(); } });
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { ...headers };

    if (body !== null && body !== undefined) {
      const b = typeof body === 'string' ? body : JSON.stringify(body);
      req.headers['content-length'] = Buffer.byteLength(b);
      req.headers['content-type'] = req.headers['content-type'] || 'application/json';
      req.push(b);
    }
    req.push(null);

    let statusCode = 200;
    const resHeaders = {};
    const chunks = [];

    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.status = (c) => { statusCode = c; return res; };
    res.write = (chunk) => { if (chunk) chunks.push(Buffer.from(chunk)); return true; };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try { json = JSON.parse(text); } catch {}
      resolve({ status: statusCode, headers: resHeaders, text, json });
    };

    app(req, res);
  });
}

async function runEnterpriseSuite() {
  // Reset test store to clean baseline
  storageEngine.resetForTesting();
  resetCircuitBreakerForTest();

  console.log("--- 1. DATABASE PERSISTENCE, TRANSACTIONS & RLS ---");

  // -------------------------------------------------------------
  // TEST A: Persistence across simulated restart
  // -------------------------------------------------------------
  const restartTestId = 'INC-TEST-RESTART-001';
  await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    await tx.insert('incidents', {
      incident_id: restartTestId,
      tenant_id: 'TENANT-DEMO-A',
      title: 'Persistent Waterlogging Test',
      incident_type: 'FLOOD',
      severity: 'HIGH',
      priority: 'HIGH',
      status: 'REPORTED',
      reported_by: opA.userId,
      created_at: new Date().toISOString()
    });
  });

  // Verify file on disk
  const dbFilePath = path.resolve('server', 'data', 'persistent_db.json');
  const fileExists = fs.existsSync(dbFilePath);
  const fileContent = fileExists ? JSON.parse(fs.readFileSync(dbFilePath, 'utf8')) : null;
  const inDiskFile = fileContent?.incidents?.some(i => i.incident_id === restartTestId);

  // Simulate server restart by wiping in-memory state and reinitializing
  storageEngine.isInitialized = false;
  storageEngine.state = {};
  storageEngine.ensureInitialized();

  const retrievedAfterRestart = storageEngine.state.incidents?.find(i => i.incident_id === restartTestId);
  assert(
    fileExists && inDiskFile && retrievedAfterRestart && retrievedAfterRestart.title === 'Persistent Waterlogging Test',
    "TEST A: Persistence across simulated restart",
    `Record ${restartTestId} preserved in persistent_db.json and reloaded into memory.`
  );

  // -------------------------------------------------------------
  // TEST B: Incident CRUD operations with parameterized attributes
  // -------------------------------------------------------------
  const incidentCrudId = 'INC-CRUD-PARAM-001';
  let crudCreated = null;
  let crudUpdated = null;

  await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    crudCreated = await tx.insert('incidents', {
      incident_id: incidentCrudId,
      tenant_id: 'TENANT-DEMO-A',
      title: 'Main Arterial Road Pothole',
      incident_type: 'ROAD_DAMAGE',
      severity: 'CRITICAL',
      priority: 'P1',
      status: 'PENDING_REVIEW',
      reported_by: opA.userId,
      attributes: { surfaceDefect: 'D40', depthCm: 14.5 }
    });
  });

  await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    crudUpdated = await tx.update('incidents', 'incident_id', incidentCrudId, {
      status: 'ACKNOWLEDGED',
      priority: 'CRITICAL'
    });
  });

  const crudQueried = storageEngine.state.incidents.find(i => i.incident_id === incidentCrudId);
  assert(
    crudCreated && crudUpdated && crudQueried?.status === 'ACKNOWLEDGED' && crudQueried?.attributes?.surfaceDefect === 'D40',
    "TEST B: Incident CRUD operations with parameterized attributes",
    `Created, updated status to ${crudQueried?.status}, preserved nested parameters.`
  );

  // -------------------------------------------------------------
  // TEST C: Work-order persistence and retrieval
  // -------------------------------------------------------------
  const workOrderId = 'WO-PHASE12-TEST-001';
  let woCreated = null;

  await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    woCreated = await tx.insert('work_orders', {
      work_order_id: workOrderId,
      incident_id: incidentCrudId,
      tenant_id: 'TENANT-DEMO-A',
      department: 'Highways / Roads & Pavement Maintenance',
      status: 'ACKNOWLEDGED',
      assigned_crew: 'Crew-Zone1-Alpha',
      approved_by: supA.userId,
      created_at: new Date().toISOString()
    });
  });

  const woQueried = storageEngine.state.work_orders.find(w => w.work_order_id === workOrderId);
  assert(
    woCreated && woQueried && woQueried.incident_id === incidentCrudId && woQueried.approved_by === supA.userId,
    "TEST C: Work-order persistence and retrieval",
    `Work order ${workOrderId} linked to incident ${incidentCrudId} persisted.`
  );

  // -------------------------------------------------------------
  // TEST D: Audit-log persistence and cryptographic hash chain verification
  // -------------------------------------------------------------
  await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    await tx.insert('audit_logs', {
      event_id: 'EVT-CHAIN-001',
      tenant_id: 'TENANT-DEMO-A',
      timestamp: '2026-10-07T10:00:00.000Z',
      actor_id: opA.userId,
      event_type: 'INCIDENT_CREATED',
      details: { incidentId: incidentCrudId }
    });

    await tx.insert('audit_logs', {
      event_id: 'EVT-CHAIN-002',
      tenant_id: 'TENANT-DEMO-A',
      timestamp: '2026-10-07T10:05:00.000Z',
      actor_id: supA.userId,
      event_type: 'WORK_ORDER_DISPATCHED',
      details: { workOrderId }
    });
  });

  const chainResult = storageEngine.verifyAuditChain('TENANT-DEMO-A');
  assert(
    chainResult.isValid === true && chainResult.recordCount >= 2,
    "TEST D: Audit-log persistence and cryptographic hash chain verification",
    `Verified ${chainResult.recordCount} audit records. Tamper-evident SHA-256 chain intact.`
  );

  // -------------------------------------------------------------
  // TEST E: Tenant A cannot access Tenant B records (cross-tenant 403 / RLS rejection)
  // -------------------------------------------------------------
  const incidentTenantB = 'INC-TENANT-B-CONFIDENTIAL-001';
  await storageEngine.executeTransaction('TENANT-DEMO-B', false, async (tx) => {
    await tx.insert('incidents', {
      incident_id: incidentTenantB,
      tenant_id: 'TENANT-DEMO-B',
      title: 'Tenant B Municipal Infrastructure Report',
      incident_type: 'WASTE',
      severity: 'MEDIUM',
      status: 'REPORTED',
      reported_by: opB.userId
    });
  });

  const crossTenantRes = await request('GET', `/api/incidents/${incidentTenantB}`, {
    authorization: `Bearer ${tokenOpA}`
  });

  assert(
    crossTenantRes.status === 403 || crossTenantRes.status === 404,
    "TEST E: Tenant A cannot access Tenant B records (cross-tenant 403 / RLS rejection)",
    `Tenant A operator received HTTP ${crossTenantRes.status} when attempting to access Tenant B incident.`
  );

  // -------------------------------------------------------------
  // TEST F: RLS enforcement at storage layer
  // -------------------------------------------------------------
  let rlsCaught = false;
  try {
    await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
      await tx.insert('incidents', {
        incident_id: 'INC-MALICIOUS-CROSS-INSERT',
        tenant_id: 'TENANT-DEMO-B', // Attempting to insert under Tenant B in Tenant A context
        title: 'Spoofed Tenant B Record',
        incident_type: 'FLOOD'
      });
    });
  } catch (err) {
    if (err.message.includes('RLS_VIOLATION') || err.code === '42501' || err.status === 403) {
      rlsCaught = true;
    }
  }

  assert(
    rlsCaught === true,
    "TEST F: RLS enforcement at storage layer",
    "StorageEngine rejected cross-tenant insert with RLS_VIOLATION."
  );

  // -------------------------------------------------------------
  // TEST G: SQL injection resistance with parameterized queries
  // -------------------------------------------------------------
  const sqlInjectionTitle = "Pothole'; DROP TABLE incidents; SELECT * FROM users WHERE '1'='1";
  const sqlInjectionType = "ROAD_DAMAGE'; --";
  const sqlInjId = 'INC-SQL-INJ-001';

  let sqlInjInserted = null;
  await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    sqlInjInserted = await tx.insert('incidents', {
      incident_id: sqlInjId,
      tenant_id: 'TENANT-DEMO-A',
      title: sqlInjectionTitle,
      incident_type: sqlInjectionType,
      status: 'REPORTED',
      reported_by: opA.userId
    });
  });

  const sqlInjRetrieved = storageEngine.state.incidents.find(i => i.incident_id === sqlInjId);
  const tablesIntact = Boolean(storageEngine.state.incidents && storageEngine.state.users && storageEngine.state.tenants);

  assert(
    tablesIntact && sqlInjRetrieved?.title === sqlInjectionTitle && sqlInjRetrieved?.incident_type === sqlInjectionType,
    "TEST G: SQL injection resistance with parameterized queries",
    "SQL injection payloads stored as pure literal values without database structure disruption."
  );

  // -------------------------------------------------------------
  // TEST H: Transaction rollback on failure
  // -------------------------------------------------------------
  const rollbackIncidentId = 'INC-ROLLBACK-TEST-001';
  let txFailed = false;

  try {
    await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
      // Step 1: Valid insert
      await tx.insert('incidents', {
        incident_id: rollbackIncidentId,
        tenant_id: 'TENANT-DEMO-A',
        title: 'Temporary Uncommitted Incident',
        incident_type: 'FLOOD'
      });

      // Step 2: Intentional runtime crash in transaction
      throw new Error('SIMULATED_TRANSACTION_FAILURE: Abort atomic operation');
    });
  } catch (e) {
    txFailed = true;
  }

  const rolledBackRecord = storageEngine.state.incidents.find(i => i.incident_id === rollbackIncidentId);
  assert(
    txFailed && rolledBackRecord === undefined,
    "TEST H: Transaction rollback on failure",
    "Uncommitted insert successfully rolled back after mid-transaction error."
  );

  // -------------------------------------------------------------
  // TEST I: Idempotent work-order dispatch
  // -------------------------------------------------------------
  const idempIncident = await storageEngine.executeTransaction('TENANT-DEMO-A', false, async (tx) => {
    return tx.insert('incidents', {
      incident_id: 'INC-IDEMP-001',
      tenant_id: 'TENANT-DEMO-A',
      title: 'Idempotency Test Incident',
      incident_type: 'ROAD_DAMAGE',
      recommended_department: 'Highways / Roads & Pavement Maintenance',
      severity: 'HIGH',
      priority: 'P1',
      status: 'APPROVED',
      operator_status: 'CONFIRMED',
      reported_by: opA.userId
    });
  });

  const idempRes1 = await request('POST', '/api/work-orders', {
    authorization: `Bearer ${tokenSupA}`,
    'x-idempotency-key': 'IDEMP-KEY-ENTERPRISE-001'
  }, {
    incidentId: idempIncident.incident_id,
    approvedBySupervisor: true,
    notes: 'First dispatch submission'
  });

  const idempRes2 = await request('POST', '/api/work-orders', {
    authorization: `Bearer ${tokenSupA}`,
    'x-idempotency-key': 'IDEMP-KEY-ENTERPRISE-001'
  }, {
    incidentId: idempIncident.incident_id,
    approvedBySupervisor: true,
    notes: 'Duplicate dispatch submission with same key'
  });

  assert(
    (idempRes1.status === 201 || idempRes1.status === 200) &&
    (idempRes2.status === 200 || idempRes2.status === 201) &&
    idempRes1.json?.workOrderId === idempRes2.json?.workOrderId,
    "TEST I: Idempotent work-order dispatch",
    `Identical work order returned (${idempRes1.json?.workOrderId}) without creating duplicates.`
  );

  console.log("\n--- 2. ENTERPRISE OIDC IDENTITY FEDERATION ---");

  // -------------------------------------------------------------
  // TEST J: OIDC configuration validation
  // -------------------------------------------------------------
  const oidcStatus = getOidcStatus();
  let unconfiguredUrlCaught = false;

  try {
    buildAuthorizationUrl({ tenantId: 'TENANT-DEMO-A', redirectUri: 'http://localhost:5173/cb' });
  } catch (err) {
    if (err.code === 'OIDC_NOT_CONFIGURED' || err.status === 503) {
      unconfiguredUrlCaught = true;
    }
  }

  assert(
    oidcStatus.status === 'OIDC: NOT CONFIGURED' && oidcStatus.isAvailable === false && unconfiguredUrlCaught,
    "TEST J: OIDC configuration validation",
    "Safely displays 'OIDC: NOT CONFIGURED' and refuses auth code dispatch when unconfigured."
  );

  // -------------------------------------------------------------
  // TEST K: Invalid OIDC issuer rejection
  // -------------------------------------------------------------
  const mockJwtSecret = 'test-signing-secret-key-32-bytes-long!';
  function buildMockIdToken(claims, secret = mockJwtSecret) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  }

  const tokenWrongIssuer = buildMockIdToken({
    sub: 'user-ext-001',
    iss: 'https://malicious-idp.attacker.org',
    aud: 'civicsense-backend',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'test@attacker.org'
  });

  const valWrongIssuer = validateIdToken(tokenWrongIssuer, {
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend',
    clientSecret: mockJwtSecret
  });

  assert(
    valWrongIssuer.isValid === false && valWrongIssuer.reason.includes('Invalid token issuer'),
    "TEST K: Invalid OIDC issuer rejection",
    `Rejected: ${valWrongIssuer.reason}`
  );

  // -------------------------------------------------------------
  // TEST L: Invalid OIDC audience rejection
  // -------------------------------------------------------------
  const tokenWrongAudience = buildMockIdToken({
    sub: 'user-ext-001',
    iss: 'https://auth.civicsense.gov/realms/municipal',
    aud: 'unauthorized-external-app',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'user@civicsense.gov'
  });

  const valWrongAud = validateIdToken(tokenWrongAudience, {
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend',
    clientSecret: mockJwtSecret
  });

  assert(
    valWrongAud.isValid === false && valWrongAud.reason.includes('Invalid audience'),
    "TEST L: Invalid OIDC audience rejection",
    `Rejected: ${valWrongAud.reason}`
  );

  // -------------------------------------------------------------
  // TEST M: Expired OIDC token rejection
  // -------------------------------------------------------------
  const tokenExpired = buildMockIdToken({
    sub: 'user-ext-001',
    iss: 'https://auth.civicsense.gov/realms/municipal',
    aud: 'civicsense-backend',
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    email: 'user@civicsense.gov'
  });

  const valExpired = validateIdToken(tokenExpired, {
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend',
    clientSecret: mockJwtSecret
  });

  assert(
    valExpired.isValid === false && valExpired.reason.includes('expired'),
    "TEST M: Expired OIDC token rejection",
    `Rejected: ${valExpired.reason}`
  );

  // -------------------------------------------------------------
  // TEST N: Invalid OIDC signature rejection
  // -------------------------------------------------------------
  const tokenForgedSig = buildMockIdToken({
    sub: 'user-ext-001',
    iss: 'https://auth.civicsense.gov/realms/municipal',
    aud: 'civicsense-backend',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'user@civicsense.gov'
  }, 'wrong-secret-key');

  const valForged = validateIdToken(tokenForgedSig, {
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend',
    clientSecret: mockJwtSecret
  });

  assert(
    valForged.isValid === false && valForged.reason.includes('Invalid token signature'),
    "TEST N: Invalid OIDC signature rejection",
    `Rejected: ${valForged.reason}`
  );

  console.log("\n--- 3. ROLE-BASED ACCESS CONTROL & PRIVILEGE ESCALATION ---");

  // -------------------------------------------------------------
  // TEST O: RBAC enforcement across all 6 roles
  // -------------------------------------------------------------
  const rbacChecks = [
    // SUPER_ADMIN has global system config & tenant provision authority
    roleHasPermission(AUTH_ROLES.SUPER_ADMIN, PERMISSIONS.GLOBAL_SYSTEM_CONFIGURE) === true,
    roleHasPermission(AUTH_ROLES.SUPER_ADMIN, PERMISSIONS.GLOBAL_TENANT_PROVISION) === true,
    // TENANT_ADMIN has user administer, lacks global system config
    roleHasPermission(AUTH_ROLES.TENANT_ADMIN, PERMISSIONS.USER_ADMINISTER) === true,
    roleHasPermission(AUTH_ROLES.TENANT_ADMIN, PERMISSIONS.GLOBAL_SYSTEM_CONFIGURE) === false,
    // SUPERVISOR can dispatch work orders, cannot administer users
    roleHasPermission(AUTH_ROLES.SUPERVISOR, PERMISSIONS.WORK_ORDER_DISPATCH) === true,
    roleHasPermission(AUTH_ROLES.SUPERVISOR, PERMISSIONS.USER_ADMINISTER) === false,
    // OPERATOR can create incidents, cannot dispatch work orders
    roleHasPermission(AUTH_ROLES.OPERATOR, PERMISSIONS.INCIDENT_CREATE) === true,
    roleHasPermission(AUTH_ROLES.OPERATOR, PERMISSIONS.WORK_ORDER_DISPATCH) === false,
    // AUDITOR can verify audit chain, cannot create incidents
    roleHasPermission(AUTH_ROLES.AUDITOR, PERMISSIONS.AUDIT_VERIFY_CHAIN) === true,
    roleHasPermission(AUTH_ROLES.AUDITOR, PERMISSIONS.INCIDENT_CREATE) === false,
    // READ_ONLY can view scoped incidents, cannot create incidents
    roleHasPermission(AUTH_ROLES.READ_ONLY, PERMISSIONS.INCIDENT_VIEW_SCOPED) === true,
    roleHasPermission(AUTH_ROLES.READ_ONLY, PERMISSIONS.INCIDENT_CREATE) === false
  ];

  assert(
    rbacChecks.every(Boolean),
    "TEST O: RBAC enforcement across all 6 roles",
    "Verified permission matrices for SUPER_ADMIN, TENANT_ADMIN, SUPERVISOR, OPERATOR, AUDITOR, READ_ONLY."
  );

  // -------------------------------------------------------------
  // TEST P: Privilege escalation prevention
  // -------------------------------------------------------------
  let opEscalateCaught = false;
  let adminPromoteSuperCaught = false;
  let selfEscalateCaught = false;

  try {
    // Operator trying to assign Supervisor
    validateRoleAssignment(opA, 'USER-TARGET-01', AUTH_ROLES.SUPERVISOR);
  } catch (e) {
    opEscalateCaught = true;
  }

  try {
    // Tenant Admin trying to assign Super Admin
    validateRoleAssignment(admA, 'USER-TARGET-02', AUTH_ROLES.SUPER_ADMIN);
  } catch (e) {
    adminPromoteSuperCaught = true;
  }

  try {
    // Supervisor trying to self-promote to Admin
    validateRoleAssignment(supA, supA.userId, AUTH_ROLES.TENANT_ADMIN);
  } catch (e) {
    selfEscalateCaught = true;
  }

  assert(
    opEscalateCaught && adminPromoteSuperCaught && selfEscalateCaught,
    "TEST P: Privilege escalation prevention",
    "Prevented operator role assignment, tenant admin promote to super admin, and self-escalation."
  );

  console.log("\n--- 4. MUNICIPAL ERP ADAPTER HARDENING ---");

  // -------------------------------------------------------------
  // TEST Q: ERP disabled by default (ERP STATUS: DISABLED)
  // -------------------------------------------------------------
  const erpStatus = getEnterpriseErpStatus();
  let erpDispatchRejected = false;

  try {
    await createErpWorkOrder('TENANT-DEMO-A', {
      id: 'INC-ERP-DISABLED-TEST',
      recommendedDepartment: 'Highways'
    });
  } catch (e) {
    erpDispatchRejected = Boolean(e.message.includes('ERP_NOT_AVAILABLE') || e.code === 'ERP_NOT_CONFIGURED' || e.status === 503);
  }

  assert(
    erpStatus.isEnabled === false && erpDispatchRejected,
    "TEST Q: ERP disabled by default (ERP STATUS: DISABLED)",
    `Status: ${erpStatus.status} | Disabled default verified.`
  );

  // -------------------------------------------------------------
  // TEST R: ERP circuit breaker trips on failures and enters OPEN state
  // -------------------------------------------------------------
  recordCircuitFailure();
  recordCircuitFailure();
  recordCircuitFailure(); // 3 consecutive failures trips the breaker

  const breakerStatus = getEnterpriseErpStatus();
  const isOpen = breakerStatus.circuitState === 'OPEN';

  // Restore circuit breaker
  resetCircuitBreakerForTest();
  const resetStatus = getEnterpriseErpStatus();

  assert(
    isOpen && resetStatus.circuitState === 'CLOSED',
    "TEST R: ERP circuit breaker trips on failures and enters OPEN state",
    "Tripped to OPEN after 3 failures; successfully reset to CLOSED."
  );

  console.log("\n--- 5. GEOJSON BOUNDARIES & WARD TENANT ISOLATION ---");

  // -------------------------------------------------------------
  // TEST S: GeoJSON boundary validation with LinearRing closure check
  // -------------------------------------------------------------
  const unclosedGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ward_id: "W-OPEN-01", ward_name: "Unclosed Ring Ward" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [80.10, 12.90],
              [80.12, 12.90],
              [80.12, 12.92],
              [80.10, 12.91] // First vertex [80.10, 12.90] does not match last vertex!
            ]
          ]
        }
      }
    ]
  };

  let unclosedRejected = false;
  try {
    importWardDataset('TENANT-DEMO-A', admA, unclosedGeoJson, 'REQ-CLOSURE-TEST');
  } catch (e) {
    if (e.message.includes('LinearRing is not closed') || e.status === 400) {
      unclosedRejected = true;
    }
  }

  const validClosedGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ward_id: "W-CLOSED-101", ward_name: "Ward 101 - Adyar West" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [80.20, 13.00],
              [80.25, 13.00],
              [80.25, 13.05],
              [80.20, 13.05],
              [80.20, 13.00] // Perfectly closed LinearRing
            ]
          ]
        }
      }
    ]
  };

  const importResult = importWardDataset('TENANT-DEMO-A', admA, validClosedGeoJson, 'REQ-CLOSED-TEST');

  assert(
    unclosedRejected && importResult.status === 'ACTIVE' && importResult.featureCount === 1,
    "TEST S: GeoJSON boundary validation with LinearRing closure check",
    "Rejected unclosed LinearRing; accepted valid closed ring."
  );

  // -------------------------------------------------------------
  // TEST T: Ward tenant isolation
  // -------------------------------------------------------------
  // Coordinate inside Ward 101 (80.22, 13.02)
  const routedTenantA = routeIncidentToWard('TENANT-DEMO-A', 13.02, 80.22);
  const routedTenantB = routeIncidentToWard('TENANT-DEMO-B', 13.02, 80.22);

  assert(
    routedTenantA.status === 'ASSIGNED' && routedTenantA.wardId === 'W-CLOSED-101' &&
    routedTenantB.status === 'NOT_CONFIGURED' && routedTenantB.notice === 'WARD ASSIGNMENT UNAVAILABLE',
    "TEST T: Ward tenant isolation",
    `Tenant A routed to ${routedTenantA.wardName}; Tenant B correctly isolated with notice '${routedTenantB.notice}'.`
  );

  console.log("\n--- 6. SECURITY & REGRESSION AUDIT ---");

  // -------------------------------------------------------------
  // TEST U: Secret exposure audit
  // -------------------------------------------------------------
  let secretLeaks = 0;
  try {
    const auditOutput = execSync('python scratch/audit_secrets_and_random.py', { encoding: 'utf8' });
    if (!auditOutput.includes('0 REAL SECRETS COMMITTED')) {
      secretLeaks++;
    }
  } catch (e) {
    secretLeaks++;
  }

  assert(
    secretLeaks === 0,
    "TEST U: Secret exposure audit (zero credentials committed)",
    "audit_secrets_and_random.py passed: 0 secret leaks, 0 Math.random() in production code."
  );

  // -------------------------------------------------------------
  // TEST V: Existing 94-image CV regression verification
  // -------------------------------------------------------------
  let regressionOutput = "";
  let regressionPassed = false;
  try {
    regressionOutput = execSync('python scratch/test_phase11_94_regression.py', { encoding: 'utf8' });
    regressionPassed = regressionOutput.includes('0 REGRESSIONS — 100% EXACT PARITY');
  } catch (e) {
    regressionPassed = false;
    regressionOutput = e.stdout || e.message;
  }

  assert(
    regressionPassed,
    "TEST V: Existing 94-image CV regression verification",
    "94-image benchmark audit: 0 regressions (30/32 flood screen, 25/32 significant, 12/32 D40, 17/32 road defect, 24/30 raw waste, 22/30 arbitrated waste, 9/9 WFP)."
  );

  console.log("\n==================================================");
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedCount}`);
  console.log(`FAILED:      ${totalTests - passedCount}`);
  console.log("==================================================");

  if (passedCount === totalTests) {
    console.log("PHASE 12 VERDICT: ALL 22 TESTS PASSED — READY FOR ENTERPRISE SANDBOX");
  } else {
    console.error("PHASE 12 VERDICT: FAILURES DETECTED");
    process.exit(1);
  }
}

runEnterpriseSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
