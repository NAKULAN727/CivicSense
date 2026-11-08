// CivicSense AI - Phase 12 Persistent Tenant-Scoped Incident Service
// Relational persistence with Row-Level Security (RLS) and audit trail.

import crypto from 'node:crypto';
import { storageEngine } from '../db/storageEngine.js';
import { executeWithTenantContext } from '../db/connection.js';
import { AUDIT_EVENTS, ERROR_CODES } from '../config/constants.js';
import { logAuditEvent } from './auditService.js';
import { recordTelemetryEvent } from './telemetryService.js';

function toIncidentModel(row) {
  if (!row) return null;
  return {
    id: row.incident_id,
    tenantId: row.tenant_id,
    title: row.title,
    incidentType: row.incident_type,
    severity: row.severity,
    priority: row.priority,
    recommendedDepartment: row.recommended_department,
    recommendedAction: row.recommended_action || '',
    sourceEvidence: row.source_evidence || '',
    confidence: row.confidence,
    operatorStatus: row.operator_status,
    location: {
      status: row.location_status,
      isGpsVerified: row.location_status === 'VERIFIED',
      latitude: row.latitude,
      longitude: row.longitude,
      formatted: row.location_formatted
    },
    status: row.status,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Creates a new civic incident persisted in the relational database with RLS.
 */
export async function createIncident(tenantId, user, sanitizedData, requestId) {
  const startTime = Date.now();
  const id = sanitizedData.id || `civic-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const record = {
    incident_id: id,
    tenant_id: tenantId,
    title: sanitizedData.title,
    incident_type: sanitizedData.incidentType,
    severity: sanitizedData.severity,
    priority: sanitizedData.priority,
    recommended_department: sanitizedData.recommendedDepartment,
    recommended_action: sanitizedData.recommendedAction || '',
    source_evidence: sanitizedData.sourceEvidence || '',
    confidence: sanitizedData.confidence,
    operator_status: sanitizedData.operatorStatus || 'NEEDS REVIEW',
    location_status: sanitizedData.location?.status || 'UNAVAILABLE',
    latitude: sanitizedData.location?.latitude ?? null,
    longitude: sanitizedData.location?.longitude ?? null,
    location_formatted: sanitizedData.location?.formatted || 'Location Unavailable',
    status: 'OPEN',
    created_by: user.userId,
    reviewed_by: sanitizedData.operatorStatus && sanitizedData.operatorStatus !== 'NEEDS REVIEW' ? user.userId : null,
    notes: sanitizedData.notes || '',
    created_at: now,
    updated_at: now
  };

  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    const inserted = await tx.insert('incidents', record);
    if (inserted) {
      Object.assign(record, inserted);
    }
  });

  logAuditEvent({
    eventType: AUDIT_EVENTS.INCIDENT_CREATED,
    tenantId,
    actorId: user.userId,
    resource: `/api/incidents/${id}`,
    result: 'SUCCESS',
    details: {
      incidentId: id,
      incidentType: record.incident_type,
      severity: record.severity,
      priority: record.priority
    },
    requestId
  });

  recordTelemetryEvent({
    eventType: 'INCIDENT_CREATED',
    tenantId,
    durationMs: Date.now() - startTime,
    status: 'SUCCESS',
    metadata: { incidentId: id, severity: record.severity }
  });

  return toIncidentModel(record);
}

/**
 * Retrieves all incidents for tenant strictly enforcing database Row-Level Security.
 */
export async function getIncidentsForTenant(tenantId, filters = {}, user = {}) {
  let rows = [];
  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    rows = await tx.query('incidents', (inc) => {
      if (filters.severity && inc.severity !== filters.severity) return false;
      if (filters.priority && inc.priority !== filters.priority) return false;
      if (filters.status && inc.status !== filters.status) return false;
      if (filters.incidentType && inc.incident_type !== filters.incidentType) return false;
      return true;
    });
  });

  return rows
    .map(toIncidentModel)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Retrieves an incident by ID with Row-Level Security checks.
 * Prevents information disclosure if incident belongs to another tenant.
 */
export async function getIncidentById(tenantId, incidentId, user, requestId) {
  let target = null;
  let existsAcrossTenants = false;

  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    const rows = await tx.query('incidents', (r) => r.incident_id === incidentId, '"incident_id" = $1', [incidentId]);
    target = rows[0] || null;
  });

  if (!target) {
    // If not found in current tenant context, query with super-admin bypass to check cross-tenant existence
    await executeWithTenantContext(tenantId, true, async (tx) => {
      const rows = await tx.query('incidents', (r) => r.incident_id === incidentId, '"incident_id" = $1', [incidentId]);
      if (rows && rows.length > 0) {
        existsAcrossTenants = true;
        target = rows[0];
      }
    });

    if (!existsAcrossTenants || !target) {
      const err = new Error(`Incident '${incidentId}' not found.`);
      err.status = 404;
      err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
      throw err;
    }
  }

  // Cross-tenant access violation check
  if (target.tenant_id !== tenantId && !user.isSuperAdmin) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
      tenantId,
      actorId: user.userId,
      resource: `/api/incidents/${incidentId}`,
      result: 'DENIED',
      details: {
        attemptedIncidentId: incidentId,
        userTenant: tenantId
      },
      requestId
    });

    const err = new Error('Access denied.');
    err.status = 403;
    err.code = ERROR_CODES.TENANT_ACCESS_DENIED;
    throw err;
  }

  logAuditEvent({
    eventType: AUDIT_EVENTS.INCIDENT_VIEWED,
    tenantId,
    actorId: user.userId,
    resource: `/api/incidents/${incidentId}`,
    result: 'SUCCESS',
    details: { incidentId },
    requestId
  });

  return toIncidentModel(target);
}

/**
 * Updates an incident's status with RLS protection.
 */
export async function updateIncidentStatus(tenantId, incidentId, user, updates, requestId) {
  const inc = await getIncidentById(tenantId, incidentId, user, requestId);

  if (updates.priority) {
    if (user.role === 'OPERATOR' || user.role === 'FIELD_OPERATOR' || user.role === 'READ_ONLY') {
      const err = new Error('Operators and Read-only users cannot modify incident priority. Supervisor approval required.');
      err.status = 403;
      err.code = ERROR_CODES.FORBIDDEN;
      throw err;
    }
  }

  const patch = {};
  if (updates.operatorStatus || updates.operatorDecision) {
    patch.operator_status = updates.operatorStatus || updates.operatorDecision;
    patch.reviewed_by = user.userId;
  }
  if (updates.status) patch.status = updates.status;
  if (updates.priority) patch.priority = updates.priority;
  if (updates.notes) patch.notes = String(updates.notes).slice(0, 500);

  let updatedRow = null;
  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    updatedRow = await tx.update('incidents', 'incident_id', incidentId, patch);
  });

  logAuditEvent({
    eventType: AUDIT_EVENTS.INCIDENT_UPDATED,
    tenantId,
    actorId: user.userId,
    resource: `/api/incidents/${incidentId}`,
    result: 'SUCCESS',
    details: { updates: Object.keys(updates) },
    requestId
  });

  return toIncidentModel(updatedRow);
}

/**
 * Clears incident store (for testing only).
 */
export function clearIncidentsForTest() {
  storageEngine.state.incidents = [];
  storageEngine.persistToDisk();
}
