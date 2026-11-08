// CivicSense AI - Phase 12R Test postgres role bypassrls behavior
import { getPool, closePool } from '../server/db/connection.js';

async function testPostgresBypassRls() {
  const pool = getPool();
  const client = await pool.connect();

  console.log("=== TESTING POSTGRES ROLE BYPASSRLS WITH FORCE ROW LEVEL SECURITY ===");

  try {
    await client.query("BEGIN;");

    // Seed test tenants
    await client.query(`
      INSERT INTO tenants (tenant_id, tenant_name, label, status, is_sandbox)
      VALUES 
        ('TENANT-SECURITY-ALPHA', 'Alpha Municipal Security Corp', 'SECURITY-TEST', 'ACTIVE', true),
        ('TENANT-SECURITY-BETA', 'Beta Municipal Security Corp', 'SECURITY-TEST', 'ACTIVE', true);
    `);

    // Seed test incidents
    await client.query(`
      INSERT INTO incidents (
        incident_id, tenant_id, title, incident_type, severity, priority,
        recommended_department, status
      ) VALUES 
        ('AUDIT-INC-ALPHA-001', 'TENANT-SECURITY-ALPHA', 'Alpha Confidential Incident', 'infrastructure', 'HIGH', 'P1', 'roads', 'OPEN'),
        ('AUDIT-INC-BETA-001', 'TENANT-SECURITY-BETA', 'Beta Confidential Incident', 'water', 'CRITICAL', 'P0', 'water_works', 'OPEN');
    `);

    // Under postgres role (WITHOUT switching role, WITHOUT setting tenant context):
    console.log("Current user:", (await client.query("SELECT current_user, session_user;")).rows[0]);
    
    // Set tenant context to ALPHA only
    await client.query("SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-ALPHA';");
    await client.query("SET LOCAL app.is_super_admin = 'false';");

    const res = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("Query as postgres role with tenant=ALPHA and super_admin=false:");
    console.log("Returned row count:", res.rows.length);
    console.log("Rows:", res.rows);

    // Now test with SET ROLE civicsense_app_role
    await client.query("SET ROLE civicsense_app_role;");
    console.log("\nAfter SET ROLE civicsense_app_role:");
    console.log("Current user:", (await client.query("SELECT current_user, session_user;")).rows[0]);
    const resRole = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("Query as civicsense_app_role with tenant=ALPHA and super_admin=false:");
    console.log("Returned row count:", resRole.rows.length);
    console.log("Rows:", resRole.rows);

  } finally {
    await client.query("ROLLBACK;");
    await client.query("RESET ROLE;");
    client.release();
    await closePool();
  }
}

testPostgresBypassRls().catch(console.error);

