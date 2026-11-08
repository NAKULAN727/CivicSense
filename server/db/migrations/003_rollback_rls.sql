-- CivicSense AI - Phase 12 Enterprise Migration 003 (Rollback RLS)
-- Disables Row-Level Security policies.

DROP POLICY IF EXISTS tenant_isolation_incidents ON incidents;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_work_orders ON work_orders;
ALTER TABLE work_orders DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ward_datasets ON ward_datasets;
ALTER TABLE ward_datasets DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ward_features ON ward_features;
ALTER TABLE ward_features DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_telemetry ON telemetry_records;
ALTER TABLE telemetry_records DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_integration ON integration_settings;
ALTER TABLE integration_settings DISABLE ROW LEVEL SECURITY;

