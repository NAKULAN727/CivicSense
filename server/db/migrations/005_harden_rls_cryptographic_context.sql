-- CivicSense AI - Phase 12R Migration 005
-- Hardened Row-Level Security with Cryptographically Authenticated Session Context
-- Eliminates reliance on untrusted custom GUC session variables

-- 1. Ensure pgcrypto extension is active in schema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Create app_security schema for cryptographic context management
CREATE SCHEMA IF NOT EXISTS app_security;

-- 3. Dedicated secrets table accessible strictly to database owner (postgres)
CREATE TABLE IF NOT EXISTS app_security.auth_secrets (
    key_id VARCHAR(64) PRIMARY KEY,
    secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Session contexts table tracking authenticated transactions per backend PID
CREATE TABLE IF NOT EXISTS app_security.session_contexts (
    pid INT PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 5. Revoke direct table access from application role and public
REVOKE ALL ON SCHEMA app_security FROM PUBLIC, civicsense_app_role;
GRANT USAGE ON SCHEMA app_security TO PUBLIC, civicsense_app_role;
REVOKE ALL ON ALL TABLES IN SCHEMA app_security FROM PUBLIC, civicsense_app_role;

-- 6. Insert default active secret if none exists
INSERT INTO app_security.auth_secrets (key_id, secret)
VALUES ('active', 'c1v1cs3ns3-d3fau1t-db-s3ss10n-s1gn1ng-k3y-32b')
ON CONFLICT (key_id) DO NOTHING;

-- 7. Context Authentication Function (SECURITY DEFINER)
-- Validates timestamp freshness (<= 60 seconds) and HMAC-SHA256 signature
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
    -- Retrieve signing secret (running as postgres owner)
    SELECT secret INTO v_secret FROM app_security.auth_secrets WHERE key_id = 'active';
    IF v_secret IS NULL THEN
        RAISE EXCEPTION 'SECURITY_CONFIG_ERROR: Database signing secret unconfigured';
    END IF;

    -- Timestamp freshness validation (prevents replay attacks)
    v_now := EXTRACT(EPOCH FROM NOW())::BIGINT;
    IF ABS(v_now - p_timestamp) > 60 THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Context timestamp expired or skewed';
    END IF;

    -- Compute expected HMAC-SHA256 signature
    v_message := p_tenant_id || ':' || (CASE WHEN p_is_super_admin THEN 'true' ELSE 'false' END) || ':' || p_timestamp::text || ':' || p_nonce;
    v_expected := encode(extensions.hmac(v_message::bytea, v_secret::bytea, 'sha256'), 'hex');

    -- Constant-time comparison
    IF p_signature IS NULL OR v_expected != p_signature THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Invalid or forged tenant context signature';
    END IF;

    -- Store verified context for this backend PID
    INSERT INTO app_security.session_contexts (pid, tenant_id, is_super_admin, expires_at)
    VALUES (pg_backend_pid(), p_tenant_id, p_is_super_admin, NOW() + INTERVAL '120 seconds')
    ON CONFLICT (pid) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        is_super_admin = EXCLUDED.is_super_admin,
        expires_at = EXCLUDED.expires_at;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = app_security, extensions, pg_catalog;

-- 8. Context Reader Functions (SECURITY DEFINER)
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

-- Grant execution privileges to application role and public
GRANT EXECUTE ON FUNCTION app_security.authenticate_context TO PUBLIC, civicsense_app_role;
GRANT EXECUTE ON FUNCTION app_security.current_tenant TO PUBLIC, civicsense_app_role;
GRANT EXECUTE ON FUNCTION app_security.is_super_admin TO PUBLIC, civicsense_app_role;
GRANT EXECUTE ON FUNCTION app_security.clear_context TO PUBLIC, civicsense_app_role;

-- 9. Replace RLS Policies on all 6 tenant tables + ward_features
-- Drop legacy GUC-based policies
DROP POLICY IF EXISTS tenant_isolation_incidents ON incidents;
DROP POLICY IF EXISTS tenant_isolation_work_orders ON work_orders;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_telemetry ON telemetry_records;
DROP POLICY IF EXISTS tenant_isolation_ward_datasets ON ward_datasets;
DROP POLICY IF EXISTS tenant_isolation_ward_features ON ward_features;
DROP POLICY IF EXISTS tenant_isolation_integration ON integration_settings;

-- Deploy cryptographically verified RLS policies
CREATE POLICY tenant_isolation_incidents ON incidents
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

CREATE POLICY tenant_isolation_work_orders ON work_orders
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

CREATE POLICY tenant_isolation_telemetry ON telemetry_records
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

CREATE POLICY tenant_isolation_ward_datasets ON ward_datasets
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

CREATE POLICY tenant_isolation_ward_features ON ward_features
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

CREATE POLICY tenant_isolation_integration ON integration_settings
FOR ALL TO PUBLIC
USING (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant())
WITH CHECK (app_security.is_super_admin() = true OR tenant_id = app_security.current_tenant());

