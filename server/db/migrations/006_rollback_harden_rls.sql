-- CivicSense AI - Phase 12R Migration 006 (Rollback)
-- Restores legacy RLS policies and removes app_security schema

-- 1. Drop hardened RLS policies
DROP POLICY IF EXISTS tenant_isolation_incidents ON incidents;
DROP POLICY IF EXISTS tenant_isolation_work_orders ON work_orders;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_telemetry ON telemetry_records;
DROP POLICY IF EXISTS tenant_isolation_ward_datasets ON ward_datasets;
DROP POLICY IF EXISTS tenant_isolation_ward_features ON ward_features;
DROP POLICY IF EXISTS tenant_isolation_integration ON integration_settings;

-- 2. Restore legacy GUC-based policies
CREATE POLICY tenant_isolation_incidents ON incidents
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

CREATE POLICY tenant_isolation_work_orders ON work_orders
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

CREATE POLICY tenant_isolation_telemetry ON telemetry_records
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

CREATE POLICY tenant_isolation_ward_datasets ON ward_datasets
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

CREATE POLICY tenant_isolation_ward_features ON ward_features
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

CREATE POLICY tenant_isolation_integration ON integration_settings
FOR ALL TO PUBLIC
USING (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text))
WITH CHECK (((tenant_id)::text = NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text)) OR (current_setting('app.is_super_admin'::text, true) = 'true'::text));

-- 3. Drop app_security schema and objects
DROP SCHEMA IF EXISTS app_security CASCADE;

