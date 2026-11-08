// CivicSense AI - Phase 12R Step 6: Connection Pool Context Leak Test
import { getPool, closePool } from '../server/db/connection.js';

async function testPoolLeak() {
  const pool = getPool();
  console.log("=== STEP 6: CONNECTION POOL CONTEXT LEAK TEST ===");

  // TEST 6.1: Transaction-local set_config(..., ..., true) lifecycle
  console.log("\n[TEST 6.1] Transaction-local set_config lifecycle on Commit/Rollback:");
  const client1 = await pool.connect();
  try {
    await client1.query("BEGIN;");
    await client1.query("SELECT set_config('app.current_tenant_id', 'TENANT-LEAK-ALPHA', true), set_config('app.is_super_admin', 'true', true);");
    
    const inTx = await client1.query("SELECT current_setting('app.current_tenant_id', true) as tenant, current_setting('app.is_super_admin', true) as super_admin;");
    console.log("Inside transaction:", inTx.rows[0]);

    await client1.query("COMMIT;");

    const afterCommit = await client1.query("SELECT current_setting('app.current_tenant_id', true) as tenant, current_setting('app.is_super_admin', true) as super_admin;");
    console.log("After COMMIT on same client:", afterCommit.rows[0]);
  } finally {
    client1.release();
  }

  // TEST 6.2: Session-level SET without DISCARD ALL / RESET ALL
  console.log("\n[TEST 6.2] Session-level SET leakage across client.release() and re-acquisition:");
  const clientA = await pool.connect();
  let clientAProcessId;
  try {
    const pidRes = await clientA.query("SELECT pg_backend_pid();");
    clientAProcessId = pidRes.rows[0].pg_backend_pid;
    console.log("Client A backend PID:", clientAProcessId);

    // Malicious or accidental session-level SET
    await clientA.query("SET app.current_tenant_id = 'LEAKED-TENANT-ALPHA';");
    await clientA.query("SET app.is_super_admin = 'true';");
    console.log("Client A set session-level GUCs.");
  } finally {
    // Note: standard pg client.release() does NOT execute DISCARD ALL unless configured
    clientA.release();
    console.log("Client A released back to pool.");
  }

  // Now acquire another client and test if any client re-uses that PID or has dirty GUCs
  const clientB = await pool.connect();
  try {
    const pidResB = await clientB.query("SELECT pg_backend_pid();");
    console.log("Client B backend PID:", pidResB.rows[0].pg_backend_pid);
    const leakedGUCs = await clientB.query("SELECT current_setting('app.current_tenant_id', true) as tenant, current_setting('app.is_super_admin', true) as super_admin;");
    console.log("Client B GUC state:", leakedGUCs.rows[0]);
    if (leakedGUCs.rows[0].tenant === 'LEAKED-TENANT-ALPHA' || leakedGUCs.rows[0].super_admin === 'true') {
      console.log("CRITICAL FINDING: Session-level GUC LEAKED across pooled connection!");
    } else {
      console.log("GUC did not leak to Client B (possibly different backend connection).");
    }

    // Clean up session GUCs on client B just in case
    await clientB.query("RESET ALL;");
  } finally {
    clientB.release();
  }

  // TEST 6.3: Does executeWithTenantContext isolate consecutive calls?
  console.log("\n[TEST 6.3] Testing executeWithTenantContext isolation between calls:");
  const { executeWithTenantContext } = await import('../server/db/connection.js');

  await executeWithTenantContext('TENANT-CALL-1', true, async (tx) => {
    const res = await tx.sql("SELECT current_setting('app.current_tenant_id', true) as tenant, current_setting('app.is_super_admin', true) as super;");
    console.log("Call 1 (Super Admin):", res.rows[0]);
  });

  await executeWithTenantContext('TENANT-CALL-2', false, async (tx) => {
    const res = await tx.sql("SELECT current_setting('app.current_tenant_id', true) as tenant, current_setting('app.is_super_admin', true) as super;");
    console.log("Call 2 (Ordinary Tenant):", res.rows[0]);
    if (res.rows[0].super === 'true') {
      console.log("CRITICAL LEAK: Call 2 inherited super-admin from Call 1!");
    } else {
      console.log("PASS: Call 2 has super=false, tenant=TENANT-CALL-2.");
    }
  });

  await closePool();
}

testPoolLeak().catch(console.error);

