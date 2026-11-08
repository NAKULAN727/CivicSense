// CivicSense AI - Phase 12R Step 4: Controlled Privilege Escalation Test
import { getPool, closePool } from '../server/db/connection.js';

async function testPrivilegeEscalation() {
  const pool = getPool();
  const client = await pool.connect();

  console.log("=== STEP 4: CONTROLLED PRIVILEGE ESCALATION TEST ===");

  try {
    // We run inside a transaction and end with ROLLBACK
    await client.query("BEGIN;");

    console.log("\n[TEST 4.1] Seeding synthetic tenants and incidents...");
    // 1. Insert synthetic tenants
    await client.query(`
      INSERT INTO tenants (tenant_id, tenant_name, label, status, is_sandbox)
      VALUES 
        ('TENANT-SECURITY-ALPHA', 'Alpha Municipal Security Corp', 'SECURITY-TEST', 'ACTIVE', true),
        ('TENANT-SECURITY-BETA', 'Beta Municipal Security Corp', 'SECURITY-TEST', 'ACTIVE', true);
    `);

    // 2. Insert synthetic incidents
    await client.query(`
      INSERT INTO incidents (
        incident_id, tenant_id, title, incident_type, severity, priority,
        recommended_department, status
      ) VALUES 
        ('AUDIT-INC-ALPHA-001', 'TENANT-SECURITY-ALPHA', 'Alpha Confidential Incident', 'infrastructure', 'HIGH', 'P1', 'roads', 'OPEN'),
        ('AUDIT-INC-BETA-001', 'TENANT-SECURITY-BETA', 'Beta Confidential Incident', 'water', 'CRITICAL', 'P0', 'water_works', 'OPEN');
    `);
    console.log("Seeded synthetic tenants and incidents successfully.");

    // 3. Switch to civicsense_app_role
    console.log("\n[TEST 4.2] Switching to unprivileged civicsense_app_role...");
    await client.query("SET ROLE civicsense_app_role;");
    const roleCheck = await client.query("SELECT current_user, session_user;");
    console.log("Current role:", roleCheck.rows[0]);

    // 4. Set tenant context to ALPHA and super_admin = false
    console.log("\n[TEST 4.3] Setting context: tenant=TENANT-SECURITY-ALPHA, super_admin=false");
    await client.query("SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-ALPHA';");
    await client.query("SET LOCAL app.is_super_admin = 'false';");

    // Query incidents
    const q1 = await client.query("SELECT incident_id, tenant_id, title FROM incidents;");
    console.log("Query as ALPHA with super_admin=false -> Count:", q1.rows.length);
    console.log("Visible rows:", q1.rows);

    // 5. ATTEMPT PRIVILEGE ESCALATION VIA SET LOCAL app.is_super_admin = 'true'
    console.log("\n[TEST 4.4] EXPLOIT ATTEMPT: executing SET LOCAL app.is_super_admin = 'true' under civicsense_app_role...");
    let escalationSucceeded = false;
    try {
      await client.query("SET LOCAL app.is_super_admin = 'true';");
      escalationSucceeded = true;
      console.log("-> SET LOCAL app.is_super_admin = 'true' EXECUTED WITHOUT PERMISSION DENIAL!");
    } catch (err) {
      console.log("-> SET LOCAL app.is_super_admin = 'true' REJECTED:", err.message);
    }

    // 6. If executed, attempt to read BETA records
    if (escalationSucceeded) {
      const q2 = await client.query("SELECT incident_id, tenant_id, title FROM incidents;");
      console.log("Query after SET LOCAL app.is_super_admin = 'true' -> Count:", q2.rows.length);
      console.log("Visible rows:", q2.rows);
      const sawBeta = q2.rows.some(r => r.tenant_id === 'TENANT-SECURITY-BETA');
      if (sawBeta) {
        console.log("CRITICAL FINDING: civicsense_app_role successfully bypassed RLS and read cross-tenant BETA record via SET LOCAL app.is_super_admin = 'true'!");
      }
    }

    // 7. ATTEMPT ARBITRARY TENANT SPOOFING VIA app.current_tenant_id
    console.log("\n[TEST 4.5] EXPLOIT ATTEMPT: executing SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-BETA'...");
    await client.query("SET LOCAL app.is_super_admin = 'false';");
    await client.query("SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-BETA';");
    const q3 = await client.query("SELECT incident_id, tenant_id, title FROM incidents;");
    console.log("Query after spoofing app.current_tenant_id = 'TENANT-SECURITY-BETA' -> Count:", q3.rows.length);
    console.log("Visible rows:", q3.rows);
    const sawBetaSpoofed = q3.rows.some(r => r.tenant_id === 'TENANT-SECURITY-BETA');
    if (sawBetaSpoofed) {
      console.log("CRITICAL FINDING: civicsense_app_role successfully spoofed tenant context directly via SET LOCAL app.current_tenant_id!");
    }

    // 8. ATTEMPT SESSION-LEVEL GUC MANIPULATION
    console.log("\n[TEST 4.6] EXPLOIT ATTEMPT: Session-level SET app.is_super_admin = 'true'...");
    try {
      await client.query("SET app.is_super_admin = 'true';");
      console.log("-> Session-level SET app.is_super_admin = 'true' EXECUTED WITHOUT ERROR!");
    } catch (err) {
      console.log("-> Session-level SET app.is_super_admin = 'true' REJECTED:", err.message);
    }

    // 9. Test RESET app.is_super_admin
    console.log("\n[TEST 4.7] Testing RESET app.is_super_admin...");
    try {
      await client.query("RESET app.is_super_admin;");
      console.log("-> RESET app.is_super_admin EXECUTED WITHOUT ERROR.");
    } catch (err) {
      console.log("-> RESET app.is_super_admin REJECTED:", err.message);
    }

  } catch (err) {
    console.error("Test execution caught error:", err);
  } finally {
    // Clean rollback
    console.log("\n[ROLLBACK] Rolling back transaction...");
    try {
      await client.query("ROLLBACK;");
      await client.query("RESET ROLE;");
      console.log("Rollback and role reset complete.");
    } catch (e) {
      console.error("Error during rollback/reset:", e.message);
    }
    client.release();
  }

  // 10. Verify zero synthetic records persist
  const verifyClient = await pool.connect();
  try {
    const v = await verifyClient.query("SELECT count(*) FROM incidents WHERE tenant_id IN ('TENANT-SECURITY-ALPHA', 'TENANT-SECURITY-BETA');");
    const vt = await verifyClient.query("SELECT count(*) FROM tenants WHERE tenant_id IN ('TENANT-SECURITY-ALPHA', 'TENANT-SECURITY-BETA');");
    console.log("\n[VERIFICATION] Synthetic incidents remaining in DB:", v.rows[0].count);
    console.log("[VERIFICATION] Synthetic tenants remaining in DB:", vt.rows[0].count);
  } finally {
    verifyClient.release();
    await closePool();
  }
}

testPrivilegeEscalation().catch(console.error);
