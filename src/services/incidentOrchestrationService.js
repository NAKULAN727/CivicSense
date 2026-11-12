// CivicSense AI - Central Incident Orchestration Service (Phase 17)
// Unified AI Detection to Civic Intelligence Pipeline
// Connects AI Detection -> Quality Audit -> Metadata -> Models -> Contextual Arbitration ->
// Severity Assessment -> Candidate Generation -> Human Review -> Incident Filing ->
// Department Routing -> Predictive Analytics -> Maintenance Recommendations -> GIS & Dashboard Updates.
//
// STRICT GOVERNANCE:
// - Zero Math.random() – Completely deterministic IDs, hashes, and audits.
// - Category-specific severity & predictive routing.
// - Real latency metrics only (null if unmeasured, never fabricated).
// - Human Review Gate (ACCEPT / IGNORE / REJECT).
// - Non-blocking asynchronous processing with structured error boundaries.

import { 
  auditImageQuality, 
  extractImageMetadata, 
  runGenuineVisualInference 
} from './visualInferenceService.js';
import { 
  calculateVisualDetectionsSeverity, 
  formatCanonicalIncident,
  applyOperatorReview,
  updateIncidentLifecycleStatus,
  generateDeterministicIncidentId
} from './civicSeverityService.js';
import { routeIncidentToDepartment as routeBoundaryDepartment } from './boundaryService.js';
import { generateStandardizedPredictionStatus } from './predictiveRiskService.js';
import { enqueueIncidentForDispatch, recordTelemetryEvent } from './municipalIntegrationService.js';
import { createWorkOrder } from './municipalAdapters/sandboxMunicipalAdapter.js';
import { getCurrentSession } from './authService.js';

export { 
  formatCanonicalIncident, 
  generateDeterministicIncidentId 
};

/**
 * Category-aware department routing for canonical incidents.
 */
export function routeIncidentToDepartment(incident) {
  const defaultCategoryDept = incident.category === 'ROAD' ? 'Greater Chennai Corporation - Bus Route Roads & Pavements' :
    incident.category === 'WASTE' ? 'Greater Chennai Corporation - Solid Waste Management' :
    incident.category === 'FLOOD' ? 'Greater Chennai Corporation - Storm Water Drains & Rivers' :
    'Greater Chennai Corporation - General Municipal Administration';

  const primaryDept = (incident.department && incident.department !== 'Municipal Administration') 
    ? incident.department 
    : (incident.recommendedDepartment && incident.recommendedDepartment !== 'Municipal Administration')
    ? incident.recommendedDepartment
    : defaultCategoryDept;

  const wardAssignment = routeBoundaryDepartment({
    primaryDepartment: primaryDept,
    latitude: incident.latitude,
    longitude: incident.longitude
  });

  return {
    department: primaryDept,
    primaryDepartment: primaryDept,
    ward: wardAssignment.wardName || incident.ward || 'Metropolitan Spatial District',
    wardAssignmentStatus: wardAssignment.wardAssignmentStatus,
    justification: `Jurisdictional routing based on ${incident.category || 'MUNICIPAL'} classification.`
  };
}
const INCIDENT_REGISTRY_STORAGE_KEY = 'civicsense_central_incident_registry';
const REVIEW_HISTORY_STORAGE_KEY = 'civicsense_review_history';

// Lifecycle State Machine
export const INCIDENT_LIFECYCLE_STAGES = {
  DETECTED: 'DETECTED',
  AWAITING_REVIEW: 'AWAITING_REVIEW',
  ACCEPTED: 'ACCEPTED',
  FILED: 'FILED',
  DEPARTMENT_ASSIGNED: 'DEPARTMENT_ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  VERIFIED: 'VERIFIED',
  CLOSED: 'CLOSED'
};

export const OPERATOR_REVIEW_ACTIONS = {
  ACCEPT: 'ACCEPT',
  IGNORE: 'IGNORE',
  REJECT: 'REJECT'
};

// In-Memory Cache with LocalStorage Persistence
let centralIncidentRegistry = new Map();
let reviewHistoryList = [];
const subscribers = new Set();

