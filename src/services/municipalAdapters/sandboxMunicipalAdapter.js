// CivicSense AI - Municipal Sandbox Adapter (Phase 10)
// Simulates municipal ERP / Work-Order dispatch in a safe, controlled sandbox environment.
// STRICT GOVERNANCE:
// - ZERO external API calls, zero real work orders, zero real records modified.
// - All records explicitly prefixed with "SANDBOX-WO-".
// - Fully idempotent: deterministic incident ID yields identical work order ID (no duplicates).
// - ZERO Math.random() – Completely deterministic logic.

export const MUNICIPAL_INTEGRATION_MODE = "SANDBOX";
const SANDBOX_STORAGE_KEY = 'civicsense_sandbox_work_orders';

// In-memory registry with localStorage persistence
let sandboxWorkOrders = new Map();

// Initialize from localStorage if available
function loadFromStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(SANDBOX_STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          sandboxWorkOrders = new Map(arr.map(wo => [wo.workOrderId, wo]));
        }
      }
    } catch (e) {
      console.warn("[SANDBOX_STORAGE_NOTICE] Could not load sandbox work orders:", e);
    }
  }
}

function persistToStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const arr = Array.from(sandboxWorkOrders.values());
      window.localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn("[SANDBOX_STORAGE_NOTICE] Could not persist sandbox work orders:", e);
    }
  }
}

// Initial load
loadFromStorage();

/**
 * Derives a deterministic work order ID from an incident ID.
 * Format: SANDBOX-WO-<clean-incident-digest>
 * 
 * @param {string} incidentId Deterministic incident identifier
 * @returns {string} Deterministic Sandbox Work Order ID
 */
export function generateSandboxWorkOrderId(incidentId) {
  if (!incidentId) {
    return `SANDBOX-WO-GENERIC-${Date.now()}`;
  }
  // Strip non-alphanumeric characters and take deterministic digest
  const cleanId = String(incidentId).replace(/[^a-zA-Z0-9]/g, '');
  const digest = cleanId.length > 20 ? cleanId.slice(-18) : cleanId;
  return `SANDBOX-WO-${digest}`;
}

/**
 * Creates a municipal work order in Sandbox Mode.
 * 
 * STRICT POLICY:
 * 1. Checks dispatch eligibility:
 *    - Rejects if operator decision is REJECTED
 *    - Rejects if operator decision is NEEDS REVIEW
 *    - Rejects high-risk incidents without operator confirmation
 * 2. Enforces idempotency:
 *    - If work order already exists for incidentId, returns existing work order without creating duplicate.
 * 
 * @param {Object} incident Validated civic incident object
 * @param {Object} [options] Dispatch options { operatorId, approvedBySupervisor, notes }
 * @returns {Promise<Object>} Created or existing work order record
 */
export async function createWorkOrder(incident, options = {}) {
  if (!incident || !incident.id) {
    throw new Error("INVALID_INCIDENT_PAYLOAD: Incident object with valid ID is required.");
  }

  const workOrderId = generateSandboxWorkOrderId(incident.id);

  // 1. Idempotency Check: Return existing record if already present
  if (sandboxWorkOrders.has(workOrderId)) {
    const existing = sandboxWorkOrders.get(workOrderId);
    return {
      ...existing,
      isIdempotentDuplicate: true,
      message: `Idempotent request: Existing sandbox work order returned (${workOrderId}). Duplicate creation prevented.`
    };
  }

  // 2. Dispatch Eligibility Verification (Section 15)
  const operatorDecision = incident.operatorStatus || incident.operatorDecision?.decision || options.operatorDecision || 'NEEDS REVIEW';
  
  if (operatorDecision === 'REJECTED') {
    const err = new Error(`DISPATCH_INELIGIBLE_REJECTED: Incident ${incident.id} was REJECTED during human triage. Work order cannot be dispatched.`);
    err.code = 'DISPATCH_INELIGIBLE_REJECTED';
    throw err;
  }

  if (operatorDecision === 'NEEDS REVIEW') {
    const err = new Error(`DISPATCH_REQUIRES_OPERATOR_REVIEW: Incident ${incident.id} is in 'NEEDS REVIEW' state. Explicit operator or supervisor confirmation required prior to dispatch.`);
    err.code = 'DISPATCH_REQUIRES_OPERATOR_REVIEW';
    throw err;
  }

  // High-Risk Incident Guard (Section 15)
  const isHighRisk = incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ||
    incident.priority === 'IMMEDIATE' || incident.incidentType === 'WATER_FILLED_POTHOLE' ||
    incident.incidentType === 'SIGNIFICANT_WATERLOGGING';

  if (isHighRisk && operatorDecision !== 'CONFIRMED' && !options.approvedBySupervisor) {
    const err = new Error(`DISPATCH_REQUIRES_SUPERVISOR_APPROVAL: High-hazard incident (${incident.incidentType}, ${incident.severity}) requires explicit confirmation prior to municipal dispatch.`);
    err.code = 'DISPATCH_REQUIRES_SUPERVISOR_APPROVAL';
    throw err;
  }

  // 3. Normalized Municipal Work-Order Payload (Section 12 & 16)
  const isGpsValid = Boolean(incident.location?.isGpsVerified);
  const secondaryDept = incident.secondaryAdvisory || 
    (incident.incidentType === 'WATER_FILLED_POTHOLE' ? 'Stormwater Drainage Department (Advisory)' : null);

  const workOrder = {
    workOrderId,
    incidentId: incident.id,
    incidentType: incident.incidentType,
    title: incident.title || incident.incidentType,
    severity: incident.severity,
    priority: incident.priority,
    department: incident.recommendedDepartment || "Municipal General Works",
    secondaryDepartment: secondaryDept,
    location: {
      status: isGpsValid ? "AVAILABLE" : "UNAVAILABLE",
      latitude: isGpsValid ? incident.location.latitude : null,
      longitude: isGpsValid ? incident.location.longitude : null,
      formatted: isGpsValid ? incident.location.formatted : "LOCATION UNAVAILABLE"
    },
    ward: {
      status: incident.wardAssignmentStatus || "WARD ASSIGNMENT UNAVAILABLE",
      wardId: incident.wardId || null,
      wardName: incident.wardName || null,
      office: incident.departmentOffice || "Central Municipal Depot"
    },
    captureTimestamp: incident.captureTimestamp || "CAPTURE TIME UNAVAILABLE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    operator: {
      operatorId: options.operatorId || incident.operatorReview?.operatorId || "FIELD_OPERATOR",
      decision: operatorDecision,
      notes: options.notes || incident.operatorDecision?.reason || incident.operatorReview?.notes || ""
    },
    evidence: {
      sourceEvidence: incident.sourceEvidence || "Visual AI Inference",
      confidence: typeof incident.confidence === 'number' ? incident.confidence : null,
      contextualInterpretation: incident.contextualInterpretation || "Contextual arbitration verified."
    },
    recommendedAction: incident.recommendedAction || "Dispatch field inspection unit.",
    status: "DISPATCHED", // Lifecycle state: DISPATCHED
    lifecycleHistory: [
      {
        status: "DISPATCHED",
        timestamp: new Date().toISOString(),
        actor: options.operatorId || "FIELD_OPERATOR",
        notes: "Work order created in Municipal Sandbox environment."
      }
    ],
    integrationMode: MUNICIPAL_INTEGRATION_MODE,
    auditNotes: "SANDBOX WORK ORDER — NO REAL MUNICIPAL RECORD MODIFIED",
    version: 1
  };

  // 4. Store and persist
  sandboxWorkOrders.set(workOrderId, workOrder);
  persistToStorage();

  return {
    ...workOrder,
    isIdempotentDuplicate: false,
    message: `Sandbox work order created successfully (${workOrderId}).`
  };
}

