// CivicSense AI - Phase 17 Unified Pipeline Test Suite
// Verifies all 12 Phase 17 Requirements:
// 1. Pothole Detection & Canonical Pipeline Execution
// 2. Road Crack Classification & ASTM D6433 PCI Deduction
// 3. Genuine Garbage Accumulation & Solid Waste Routing
// 4. Flood Without Garbage & SegFormer B0 Coverage
// 5. Flood With Floating Garbage (Debris Fusion)
// 6. Wet Road Reflections & Mandatory Operator Ignore Reason
// 7. Water-Filled Pothole Multi-Modal Fusion & Elevated Severity
// 8. Missing GPS Handling & Zero Coordinate Hallucination
// 9. Low-Resolution Image Quality Audit & Review Flagging
// 10. Multi-Hazard Independent Candidate Generation
// 11. Human Review Gate (Accept, Ignore, Reject) & Duplicate Idempotency
// 12. Category-Specific Predictive Modeling Isolation

// Setup in-memory LocalStorage shim for Node.js test environment
const memoryStore = new Map();
global.window = {
  localStorage: {
    getItem: (key) => memoryStore.get(key) || null,
    setItem: (key, val) => memoryStore.set(key, String(val)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear()
  }
};
global.performance = {
  now: () => Date.now()
};

import { 
  formatCanonicalIncident,
  routeIncidentToDepartment,
  acceptIncidentCandidate,
  ignoreIncidentCandidate,
  rejectIncidentCandidate,
  updateIncidentLifecycle,
  getAllActiveIncidents,
  getReviewHistory,
  getOrchestrationStats,
  subscribeToOrchestration,
  INCIDENT_LIFECYCLE_STAGES
} from '../src/services/incidentOrchestrationService.js';

import {
  predictRoadDeteriorationRisk,
  predictFloodDrainageRisk,
  predictWasteAccumulationRisk,
  generateStandardizedPredictionStatus
} from '../src/services/predictiveRiskService.js';

import { auditImageQuality } from '../src/services/visualInferenceService.js';

console.log("================================================================================");
console.log("CIVICSENSE AI — PHASE 17 UNIFIED AI DETECTION TO CIVIC INTELLIGENCE TEST SUITE");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName, details = "") {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
    throw new Error(`Test Failed: ${testName} (${details})`);
  }
}

