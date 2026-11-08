// CivicSense AI - Phase 12 Security Audit Logging Service
// Append-only tamper-evident audit log with SHA-256 cryptographic hash chaining.
// STRICT GOVERNANCE: ZERO passwords, tokens, API keys, or raw images logged.

import crypto from 'node:crypto';
import { storageEngine } from '../db/storageEngine.js';
import { AUDIT_EVENTS } from '../config/constants.js';

/**
 * Strips sensitive keys recursively from details payload before logging.
 */
function sanitizeAuditDetails(details) {
  if (!details || typeof details !== 'object') return details;
  const sanitized = { ...details };

  const forbiddenKeys = [
    'password', 'token', 'secret', 'clientSecret', 'jwtSecret',
    'privateKey', 'apiKey', 'authorization', 'bearer', 'image', 'imageData', 'rawImage'
  ];

  for (const key of Object.keys(sanitized)) {
    const lower = key.toLowerCase();
    if (forbiddenKeys.some(fk => lower.includes(fk))) {
      sanitized[key] = '[REDACTED_BY_AUDIT_POLICY]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeAuditDetails(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Records an immutable persistent audit event with hash chaining.
 */
export function logAuditEvent({ eventType, tenantId, actorId, resource, result, requestId, details = {} }) {
  const eventId = `AUD-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  const record = {
    event_id: eventId,
    tenant_id: tenantId || 'GLOBAL',
    event_type: eventType || 'SYSTEM_EVENT',
    actor_id: actorId || 'SYSTEM',
    resource: resource || 'UNKNOWN',
    result: result || 'UNKNOWN',
    request_id: requestId || 'untracked',
    timestamp,
    details: sanitizeAuditDetails(details)
  };

  try {
    storageEngine.executeTransaction(record.tenant_id, true, async (tx) => {
      await tx.insert('audit_logs', record);
    });
  } catch (err) {
    console.warn('[AUDIT_WARNING] Failed to write persistent audit log:', err.message);
  }

  if (result === 'DENIED' || result === 'FORBIDDEN' || result === 'FAILURE') {
    console.warn(`[SECURITY_AUDIT][${record.result}] ${record.event_type} by ${record.actor_id} on ${record.resource} (Tenant: ${record.tenant_id}) [Req: ${record.request_id}]`);
  }

  return record;
}

/**
 * Queries audit logs scoped strictly to an authorized tenant.
 */
export function getAuditLogsForTenant(tenantId, filters = {}) {
  let logs = [];
  storageEngine.executeTransaction(tenantId, false, async (tx) => {
    logs = await tx.query('audit_logs', (log) => {
      if (filters.eventType && log.event_type !== filters.eventType) return false;
      if (filters.result && log.result !== filters.result) return false;
      return true;
    });
  });
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Verifies tamper-evident cryptographic hash chain for a tenant.
 */
export function verifyAuditChain(tenantId) {
  return storageEngine.verifyAuditChain(tenantId);
}

/**
 * Clears audit logs (for testing purposes only).
 */
export function clearAuditLogsForTest() {
  storageEngine.state.audit_logs = [];
  storageEngine.persistToDisk();
}
