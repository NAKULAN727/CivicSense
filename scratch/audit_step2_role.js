// CivicSense AI - Phase 12R Database Role Inspection (Step 2)
import { getPool, closePool } from '../server/db/connection.js';

async function inspectRole() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
          rolname,
          rolsuper,
          rolcreaterole,
          rolcreatedb,
          rolinherit,
          rolbypassrls
      FROM pg_roles
      WHERE rolname = 'civicsense_app_role';
    `);

    console.log("ROLE_ATTRIBUTES:", res.rows[0]);

    // Check grants on tables
    const grantsRes = await client.query(`
      SELECT table_name, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE grantee = 'civicsense_app_role' AND table_schema = 'public'
      ORDER BY table_name, privilege_type;
    `);

    console.log("GRANTS_COUNT:", grantsRes.rows.length);
    const tablePrivs = {};
    for (const g of grantsRes.rows) {
      if (!tablePrivs[g.table_name]) tablePrivs[g.table_name] = [];
      tablePrivs[g.table_name].push(g.privilege_type);
    }
    console.log("TABLE_PRIVILEGES:", tablePrivs);

    // Check memberships
    const memRes = await client.query(`
      SELECT r.rolname as role, m.rolname as member
      FROM pg_auth_members am
      JOIN pg_roles r ON r.oid = am.roleid
      JOIN pg_roles m ON m.oid = am.member
      WHERE m.rolname = 'civicsense_app_role' OR r.rolname = 'civicsense_app_role';
    `);
    console.log("MEMBERSHIPS:", memRes.rows);

  } finally {
    client.release();
    await closePool();
  }
}

inspectRole().catch(console.error);

