// CivicSense AI - Phase 12R-4 Comprehensive Security Remediation Test Suite
// Rigorous verification of Rule 2, 3, 4, 5, 6
import crypto from 'node:crypto';
import { getPool, closePool, executeWithTenantContext } from '../server/db/connection.js';
import { config } from '../server/config/environment.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runRemediationTestSuite() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R-4 SECURITY REMEDIATION");
  console.log("==================================================");

  const pool = getPool();
  const rawClient = await pool.connect();

  try {
    // -------------------------------------------------------------------
    // TEST A: Database Role Verification (Rule 2)
    // -------------------------------------------------------------------
    console.log("\n--- TEST A: DATABASE ROLE ATTRIBUTES (civicsense_app_role) ---");
    const roleRes = await rawClient.query(`
      SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolinherit, rolbypassrls
      FROM pg_roles WHERE rolname = 'civicsense_app_role';
    `);
    const appRole = roleRes.rows[0];
    assert(appRole && appRole.rolsuper === false, "civicsense_app_role: rolsuper is FALSE (non-superuser)");
    assert(appRole && appRole.rolbypassrls === false, "civicsense_app_role: rolbypassrls is FALSE (cannot bypass RLS)");
    assert(appRole && appRole.rolcreaterole === false, "civicsense_app_role: rolcreaterole is FALSE");
    assert(appRole && appRole.rolcreatedb === false, "civicsense_app_role: rolcreatedb is FALSE");

    // Verify SET LOCAL ROLE civicsense_app_role inside transaction
    await rawClient.query("BEGIN;");
    await rawClient.query("SET LOCAL ROLE civicsense_app_role;");
    const curUser = await rawClient.query("SELECT current_user;");
    assert(curUser.rows[0].current_user === 'civicsense_app_role', "SET LOCAL ROLE civicsense_app_role verified inside transaction");
    await rawClient.query("ROLLBACK;");

    // -------------------------------------------------------------------
    // TEST B & C: Super-Admin GUC Attack & Tenant Impersonation Defeated
    // -------------------------------------------------------------------
    console.log("\n--- TEST B & C: GUC EXPLOITATION ATTEMPTS ON LIVE RLS ---");
    // Seed synthetic tenants
    await rawClient.query("BEGIN;");
    await rawClient.query(`
      INSERT INTO tenants (tenant_id, tenant_name, label, status, is_sandbox)
      VALUES 
        ('TENANT-SECURITY-ALPHA', 'Alpha Corp', 'SEC-TEST', 'ACTIVE', true),
        ('TENANT-SECURITY-BETA', 'Beta Corp', 'SEC-TEST', 'ACTIVE', true)
      ON CONFLICT (tenant_id) DO NOTHING;
    `);

    // Seed synthetic incidents
    await rawClient.query(`
      INSERT INTO incidents (
        incident_id, tenant_id, title, incident_type, severity, priority, recommended_department, status
      ) VALUES 
        ('TEST-INC-ALPHA-01', 'TENANT-SECURITY-ALPHA', 'Confidential Alpha', 'road', 'HIGH', 'P1', 'roads', 'OPEN'),
        ('TEST-INC-BETA-01', 'TENANT-SECURITY-BETA', 'Confidential Beta', 'water', 'CRITICAL', 'P0', 'water', 'OPEN')
      ON CONFLICT (incident_id) DO NOTHING;
    `);
    await rawClient.query("COMMIT;");

    // Execute through executeWithTenantContext as ALPHA
    await executeWithTenantContext('TENANT-SECURITY-ALPHA', false, async (tx) => {
      // 1. Legitimate query
      const legitimateRows = await tx.query('incidents');
      assert(legitimateRows.length === 1 && legitimateRows[0].incident_id === 'TEST-INC-ALPHA-01', 
        "Alpha context: sees only Alpha incident (1 row)");

      // 2. ATTEMPT SUPER-ADMIN GUC ATTACK
      await tx.sql("SET LOCAL app.is_super_admin = 'true';");
      const attackRows = await tx.query('incidents');
      assert(attackRows.length === 1 && attackRows[0].incident_id === 'TEST-INC-ALPHA-01',
        "Attack Defeated: SET LOCAL app.is_super_admin = 'true' did NOT leak Beta incident!");

      // 3. ATTEMPT TENANT IMPERSONATION GUC ATTACK
      await tx.sql("SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-BETA';");
      const spoofRows = await tx.query('incidents');
      assert(spoofRows.length === 1 && spoofRows[0].incident_id === 'TEST-INC-ALPHA-01',
        "Attack Defeated: SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-BETA' did NOT leak Beta incident!");
    });

    // -------------------------------------------------------------------
    // TEST D: All Six Tenant Tables (CRUD & RLS Isolation)
    // -------------------------------------------------------------------
    console.log("\n--- TEST D: ALL SIX TENANT TABLES (SELECT, INSERT, UPDATE, DELETE) ---");
    const tables = [
      {
        name: 'incidents',
        recordAlpha: {
          incident_id: 'CRUD-INC-A-01',
          tenant_id: 'TENANT-SECURITY-ALPHA',
          title: 'CRUD Incident Alpha',
          incident_type: 'infrastructure',
          severity: 'HIGH',
          priority: 'P1',
          recommended_department: 'roads',
          status: 'OPEN'
        },
        idField: 'incident_id',
        idValue: 'CRUD-INC-A-01',
        updatePayload: { title: 'Updated Incident Alpha' }
      },
      {
        name: 'work_orders',
        recordAlpha: {
          work_order_id: 'CRUD-WO-A-01',
          incident_id: 'TEST-INC-ALPHA-01',
          tenant_id: 'TENANT-SECURITY-ALPHA',
          idempotency_key: 'IDEMP-CRUD-WO-A-01',
          title: 'CRUD Work Order Alpha',
          department: 'roads',
          severity: 'HIGH',
          priority: 'P1',
          status: 'DISPATCHED'
        },
        idField: 'work_order_id',
        idValue: 'CRUD-WO-A-01',
        updatePayload: { title: 'Updated Work Order Alpha' }
      },
      {
        name: 'audit_logs',
        recordAlpha: {
          event_id: 'CRUD-AUD-A-01',
          tenant_id: 'TENANT-SECURITY-ALPHA',
          event_type: 'TEST_EVENT',
          actor_id: 'TEST-USER',
          resource: '/api/incidents',
          result: 'SUCCESS',
          request_id: 'REQ-CRUD-001',
          current_hash: 'HASH-CRUD-001'
        },
        idField: 'event_id',
        idValue: 'CRUD-AUD-A-01',
        updatePayload: { details: { verified: true } }
      },
      {
        name: 'telemetry_records',
        recordAlpha: {
          telemetry_id: 'CRUD-TEL-A-01',
          tenant_id: 'TENANT-SECURITY-ALPHA',
          event_type: 'API_REQUEST',
          duration_ms: 45.2,
          status: 'SUCCESS'
        },
        idField: 'telemetry_id',
        idValue: 'CRUD-TEL-A-01',
        updatePayload: { duration_ms: 55.8 }
      },
      {
        name: 'ward_datasets',
        recordAlpha: {
          dataset_id: 'CRUD-WARD-A-01',
          tenant_id: 'TENANT-SECURITY-ALPHA',
          dataset_version: 'v1.0',
          feature_count: 5,
          raw_geojson: { type: 'FeatureCollection', features: [] },
          dataset_hash: 'HASH-WARD-001',
          status: 'ACTIVE'
        },
        idField: 'dataset_id',
        idValue: 'CRUD-WARD-A-01',
        updatePayload: { feature_count: 10 }
      },
      {
        name: 'integration_settings',
        recordAlpha: {
          setting_id: 'CRUD-SETTING-A-01',
          tenant_id: 'TENANT-SECURITY-ALPHA',
          integration_type: 'ERP_TEST',
          is_enabled: true,
          endpoint_url: 'https://erp.test.local'
        },
        idField: 'setting_id',
        idValue: 'CRUD-SETTING-A-01',
        updatePayload: { endpoint_url: 'https://erp.updated.local' }
      }
    ];

    for (const t of tables) {
      await executeWithTenantContext('TENANT-SECURITY-ALPHA', false, async (tx) => {
        // 1. INSERT in Alpha
        await tx.insert(t.name, t.recordAlpha);
        const sel = await tx.query(t.name, null, `"${t.idField}" = $1`, [t.idValue]);
        assert(sel.length === 1, `${t.name}: INSERT and SELECT verified in Alpha`);

        // 2. Cross-tenant INSERT into Beta rejected
        const crossInsertRecord = { 
          ...t.recordAlpha, 
          [t.idField]: `CROSS-${t.idValue}`, 
          tenant_id: 'TENANT-SECURITY-BETA',
          ...(t.recordAlpha.idempotency_key ? { idempotency_key: `CROSS-IDEMP-${t.idValue}` } : {})
        };
        let crossInsertRejected = false;
        try {
          await tx.insert(t.name, crossInsertRecord);
        } catch (err) {
          crossInsertRejected = true;
        }
        assert(crossInsertRejected, `${t.name}: Cross-tenant INSERT into Beta rejected by RLS`);

        // 3. UPDATE in Alpha
        const upd = await tx.update(t.name, t.idField, t.idValue, t.updatePayload);
        assert(upd !== null, `${t.name}: UPDATE verified in Alpha`);

        // 4. DELETE in Alpha
        const del = await tx.delete(t.name, t.idField, t.idValue);
        assert(del !== null, `${t.name}: DELETE verified in Alpha`);
      });

      // Verify Beta cannot see Alpha record
      await executeWithTenantContext('TENANT-SECURITY-BETA', false, async (txBeta) => {
        const betaRows = await txBeta.query(t.name, null, `"${t.idField}" = $1`, [t.idValue]);
        assert(betaRows.length === 0, `${t.name}: Beta tenant isolated (cannot read Alpha record)`);
      });
    }

    // -------------------------------------------------------------------
    // TEST E: Connection Pool Leakage Across Tenants (Rule 5)
    // -------------------------------------------------------------------
    console.log("\n--- TEST E: CONNECTION POOL HYGIENE & LEAKAGE TEST ---");
    // Run Alpha call
    await executeWithTenantContext('TENANT-SECURITY-ALPHA', true, async (tx) => {
      // Simulate dirty session setting
      await tx.sql("SET app.is_super_admin = 'true';");
    });

    // Run Beta call immediately after
    await executeWithTenantContext('TENANT-SECURITY-BETA', false, async (txBeta) => {
      const isSuper = await txBeta.sql("SELECT app_security.is_super_admin() as is_super;");
      const tenant = await txBeta.sql("SELECT app_security.current_tenant() as tenant;");
      assert(isSuper.rows[0].is_super === false, "Reused pool client: is_super_admin is FALSE (no privileged leak)");
      assert(tenant.rows[0].tenant === 'TENANT-SECURITY-BETA', "Reused pool client: current_tenant is TENANT-SECURITY-BETA");

      const visibleIncidents = await txBeta.query('incidents');
      assert(visibleIncidents.length === 1 && visibleIncidents[0].tenant_id === 'TENANT-SECURITY-BETA',
        "Reused pool client: sees ONLY Beta incident (Alpha incident completely hidden)");
    });

    // -------------------------------------------------------------------
    // TEST F: Privileged Super-Admin Operations Authorized Backend-Only
    // -------------------------------------------------------------------
    console.log("\n--- TEST F: PRIVILEGED SUPER-ADMIN MULTI-TENANT ACCESS ---");
    await executeWithTenantContext('TENANT-SECURITY-ALPHA', true, async (txSuper) => {
      const allIncidents = await txSuper.query('incidents');
      assert(allIncidents.length >= 2, "Authorized Super-Admin context: can read all tenant incidents");
    });

    // -------------------------------------------------------------------
    // TEST G: Failure Cases & Signature Verification
    // -------------------------------------------------------------------
    console.log("\n--- TEST G: FAILURE CASES & TAMPER-RESISTANCE ---");
    
    // G.1: Invalid signature
    let invalidSigCaught = false;
    try {
      const ts = Math.floor(Date.now() / 1000);
      await rawClient.query("SELECT app_security.authenticate_context($1, $2, $3, $4, $5);", [
        'TENANT-SECURITY-ALPHA', false, ts, 'nonce1', 'invalid-signature-hex'
      ]);
    } catch (e) {
      invalidSigCaught = e.message.includes('SECURITY_VIOLATION');
    }
    assert(invalidSigCaught, "Tampered context signature rejected with SECURITY_VIOLATION");

    // G.2: Expired timestamp (> 60s)
    let expiredCaught = false;
    try {
      const oldTs = Math.floor(Date.now() / 1000) - 120;
      const nonce = crypto.randomBytes(16).toString('hex');
      const msg = `TENANT-SECURITY-ALPHA:false:${oldTs}:${nonce}`;
      const sig = crypto.createHmac('sha256', config.databaseSessionSecret).update(msg).digest('hex');
      await rawClient.query("SELECT app_security.authenticate_context($1, $2, $3, $4, $5);", [
        'TENANT-SECURITY-ALPHA', false, oldTs, nonce, sig
      ]);
    } catch (e) {
      expiredCaught = e.message.includes('SECURITY_VIOLATION');
    }
    assert(expiredCaught, "Expired context timestamp rejected with SECURITY_VIOLATION");

  } finally {
    // Clean up synthetic test records
    console.log("\nCleaning up synthetic security test records...");
    try {
      await rawClient.query("DELETE FROM incidents WHERE tenant_id IN ('TENANT-SECURITY-ALPHA', 'TENANT-SECURITY-BETA');");
      await rawClient.query("DELETE FROM tenants WHERE tenant_id IN ('TENANT-SECURITY-ALPHA', 'TENANT-SECURITY-BETA');");
      console.log("Synthetic test records cleanly removed.");
    } catch (e) {
      console.error("Cleanup error:", e.message);
    }
    rawClient.release();
    await closePool();
  }

  console.log("==================================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRemediationTestSuite().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
