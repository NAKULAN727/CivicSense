import { getPool, closePool } from '../server/db/connection.js';

async function checkCleanState() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const t = await client.query("SELECT count(*) FROM tenants WHERE tenant_id LIKE 'TENANT-SECURITY%';");
    const inc = await client.query("SELECT count(*) FROM incidents WHERE tenant_id LIKE 'TENANT-SECURITY%';");
    const wo = await client.query("SELECT count(*) FROM work_orders WHERE tenant_id LIKE 'TENANT-SECURITY%';");
    const aud = await client.query("SELECT count(*) FROM audit_logs WHERE tenant_id LIKE 'TENANT-SECURITY%';");
    const tel = await client.query("SELECT count(*) FROM telemetry_records WHERE tenant_id LIKE 'TENANT-SECURITY%';");
    const ward = await client.query("SELECT count(*) FROM ward_datasets WHERE tenant_id LIKE 'TENANT-SECURITY%';");
    const set = await client.query("SELECT count(*) FROM integration_settings WHERE tenant_id LIKE 'TENANT-SECURITY%';");

    console.log("Residual test records in production database:");
    console.log("- tenants:", t.rows[0].count);
    console.log("- incidents:", inc.rows[0].count);
    console.log("- work_orders:", wo.rows[0].count);
    console.log("- audit_logs:", aud.rows[0].count);
    console.log("- telemetry_records:", tel.rows[0].count);
    console.log("- ward_datasets:", ward.rows[0].count);
    console.log("- integration_settings:", set.rows[0].count);
  } finally {
    client.release();
    await closePool();
  }
}

checkCleanState().catch(console.error);