/**
 * Retrieves the current status and payload of a Sandbox work order.
 * 
 * @param {string} workOrderId Sandbox Work Order ID
 * @returns {Promise<Object>} Work order payload
 */
export async function getWorkOrderStatus(workOrderId) {
  if (!sandboxWorkOrders.has(workOrderId)) {
    const err = new Error(`WORK_ORDER_NOT_FOUND: Work order '${workOrderId}' does not exist in sandbox registry.`);
    err.code = 'WORK_ORDER_NOT_FOUND';
    throw err;
  }
  return sandboxWorkOrders.get(workOrderId);
}

/**
 * Updates a Sandbox work order status.
 * Handles conflicts deterministically without silent overwrites (Section 25).
 * 
 * @param {string} workOrderId Sandbox Work Order ID
 * @param {Object} update Update payload { status, notes, actor, expectedStatus, version }
 * @returns {Promise<Object>} Updated work order or conflict descriptor
 */
export async function updateWorkOrder(workOrderId, update = {}) {
  if (!sandboxWorkOrders.has(workOrderId)) {
    const err = new Error(`WORK_ORDER_NOT_FOUND: Work order '${workOrderId}' does not exist in sandbox registry.`);
    err.code = 'WORK_ORDER_NOT_FOUND';
    throw err;
  }

  const current = sandboxWorkOrders.get(workOrderId);

  // Conflict Detection: If expectedStatus was supplied and differs from current status
  if (update.expectedStatus && update.expectedStatus !== current.status) {
    return {
      workOrderId,
      status: "CONFLICT_REQUIRES_REVIEW",
      conflict: true,
      localRequestedStatus: update.status,
      serverCurrentStatus: current.status,
      message: `Conflict detected: Expected status '${update.expectedStatus}', but server status is '${current.status}'. Silent overwrite rejected.`
    };
  }

  // Protect completed/cancelled records from regression without explicit override
  if ((current.status === 'COMPLETED' || current.status === 'CANCELLED') && update.status !== current.status && !update.forceOverride) {
    return {
      workOrderId,
      status: "CONFLICT_REQUIRES_REVIEW",
      conflict: true,
      localRequestedStatus: update.status,
      serverCurrentStatus: current.status,
      message: `Conflict detected: Work order is already '${current.status}'. Cannot regress to '${update.status}' without supervisor resolution.`
    };
  }

  const newStatus = update.status || current.status;
  const updatedRecord = {
    ...current,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    version: (current.version || 1) + 1,
    lifecycleHistory: [
      ...(current.lifecycleHistory || []),
      {
        status: newStatus,
        timestamp: new Date().toISOString(),
        actor: update.actor || "OPERATOR",
        notes: update.notes || `Status transition to ${newStatus}`
      }
    ]
  };

  sandboxWorkOrders.set(workOrderId, updatedRecord);
  persistToStorage();
  return updatedRecord;
}

/**
 * Cancels a Sandbox work order.
 * 
 * @param {string} workOrderId Sandbox Work Order ID
 * @param {string} reason Cancellation reason
 * @returns {Promise<Object>} Cancelled work order
 */
export async function cancelWorkOrder(workOrderId, reason = "Cancelled by operator") {
  return updateWorkOrder(workOrderId, {
    status: 'CANCELLED',
    notes: reason,
    actor: 'OPERATOR'
  });
}

/**
 * Returns all active sandbox work orders.
 * 
 * @returns {Array<Object>} List of work orders
 */
export function getAllSandboxWorkOrders() {
  return Array.from(sandboxWorkOrders.values());
}

/**
 * Clears all sandbox work orders (for test reset / test suites).
 */
export function clearSandboxWorkOrders() {
  sandboxWorkOrders.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SANDBOX_STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }
}
