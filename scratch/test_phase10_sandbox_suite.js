// CivicSense AI - Phase 10 Municipal Sandbox Test Suite
// Executes all 10 mandated sandbox tests and GeoJSON validation tests deterministically.

import * as sandboxAdapter from '../src/services/municipalAdapters/sandboxMunicipalAdapter.js';
import * as municipalService from '../src/services/municipalIntegrationService.js';
import * as boundaryService from '../src/services/boundaryService.js';
import * as authService from '../src/services/authService.js';

console.log("==================================================");
console.log("CIVICSENSE AI — PHASE 10 SANDBOX TEST SUITE");
console.log("==================================================\n");

let passedCount = 0;
let totalTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ↳ ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       ↳ ${details}`);
    process.exitCode = 1;
  }
}

// Reset state
sandboxAdapter.clearSandboxWorkOrders();
municipalService.clearOfflineQueue();
municipalService.clearTelemetryEvents();

// Base Incident Fixtures
const roadIncident = {
  id: "civic-RD-1297-8021-1728210000-01",
  incidentType: "ROAD_DAMAGE",
  title: "Pothole (D40) Cavity",
  sourceEvidence: "RDD2022: D40 (78% confidence)",
  confidence: 0.78,
  severity: "HIGH",
  priority: "HIGH",
  recommendedDepartment: "Highways / Roads & Pavement Maintenance",
  recommendedAction: "Inspect and repair affected pavement section.",
  operatorStatus: "CONFIRMED",
  location: {
    isGpsVerified: true,
    latitude: 12.9716,
    longitude: 80.2184,
    formatted: "12.9716° N, 80.2184° E"
  },
  captureTimestamp: "2026:10:06 14:15:22"
};

const wasteIncident = {
  id: "civic-WST-1298-8022-1728210000-02",
  incidentType: "WASTE_ACCUMULATION",
  title: "Visible Waste Accumulation",
  sourceEvidence: "Waste model: Plastic Waste (84%)",
  confidence: 0.84,
  severity: "HIGH",
  priority: "HIGH",
  recommendedDepartment: "Solid Waste Management",
  recommendedAction: "Dispatch zonal waste collection truck.",
  operatorStatus: "CONFIRMED",
  location: {
    isGpsVerified: true,
    latitude: 12.9801,
    longitude: 80.2210,
    formatted: "12.9801° N, 80.2210° E"
  },
  captureTimestamp: "2026:10:06 14:18:10"
};

const floodIncident = {
  id: "civic-FLD-1296-8023-1728210000-03",
  incidentType: "SIGNIFICANT_WATERLOGGING",
  title: "Significant Roadway Waterlogging",
  sourceEvidence: "Flood segmentation: 38.5% water coverage (continuous)",
  confidence: null,
  severity: "CRITICAL",
  priority: "IMMEDIATE",
  recommendedDepartment: "Stormwater / Drainage Department",
  recommendedAction: "Prioritize drainage inspection and emergency stormwater response.",
  operatorStatus: "CONFIRMED",
  location: {
    isGpsVerified: true,
    latitude: 12.9650,
    longitude: 80.2300,
    formatted: "12.9650° N, 80.2300° E"
  },
  captureTimestamp: "2026:10:06 14:22:00"
};

const waterFilledPotholeIncident = {
  id: "civic-WFP-1297-8021-1728210000-04",
  incidentType: "WATER_FILLED_POTHOLE",
  title: "Water-Filled Pothole (Hazard Fusion)",
  sourceEvidence: "Multi-modal hazard fusion: Structural road cavity (D40) holding standing water.",
  confidence: 0.72,
  severity: "HIGH",
  priority: "IMMEDIATE",
  recommendedDepartment: "Highways / Roads & Pavement Maintenance",
  secondaryAdvisory: "Stormwater Drainage Department (Advisory)",
  recommendedAction: "Inspect and repair pothole and verify drainage/water accumulation.",
  operatorStatus: "CONFIRMED",
  location: {
    isGpsVerified: true,
    latitude: 12.9720,
    longitude: 80.2190,
    formatted: "12.9720° N, 80.2190° E"
  },
  captureTimestamp: "2026:10:06 14:25:30"
};

async function runTestSuite() {
  // TEST 1: Create confirmed road incident -> Sandbox work order created
  const wo1 = await sandboxAdapter.createWorkOrder(roadIncident, { operatorId: "OP-01" });
  assert(
    wo1 && wo1.workOrderId.startsWith("SANDBOX-WO-") && wo1.status === "DISPATCHED" && !wo1.isIdempotentDuplicate,
    "TEST 1: Create confirmed road incident",
    `Created Work Order: ${wo1.workOrderId} | Status: ${wo1.status} | Dept: ${wo1.department}`
  );

  // TEST 2: Repeat same request -> Same work order returned without duplicate
  const wo2 = await sandboxAdapter.createWorkOrder(roadIncident, { operatorId: "OP-01" });
  const allOrdersAfterT2 = sandboxAdapter.getAllSandboxWorkOrders();
  assert(
    wo2.workOrderId === wo1.workOrderId && wo2.isIdempotentDuplicate === true && allOrdersAfterT2.length === 1,
    "TEST 2: Repeat same request (Idempotency check)",
    `Returned same ID: ${wo2.workOrderId} | Duplicate prevented (Total count: ${allOrdersAfterT2.length})`
  );

  // TEST 3: Create waste incident -> Solid Waste routing
  const wo3 = await sandboxAdapter.createWorkOrder(wasteIncident, { operatorId: "OP-01" });
  assert(
    wo3 && wo3.department === "Solid Waste Management" && wo3.workOrderId.startsWith("SANDBOX-WO-"),
    "TEST 3: Create waste incident",
    `Routed to: ${wo3.department} | Work Order: ${wo3.workOrderId}`
  );

  // TEST 4: Create significant flood incident -> Stormwater routing
  const wo4 = await sandboxAdapter.createWorkOrder(floodIncident, { operatorId: "OP-01", approvedBySupervisor: true });
  assert(
    wo4 && wo4.department === "Stormwater / Drainage Department" && wo4.severity === "CRITICAL",
    "TEST 4: Create significant flood incident",
    `Routed to: ${wo4.department} | Severity: ${wo4.severity}`
  );

  // TEST 5: Create water-filled pothole -> Highways + Drainage advisory
  const wo5 = await sandboxAdapter.createWorkOrder(waterFilledPotholeIncident, { operatorId: "OP-01", approvedBySupervisor: true });
  assert(
    wo5 && wo5.department === "Highways / Roads & Pavement Maintenance" && Boolean(wo5.secondaryDepartment),
    "TEST 5: Create water-filled pothole (Dual Routing)",
    `Primary: ${wo5.department} | Secondary: ${wo5.secondaryDepartment}`
  );

  // TEST 6: Rejected incident -> No work order created
  const rejectedIncident = {
    ...roadIncident,
    id: "civic-REJ-1297-8021-001",
    operatorStatus: "REJECTED"
  };
  let rejError = null;
  try {
    await sandboxAdapter.createWorkOrder(rejectedIncident);
  } catch (e) {
    rejError = e;
  }
  assert(
    rejError && rejError.code === "DISPATCH_INELIGIBLE_REJECTED",
    "TEST 6: Rejected incident",
    `Disallowed: ${rejError ? rejError.message : "None"}`
  );

  // TEST 7: Needs-review incident -> No automatic dispatch
  const needsReviewIncident = {
    ...wasteIncident,
    id: "civic-REV-1298-8022-002",
    operatorStatus: "NEEDS REVIEW"
  };
  let revError = null;
  try {
    await sandboxAdapter.createWorkOrder(needsReviewIncident);
  } catch (e) {
    revError = e;
  }
  assert(
    revError && revError.code === "DISPATCH_REQUIRES_OPERATOR_REVIEW",
    "TEST 7: Needs-review incident",
    `Disallowed: ${revError ? revError.message : "None"}`
  );

  // TEST 8: Network failure -> PENDING_SYNC / SYNC_FAILED
  const offlineIncident = {
    ...roadIncident,
    id: "civic-OFF-1297-8021-003",
    title: "Offline Network Outage Test Incident"
  };
  municipalService.enqueueIncidentForDispatch(offlineIncident);
  const syncFailRes = await municipalService.syncOfflineQueue({ simulateNetworkFailure: true });
  const failedItem = syncFailRes.items.find(i => i.incidentId === offlineIncident.id);
  assert(
    failedItem && failedItem.syncState === "SYNC_FAILED" && syncFailRes.failedCount >= 1,
    "TEST 8: Network failure handling",
    `Item state: ${failedItem?.syncState} | Error logged: ${failedItem?.lastError}`
  );

  // TEST 9: Retry -> Single idempotent work order
  const syncRetryRes = await municipalService.syncOfflineQueue({ simulateNetworkFailure: false });
  const retriedItem = syncRetryRes.items.find(i => i.incidentId === offlineIncident.id);
  assert(
    retriedItem && retriedItem.syncState === "SYNCED" && Boolean(retriedItem.workOrderId),
    "TEST 9: Retry after network recovery",
    `Item recovered to state: ${retriedItem?.syncState} | Work Order: ${retriedItem?.workOrderId}`
  );

  // TEST 10: Conflicting status -> CONFLICT_REQUIRES_REVIEW
  // Mark work order COMPLETED, then attempt an unforced transition back to IN_PROGRESS
  await sandboxAdapter.updateWorkOrder(wo1.workOrderId, { status: "COMPLETED", actor: "SUPERVISOR" });
  const conflictRes = await sandboxAdapter.updateWorkOrder(wo1.workOrderId, { status: "IN_PROGRESS", actor: "FIELD_OPERATOR" });
  assert(
    conflictRes && conflictRes.status === "CONFLICT_REQUIRES_REVIEW" && conflictRes.conflict === true,
    "TEST 10: Conflicting status handling",
    `Conflict flagged: ${conflictRes.message}`
  );

  // ADDITIONAL: GeoJSON Validation Tests (Section 14)
  console.log("\n--------------------------------------------------");
  console.log("GEOJSON BOUNDARY VALIDATION AUDIT (Section 14)");
  console.log("--------------------------------------------------");

  // A. Invalid JSON / Not Object
  const g1 = boundaryService.validateGeoJsonBoundaries(null);
  assert(!g1.isValid && g1.errors.some(e => e.includes("INVALID GEOJSON")), "GeoJSON Audit A: Reject null/invalid object");

  // B. Missing FeatureCollection type
  const g2 = boundaryService.validateGeoJsonBoundaries({ type: "Point", coordinates: [80.2, 12.9] });
  assert(!g2.isValid && g2.errors.some(e => e.includes("INVALID GEOJSON")), "GeoJSON Audit B: Reject non-FeatureCollection");

  // C. Missing Ward ID
  const g3 = boundaryService.validateGeoJsonBoundaries({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Mystery Ward" },
        geometry: { type: "Polygon", coordinates: [[[80.2, 12.9], [80.3, 12.9], [80.3, 13.0], [80.2, 13.0], [80.2, 12.9]]] }
      }
    ]
  });
  assert(!g3.isValid && g3.errors.some(e => e.includes("MISSING WARD ID")), "GeoJSON Audit C: Reject feature without ward_id");

  // D. Unsupported Geometry
  const g4 = boundaryService.validateGeoJsonBoundaries({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ward_id: "W-99" },
        geometry: { type: "Point", coordinates: [80.2, 12.9] }
      }
    ]
  });
  assert(!g4.isValid && g4.errors.some(e => e.includes("UNSUPPORTED GEOMETRY")), "GeoJSON Audit D: Reject Point/LineString geometry");

  // E. Invalid Coordinates (out of range or malformed)
  const g5 = boundaryService.validateGeoJsonBoundaries({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ward_id: "W-100" },
        geometry: { type: "Polygon", coordinates: [[[280.2, 12.9], [80.3, 12.9], [80.3, 13.0], [80.2, 13.0], [80.2, 12.9]]] }
      }
    ]
  });
  assert(!g5.isValid && g5.errors.some(e => e.includes("INVALID COORDINATES")), "GeoJSON Audit E: Reject coordinates out of bounds");

  // F. Valid FeatureCollection
  const g6 = boundaryService.validateGeoJsonBoundaries({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ward_id: "WARD-168", ward_name: "Velachery South" },
        geometry: { 
          type: "Polygon", 
          coordinates: [[[80.21, 12.96], [80.23, 12.96], [80.23, 12.98], [80.21, 12.98], [80.21, 12.96]]] 
        }
      }
    ]
  });
  assert(g6.isValid && g6.wardCount === 1, "GeoJSON Audit F: Accept valid municipal Polygon FeatureCollection");

  console.log("\n==================================================");
  console.log(`PHASE 10 TEST SUMMARY: ${passedCount} / ${totalTests} PASSED (${Math.round(passedCount/totalTests*100)}%)`);
  console.log("==================================================");
}

runTestSuite().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