/**
 * Loads registry and review history from localStorage.
 */
function initializeStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedInc = window.localStorage.getItem(INCIDENT_REGISTRY_STORAGE_KEY);
      if (storedInc) {
        const arr = JSON.parse(storedInc);
        if (Array.isArray(arr)) {
          centralIncidentRegistry = new Map(arr.map(item => [item.incidentId || item.id, item]));
        }
      }

      const storedRev = window.localStorage.getItem(REVIEW_HISTORY_STORAGE_KEY);
      if (storedRev) {
        const arr = JSON.parse(storedRev);
        if (Array.isArray(arr)) {
          reviewHistoryList = arr;
        }
      }
    } catch (e) {
      console.warn("[ORCHESTRATION_STORAGE_NOTICE] Could not load persisted incident registry:", e);
    }
  }
}

/**
 * Persists current registry and history to localStorage.
 */
function persistStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const arr = Array.from(centralIncidentRegistry.values());
      window.localStorage.setItem(INCIDENT_REGISTRY_STORAGE_KEY, JSON.stringify(arr));
      window.localStorage.setItem(REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(reviewHistoryList));
    } catch (e) {
      console.warn("[ORCHESTRATION_STORAGE_NOTICE] Could not persist incident registry:", e);
    }
  }
}

// Initial Load
initializeStorage();

/**
 * Notifies all reactive UI subscribers of state changes.
 */
function notifySubscribers() {
  const allIncidents = Array.from(centralIncidentRegistry.values());
  const stats = getOrchestrationStats();
  subscribers.forEach(cb => {
    try {
      cb({ incidents: allIncidents, history: reviewHistoryList, stats });
    } catch (err) {
      console.error("[ORCHESTRATION_SUBSCRIBER_ERROR]", err);
    }
  });
}

/**
 * Subscribes a React component to real-time central incident updates.
 * @param {Function} callback Callback receiving ({ incidents, history, stats })
 * @returns {Function} Unsubscribe function
 */
