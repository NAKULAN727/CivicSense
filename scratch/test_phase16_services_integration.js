// CivicSense AI — Phase 16 Services & Severity Integration Test
import { 
  FLOOD_CLASSES, 
  resizeLogitsAndGenerateMask, 
  calculateFloodConnectedComponents 
} from '../src/services/floodInferenceService.js';
import { 
  classifyFloodEvent, 
  FLOOD_CATEGORIES 
} from '../src/services/floodClassificationService.js';
import { 
  calculateVisualDetectionsSeverity,
  formatCanonicalIncident,
  calculateFloodSeverity
} from '../src/services/civicSeverityService.js';
import { MODEL_REGISTRY, getActiveFloodModelConfig } from '../src/config/modelRegistry.js';
import ort from 'onnxruntime-web';

console.log("=".repeat(70));
console.log("TEST: CivicSense AI Phase 16 Services & Pipeline Integration");
console.log("=".repeat(70));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// 1. Model Registry Verification
console.log("\n[TEST 1] Model Registry Verification");
const floodConfig = getActiveFloodModelConfig();
assert(floodConfig.activeModelId === 'SEGFORMER_B0_BINARY', "activeModelId is SEGFORMER_B0_BINARY");
assert(floodConfig.fileUrl === '/models/flood_segmentation.onnx', "fileUrl is /models/flood_segmentation.onnx");
assert(floodConfig.inputName === 'pixel_values', "inputName is pixel_values");
assert(floodConfig.outputName === 'logits', "outputName is logits");
assert(floodConfig.classes[0] === 'BACKGROUND', "Class 0 is BACKGROUND");
assert(floodConfig.classes[1] === 'FLOODWATER', "Class 1 is FLOODWATER");
assert(floodConfig.rollbackModel.fileUrl === '/models/flood-water-segmentation.onnx', "Rollback backup preserved in registry");

// 2. Class Definitions
console.log("\n[TEST 2] Flood Classes Definition");
assert(FLOOD_CLASSES[0].code === 'BACKGROUND' && FLOOD_CLASSES[0].isWater === false, "FLOOD_CLASSES[0] is non-water BACKGROUND");
assert(FLOOD_CLASSES[1].code === 'FLOODWATER' && FLOOD_CLASSES[1].isWater === true, "FLOOD_CLASSES[1] is water FLOODWATER");

// 3. Bilinear Logits Resizing & Mask Generation
console.log("\n[TEST 3] Bilinear Logit Resizing to Original Dimensions");
const inW = 128, inH = 128;
const origW = 640, origH = 480;
const totalPx = origW * origH;
const mockLogits = new Float32Array(2 * inW * inH);

// Set top half of 128x128 feature map to water (L1 > L0)
for (let y = 0; y < inH; y++) {
  for (let x = 0; x < inW; x++) {
    const idx = y * inW + x;
    if (y < 64) {
      mockLogits[idx] = -1.0;                  // Class 0
      mockLogits[inW * inH + idx] = 2.0;       // Class 1 (water)
    } else {
      mockLogits[idx] = 2.0;                   // Class 0 (dry)
      mockLogits[inW * inH + idx] = -1.0;      // Class 1
    }
  }
}

const resizeResult = resizeLogitsAndGenerateMask(mockLogits, inW, inH, origW, origH);
assert(resizeResult.totalPixels === totalPx, `Total pixels matches original image resolution (${origW}x${origH} = ${totalPx})`);
assert(resizeResult.mask.length === totalPx, `Mask array length matches original resolution (${totalPx})`);
assert(Math.abs(resizeResult.floodedAreaPercent - 50.0) < 0.5, `Flooded area percent is ~50.0% (got ${resizeResult.floodedAreaPercent}%)`);
assert(resizeResult.classPixelCounts[1] === resizeResult.floodCount, "classPixelCounts[1] matches floodCount");
assert(resizeResult.classPixelCounts[0] === totalPx - resizeResult.floodCount, "classPixelCounts[0] matches background count");

// 4. Connected Components & Topology
console.log("\n[TEST 4] Flood Connected Components & Topology");
const comps = calculateFloodConnectedComponents(resizeResult.mask.subarray(0, 128 * 128), 128, 128);
assert(comps.largestCompRatioPct > 90.0, `Continuous sheet has high connected component ratio (>90%, got ${comps.largestCompRatioPct}%)`);

// 5. Flood Classification F00-F06 Integration
console.log("\n[TEST 5] Flood Classification Service (F00-F06)");
// Scenario A: Dry road (< 5% water)
const dryClass = classifyFloodEvent({
  floodSegmentation: { floodedAreaPercent: 2.1, largest_comp_ratio_pct: 10.0 }
});
assert(dryClass.categoryCode === 'F00', `Dry surface classifies as F00 (got ${dryClass.categoryCode})`);
assert(dryClass.severity === 'LOW', `Dry surface severity is LOW (got ${dryClass.severity})`);

