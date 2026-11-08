// CivicSense AI - Prototype RLS Hardening End-to-End Test
import crypto from 'node:crypto';
import { getPool, closePool } from '../server/db/connection.js';

async function testRLSHardening() {
  const pool = getPool();
  const client = await pool.connect();

  console.log("=== TESTING RLS HARDENING WITH APP_SECURITY FUNCTIONS ===");

  try {
    await client.query("BEGIN;");

    // 1. Setup app_security
    await client.query("CREATE SCHEMA IF NOT EXISTS app_security;");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_security.auth_secrets (
        key_id VARCHAR(64) PRIMARY KEY,
        secret TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS app_security.session_contexts (
        pid INT PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        is_super_admin BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMPTZ NOT NULL
      );
      REVOKE ALL ON SCHEMA app_security FROM PUBLIC, civicsense_app_role;
      GRANT USAGE ON SCHEMA app_security TO PUBLIC, civicsense_app_role;
      REVOKE ALL ON ALL TABLES IN SCHEMA app_security FROM PUBLIC, civicsense_app_role;
    `);

    const testSecret = 'civicsense-prototype-test-secret-32-chars';
    await client.query(`
      INSERT INTO app_security.auth_secrets (key_id, secret)
      VALUES ('active', $1)
      ON CONFLICT (key_id) DO UPDATE SET secret = EXCLUDED.secret;
    `, [testSecret]);

    // Functions
    await client.query(`
      CREATE OR REPLACE FUNCTION app_security.authenticate_context(
        p_tenant_id TEXT,
        p_is_super_admin BOOLEAN,
        p_timestamp BIGINT,
        p_nonce TEXT,
        p_signature TEXT
      ) RETURNS BOOLEAN AS $$
      DECLARE
        v_secret TEXT;
        v_message TEXT;
        v_expected TEXT;
        v_now BIGINT;
      BEGIN
        SELECT secret INTO v_secret FROM app_security.auth_secrets WHERE key_id = 'active';
        IF v_secret IS NULL THEN
          RAISE EXCEPTION 'SECURITY_CONFIG_ERROR: Database signing secret unconfigured';
        END IF;

        v_now := EXTRACT(EPOCH FROM NOW())::BIGINT;
        IF ABS(v_now - p_timestamp) > 60 THEN
          RAISE EXCEPTION 'SECURITY_VIOLATION: Context timestamp expired or skewed';
        END IF;

        v_message := p_tenant_id || ':' || (CASE WHEN p_is_super_admin THEN 'true' ELSE 'false' END) || ':' || p_timestamp::text || ':' || p_nonce;
        v_expected := encode(extensions.hmac(v_message::bytea, v_secret::bytea, 'sha256'), 'hex');

        IF p_signature IS NULL OR v_expected != p_signature THEN
          RAISE EXCEPTION 'SECURITY_VIOLATION: Invalid or forged tenant context signature';
        END IF;

        INSERT INTO app_security.session_contexts (pid, tenant_id, is_super_admin, expires_at)
        VALUES (pg_backend_pid(), p_tenant_id, p_is_super_admin, NOW() + INTERVAL '120 seconds')
        ON CONFLICT (pid) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          is_super_admin = EXCLUDED.is_super_admin,
          expires_at = EXCLUDED.expires_at;

        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = app_security, extensions, pg_catalog;

      CREATE OR REPLACE FUNCTION app_security.current_tenant() RETURNS VARCHAR(64) AS $$
        SELECT tenant_id FROM app_security.session_contexts 
        WHERE pid = pg_backend_pid() AND expires_at > NOW();
      $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app_security, pg_catalog;

      CREATE OR REPLACE FUNCTION app_security.is_super_admin() RETURNS BOOLEAN AS $$
        SELECT COALESCE(
          (SELECT is_super_admin FROM app_security.session_contexts 
           WHERE pid = pg_backend_pid() AND expires_at > NOW()),
          false
        );
      $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = app_security, pg_catalog;

      CREATE OR REPLACE FUNCTION app_security.clear_context() RETURNS VOID AS $$
        DELETE FROM app_security.session_contexts WHERE pid = pg_backend_pid();
      $$ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = app_security, pg_catalog;

      GRANT EXECUTE ON FUNCTION app_security.authenticate_context TO PUBLIC, civicsense_app_role;
      GRANT EXECUTE ON FUNCTION app_security.current_tenant TO PUBLIC, civicsense_app_role;
      GRANT EXECUTE ON FUNCTION app_security.is_super_admin TO PUBLIC, civicsense_app_role;
      GRANT EXECUTE ON FUNCTION app_security.clear_context TO PUBLIC, civicsense_app_role;
    `);

    // 2. Temporarily update RLS policy on incidents
    await client.query("DROP POLICY IF EXISTS tenant_isolation_incidents ON incidents;");
    await client.query(`
      CREATE POLICY tenant_isolation_incidents ON incidents
      FOR ALL
      TO PUBLIC
      USING (
        app_security.is_super_admin() = true
        OR tenant_id = app_security.current_tenant()
      )
      WITH CHECK (
        app_security.is_super_admin() = true
        OR tenant_id = app_security.current_tenant()
      );
    `);

    // 3. Seed test tenants and incidents
    await client.query(`
      INSERT INTO tenants (tenant_id, tenant_name, label, status, is_sandbox)
      VALUES 
        ('TENANT-SECURITY-ALPHA', 'Alpha Corp', 'SECURITY-TEST', 'ACTIVE', true),
        ('TENANT-SECURITY-BETA', 'Beta Corp', 'SECURITY-TEST', 'ACTIVE', true);

      INSERT INTO incidents (
        incident_id, tenant_id, title, incident_type, severity, priority,
        recommended_department, status
      ) VALUES 
        ('INC-ALPHA-01', 'TENANT-SECURITY-ALPHA', 'Alpha Data', 'infrastructure', 'HIGH', 'P1', 'roads', 'OPEN'),
        ('INC-BETA-01', 'TENANT-SECURITY-BETA', 'Beta Data', 'water', 'CRITICAL', 'P0', 'water', 'OPEN');
    `);

    // 4. Drop to civicsense_app_role
    await client.query("SET ROLE civicsense_app_role;");

    // Case A: Unauthenticated context -> should return 0 rows
    const resUnauth = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("Unauthenticated query row count (expected 0):", resUnauth.rows.length);

    // Case B: Authenticate as ALPHA
    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    const msgAlpha = `TENANT-SECURITY-ALPHA:false:${ts}:${nonce}`;
    const sigAlpha = crypto.createHmac('sha256', testSecret).update(msgAlpha).digest('hex');
    await client.query("SELECT app_security.authenticate_context($1, $2, $3, $4, $5);", ['TENANT-SECURITY-ALPHA', false, ts, nonce, sigAlpha]);

    const resAlpha = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("Alpha authenticated query row count (expected 1):", resAlpha.rows.length);
    console.log("Alpha returned records:", resAlpha.rows);

    // Case C: ATTEMPT SUPER ADMIN GUC BYPASS ATTACK
    console.log("\nAttempting SET LOCAL app.is_super_admin = 'true' attack...");
    await client.query("SET LOCAL app.is_super_admin = 'true';");
    const resAttack = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("Query after GUC bypass attack (expected STILL 1):", resAttack.rows.length);
    console.log("Visible records:", resAttack.rows);
    if (resAttack.rows.length === 1 && resAttack.rows[0].tenant_id === 'TENANT-SECURITY-ALPHA') {
      console.log("SUCCESS: GUC bypass attack COMPLETELY DEFEATED! Beta record was NOT leaked.");
    } else {
      console.log("FAILURE: GUC bypass leaked data!");
    }

    // Case D: ATTEMPT TENANT GUC SPOOFING ATTACK
    console.log("\nAttempting SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-BETA' attack...");
    await client.query("SET LOCAL app.current_tenant_id = 'TENANT-SECURITY-BETA';");
    const resSpoof = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("Query after GUC spoof attack (expected STILL 1):", resSpoof.rows.length);
    console.log("Visible records:", resSpoof.rows);
    if (resSpoof.rows.length === 1 && resSpoof.rows[0].tenant_id === 'TENANT-SECURITY-ALPHA') {
      console.log("SUCCESS: GUC tenant spoof attack COMPLETELY DEFEATED!");
    } else {
      console.log("FAILURE: Tenant spoof succeeded!");
    }

    // Case E: Authenticate as SUPER-ADMIN with valid signature
    const nonceSA = crypto.randomBytes(16).toString('hex');
    const msgSA = `TENANT-SECURITY-ALPHA:true:${ts}:${nonceSA}`;
    const sigSA = crypto.createHmac('sha256', testSecret).update(msgSA).digest('hex');
    await client.query("SELECT app_security.authenticate_context($1, $2, $3, $4, $5);", ['TENANT-SECURITY-ALPHA', true, ts, nonceSA, sigSA]);

    const resSA = await client.query("SELECT incident_id, tenant_id FROM incidents;");
    console.log("\nSuper-Admin authenticated query row count (expected 2):", resSA.rows.length);
    console.log("Visible records:", resSA.rows.map(r => r.tenant_id));

  } finally {
    await client.query("RESET ROLE;");
    await client.query("ROLLBACK;");
    client.release();
    await closePool();
  }
}

testRLSHardening().catch(console.error);