export function subscribeToOrchestration(callback) {
  subscribers.add(callback);
  // Immediately emit current state
  try {
    callback({
      incidents: Array.from(centralIncidentRegistry.values()),
      history: reviewHistoryList,
      stats: getOrchestrationStats()
    });
  } catch (e) {}

  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Computes live operational intelligence metrics across all persisted incidents.
 */
export function getOrchestrationStats() {
  const incidents = Array.from(centralIncidentRegistry.values());
  const totalIncidents = incidents.length;
  
  // Pending review candidates from review history or active registry
  const pendingReviews = reviewHistoryList.filter(r => r.operatorStatus === 'AWAITING_REVIEW').length;
  const acceptedIncidents = incidents.filter(i => 
    i.operatorStatus === 'ACCEPTED' || i.operatorStatus === 'CONFIRMED' || i.lifecycleStatus !== 'AWAITING_REVIEW'
  ).length;
  const criticalIncidents = incidents.filter(i => i.severity === 'CRITICAL').length;
  const unresolvedIncidents = incidents.filter(i => 
    i.lifecycleStatus !== 'RESOLVED' && i.lifecycleStatus !== 'VERIFIED' && i.lifecycleStatus !== 'CLOSED'
  ).length;

  const categoryBreakdown = {
    ROAD: incidents.filter(i => i.category === 'ROAD').length,
    WASTE: incidents.filter(i => i.category === 'WASTE').length,
    FLOOD: incidents.filter(i => i.category === 'FLOOD').length,
    MULTI: incidents.filter(i => i.category === 'MULTI').length
  };

  const severityDistribution = {
    LOW: incidents.filter(i => i.severity === 'LOW').length,
    MEDIUM: incidents.filter(i => i.severity === 'MEDIUM').length,
    HIGH: incidents.filter(i => i.severity === 'HIGH').length,
    CRITICAL: incidents.filter(i => i.severity === 'CRITICAL').length
  };

  return {
    totalIncidents,
    pendingReviews,
    acceptedIncidents,
    criticalIncidents,
    unresolvedIncidents,
    categoryBreakdown,
    severityDistribution
  };
}

/**
 * Returns all active, accepted canonical incidents.
 */
export function getAllActiveIncidents() {
  return Array.from(centralIncidentRegistry.values());
}

export const getAllIncidents = getAllActiveIncidents;

/**
 * Returns complete review history (including ACCEPTED, IGNORED, REJECTED).
 */
export function getReviewHistory() {
  return [...reviewHistoryList];
}

/**
 * Finds a specific incident by ID.
 */
export function getIncidentById(incidentId) {
  return centralIncidentRegistry.get(incidentId) || null;
}

// =========================================================================
// CENTRAL ORCHESTRATION PIPELINE (Section 1)
// =========================================================================

/**
 * Initiates the complete 14-stage Unified AI Detection to Civic Intelligence Pipeline.
 * 
 * Flow:
 * 1. Image Upload Verification
 * 2. Image Quality Audit
 * 3. Metadata Extraction (EXIF GPS & Timestamp)
 * 4. Model Inference (Road + Waste + Flood ONNX)
 * 5. Contextual Cross-Model Arbitration
 * 6. Category-Specific Severity Assessment
 * 7. Canonical Incident Candidate Generation
 * 8. Predictive Analytics Integration
 * 9. Department Routing Recommendation
 * 10. Maintenance Planning Recommendations
 * 11. Traceable Processing Summary
 * 
 * @param {Object} input
 * @param {HTMLImageElement} input.imageElement Preloaded Image DOM element
 * @param {Object} [input.metadata] Pre-extracted EXIF or mock metadata
 * @param {string} [input.imageSourceType] Source description
 * @param {number} [input.confidenceThreshold] Detection threshold (0.30 - 0.95)
 * @param {number} [input.imageLoadTimeMs] Image loading duration
 * @returns {Promise<Object>} Comprehensive Orchestration Payload
 */
export async function orchestrateImageAnalysis({
  imageElement,
  metadata = null,
  imageSourceType = 'STREET LEVEL IMAGE',
  confidenceThreshold = 0.50,
  imageLoadTimeMs = null
}) {
  const orchestrateStart = performance.now();
  const pipelineTrace = {
    pipelineId: `PIPE-${Date.now()}`,
    startTime: new Date().toISOString(),
    stages: {},
    errors: []
  };

  try {
    // 1. IMAGE UPLOAD & DIMENSION VALIDATION
    if (!imageElement || !imageElement.naturalWidth || !imageElement.naturalHeight) {
      throw new Error("INVALID_IMAGE_ELEMENT: Image element must be fully loaded with valid natural dimensions.");
    }
    const originalWidth = imageElement.naturalWidth;
    const originalHeight = imageElement.naturalHeight;
    pipelineTrace.stages.UPLOAD = { status: 'COMPLETED', dimensions: `${originalWidth}×${originalHeight}` };

    // 2. IMAGE QUALITY VALIDATION
    const qualityAudit = auditImageQuality({
      width: originalWidth,
      height: originalHeight,
      orientation: metadata?.orientation || 'Normal'
    });
    pipelineTrace.stages.QUALITY_AUDIT = {
      status: 'COMPLETED',
      qualityScore: qualityAudit.qualityScore,
      isLowResolution: qualityAudit.isLowResolution,
      megapixels: qualityAudit.megapixels
    };

    // 3. METADATA EXTRACTION (GPS & TIMESTAMP)
    const verifiedMetadata = {
      latitude: typeof metadata?.latitude === 'number' ? metadata.latitude : null,
      longitude: typeof metadata?.longitude === 'number' ? metadata.longitude : null,
      timestamp: metadata?.timestamp || null,
      isGpsVerified: Boolean(metadata?.isGpsVerified && metadata?.latitude && metadata?.longitude),
      orientation: metadata?.orientation || 'Normal'
    };
    pipelineTrace.stages.METADATA = {
      status: 'COMPLETED',
      gpsVerified: verifiedMetadata.isGpsVerified,
      coordinates: verifiedMetadata.isGpsVerified ? `${verifiedMetadata.latitude}, ${verifiedMetadata.longitude}` : 'UNAVAILABLE'
    };

    // 4. MULTI-MODEL INFERENCE (ROAD + WASTE + FLOOD ONNX)
    const inferenceResult = await runGenuineVisualInference({
      imageElement,
      metadata: verifiedMetadata,
      imageSourceType,
      confidenceThreshold,
      imageLoadTimeMs,
      floodModelUrl: '/models/flood_segmentation.onnx'
    });
    pipelineTrace.stages.INFERENCE = {
      status: 'COMPLETED',
      roadDetections: inferenceResult.detections.road.length,
      wasteDetections: inferenceResult.detections.waste.length,
      floodWaterCoveragePct: inferenceResult.flood?.floodedAreaPercent ?? 0,
      timing: inferenceResult.timingBreakdown
    };

    // 5. CONTEXTUAL CROSS-MODEL ARBITRATION & SEVERITY ASSESSMENT
    const severityAnalysis = calculateVisualDetectionsSeverity({
      ...inferenceResult,
      isAvailable: true
    });
    pipelineTrace.stages.ARBITRATION = {
      status: 'COMPLETED',
      rawRoadCount: severityAnalysis.rawDetections?.road?.length ?? 0,
      rawWasteCount: severityAnalysis.rawDetections?.waste?.length ?? 0,
      suppressedWasteCount: severityAnalysis.suppressedDetections?.length ?? 0,
      confirmedIncidentsCount: severityAnalysis.civicIncidents?.length ?? 0
    };

    // 6. CANONICAL INCIDENT CANDIDATE GENERATION
    // AI Detection Hub generates candidate records awaiting human triage (Section 5)
    const rawCandidates = severityAnalysis.civicIncidents || [];
    const formattedCandidates = rawCandidates.map((rawInc, index) => {
      const canonical = formatCanonicalIncident({
        ...rawInc,
        operatorStatus: 'AWAITING_REVIEW',
        lifecycleStatus: INCIDENT_LIFECYCLE_STAGES.AWAITING_REVIEW,
        processingTimestamp: new Date().toISOString()
      });

      // 7. PREDICTIVE ANALYTICS INTEGRATION (Category-Specific)
      const predictiveAssessment = generateStandardizedPredictionStatus(canonical);

      // 8. DEPARTMENT ROUTING RECOMMENDATION
      const routingResult = routeIncidentToDepartment(canonical);

      return {
        ...canonical,
        predictionStatus: predictiveAssessment,
        recommendedDepartment: routingResult.department || canonical.department,
        routingJustification: routingResult.justification || 'Category-specific jurisdictional routing.',
        isCandidate: true,
        candidateIndex: index + 1
      };
    });

    pipelineTrace.stages.CANDIDATE_GENERATION = {
      status: 'COMPLETED',
      candidateCount: formattedCandidates.length
    };

    // Record review history entry for tracking
    formattedCandidates.forEach(cand => {
      const existingIdx = reviewHistoryList.findIndex(r => r.incidentId === cand.incidentId);
      if (existingIdx === -1) {
        reviewHistoryList.push({
          incidentId: cand.incidentId,
          incidentType: cand.incidentType,
          category: cand.category,
          severity: cand.severity,
          operatorStatus: 'AWAITING_REVIEW',
          lifecycleStatus: INCIDENT_LIFECYCLE_STAGES.AWAITING_REVIEW,
          timestamp: new Date().toISOString(),
          candidatePayload: cand
        });
      }
    });
    persistStorage();

    const orchestrateEnd = performance.now();
    pipelineTrace.totalDurationMs = Number((orchestrateEnd - orchestrateStart).toFixed(1));
    pipelineTrace.status = 'SUCCESS';

    return {
      success: true,
      pipelineTrace,
      qualityAudit,
      metadata: verifiedMetadata,
      inferenceResult,
      severityAnalysis,
      candidates: formattedCandidates,
      timingBreakdown: {
        ...(severityAnalysis.timingBreakdown || {}),
        orchestrationDurationMs: pipelineTrace.totalDurationMs
      }
    };

  } catch (err) {
    const orchestrateEnd = performance.now();
    pipelineTrace.totalDurationMs = Number((orchestrateEnd - orchestrateStart).toFixed(1));
    pipelineTrace.status = 'FAILED';
    pipelineTrace.errors.push(err.message || String(err));

    console.error("[INCIDENT_ORCHESTRATION_ERROR]", err);

    return {
      success: false,
      error: err.message || String(err),
      pipelineTrace,
      candidates: [],
      timingBreakdown: {
        orchestrationDurationMs: pipelineTrace.totalDurationMs
      }
    };
  }
}

// =========================================================================
// HUMAN REVIEW & INCIDENT APPROVAL (Section 5 & 10)
// =========================================================================

/**
 * Human Operator Action: ACCEPT
 * - Validates incident candidate.
 * - Enforces uniqueness & idempotency (prevents duplicate creation).
 * - Enters the central active incident registry.
 * - Dispatches to municipal adapter (creates work order).
 * - Notifies all downstream modules (GIS, Dashboard, Civic Health, Planner, Reports).
 * 
 * @param {Object|string} candidate Incident candidate object or incidentId
 * @param {Object} [options] Review options { notes, operatorId }
 * @returns {Promise<Object>} Created and activated canonical incident record
 */
export async function acceptIncidentCandidate(candidate, options = {}) {
  let candObj = candidate;
  if (typeof candidate === 'string') {
    const fromHist = reviewHistoryList.find(r => r.incidentId === candidate);
    candObj = fromHist?.candidatePayload || centralIncidentRegistry.get(candidate) || { incidentId: candidate, title: 'Civic Defect', category: 'ROAD', severity: 'HIGH' };
  }

  if (!candObj || !candObj.incidentId) {
    throw new Error("INVALID_CANDIDATE: Incident candidate must have a valid incidentId.");
  }

  const session = getCurrentSession();
  const operatorId = options.operatorId || session.userId || 'FIELD-OPERATOR-1';
  const notes = options.notes || 'Accepted and verified by operator during triage.';
  const nowStr = new Date().toISOString();

  const incidentId = candObj.incidentId || candObj.id;

  // 1. Idempotency Check: Prevent duplicate creation
  if (centralIncidentRegistry.has(incidentId)) {
    const existing = centralIncidentRegistry.get(incidentId);
    console.log(`[ORCHESTRATION_IDEMPOTENT_HIT] Incident ${incidentId} already activated.`);
    return {
      success: true,
      isDuplicate: true,
      incident: existing,
      ...existing
    };
  }

  // 2. Construct Formal Canonical Incident
  const acceptedIncident = {
    ...candObj,
    id: incidentId,
    incidentId: incidentId,
    operatorStatus: 'ACCEPTED',
    operatorDecision: {
      decision: 'CONFIRMED',
      reason: notes,
      operatorId,
      timestamp: nowStr
    },
    lifecycleStatus: INCIDENT_LIFECYCLE_STAGES.ACCEPTED,
    incidentStatus: 'ACKNOWLEDGED',
    reviewedBy: operatorId,
    reviewTimestamp: nowStr,
    auditTrail: [
      ...(candObj.auditTrail || []),
      {
        stepNumber: (candObj.auditTrail?.length || 0) + 1,
        stepName: 'HUMAN_OPERATOR_ACCEPTED',
        timestamp: nowStr,
        summary: `Operator Decision: ACCEPTED`,
        details: `Incident verified and promoted to active municipal record by ${operatorId}. Notes: "${notes}"`
      }
    ]
  };

  // 3. Initiate Department Routing & Municipal Dispatch
  try {
    enqueueIncidentForDispatch(acceptedIncident, { notes });
    const wo = await createWorkOrder(acceptedIncident, {
      operatorId,
      approvedBySupervisor: true,
      notes
    });

    acceptedIncident.workOrderId = wo.workOrderId;
    acceptedIncident.lifecycleStatus = INCIDENT_LIFECYCLE_STAGES.FILED;
    acceptedIncident.auditTrail.push({
      stepNumber: acceptedIncident.auditTrail.length + 1,
      stepName: 'MUNICIPAL_DISPATCH_COMPLETED',
      timestamp: new Date().toISOString(),
      summary: `Work Order Created: ${wo.workOrderId}`,
      details: `Successfully dispatched to ${acceptedIncident.recommendedDepartment || 'Sandbox Operations'}.`
    });
  } catch (err) {
    console.warn(`[DISPATCH_NOTICE] Work order generation deferred or sandbox error:`, err);
  }

  // 4. Persist to Central Registry
  centralIncidentRegistry.set(acceptedIncident.incidentId, acceptedIncident);

  // Update Review History
  const historyIdx = reviewHistoryList.findIndex(r => r.incidentId === acceptedIncident.incidentId);
  const historyEntry = {
    incidentId: acceptedIncident.incidentId,
    incidentType: acceptedIncident.incidentType,
    category: acceptedIncident.category,
    severity: acceptedIncident.severity,
    operatorStatus: 'ACCEPTED',
    operatorId,
    notes,
    timestamp: nowStr,
    workOrderId: acceptedIncident.workOrderId || null
  };

  if (historyIdx >= 0) {
    reviewHistoryList[historyIdx] = historyEntry;
  } else {
    reviewHistoryList.push(historyEntry);
  }

  persistStorage();
  notifySubscribers();

  recordTelemetryEvent('INCIDENT_CONFIRMED', {
    incidentId: acceptedIncident.incidentId,
    operatorId,
    notes
  });

  return {
    success: true,
    isDuplicate: false,
    incident: acceptedIncident,
    ...acceptedIncident
  };
}

/**
 * Human Operator Action: IGNORE
 * - Stores decision with required reason.
 * - Preserves record in review history.
 * - Does NOT create an active municipal incident.
 * 
 * @param {Object|string} candidateOrId Candidate object or incidentId
 * @param {string|Object} reasonOrOptions Mandatory reason string or options object
 * @param {Object} [options] Review options { operatorId }
 * @returns {Object} Updated review record
 */
export function ignoreIncidentCandidate(candidateOrId, reasonOrOptions = {}, options = {}) {
  const incidentId = typeof candidateOrId === 'string' ? candidateOrId : candidateOrId?.incidentId;
  const reason = typeof reasonOrOptions === 'string' 
    ? reasonOrOptions 
    : (reasonOrOptions?.reason || reasonOrOptions?.notes || options?.reason || options?.notes);
  const opts = typeof reasonOrOptions === 'object' ? reasonOrOptions : options;

  if (!reason || !reason.trim()) {
    throw new Error("REASON_REQUIRED: A specific reason is mandatory to IGNORE an incident candidate.");
  }

  const session = getCurrentSession();
  const operatorId = opts.operatorId || session.userId || 'FIELD-OPERATOR-1';
  const nowStr = new Date().toISOString();

  // If incident was in active registry, remove it from active queue
  if (centralIncidentRegistry.has(incidentId)) {
    centralIncidentRegistry.delete(incidentId);
  }

  // Record into Review History
  const historyIdx = reviewHistoryList.findIndex(r => r.incidentId === incidentId);
  const historyEntry = {
    incidentId,
    incidentType: candidateOrId?.incidentType || 'CIVIC_ISSUE',
    category: candidateOrId?.category || 'UNCERTAIN',
    severity: candidateOrId?.severity || 'LOW',
    operatorStatus: 'IGNORED',
    operatorId,
    notes: reason.trim(),
    timestamp: nowStr,
    workOrderId: null
  };

  if (historyIdx >= 0) {
    reviewHistoryList[historyIdx] = historyEntry;
  } else {
    reviewHistoryList.push(historyEntry);
  }

  persistStorage();
  notifySubscribers();

  recordTelemetryEvent('OPERATOR_REVIEWED', {
    incidentId,
    operatorId,
    notes: `Incident IGNORED. Reason: "${reason.trim()}"`
  });

  return {
    success: true,
    incident: historyEntry,
    ...historyEntry
  };
}

/**
 * Human Operator Action: REJECT
 * - Stores decision with required reason.
 * - Preserves audit history.
 * - Does NOT create an active municipal incident.
 * 
 * @param {Object|string} candidateOrId Candidate object or incidentId
 * @param {string|Object} reasonOrOptions Mandatory reason string or options object
 * @param {Object} [options] Review options { operatorId }
 * @returns {Object} Updated review record
 */
export function rejectIncidentCandidate(candidateOrId, reasonOrOptions = {}, options = {}) {
  const incidentId = typeof candidateOrId === 'string' ? candidateOrId : candidateOrId?.incidentId;
  const reason = typeof reasonOrOptions === 'string' 
    ? reasonOrOptions 
    : (reasonOrOptions?.reason || reasonOrOptions?.notes || options?.reason || options?.notes);
  const opts = typeof reasonOrOptions === 'object' ? reasonOrOptions : options;

  if (!reason || !reason.trim()) {
    throw new Error("REASON_REQUIRED: A specific reason is mandatory to REJECT an incident candidate.");
  }

  const session = getCurrentSession();
  const operatorId = opts.operatorId || session.userId || 'FIELD-OPERATOR-1';
  const nowStr = new Date().toISOString();

  // If incident was in active registry, remove it
  if (centralIncidentRegistry.has(incidentId)) {
    centralIncidentRegistry.delete(incidentId);
  }

  // Record into Review History
  const historyIdx = reviewHistoryList.findIndex(r => r.incidentId === incidentId);
  const historyEntry = {
    incidentId,
    incidentType: candidateOrId?.incidentType || 'CIVIC_ISSUE',
    category: candidateOrId?.category || 'UNCERTAIN',
    severity: candidateOrId?.severity || 'LOW',
    operatorStatus: 'REJECTED',
    operatorId,
    notes: reason.trim(),
    timestamp: nowStr,
    workOrderId: null
  };

  if (historyIdx >= 0) {
    reviewHistoryList[historyIdx] = historyEntry;
  } else {
    reviewHistoryList.push(historyEntry);
  }

  persistStorage();
  notifySubscribers();

  recordTelemetryEvent('INCIDENT_REJECTED', {
    incidentId,
    operatorId,
    notes: `Incident REJECTED. Reason: "${reason.trim()}"`
  });

  return {
    success: true,
    incident: historyEntry,
    ...historyEntry
  };
}

/**
 * Transitions an incident through its formal lifecycle stages (Section 10).
 * Stages: DETECTED -> AWAITING_REVIEW -> ACCEPTED -> FILED -> DEPARTMENT_ASSIGNED -> IN_PROGRESS -> RESOLVED -> VERIFIED -> CLOSED
 * 
 * @param {string} incidentId Unique incident identifier
 * @param {string} newStatus New lifecycle stage
 * @param {Object} [options] Transition options { operatorId, notes }
 * @returns {Object} Updated incident record
 */
export function updateIncidentLifecycle(incidentId, newStatus, options = {}) {
  const incident = centralIncidentRegistry.get(incidentId);
  if (!incident) {
    throw new Error(`INCIDENT_NOT_FOUND: Cannot update lifecycle for nonexistent incident ${incidentId}.`);
  }

  const session = getCurrentSession();
  const operatorId = options.operatorId || session.userId || 'OPERATOR';
  const nowStr = new Date().toISOString();
  const notes = options.notes || `Lifecycle stage transitioned to ${newStatus}`;

  const updatedIncident = {
    ...incident,
    lifecycleStatus: newStatus,
    incidentStatus: newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? 'RESOLVED' : 'IN_PROGRESS',
    updatedAt: nowStr,
    auditTrail: [
      ...(incident.auditTrail || []),
      {
        stepNumber: (incident.auditTrail?.length || 0) + 1,
        stepName: `LIFECYCLE_${newStatus}`,
        timestamp: nowStr,
        summary: `Lifecycle Stage: ${newStatus}`,
        details: `${notes} (by ${operatorId})`
      }
    ]
  };

  centralIncidentRegistry.set(incidentId, updatedIncident);
  persistStorage();
  notifySubscribers();

  return updatedIncident;
}

/**
 * Helper to clear all central incidents (for testing or reset purposes).
 */
export function clearCentralIncidentRegistry() {
  centralIncidentRegistry.clear();
  reviewHistoryList = [];
  persistStorage();
  notifySubscribers();
}
