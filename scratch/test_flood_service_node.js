import { classifyFloodEvent, FLOOD_CATEGORIES } from '../src/services/floodClassificationService.js';
import { performContextualArbitration } from '../src/services/civicSeverityService.js';

console.log("================================================================================");
console.log("NODE.JS INTEGRATION TEST: FLOOD CLASSIFICATION SERVICE & ARBITRATION");
console.log("================================================================================");

// 1. Check Categories
console.log("Checking supported flood categories F00-F06:");
for (const [key, val] of Object.entries(FLOOD_CATEGORIES)) {
  console.log(`  ${val.code}: ${val.name} — ${val.title}`);
}

// 2. Test F05 Large Area Inundation
const f05 = classifyFloodEvent({
  floodSegmentation: { floodedAreaPercent: 83.65, topologyRatio: 99.95 },
  contextEvidence: { rawRoad: [] }
});

console.log("\nF05 Aerial Test Result:");
console.log(`  Code:     ${f05.categoryCode}`);
console.log(`  Name:     ${f05.categoryName}`);
console.log(`  Title:    ${f05.title}`);
console.log(`  Severity: ${f05.severity}`);
console.log(`  Priority: ${f05.priority}`);
console.log(`  Status:   ${f05.operatorStatus}`);

if (f05.categoryCode !== 'F05') throw new Error("F05 code mismatch!");
if (f05.guards.buildingDamageInferred !== false) throw new Error("Building damage must not be inferred!");
if (f05.guards.humanDangerInferred !== false) throw new Error("Human danger must not be inferred!");
if (f05.guards.gpsFabricated !== false) throw new Error("GPS must not be fabricated!");

// 3. Test performContextualArbitration Integration
const arbResult = performContextualArbitration({
  roadDetections: [],
  wasteDetections: [{
    type: 'Organic Waste',
    classCode: 'W50',
    confidence: 0.68,
    boundingBox: { x: 5, y: 5, width: 85, height: 90 }
  }],
  floodResult: { floodedAreaPercent: 83.65, topologyRatio: 99.95 },
  metadata: { isGpsVerified: false }
});

console.log("\nContextual Arbitration Integration Test:");
console.log(`  Flood Incidents: ${arbResult.civicIncidents.length}`);
console.log(`  Incident Type:   ${arbResult.civicIncidents[0].incidentType}`);
console.log(`  Incident Title:  ${arbResult.civicIncidents[0].title}`);
console.log(`  Category Code:   ${arbResult.civicIncidents[0].floodCategoryCode}`);
console.log(`  Suppressed Waste: ${arbResult.suppressedWaste.length} (${arbResult.suppressedWaste[0]?.decision})`);

if (arbResult.civicIncidents[0].incidentType !== 'LARGE_AREA_INUNDATION' && arbResult.civicIncidents[0].incidentType !== 'GENERAL_SIGNIFICANT_FLOODING') {
  throw new Error("Flood incident type mismatch!");
}
if (arbResult.suppressedWaste.length !== 1) throw new Error("W50 waste on flood must be suppressed!");
if (arbResult.floodClassification.categoryCode !== 'F05') throw new Error("Classification code mismatch in arbitration!");

console.log("\n[PASS] Node.js isolated integration test passed 100%!");

