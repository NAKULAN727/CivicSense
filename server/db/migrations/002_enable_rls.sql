-- CivicSense AI - Phase 12 Enterprise Migration 002
-- PostgreSQL Row-Level Security (RLS) Policies
-- Enforces database-level isolation using 'app.current_tenant_id' session variable.

-- 1. Incidents Table RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_incidents ON incidents;
CREATE POLICY tenant_isolation_incidents ON incidents
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 2. Work Orders Table RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_work_orders ON work_orders;
CREATE POLICY tenant_isolation_work_orders ON work_orders
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 3. Ward Datasets Table RLS
ALTER TABLE ward_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_datasets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ward_datasets ON ward_datasets;
CREATE POLICY tenant_isolation_ward_datasets ON ward_datasets
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 4. Ward Features Table RLS
ALTER TABLE ward_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE ward_features FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ward_features ON ward_features;
CREATE POLICY tenant_isolation_ward_features ON ward_features
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 5. Audit Logs Table RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 6. Telemetry Records Table RLS
ALTER TABLE telemetry_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_telemetry ON telemetry_records;
CREATE POLICY tenant_isolation_telemetry ON telemetry_records
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

-- 7. Integration Settings Table RLS
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_integration ON integration_settings;
CREATE POLICY tenant_isolation_integration ON integration_settings
    AS PERMISSIVE
    FOR ALL
    TO PUBLIC
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

