// CivicSense AI - Phase 11 Municipal Sandbox Adapter
// Deterministic in-memory municipal work order simulator with strict idempotency and tenant isolation.

import { ERROR_CODES } from '../config/constants.js';

// tenantId -> Map(workOrderId -> WorkOrderRecord)
const tenantWorkOrders = new Map();

/**
 * Derives a deterministic work order ID from an incident ID.
 * Format: SANDBOX-WO-<incident-digest>
 */
export function generateSandboxWorkOrderId(incidentId) {
  if (!incidentId) return 'SANDBOX-WO-GENERIC';
  const clean = String(incidentId).replace(/[^a-zA-Z0-9]/g, '');
  const digest = clean.length > 20 ? clean.slice(-18) : clean;
  return `SANDBOX-WO-${digest}`;
}

/**
 * Derives a deterministic idempotency key for an incident.
 */
export function deriveIdempotencyKey(tenantId, incidentId) {
  return `IDEMP-${tenantId}-${String(incidentId).replace(/[^a-zA-Z0-9]/g, '')}`;
}

function getTenantMap(tenantId) {
  let map = tenantWorkOrders.get(tenantId);
  if (!map) {
    map = new Map();
    tenantWorkOrders.set(tenantId, map);
  }
  return map;
}

/**
 * Creates a municipal work order in Sandbox Mode.
 */
export async function createWorkOrder(tenantId, incident, options = {}) {
  if (!incident || !incident.id) {
    const err = new Error('Invalid incident payload: Incident ID is required.');
    err.status = 400;
    err.code = ERROR_CODES.VALIDATION_ERROR;
    throw err;
  }

  const map = getTenantMap(tenantId);
  const workOrderId = generateSandboxWorkOrderId(incident.id);
  const idempotencyKey = options.idempotencyKey || deriveIdempotencyKey(tenantId, incident.id);

  // 1. Idempotency Check
  if (map.has(workOrderId)) {
    const existing = map.get(workOrderId);
    return {
      ...existing,
      isIdempotentDuplicate: true,
      message: `Idempotent request: Existing sandbox work order returned (${workOrderId}). Duplicate creation prevented.`
    };
  }

  // 2. Dispatch Eligibility Verification
  const operatorDecision = incident.operatorStatus || incident.operatorDecision || 'NEEDS REVIEW';

  if (operatorDecision === 'REJECTED') {
    const err = new Error(`DISPATCH_INELIGIBLE: Incident '${incident.id}' was REJECTED during operator triage. Work order cannot be dispatched.`);
    err.status = 422;
    err.code = ERROR_CODES.DISPATCH_INELIGIBLE;
    throw err;
  }

  if (operatorDecision === 'NEEDS REVIEW') {
    const err = new Error(`DISPATCH_REQUIRES_OPERATOR_REVIEW: Incident '${incident.id}' is in 'NEEDS REVIEW' state. Explicit operator or supervisor confirmation required prior to dispatch.`);
    err.status = 422;
    err.code = ERROR_CODES.DISPATCH_INELIGIBLE;
    throw err;
  }

  // 3. High-Risk Human-in-the-Loop Approval Check (Section 29)
  const isHighRisk = incident.severity === 'CRITICAL' || 
                     incident.priority === 'IMMEDIATE' || 
                     incident.incidentType === 'SIGNIFICANT_WATERLOGGING' || 
                     incident.incidentType === 'WATER_FILLED_POTHOLE';

  if (isHighRisk && !options.approvedBySupervisor) {
    const err = new Error(`HIGH_RISK_APPROVAL_REQUIRED: Incident '${incident.id}' is high-risk (${incident.incidentType || incident.severity}). Explicit supervisor approval is required before dispatch.`);
    err.status = 403;
    err.code = ERROR_CODES.HIGH_RISK_APPROVAL_REQUIRED;
    throw err;
  }

  // Determine secondary department for multi-modal hazards
  let secondaryDepartment = null;
  if (incident.incidentType === 'WATER_FILLED_POTHOLE') {
    secondaryDepartment = 'Stormwater Drainage Department (Advisory)';
  }

  const workOrderRecord = {
    workOrderId,
    tenantId,
    incidentId: incident.id,
    idempotencyKey,
    title: incident.title || 'Civic Incident Dispatch',
    department: incident.recommendedDepartment,
    secondaryDepartment,
    severity: incident.severity,
    priority: incident.priority,
    location: incident.location,
    status: 'DISPATCHED',
    dispatchedBy: options.operatorId || 'SYSTEM_OPERATOR',
    approvedBy: options.approvedBySupervisor ? (options.supervisorId || 'SUPERVISOR') : null,
    isIdempotentDuplicate: false,
    dispatchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: options.notes || '',
    history: [
      {
        status: 'DISPATCHED',
        timestamp: new Date().toISOString(),
        actor: options.operatorId || 'OPERATOR',
        note: 'Initial work order dispatch in Sandbox Mode'
      }
    ]
  };

  map.set(workOrderId, workOrderRecord);
  return workOrderRecord;
}

/**
 * Retrieves a work order within tenant scope.
 */
export async function getWorkOrder(tenantId, workOrderId) {
  const map = getTenantMap(tenantId);
  return map.get(workOrderId) || null;
}

/**
 * Returns all work orders for a tenant.
 */
export async function getAllWorkOrders(tenantId) {
  const map = getTenantMap(tenantId);
  return Array.from(map.values()).sort((a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt));
}

/**
 * Updates a work order lifecycle state with conflict resolution (Section 31).
 */
export async function updateWorkOrder(tenantId, workOrderId, updates = {}) {
  const map = getTenantMap(tenantId);
  const order = map.get(workOrderId);

  if (!order) {
    const err = new Error(`Work order '${workOrderId}' not found.`);
    err.status = 404;
    err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
    throw err;
  }

  // Conflict Management (Section 31):
  // If remote work order is already COMPLETED, regressing to IN_PROGRESS triggers CONFLICT_REQUIRES_REVIEW
  if (order.status === 'COMPLETED' && updates.status === 'IN_PROGRESS') {
    order.status = 'CONFLICT_REQUIRES_REVIEW';
    order.conflict = true;
    order.history.push({
      status: 'CONFLICT_REQUIRES_REVIEW',
      timestamp: new Date().toISOString(),
      actor: updates.actor || 'SYSTEM',
      note: 'Conflict detected: Attempted regression from COMPLETED to IN_PROGRESS.'
    });

    return {
      ...order,
      conflict: true,
      status: 'CONFLICT_REQUIRES_REVIEW',
      message: "Conflict detected: Work order is already 'COMPLETED'. Cannot regress to 'IN_PROGRESS' without supervisor resolution."
    };
  }

  if (updates.status) {
    order.status = updates.status;
    order.conflict = false;
  }

  if (updates.notes) {
    order.notes = updates.notes;
  }

  order.updatedAt = new Date().toISOString();
  order.history.push({
    status: order.status,
    timestamp: new Date().toISOString(),
    actor: updates.actor || 'OPERATOR',
    note: updates.note || `Status updated to ${order.status}`
  });

  return order;
}

/**
 * Clears sandbox work orders (for testing only).
 */
export function clearSandboxWorkOrdersForTest() {
  tenantWorkOrders.clear();
}