// Scenario B: Large-area inundation (> 50% water, > 80% comp)
const largeFloodClass = classifyFloodEvent({
  floodSegmentation: { floodedAreaPercent: 78.5, largest_comp_ratio_pct: 95.0 }
});
assert(largeFloodClass.categoryCode === 'F05', `Extensive sheet classifies as F05 LARGE_AREA_INUNDATION (got ${largeFloodClass.categoryCode})`);
assert(largeFloodClass.severity === 'CRITICAL', `F05 severity is CRITICAL (got ${largeFloodClass.severity})`);
assert(largeFloodClass.priority === 'IMMEDIATE', `F05 priority is IMMEDIATE (got ${largeFloodClass.priority})`);

// Scenario C: Road waterlogging with road defect context
const roadFloodClass = classifyFloodEvent({
  floodSegmentation: { floodedAreaPercent: 32.0, largest_comp_ratio_pct: 75.0 },
  contextEvidence: { roadDetections: [{ classCode: 'D40', type: 'Pothole', confidence: 0.78 }] }
});
assert(roadFloodClass.categoryCode === 'F01', `Water with road defect classifies as F01 ROAD_WATERLOGGING (got ${roadFloodClass.categoryCode})`);

// Scenario D: General significant flooding fallback
const genFloodClass = classifyFloodEvent({
  floodSegmentation: { floodedAreaPercent: 38.0, largest_comp_ratio_pct: 45.0 }
});
assert(genFloodClass.categoryCode === 'F06', `Unclassified extensive water classifies as F06 GENERAL_SIGNIFICANT_FLOODING (got ${genFloodClass.categoryCode})`);
assert(genFloodClass.operatorStatus === 'NEEDS REVIEW', `F06 has operator status NEEDS REVIEW`);

// 6. Civic Severity & Canonical Incident Generation
console.log("\n[TEST 6] Civic Severity & Incident Routing with New Model");
const rawVisualPayload = {
  detections: {
    road: [],
    waste: []
  },
  flood: {
    type: "flood",
    model: "flood_segmentation.onnx",
    modelStatus: "VERIFIED_ONNX",
    inferenceStatus: "SUCCESS",
    detected: true,
    floodedAreaRatio: 0.45,
    floodedAreaPercent: 45.0,
    maskWidth: origW,
    maskHeight: origH,
    maskClassArray: resizeResult.mask,
    floodPixelsCount: Math.round(totalPx * 0.45),
    totalMaskPixels: totalPx,
    largest_comp_ratio_pct: 88.0,
    spatialTopology: "CONTINUOUS_WATER_BODY",
    source: "RGB_FLOOD_SEGFORMER_B0",
    isFloodModelVerified: true
  },
  metadata: {
    latitude: 13.0827,
    longitude: 80.2707,
    isGpsVerified: true,
    timestamp: new Date().toISOString()
  },
  isAvailable: true
};

const severityAnalysis = calculateVisualDetectionsSeverity(rawVisualPayload);
assert(severityAnalysis.civicIncidents.length > 0, `Generated canonical incident for flood detection (count=${severityAnalysis.civicIncidents.length})`);

const rawIncident = severityAnalysis.civicIncidents[0];
const floodIncident = formatCanonicalIncident(rawIncident);

assert(floodIncident.category === 'FLOOD', `Incident category is FLOOD (got ${floodIncident.category})`);
assert(floodIncident.modelId === 'flood_segmentation', `ModelId is flood_segmentation (got ${floodIncident.modelId})`);
assert(floodIncident.modelVersion === 'v2.0-segformer-b0', `ModelVersion is v2.0-segformer-b0 (got ${floodIncident.modelVersion})`);
assert(floodIncident.severity === 'CRITICAL' || floodIncident.severity === 'HIGH', `Severity is HIGH/CRITICAL (got ${floodIncident.severity})`);
assert(Array.isArray(floodIncident.recommendations) && floodIncident.recommendations.length > 0, "Generated actionable department recommendations");
assert(floodIncident.department.includes('Drainage') || floodIncident.department.includes('Municipal'), `Department routed correctly (got ${floodIncident.department})`);

// 7. Real ONNX Runtime Session Inference Test
console.log("\n[TEST 7] ONNX Runtime Web Real Model Session Load & Execution");
try {
  const session = await ort.InferenceSession.create('public/models/flood_segmentation.onnx');
  assert(session !== null, "Created live InferenceSession for public/models/flood_segmentation.onnx");
  assert(session.inputNames.includes('pixel_values'), "Session input is 'pixel_values'");
  assert(session.outputNames.includes('logits'), "Session output is 'logits'");

  // Dummy input tensor
  const dummyTensor = new ort.Tensor('float32', new Float32Array(1 * 3 * 512 * 512), [1, 3, 512, 512]);
  const runResults = await session.run({ 'pixel_values': dummyTensor });
  const outTensor = runResults['logits'];
  assert(outTensor !== undefined, "Executed inference and retrieved 'logits' tensor");
  assert(outTensor.dims[0] === 1 && outTensor.dims[1] === 2 && outTensor.dims[2] === 128 && outTensor.dims[3] === 128, 
    `Output dims match [1, 2, 128, 128] (got [${outTensor.dims}])`);
} catch (err) {
  assert(false, `ONNX execution failed: ${err.message}`);
}

console.log("\n" + "=".repeat(70));
console.log(`INTEGRATION TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=".repeat(70));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL TESTS COMPLETED SUCCESSFULLY.");
}
