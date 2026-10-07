// CivicSense AI - Municipal Integration & Telemetry Service (Phase 10)
// Orchestrates municipal adapter routing, offline queue synchronization,
// idempotency checks, and operational telemetry.
// 
// STRICT GOVERNANCE:
// - Default mode: SANDBOX ("MUNICIPAL INTEGRATION: SANDBOX")
// - Zero external ERP calls without an authorized secure backend integration layer.
// - Zero Math.random() – Completely deterministic event IDs and work order digests.
// - Real latency metrics only (null if unmeasured, never 0 or fabricated).

import * as sandboxAdapter from './municipalAdapters/sandboxMunicipalAdapter.js';
import * as erpAdapter from './municipalAdapters/municipalErpAdapter.js';
import { getCurrentSession } from './authService.js';

export const INTEGRATION_MODES = {
  SANDBOX: "SANDBOX",
  ERP: "ERP"
};

export const SYNC_STATES = {
  LOCAL_ONLY: "LOCAL_ONLY",
  PENDING_SYNC: "PENDING_SYNC",
  SYNCING: "SYNCING",
  SYNCED: "SYNCED",
  SYNC_FAILED: "SYNC_FAILED",
  CONFLICT_REQUIRES_REVIEW: "CONFLICT_REQUIRES_REVIEW"
};

const QUEUE_STORAGE_KEY = 'civicsense_offline_incident_queue';
const TELEMETRY_STORAGE_KEY = 'civicsense_telemetry_events';

let activeIntegrationMode = INTEGRATION_MODES.SANDBOX;

// =========================================================================
// 1. ADAPTER RESOLUTION
// =========================================================================

export function getIntegrationMode() {
  return activeIntegrationMode;
}

export function setIntegrationMode(mode) {
  if (mode === INTEGRATION_MODES.ERP) {
    activeIntegrationMode = INTEGRATION_MODES.ERP;
  } else {
    activeIntegrationMode = INTEGRATION_MODES.SANDBOX;
  }
  return activeIntegrationMode;
}

export function getActiveAdapter() {
  if (activeIntegrationMode === INTEGRATION_MODES.ERP) {
    return erpAdapter;
  }
  return sandboxAdapter;
}

// =========================================================================
// 2. OFFLINE INCIDENT QUEUE MANAGEMENT
// =========================================================================

// In-memory queue fallback for Node CLI and non-browser environments
let inMemoryQueue = [];

function loadQueue() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          inMemoryQueue = arr;
          return arr;
        }
      }
    } catch (e) {
      console.warn("[QUEUE_STORAGE_NOTICE] Could not load offline queue:", e);
    }
  }
  return inMemoryQueue;
}

function persistQueue(queue) {
  inMemoryQueue = Array.isArray(queue) ? [...queue] : [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(inMemoryQueue));
    } catch (e) {
      console.warn("[QUEUE_STORAGE_NOTICE] Could not persist offline queue:", e);
    }
  }
}

/**
 * Enqueues a validated incident for municipal dispatch.
 * 
 * @param {Object} incident Incident object
 * @param {Object} [options] Options { isOfflineOnly, notes }
 * @returns {Object} Enqueued record
 */
export function enqueueIncidentForDispatch(incident, options = {}) {
  if (!incident || !incident.id) {
    throw new Error("INVALID_INCIDENT: Incident must contain a valid deterministic ID.");
  }

  const queue = loadQueue();
  const queueId = `QUEUE-${incident.id}`;
  const existingIdx = queue.findIndex(item => item.queueId === queueId);

  const session = getCurrentSession();
  const initialSyncState = options.isOfflineOnly 
    ? SYNC_STATES.LOCAL_ONLY 
    : SYNC_STATES.PENDING_SYNC;

  const queueItem = {
    queueId,
    incidentId: incident.id,
    incidentPayload: incident,
    syncState: initialSyncState,
    queuedAt: new Date().toISOString(),
    lastSyncAttempt: null,
    syncAttempts: 0,
    workOrderId: null,
    lastError: null,
    conflictDetails: null,
    operatorId: session.userId,
    operatorRole: session.role
  };

  if (existingIdx >= 0) {
    // Preserve existing workOrderId if already synced
    queueItem.workOrderId = queue[existingIdx].workOrderId;
    queueItem.syncAttempts = queue[existingIdx].syncAttempts;
    queue[existingIdx] = queueItem;
  } else {
    queue.push(queueItem);
  }

  persistQueue(queue);

  recordTelemetryEvent('INCIDENT_CREATED', {
    incidentId: incident.id,
    operatorId: session.userId,
    notes: `Incident enqueued for municipal dispatch (State: ${initialSyncState}).`
  });

  return queueItem;
}

