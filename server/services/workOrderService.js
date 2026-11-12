// CivicSense AI - Phase 12 Persistent Municipal Work Order Service
// Relational persistence, deterministic idempotency, human-in-the-loop validation, and conflict management.

import { storageEngine } from '../db/storageEngine.js';
import { executeWithTenantContext } from '../db/connection.js';
import { AUDIT_EVENTS, ERROR_CODES } from '../config/constants.js';
import { logAuditEvent } from './auditService.js';
import { recordTelemetryEvent } from './telemetryService.js';
import * as incidentService from './incidentService.js';
import * as municipalAdapter from '../adapters/municipalAdapter.js';
import { deriveIdempotencyKey } from '../adapters/sandboxAdapter.js';

function toWorkOrderModel(row) {
  if (!row) return null;
  return {
    workOrderId: row.work_order_id,
    tenantId: row.tenant_id,
    incidentId: row.incident_id,
    idempotencyKey: row.idempotency_key,
    title: row.title,
    department: row.department,
    secondaryDepartment: row.secondary_department,
    severity: row.severity,
    priority: row.priority,
    status: row.status,
    dispatchedBy: row.dispatched_by,
    approvedBy: row.approved_by,
    externalReferenceId: row.external_reference_id,
    isIdempotentDuplicate: row.is_idempotent_duplicate,
    notes: row.notes,
    history: row.history || [],
    dispatchedAt: row.dispatched_at,
    updatedAt: row.updated_at
  };
}

/**
 * Dispatches an approved incident to the municipal work-order adapter with database persistence.
 */
export async function dispatchWorkOrder(tenantId, user, { incidentId, approvedBySupervisor, notes }, requestId) {
  const startTime = Date.now();

  // 1. Verify incident exists and belongs to this tenant
  const incident = await incidentService.getIncidentById(tenantId, incidentId, user, requestId);

  // 2. High-Risk Human-in-the-Loop Verification (Phase 11/12 Policy)
  const isHighRisk = incident.severity === 'CRITICAL' || 
                     incident.priority === 'IMMEDIATE' || 
                     incident.incidentType === 'SIGNIFICANT_WATERLOGGING' || 
                     incident.incidentType === 'GENERAL_SIGNIFICANT_FLOODING' || 
                     incident.incidentType === 'ROAD_WATERLOGGING' || 
                     incident.incidentType === 'WATER_FILLED_POTHOLE';

  if (isHighRisk && !approvedBySupervisor) {
    const err = new Error(
      `HIGH_RISK_APPROVAL_REQUIRED: Incident '${incident.id}' is high-risk (${incident.incidentType || incident.severity}). Explicit supervisor approval is required before dispatch.`
    );
    err.status = 403;
    err.code = ERROR_CODES.HIGH_RISK_APPROVAL_REQUIRED;
    throw err;
  }

  // Operators and Read-Only users cannot grant supervisor approval
  if (approvedBySupervisor && (user.role === 'OPERATOR' || user.role === 'FIELD_OPERATOR' || user.role === 'READ_ONLY')) {
    const err = new Error('Field operators and Read-only users cannot grant supervisor approval.');
    err.status = 403;
    err.code = ERROR_CODES.FORBIDDEN;
    throw err;
  }

  const idempotencyKey = deriveIdempotencyKey(tenantId, incident.id);

  // 3. Idempotency Check in Persistent Storage
  let existingOrder = null;
  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    const rows = await tx.query(
      'work_orders',
      w => w.tenant_id === tenantId && (w.idempotency_key === idempotencyKey || w.incident_id === incident.id),
      '"idempotency_key" = $1 OR "incident_id" = $2',
      [idempotencyKey, incident.id]
    );
    existingOrder = rows[0] || null;
  });

  if (existingOrder) {
    return {
      ...toWorkOrderModel(existingOrder),
      isIdempotentDuplicate: true,
      message: `Idempotent request: Existing work order returned (${existingOrder.work_order_id}). Duplicate dispatch prevented.`
    };
  }

  // 4. Dispatch via Municipal Adapter
  try {
    const adapterResult = await municipalAdapter.createWorkOrder(tenantId, incident, {
      operatorId: user.userId,
      supervisorId: approvedBySupervisor ? user.userId : null,
      approvedBySupervisor,
      idempotencyKey,
      requestId,
      notes
    });

    const now = new Date().toISOString();
    const workOrderRecord = {
      work_order_id: adapterResult.workOrderId,
      tenant_id: tenantId,
      incident_id: incident.id,
      idempotency_key: idempotencyKey,
      title: incident.title || 'Civic Incident Dispatch',
      department: incident.recommendedDepartment,
      secondary_department: incident.incidentType === 'WATER_FILLED_POTHOLE' ? 'Stormwater Drainage Department (Advisory)' : null,
      severity: incident.severity,
      priority: incident.priority,
      status: adapterResult.status || 'DISPATCHED',
      dispatched_by: user.userId,
      approved_by: approvedBySupervisor ? user.userId : null,
      external_reference_id: adapterResult.externalReferenceId || null,
      is_idempotent_duplicate: false,
      notes: notes || '',
      history: [
        {
          status: adapterResult.status || 'DISPATCHED',
          timestamp: now,
          actor: user.userId,
          note: 'Initial dispatch to municipal adapter'
        }
      ],
      dispatched_at: now,
      updated_at: now
    };

    // Transactional save to database and incident status update
    await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
      await tx.insert('work_orders', workOrderRecord);
      await tx.update('incidents', 'incident_id', incident.id, { status: 'DISPATCHED' });
    });

    logAuditEvent({
      eventType: AUDIT_EVENTS.WORK_ORDER_CREATED,
      tenantId,
      actorId: user.userId,
      resource: `/api/work-orders/${workOrderRecord.work_order_id}`,
      result: 'SUCCESS',
      details: {
        workOrderId: workOrderRecord.work_order_id,
        incidentId: incident.id,
        department: workOrderRecord.department
      },
      requestId
    });

    recordTelemetryEvent({
      eventType: 'WORK_ORDER_DISPATCH',
      tenantId,
      durationMs: Date.now() - startTime,
      status: 'SUCCESS',
      metadata: { workOrderId: workOrderRecord.work_order_id }
    });

    return toWorkOrderModel(workOrderRecord);
  } catch (err) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.WORK_ORDER_SYNC_FAILED,
      tenantId,
      actorId: user.userId,
      resource: `/api/work-orders`,
      result: 'FAILURE',
      details: { incidentId, error: err.message, errorCode: err.code },
      requestId
    });

    recordTelemetryEvent({
      eventType: 'WORK_ORDER_DISPATCH_FAILURE',
      tenantId,
      durationMs: Date.now() - startTime,
      status: 'ERROR',
      metadata: { incidentId, error: err.message }
    });

    throw err;
  }
}

