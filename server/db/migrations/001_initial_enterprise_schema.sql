-- CivicSense AI - Phase 12 Enterprise Migration 001
-- Initial Normalized Relational Enterprise Schema
-- Compatible with PostgreSQL 14+ / PostGIS

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id VARCHAR(64) PRIMARY KEY,
    tenant_name VARCHAR(255) NOT NULL,
    label VARCHAR(64) NOT NULL DEFAULT 'SANDBOX TENANT',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    is_sandbox BOOLEAN NOT NULL DEFAULT true,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    email VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    department VARCHAR(255),
    is_sandbox_user BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Civic Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    incident_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    priority VARCHAR(32) NOT NULL,
    recommended_department VARCHAR(255) NOT NULL,
    recommended_action TEXT,
    source_evidence TEXT,
    confidence DOUBLE PRECISION,
    operator_status VARCHAR(32) NOT NULL DEFAULT 'NEEDS REVIEW',
    location_status VARCHAR(32) NOT NULL DEFAULT 'UNAVAILABLE',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_formatted VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    created_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Municipal Work Orders Table
CREATE TABLE IF NOT EXISTS work_orders (
    work_order_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    secondary_department VARCHAR(255),
    severity VARCHAR(32) NOT NULL,
    priority VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DISPATCHED',
    dispatched_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    approved_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    external_reference_id VARCHAR(128),
    is_idempotent_duplicate BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Ward Datasets Table (GeoJSON boundary versions)
CREATE TABLE IF NOT EXISTS ward_datasets (
    dataset_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    dataset_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    uploaded_by VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    feature_count INTEGER NOT NULL DEFAULT 0,
    raw_geojson JSONB NOT NULL,
    dataset_hash VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Ward Features Table (Individual polygon boundaries)
CREATE TABLE IF NOT EXISTS ward_features (
    feature_id VARCHAR(64) PRIMARY KEY,
    dataset_id VARCHAR(64) NOT NULL REFERENCES ward_datasets(dataset_id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    ward_id VARCHAR(64) NOT NULL,
    ward_name VARCHAR(255),
    geometry JSONB NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Immutable Security Audit Logs (with hash chaining)
CREATE TABLE IF NOT EXISTS audit_logs (
    event_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    result VARCHAR(32) NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_hash VARCHAR(64) NOT NULL DEFAULT 'GENESIS',
    current_hash VARCHAR(64) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Operational Telemetry Table
CREATE TABLE IF NOT EXISTS telemetry_records (
    telemetry_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    duration_ms DOUBLE PRECISION,
    status VARCHAR(32) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Municipal Integration Settings Table
CREATE TABLE IF NOT EXISTS integration_settings (
    setting_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    integration_type VARCHAR(64) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    endpoint_url VARCHAR(512),
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    circuit_state VARCHAR(32) NOT NULL DEFAULT 'CLOSED',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and query optimization
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status ON incidents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_status ON work_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_idemp ON work_orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ward_datasets_tenant_status ON ward_datasets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ward_features_tenant_ward ON ward_features(tenant_id, ward_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_tenant_time ON telemetry_records(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_integration_tenant ON integration_settings(tenant_id, integration_type);