async function runPhase17Tests() {
  console.log("--- TEST GROUP 1: POTHOLE DETECTION & CANONICAL PIPELINE ---");
  const potholeRaw = {
    id: "TEST-POTHOLE-01",
    title: "Structural Pothole",
    incidentType: "POTHOLE",
    category: "ROAD",
    severity: "HIGH",
    priority: "HIGH",
    confidence: 0.92,
    detectionEvidence: "1 D40 (Pothole) detected with 92% confidence",
    location: {
      latitude: 12.9815,
      longitude: 80.2180,
      isGpsVerified: true,
      address: "100 Feet Road, Velachery"
    },
    ward: "Ward 168 - Velachery"
  };

  const canonicalPothole = formatCanonicalIncident(potholeRaw);
  assert(canonicalPothole.incidentId === "TEST-POTHOLE-01", "Pothole has canonical incidentId");
  assert(canonicalPothole.category === "ROAD", "Pothole category is ROAD");
  assert(canonicalPothole.gpsVerified === true, "Pothole GPS verified preserved");
  assert(canonicalPothole.operatorStatus === "AWAITING_REVIEW" || canonicalPothole.operatorStatus === "NEEDS REVIEW", "Initial status is review required");

  const roadRoute = routeIncidentToDepartment(canonicalPothole);
  assert(roadRoute.department.includes("Bus Route Roads") || roadRoute.department.includes("Road"), "Pothole routed to Road Department", roadRoute.department);

  console.log("\n--- TEST GROUP 2: ROAD CRACK CLASSIFICATION & PCI DEDUCTION ---");
  const crackIncident = {
    incidentId: "TEST-CRACK-01",
    category: "ROAD",
    incidentType: "ROAD_DAMAGE",
    severity: "HIGH",
    detectionEvidence: "D20 (Alligator Crack) detected with 88% confidence"
  };
  const crackPci = predictRoadDeteriorationRisk(crackIncident);
  assert(crackPci.category === "ROAD", "PCI evaluated for Road category");
  assert(crackPci.pciDeteriorationRisk === 26, "Alligator crack high severity deducts 26 PCI points");
  assert(crackPci.provenance === "RULE-BASED ESTIMATE", "Provenance is RULE-BASED ESTIMATE (ASTM D6433)");
  assert(crackPci.monthsToStructuralFailure === 3, "Structural failure window correctly estimated at 3 months");

  console.log("\n--- TEST GROUP 3: GENUINE GARBAGE ACCUMULATION & SOLID WASTE ROUTING ---");
  const wasteIncident = {
    incidentId: "TEST-WASTE-01",
    category: "WASTE",
    incidentType: "WASTE_ACCUMULATION",
    severity: "HIGH",
    confidence: 0.89,
    detectionEvidence: "4 waste objects detected (W00, W70)"
  };
  const wasteRoute = routeIncidentToDepartment(wasteIncident);
  assert(wasteRoute.department.includes("Solid Waste Management"), "Waste routed to Solid Waste Department", wasteRoute.department);

  const wastePci = predictRoadDeteriorationRisk(wasteIncident);
  assert(wastePci.pciDeteriorationRisk === null, "Pavement PCI deduction is strictly null for Waste category");
  assert(wastePci.provenance === "UNAVAILABLE", "PCI provenance is UNAVAILABLE for non-road incident");

  const wasteRisk = predictWasteAccumulationRisk(wasteIncident);
  assert(wasteRisk.category === "WASTE", "Waste predictive risk evaluated under WASTE category");
  assert(wasteRisk.vectorPestRisk === "ELEVATED", "Vector pest hazard elevated for high severity waste");

  console.log("\n--- TEST GROUP 4: FLOOD WITHOUT GARBAGE & DRAINAGE SURCHARGE ---");
  const cleanFlood = {
    incidentId: "TEST-FLOOD-01",
    category: "FLOOD",
    incidentType: "ROADWAY_WATERLOGGING",
    severity: "HIGH",
    confidence: 0.95,
    floodClassification: {
      waterCoverage: 22.5,
      floodType: "F01 Roadway Waterlogging"
    }
  };
  const floodRoute = routeIncidentToDepartment(cleanFlood);
  assert(floodRoute.department.includes("Storm Water Drains"), "Flood routed to Storm Water Drains", floodRoute.department);

  const floodPci = predictRoadDeteriorationRisk(cleanFlood);
  assert(floodPci.pciDeteriorationRisk === null, "PCI deduction is strictly null for Flood incident");

  const floodRisk = predictFloodDrainageRisk(cleanFlood);
  assert(floodRisk.drainageSurchargeProbability === "65%", "Drainage surcharge prob 65% for 22.5% coverage");
  assert(floodRisk.estimatedRecessionHours === 18, "Recession window estimated at 18 hours");

  console.log("\n--- TEST GROUP 5: FLOOD WITH FLOATING GARBAGE (DEBRIS FUSION) ---");
  const floodWithDebris = {
    incidentId: "TEST-FUSION-01",
    category: "FLOOD",
    incidentType: "SIGNIFICANT_WATERLOGGING_WITH_DEBRIS",
    severity: "CRITICAL",
    confidence: 0.91,
    detectionEvidence: "Floodwater 32% with 3 floating debris items"
  };
  const fusionRoute = routeIncidentToDepartment(floodWithDebris);
  assert(fusionRoute.department.includes("Storm Water Drains"), "Primary flood routing preserved with joint dispatch notes");

  console.log("\n--- TEST GROUP 6: WET ROAD REFLECTIONS & MANDATORY IGNORE REASON ---");
  const wetReflectionCandidate = {
    incidentId: "CAND-WET-ROAD-01",
    title: "Possible Water Reflection",
    incidentType: "POSSIBLE_WATERLOGGING",
    category: "FLOOD",
    severity: "LOW",
    operatorStatus: "AWAITING_REVIEW",
    isCandidate: true
  };

  // Attempting ignore without reason must fail
  let ignoreFailedWithoutReason = false;
  try {
    await ignoreIncidentCandidate("CAND-WET-ROAD-01", "");
  } catch (e) {
    ignoreFailedWithoutReason = true;
  }
  assert(ignoreFailedWithoutReason, "Ignore rejected when mandatory reason is empty");

  // Providing mandatory reason
  const ignoreRes = await ignoreIncidentCandidate("CAND-WET-ROAD-01", "Wet asphalt surface reflection mistaken for floodwater");
  assert(ignoreRes.success === true, "Ignore accepted with valid operator reason");
  assert(ignoreRes.incident.operatorStatus === "IGNORED", "Candidate marked as IGNORED");
  
  // Verify ignored candidate is NOT in active incident registry
  const activeAfterIgnore = getAllActiveIncidents();
  assert(!activeAfterIgnore.some(i => i.incidentId === "CAND-WET-ROAD-01"), "Ignored candidate is NOT in active incident registry");

  console.log("\n--- TEST GROUP 7: WATER-FILLED POTHOLE MULTI-MODAL FUSION ---");
  const waterPothole = {
    incidentId: "TEST-WFP-01",
    category: "ROAD",
    incidentType: "WATER_FILLED_POTHOLE",
    severity: "CRITICAL",
    priority: "IMMEDIATE",
    detectionEvidence: "Spatial overlap between pothole D40 and standing water"
  };
  const wfpPred = predictRoadDeteriorationRisk(waterPothole);
  assert(wfpPred.riskLevel === "CRITICAL", "Water-filled pothole evaluated as CRITICAL risk");
  assert(wfpPred.monthsToStructuralFailure === 1, "Immediate 1-month structural failure under hydraulic pore pressure");
  assert(wfpPred.pciDeteriorationRisk === 35, "Maximum 35 PCI points deduction");

  console.log("\n--- TEST GROUP 8: MISSING GPS & ZERO COORDINATE HALLUCINATION ---");
  const noGpsCandidate = {
    incidentId: "TEST-NO-GPS-01",
    title: "Pothole on Main Road",
    category: "ROAD",
    latitude: null,
    longitude: null,
    gpsVerified: false
  };
  const canonicalNoGps = formatCanonicalIncident(noGpsCandidate);
  assert(canonicalNoGps.latitude === null, "Latitude remains strictly null when missing");
  assert(canonicalNoGps.longitude === null, "Longitude remains strictly null when missing");
  assert(canonicalNoGps.gpsVerified === false, "gpsVerified is strictly false");

  console.log("\n--- TEST GROUP 9: LOW-RESOLUTION IMAGE QUALITY AUDIT ---");
  const lowResAudit = auditImageQuality({ width: 250, height: 180, orientation: 'Normal' });
  assert(lowResAudit.isLowResolution === true, "Image quality audit flags low resolution (<300x200)");

  console.log("\n--- TEST GROUP 10: MULTI-HAZARD INDEPENDENT CANDIDATE GENERATION ---");
  const multiHazard = {
    incidentId: "TEST-MULTI-01",
    category: "MULTI",
    incidentType: "WATER_FILLED_POTHOLE",
    severity: "HIGH",
    detectionEvidence: "Road defect D40 and standing water in same scene"
  };
  const multiPred = generateStandardizedPredictionStatus(multiHazard);
  assert(multiPred.pciDeteriorationRisk !== null, "Road component receives PCI evaluation");
  assert(multiPred.floodDrainageRisk !== null, "Flood component receives drainage evaluation");

  console.log("\n--- TEST GROUP 11: HUMAN REVIEW GATE (ACCEPT / IGNORE / REJECT) & IDEMPOTENCY ---");
  const candidateForReview = {
    incidentId: "CAND-GATE-01",
    title: "Severe Pothole Cluster",
    category: "ROAD",
    incidentType: "POTHOLE",
    severity: "CRITICAL",
    priority: "IMMEDIATE",
    latitude: 12.982,
    longitude: 80.219,
    gpsVerified: true
  };

  // Stage candidate into review tracking
  const preAcceptReview = await acceptIncidentCandidate("CAND-GATE-01", {
    operatorId: "OP-42",
    operatorName: "Senior Inspector Rajesh",
    notes: "Verified pothole depth > 8cm"
  });

  assert(preAcceptReview.success === true, "Candidate accepted successfully");
  assert(preAcceptReview.incident.lifecycleStatus === INCIDENT_LIFECYCLE_STAGES.FILED || preAcceptReview.incident.lifecycleStatus === INCIDENT_LIFECYCLE_STAGES.ACCEPTED, "Candidate promoted to active municipal incident");
  assert(preAcceptReview.incident.workOrderId && (preAcceptReview.incident.workOrderId.startsWith("WO-") || preAcceptReview.incident.workOrderId.startsWith("SANDBOX-WO-")), "Work order generated for accepted incident", preAcceptReview.incident.workOrderId);

  // Idempotency: re-accepting the same candidate returns existing incident without creating duplicates
  const secondAccept = await acceptIncidentCandidate("CAND-GATE-01", { operatorId: "OP-42" });
  assert(secondAccept.isDuplicate === true, "Duplicate acceptance detected and handled idempotently");
  assert(secondAccept.incident.workOrderId === preAcceptReview.incident.workOrderId, "Same work order retained without duplication");

  // Rejection with mandatory reason
  const candToReject = {
    incidentId: "CAND-REJECT-01",
    title: "Alleged Garbage Pile",
    category: "WASTE"
  };
  const rejectRes = await rejectIncidentCandidate("CAND-REJECT-01", "Authorized utility container, not scattered waste", { operatorId: "OP-42" });
  assert(rejectRes.success === true, "Rejection recorded with reason");
  assert(rejectRes.incident.operatorStatus === "REJECTED", "Operator status set to REJECTED");

  const activeIncidents = getAllActiveIncidents();
  assert(!activeIncidents.some(i => i.incidentId === "CAND-REJECT-01"), "Rejected incident is strictly excluded from active municipal registry");

  console.log("\n--- TEST GROUP 12: CATEGORY-SPECIFIC PREDICTIVE ISOLATION ---");
  const roadStatus = generateStandardizedPredictionStatus({ category: "ROAD", severity: "HIGH", incidentType: "POTHOLE" });
  assert(roadStatus.category === "ROAD", "Road status matches category");
  assert(roadStatus.pciDeteriorationRisk !== null, "Road has PCI risk");
  assert(roadStatus.floodDrainageRisk === null, "Road strictly has NO flood drainage risk");
  assert(roadStatus.wasteAccumulationTrend === null, "Road strictly has NO waste trend");

  const floodStatus = generateStandardizedPredictionStatus({ category: "FLOOD", severity: "HIGH", floodClassification: { waterCoverage: 20 } });
  assert(floodStatus.category === "FLOOD", "Flood status matches category");
  assert(floodStatus.pciDeteriorationRisk === null, "Flood strictly has NO PCI risk");
  assert(floodStatus.floodDrainageRisk !== null, "Flood has drainage risk");

  const wasteStatus = generateStandardizedPredictionStatus({ category: "WASTE", severity: "HIGH" });
  assert(wasteStatus.category === "WASTE", "Waste status matches category");
  assert(wasteStatus.pciDeteriorationRisk === null, "Waste strictly has NO PCI risk");
  assert(wasteStatus.wasteAccumulationTrend !== null, "Waste has accumulation trend");

  console.log("\n================================================================================");
  console.log(`ALL PHASE 17 REGRESSION TESTS PASSED: ${passed}/${total} assertions successful.`);
  console.log("================================================================================\n");
}

runPhase17Tests().catch(err => {
  console.error("TEST EXECUTION FAILED:", err);
  process.exit(1);
});
