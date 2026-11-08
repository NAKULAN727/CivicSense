-- CivicSense AI - Phase 12 Enterprise Migration 004 (Rollback Schema)
-- Tears down tables and indexes cleanly in reverse dependency order.

DROP TABLE IF EXISTS integration_settings CASCADE;
DROP TABLE IF EXISTS telemetry_records CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS ward_features CASCADE;
DROP TABLE IF EXISTS ward_datasets CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