/**
 * Returns all work orders for a tenant.
 */
export async function getTenantWorkOrders(tenantId, user = {}) {
  let rows = [];
  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    rows = await tx.query('work_orders');
  });

  return rows
    .map(toWorkOrderModel)
    .sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt));
}

/**
 * Returns a specific work order with Row-Level Security verification.
 */
export async function getWorkOrderById(tenantId, workOrderId, user, requestId) {
  let order = null;
  let existsAcrossTenants = false;

  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    const rows = await tx.query('work_orders', w => w.work_order_id === workOrderId, '"work_order_id" = $1', [workOrderId]);
    order = rows[0] || null;
  });

  if (!order) {
    await executeWithTenantContext(tenantId, true, async (tx) => {
      const rows = await tx.query('work_orders', w => w.work_order_id === workOrderId, '"work_order_id" = $1', [workOrderId]);
      if (rows && rows.length > 0) {
        existsAcrossTenants = true;
        order = rows[0];
      }
    });

    if (!existsAcrossTenants || !order) {
      const err = new Error(`Work order '${workOrderId}' not found.`);
      err.status = 404;
      err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
      throw err;
    }
  }

  // Cross-tenant access violation check
  if (order.tenant_id !== tenantId && !user.isSuperAdmin) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
      tenantId,
      actorId: user.userId,
      resource: `/api/work-orders/${workOrderId}`,
      result: 'DENIED',
      details: { attemptedWorkOrderId: workOrderId },
      requestId
    });

    const err = new Error('Access denied.');
    err.status = 403;
    err.code = ERROR_CODES.TENANT_ACCESS_DENIED;
    throw err;
  }

  return toWorkOrderModel(order);
}

/**
 * Updates work order status with conflict detection (Section 13).
 */
export async function updateWorkOrderStatus(tenantId, workOrderId, user, updates, requestId) {
  const existing = await getWorkOrderById(tenantId, workOrderId, user, requestId);

  // Conflict Handling: If status is COMPLETED, regression to IN_PROGRESS triggers CONFLICT_REQUIRES_REVIEW
  if (existing.status === 'COMPLETED' && updates.status === 'IN_PROGRESS') {
    const conflictNote = {
      status: 'CONFLICT_REQUIRES_REVIEW',
      timestamp: new Date().toISOString(),
      actor: user.userId,
      note: 'Conflict detected: Attempted regression from COMPLETED to IN_PROGRESS.'
    };

    let updated = null;
    await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
      updated = await tx.update('work_orders', 'work_order_id', workOrderId, {
        status: 'CONFLICT_REQUIRES_REVIEW',
        history: [...(existing.history || []), conflictNote]
      });
    });

    logAuditEvent({
      eventType: AUDIT_EVENTS.WORK_ORDER_STATUS_CHANGED,
      tenantId,
      actorId: user.userId,
      resource: `/api/work-orders/${workOrderId}`,
      result: 'CONFLICT',
      details: { attemptedStatus: 'IN_PROGRESS', resultingStatus: 'CONFLICT_REQUIRES_REVIEW' },
      requestId
    });

    return {
      ...toWorkOrderModel(updated),
      conflict: true,
      message: "Conflict detected: Work order is already 'COMPLETED'. Cannot regress to 'IN_PROGRESS' without supervisor resolution."
    };
  }

  const historyEntry = {
    status: updates.status || existing.status,
    timestamp: new Date().toISOString(),
    actor: user.userId,
    note: updates.notes || `Status updated to ${updates.status || existing.status}`
  };

  let updatedRow = null;
  await executeWithTenantContext(tenantId, user.isSuperAdmin, async (tx) => {
    updatedRow = await tx.update('work_orders', 'work_order_id', workOrderId, {
      status: updates.status || existing.status,
      notes: updates.notes || existing.notes,
      history: [...(existing.history || []), historyEntry]
    });
  });

  logAuditEvent({
    eventType: AUDIT_EVENTS.WORK_ORDER_STATUS_CHANGED,
    tenantId,
    actorId: user.userId,
    resource: `/api/work-orders/${workOrderId}`,
    result: 'SUCCESS',
    details: { newStatus: updatedRow.status },
    requestId
  });

  return toWorkOrderModel(updatedRow);
}

/**
 * Clears work orders (for testing only).
 */
export function clearWorkOrdersForTest() {
  storageEngine.state.work_orders = [];
  storageEngine.persistToDisk();
}