/**
 * Synchronizes queued incidents with the active municipal adapter.
 * Handles network failures, idempotent retries, and conflicts (Section 10 & 11).
 * 
 * @param {Object} [options] Sync options { simulateNetworkFailure, simulateErpFailure, forceItemQueueId }
 * @returns {Promise<Object>} Summary of sync results { syncedCount, failedCount, conflictsCount, items }
 */
export async function syncOfflineQueue(options = {}) {
  const queue = loadQueue();
  const session = getCurrentSession();
  const adapter = getActiveAdapter();

  recordTelemetryEvent('SYNC_STARTED', {
    operatorId: session.userId,
    notes: `Sync triggered across ${queue.length} queue item(s).`
  });

  let syncedCount = 0;
  let failedCount = 0;
  let conflictsCount = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    // Filter to specific item if requested, otherwise process pending/failed
    if (options.forceItemQueueId && item.queueId !== options.forceItemQueueId) {
      continue;
    }

    if (item.syncState === SYNC_STATES.SYNCED && !options.forceItemQueueId) {
      continue;
    }

    item.syncState = SYNC_STATES.SYNCING;
    item.syncAttempts = (item.syncAttempts || 0) + 1;
    item.lastSyncAttempt = new Date().toISOString();

    // 1. Simulated or Actual Network Failure Handling (Section 11)
    if (options.simulateNetworkFailure) {
      item.syncState = SYNC_STATES.SYNC_FAILED;
      item.lastError = "NETWORK_ERROR: Municipal dispatch network unreachable. Incident retained locally for retry.";
      failedCount++;
      recordTelemetryEvent('SYNC_FAILED', {
        incidentId: item.incidentId,
        operatorId: session.userId,
        error: item.lastError
      });
      continue;
    }

    // 2. Dispatch via Active Adapter
    try {
      const result = await adapter.createWorkOrder(item.incidentPayload, {
        operatorId: session.userId,
        approvedBySupervisor: session.role === 'SUPERVISOR' || session.role === 'ADMIN',
        notes: item.incidentPayload.operatorReview?.notes || ""
      });

      if (result.status === 'CONFLICT_REQUIRES_REVIEW') {
        item.syncState = SYNC_STATES.CONFLICT_REQUIRES_REVIEW;
        item.conflictDetails = result;
        conflictsCount++;
      } else {
        item.syncState = SYNC_STATES.SYNCED;
        item.workOrderId = result.workOrderId;
        item.lastError = null;
        syncedCount++;

        recordTelemetryEvent('WORK_ORDER_CREATED', {
          incidentId: item.incidentId,
          operatorId: session.userId,
          workOrderId: result.workOrderId,
          notes: `Work order dispatched (${result.workOrderId}).`
        });
      }
    } catch (err) {
      item.syncState = SYNC_STATES.SYNC_FAILED;
      item.lastError = err.message || "Unknown municipal dispatch error.";
      failedCount++;

      recordTelemetryEvent('SYNC_FAILED', {
        incidentId: item.incidentId,
        operatorId: session.userId,
        error: item.lastError
      });
    }
  }

  persistQueue(queue);

  recordTelemetryEvent('SYNC_COMPLETED', {
    operatorId: session.userId,
    notes: `Sync batch completed: ${syncedCount} synced, ${failedCount} failed, ${conflictsCount} conflicts.`
  });

  return {
    syncedCount,
    failedCount,
    conflictsCount,
    items: queue
  };
}

/**
 * Returns all offline queue items.
 */
export function getOfflineQueue() {
  return loadQueue();
}

/**
 * Returns statistical counters for the municipal operations dashboard.
 */
