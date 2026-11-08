// CivicSense AI - Phase 12 Operational Telemetry Service
// Tracks operational metrics and latencies in persistent relational storage.
// STRICTLY SEPARATED from Security Audit Logs.
// Real measured metrics only: durationMs is strictly null if unmeasured.

import crypto from 'node:crypto';
import { storageEngine } from '../db/storageEngine.js';

/**
 * Records an operational telemetry event.
 */
export function recordTelemetryEvent({ eventType, tenantId, durationMs = null, status = 'SUCCESS', metadata = {} }) {
  const telemetryId = `TEL-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  const record = {
    telemetry_id: telemetryId,
    tenant_id: tenantId || 'GLOBAL',
    event_type: eventType,
    duration_ms: typeof durationMs === 'number' && durationMs >= 0 ? Math.round(durationMs * 100) / 100 : null,
    status,
    metadata,
    timestamp
  };

  try {
    storageEngine.executeTransaction(record.tenant_id, true, async (tx) => {
      await tx.insert('telemetry_records', record);
    });
  } catch (err) {
    console.warn('[TELEMETRY_WARNING] Failed to write telemetry record:', err.message);
  }

  return record;
}

/**
 * Returns operational telemetry events scoped to a specific tenant.
 */
export function getTenantTelemetry(tenantId, limit = 50) {
  let records = [];
  storageEngine.executeTransaction(tenantId, false, async (tx) => {
    records = await tx.query('telemetry_records');
  });

  return records
    .slice(-limit)
    .reverse()
    .map(r => ({
      telemetryId: r.telemetry_id,
      tenantId: r.tenant_id,
      eventType: r.event_type,
      durationMs: r.duration_ms,
      status: r.status,
      metadata: r.metadata,
      timestamp: r.timestamp
    }));
}

/**
 * Computes tenant operational health stats from persistent telemetry.
 */
export function getTenantTelemetryStats(tenantId) {
  let events = [];
  storageEngine.executeTransaction(tenantId, false, async (tx) => {
    events = await tx.query('telemetry_records');
  });

  const total = events.length;
  const errors = events.filter(t => t.status === 'ERROR').length;
  
  const measuredDurations = events
    .map(t => t.duration_ms)
    .filter(d => typeof d === 'number' && d !== null);

  const avgLatency = measuredDurations.length > 0
    ? Math.round(measuredDurations.reduce((acc, v) => acc + v, 0) / measuredDurations.length)
    : null;

  return {
    tenantId,
    totalOperationalEvents: total,
    errorCount: errors,
    errorRate: total > 0 ? Math.round((errors / total) * 100) / 100 : 0,
    averageLatencyMs: avgLatency
  };
}

/**
 * Clears telemetry (for testing purposes only).
 */
export function clearTelemetryForTest() {
  storageEngine.state.telemetry_records = [];
  storageEngine.persistToDisk();
}
