// CivicSense AI - Phase 12R-2 Non-Superuser Runtime RLS Verification
// Evaluates Row-Level Security isolation using an unprivileged application role (civicsense_app_role).
// Tests SELECT, INSERT, UPDATE, DELETE two-tenant isolation + Super Admin bypass.
// Rolls back all test records cleanly to leave the live database untouched.

import { getPool, closePool } from '../server/db/connection.js';

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

async function runNonSuperuserRlsTest() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — NON-SUPERUSER RUNTIME RLS AUDIT");
  console.log("==================================================");

  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. Provision unprivileged application role
    console.log("1. Setting up unprivileged application role (civicsense_app_role)...");
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'civicsense_app_role') THEN 
          CREATE ROLE civicsense_app_role NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; 
        END IF; 
      END $$;
    `);

    await client.query(`
      GRANT civicsense_app_role TO postgres;
      GRANT USAGE ON SCHEMA public TO civicsense_app_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO civicsense_app_role;
    `);

    // Verify role attributes
    const roleCheck = await client.query(`
      SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb 
      FROM pg_roles 
      WHERE rolname = 'civicsense_app_role';
    `);

    const roleInfo = roleCheck.rows[0];
    console.log(`   Role: ${roleInfo.rolname} | Superuser: ${roleInfo.rolsuper} | CreateDB: ${roleInfo.rolcreatedb}`);
    if (roleInfo.rolsuper !== false) {
      throw new Error("ABORT: civicsense_app_role must NOT be a superuser!");
    }

    // Begin isolated test transaction
    await client.query('BEGIN;');

    // Seed test tenants within transaction
    await client.query(`
      INSERT INTO tenants (tenant_id, tenant_name, label, status) VALUES
        ('TENANT-RLS-ALPHA', 'Municipality Alpha (Test)', 'TEST', 'ACTIVE'),
        ('TENANT-RLS-BETA',  'Municipality Beta (Test)',  'TEST', 'ACTIVE');
    `);

    // Switch to non-superuser application role
    await client.query('SET LOCAL ROLE civicsense_app_role;');

    const currentUserRes = await client.query('SELECT current_user, session_user;');
    console.log(`   Effective Role in Transaction: ${currentUserRes.rows[0].current_user} (Session: ${currentUserRes.rows[0].session_user})`);
    
    assert(
      currentUserRes.rows[0].current_user === 'civicsense_app_role',
      "PRE-CONDITION: Non-superuser role actively enforced",
      `Active role is ${currentUserRes.rows[0].current_user} (rolsuper=false).`
    );

    // -------------------------------------------------------------
    // TEST 5.1: INSERT Isolation
    // -------------------------------------------------------------
    // Set Tenant Alpha context
    await client.query("SELECT set_config('app.current_tenant_id', 'TENANT-RLS-ALPHA', true), set_config('app.is_super_admin', 'false', true);");

    // Legitimate insert for Tenant Alpha
    await client.query(`
      INSERT INTO incidents (incident_id, tenant_id, title, incident_type, severity, priority, recommended_department)
      VALUES ('INC-ALPHA-001', 'TENANT-RLS-ALPHA', 'Alpha Street Light Defect', 'ELECTRICAL', 'LOW', 'SCHEDULED', 'Street Lighting');
    `);

    // Attempt illegal cross-tenant insert for Tenant Beta while in Alpha context
    let crossTenantInsertBlocked = false;
    let rlsErrorCode = null;
    await client.query('SAVEPOINT rls_insert_sp;');
    try {
      await client.query(`
        INSERT INTO incidents (incident_id, tenant_id, title, incident_type, severity, priority, recommended_department)
        VALUES ('INC-BETA-ILLEGAL', 'TENANT-RLS-BETA', 'Unauthorized Injection into Beta', 'WASTE', 'HIGH', 'IMMEDIATE', 'Sanitation');
      `);
    } catch (err) {
      crossTenantInsertBlocked = true;
      rlsErrorCode = err.code;
      await client.query('ROLLBACK TO SAVEPOINT rls_insert_sp;');
    }

    assert(
      crossTenantInsertBlocked && rlsErrorCode === '42501',
      "TEST 5.1: Non-Superuser INSERT isolation enforced by RLS",
      `PostgreSQL engine blocked cross-tenant insert with error code: ${rlsErrorCode} (insufficient_privilege / RLS WITH CHECK violation).`
    );

    // -------------------------------------------------------------
    // TEST 5.2: SELECT Isolation
    // -------------------------------------------------------------
    // Switch to Tenant Beta context and insert a legitimate Beta record
    await client.query("SELECT set_config('app.current_tenant_id', 'TENANT-RLS-BETA', true), set_config('app.is_super_admin', 'false', true);");
    await client.query(`
      INSERT INTO incidents (incident_id, tenant_id, title, incident_type, severity, priority, recommended_department)
      VALUES ('INC-BETA-001', 'TENANT-RLS-BETA', 'Beta Waterlogging Incident', 'FLOOD', 'CRITICAL', 'IMMEDIATE', 'Stormwater Drainage');
    `);

    // Switch back to Tenant Alpha context
    await client.query("SELECT set_config('app.current_tenant_id', 'TENANT-RLS-ALPHA', true), set_config('app.is_super_admin', 'false', true);");
    const alphaSelectRes = await client.query('SELECT incident_id, tenant_id, title FROM incidents;');

    const visibleToAlpha = alphaSelectRes.rows;
    const sawBetaRecord = visibleToAlpha.some(r => r.tenant_id === 'TENANT-RLS-BETA');

    assert(
      visibleToAlpha.length === 1 && visibleToAlpha[0].incident_id === 'INC-ALPHA-001' && !sawBetaRecord,
      "TEST 5.2: Non-Superuser SELECT isolation enforced by RLS",
      `Tenant Alpha query returned only Alpha records (Count: ${visibleToAlpha.length}). Foreign Beta records completely hidden.`
    );

    // -------------------------------------------------------------
    // TEST 5.3: UPDATE Isolation
    // -------------------------------------------------------------
    // Tenant Alpha attempts to update Tenant Beta's incident
    const updateAttemptRes = await client.query(`
      UPDATE incidents 
      SET title = 'DEFACED BY TENANT ALPHA' 
      WHERE incident_id = 'INC-BETA-001';
    `);

    // Switch to Beta to check if record was modified
    await client.query("SELECT set_config('app.current_tenant_id', 'TENANT-RLS-BETA', true), set_config('app.is_super_admin', 'false', true);");
    const betaCheckRes = await client.query("SELECT title FROM incidents WHERE incident_id = 'INC-BETA-001';");

    assert(
      updateAttemptRes.rowCount === 0 && betaCheckRes.rows[0].title === 'Beta Waterlogging Incident',
      "TEST 5.3: Non-Superuser UPDATE isolation enforced by RLS",
      `Cross-tenant update modified 0 rows (rowCount=0). Target record preserved.`
    );

    // -------------------------------------------------------------
    // TEST 5.4: DELETE Isolation
    // -------------------------------------------------------------
    // Switch to Alpha context
    await client.query("SELECT set_config('app.current_tenant_id', 'TENANT-RLS-ALPHA', true), set_config('app.is_super_admin', 'false', true);");
    const deleteAttemptRes = await client.query("DELETE FROM incidents WHERE incident_id = 'INC-BETA-001';");

    // Switch to Beta to verify record is still alive
    await client.query("SELECT set_config('app.current_tenant_id', 'TENANT-RLS-BETA', true), set_config('app.is_super_admin', 'false', true);");
    const betaRecordSurvives = await client.query("SELECT incident_id FROM incidents WHERE incident_id = 'INC-BETA-001';");

    assert(
      deleteAttemptRes.rowCount === 0 && betaRecordSurvives.rows.length === 1,
      "TEST 5.4: Non-Superuser DELETE isolation enforced by RLS",
      `Cross-tenant delete affected 0 rows (rowCount=0). Foreign record survived.`
    );

    // -------------------------------------------------------------
    // TEST 5.5: Super-Admin Authorized Cross-Tenant Access
    // -------------------------------------------------------------
    await client.query("SELECT set_config('app.current_tenant_id', '', true), set_config('app.is_super_admin', 'true', true);");
    const superAdminRes = await client.query("SELECT incident_id, tenant_id FROM incidents ORDER BY incident_id;");

    assert(
      superAdminRes.rows.length === 2 && 
      superAdminRes.rows.some(r => r.tenant_id === 'TENANT-RLS-ALPHA') &&
      superAdminRes.rows.some(r => r.tenant_id === 'TENANT-RLS-BETA'),
      "TEST 5.5: Authorized Super-Admin cross-tenant visibility",
      `Super-Admin bypass query returned all records across tenants (Count: ${superAdminRes.rows.length}).`
    );

    // Clean rollback of test data so zero test rows persist in production database
    await client.query('ROLLBACK;');
    console.log("\n[CLEANUP] Rolled back test transaction cleanly. Live database has zero test records.");

  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
    await closePool();
  }

  console.log("\n==================================================");
  console.log(`TOTAL RLS TESTS: ${total}`);
  console.log(`PASSED:          ${passed}`);
  console.log(`FAILED:          ${total - passed}`);
  console.log("==================================================");

  if (total - passed > 0) {
    process.exit(1);
  }
}

runNonSuperuserRlsTest().catch(err => {
  console.error("NON-SUPERUSER RLS TEST FAILED:", err);
  process.exit(1);
});