export function getOfflineQueueStats() {
  const queue = loadQueue();
  const pending = queue.filter(i => i.syncState === SYNC_STATES.PENDING_SYNC || i.syncState === SYNC_STATES.LOCAL_ONLY).length;
  const synced = queue.filter(i => i.syncState === SYNC_STATES.SYNCED).length;
  const failed = queue.filter(i => i.syncState === SYNC_STATES.SYNC_FAILED).length;
  const conflicts = queue.filter(i => i.syncState === SYNC_STATES.CONFLICT_REQUIRES_REVIEW).length;
  
  const allWorkOrders = sandboxAdapter.getAllSandboxWorkOrders();
  const highPriorityWorkOrders = allWorkOrders.filter(w => w.priority === 'IMMEDIATE' || w.severity === 'HIGH' || w.severity === 'CRITICAL').length;

  return {
    totalQueueItems: queue.length,
    pendingSyncCount: pending,
    syncedCount: synced,
    failedCount: failed,
    conflictsCount: conflicts,
    workOrdersCount: allWorkOrders.length,
    highPriorityCount: highPriorityWorkOrders
  };
}

/**
 * Clears the offline queue (for test resets).
 */
export function clearOfflineQueue() {
  persistQueue([]);
}

// =========================================================================
// 3. OPERATIONAL TELEMETRY & PERFORMANCE PROFILING
// =========================================================================

// In-memory telemetry fallback for Node CLI and non-browser environments
let inMemoryTelemetry = [];

function loadTelemetry() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          inMemoryTelemetry = arr;
          return arr;
        }
      }
    } catch (e) {
      console.warn("[TELEMETRY_STORAGE_NOTICE] Could not load telemetry:", e);
    }
  }
  return inMemoryTelemetry;
}

function persistTelemetry(events) {
  inMemoryTelemetry = Array.isArray(events) ? events.slice(-100) : [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(inMemoryTelemetry));
    } catch (e) {
      console.warn("[TELEMETRY_STORAGE_NOTICE] Could not persist telemetry:", e);
    }
  }
}

/**
 * Records an operational telemetry event matching the Phase 10 event schema.
 * 
 * STRICT RULES:
 * - Deterministic event ID format: EVT-<type>-<timestamp-ms>-<seq>
 * - Performance metrics strictly null if unmeasured (no 0 substitution, no fake numbers)
 * - Zero raw image data, zero passwords, zero secrets.
 * 
 * @param {string} eventType One of standard telemetry events
 * @param {Object} details Event attributes
 */
export function recordTelemetryEvent(eventType, details = {}) {
  const events = loadTelemetry();
  const session = getCurrentSession();
  const now = new Date();
  const seq = events.length + 1;
  const eventId = `EVT-${eventType}-${now.getTime()}-${seq}`;

  const eventRecord = {
    eventId,
    eventType,
    timestamp: now.toISOString(), // Labeled EVENT TIME
    label: "EVENT TIME",
    incidentId: details.incidentId || null,
    operatorId: details.operatorId || session.userId,
    integrationMode: activeIntegrationMode,
    processingMetrics: {
      imageLoadMs: typeof details.metrics?.imageLoadMs === 'number' ? details.metrics.imageLoadMs : null,
      roadInferenceMs: typeof details.metrics?.roadInferenceMs === 'number' ? details.metrics.roadInferenceMs : null,
      wasteInferenceMs: typeof details.metrics?.wasteInferenceMs === 'number' ? details.metrics.wasteInferenceMs : null,
      floodInferenceMs: typeof details.metrics?.floodInferenceMs === 'number' ? details.metrics.floodInferenceMs : null,
      arbitrationMs: typeof details.metrics?.arbitrationMs === 'number' ? details.metrics.arbitrationMs : null,
      totalInferenceMs: typeof details.metrics?.totalInferenceMs === 'number' ? details.metrics.totalInferenceMs : null,
      uiProcessingMs: typeof details.metrics?.uiProcessingMs === 'number' ? details.metrics.uiProcessingMs : null
    },
    notes: details.notes || null,
    error: details.error || null,
    workOrderId: details.workOrderId || null
  };

  events.push(eventRecord);
  persistTelemetry(events);
  return eventRecord;
}

export function getTelemetryEvents() {
  return loadTelemetry();
}

export function clearTelemetryEvents() {
  persistTelemetry([]);
}
