// CivicSense AI - Prototype Cryptographic Session Context
import crypto from 'node:crypto';
import { getPool, closePool } from '../server/db/connection.js';

async function testPrototype() {
  const pool = getPool();
  const client = await pool.connect();

  console.log("=== PROTOTYPE CRYPTOGRAPHIC SESSION CONTEXT ===");

  try {
    await client.query("BEGIN;");

    // 1. Create app_security schema
    await client.query("CREATE SCHEMA IF NOT EXISTS app_security;");

    // 2. Create signing secrets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_security.auth_secrets (
        key_id VARCHAR(64) PRIMARY KEY,
        secret TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Create session contexts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_security.session_contexts (
        pid INT PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        is_super_admin BOOLEAN NOT NULL DEFAULT false,
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    // Restrict permissions
    await client.query("REVOKE ALL ON SCHEMA app_security FROM PUBLIC, civicsense_app_role;");
    await client.query("GRANT USAGE ON SCHEMA app_security TO PUBLIC, civicsense_app_role;");
    await client.query("REVOKE ALL ON ALL TABLES IN SCHEMA app_security FROM PUBLIC, civicsense_app_role;");

    // Seed test secret
    const testSecret = 'civicsense-prototype-test-secret-32-chars';
    await client.query(`
      INSERT INTO app_security.auth_secrets (key_id, secret)
      VALUES ('active', $1)
      ON CONFLICT (key_id) DO UPDATE SET secret = EXCLUDED.secret;
    `, [testSecret]);

    // 4. Create authentication and context functions
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
        -- 1. Fetch secret
        SELECT secret INTO v_secret FROM app_security.auth_secrets WHERE key_id = 'active';
        IF v_secret IS NULL THEN
          RAISE EXCEPTION 'SECURITY_CONFIG_ERROR: Database signing secret unconfigured';
        END IF;

        -- 2. Check expiration (valid within 60 seconds)
        v_now := EXTRACT(EPOCH FROM NOW())::BIGINT;
        IF ABS(v_now - p_timestamp) > 60 THEN
          RAISE EXCEPTION 'SECURITY_VIOLATION: Context timestamp expired or skewed (skew: %s)', (v_now - p_timestamp);
        END IF;

        -- 3. Verify HMAC signature
        v_message := p_tenant_id || ':' || (CASE WHEN p_is_super_admin THEN 'true' ELSE 'false' END) || ':' || p_timestamp::text || ':' || p_nonce;
        v_expected := encode(extensions.hmac(v_message::bytea, v_secret::bytea, 'sha256'), 'hex');

        IF p_signature IS NULL OR v_expected != p_signature THEN
          RAISE EXCEPTION 'SECURITY_VIOLATION: Invalid or forged tenant context signature';
        END IF;

        -- 4. Store verified context for this backend PID
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

    console.log("Functions created successfully.");

    // 5. Test valid HMAC authentication
    const tenantId = 'TENANT-SECURITY-ALPHA';
    const isSuperAdmin = false;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    const msg = `${tenantId}:${isSuperAdmin ? 'true' : 'false'}:${timestamp}:${nonce}`;
    const sig = crypto.createHmac('sha256', testSecret).update(msg).digest('hex');

    const authRes = await client.query(
      "SELECT app_security.authenticate_context($1, $2, $3, $4, $5);",
      [tenantId, isSuperAdmin, timestamp, nonce, sig]
    );
    console.log("authenticate_context result:", authRes.rows[0]);

    const tenantRes = await client.query("SELECT app_security.current_tenant(), app_security.is_super_admin();");
    console.log("Current context from DB functions:", tenantRes.rows[0]);

    // 6. Test invalid / forged HMAC authentication using SAVEPOINT
    await client.query("SAVEPOINT forgery_test;");
    try {
      await client.query(
        "SELECT app_security.authenticate_context($1, $2, $3, $4, $5);",
        ['TENANT-SECURITY-BETA', true, timestamp, nonce, 'forged-signature-12345']
      );
      console.log("ERROR: Forged signature was NOT rejected!");
    } catch (e) {
      console.log("SUCCESS: Forged signature rejected with error:", e.message);
      await client.query("ROLLBACK TO SAVEPOINT forgery_test;");
    }

    // 7. Test direct manipulation by civicsense_app_role
    console.log("\nTesting direct tampering under civicsense_app_role...");
    await client.query("SET ROLE civicsense_app_role;");
    
    // Can civicsense_app_role read or write session_contexts table directly?
    await client.query("SAVEPOINT tamper_select;");
    try {
      await client.query("SELECT * FROM app_security.session_contexts;");
      console.log("ERROR: civicsense_app_role read session_contexts table!");
    } catch (e) {
      console.log("SUCCESS: civicsense_app_role SELECT rejected:", e.message);
      await client.query("ROLLBACK TO SAVEPOINT tamper_select;");
    }

    await client.query("SAVEPOINT tamper_update;");
    try {
      await client.query("UPDATE app_security.session_contexts SET is_super_admin = true;");
      console.log("ERROR: civicsense_app_role updated session_contexts table!");
    } catch (e) {
      console.log("SUCCESS: civicsense_app_role UPDATE rejected:", e.message);
      await client.query("ROLLBACK TO SAVEPOINT tamper_update;");
    }

    // Can civicsense_app_role read auth_secrets table?
    await client.query("SAVEPOINT tamper_secrets;");
    try {
      await client.query("SELECT * FROM app_security.auth_secrets;");
      console.log("ERROR: civicsense_app_role read auth_secrets table!");
    } catch (e) {
      console.log("SUCCESS: civicsense_app_role auth_secrets SELECT rejected:", e.message);
      await client.query("ROLLBACK TO SAVEPOINT tamper_secrets;");
    }

    // Can civicsense_app_role call current_tenant() and is_super_admin()?
    const userContext = await client.query("SELECT app_security.current_tenant(), app_security.is_super_admin();");
    console.log("civicsense_app_role read authorized context:", userContext.rows[0]);

  } finally {
    try {
      await client.query("RESET ROLE;");
      await client.query("ROLLBACK;");
    } catch (e) {}
    client.release();
    await closePool();
  }
}

testPrototype().catch(console.error);
