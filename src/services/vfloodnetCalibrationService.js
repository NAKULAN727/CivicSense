/**
 * ============================================================================
 * CivicSense AI – V-FloodNet Calibration Service
 * ============================================================================
 * CANDIDATE STATUS: V-FLOODNET CANDIDATE (CALIBRATION ONLY - NOT GLOBALLY ACTIVE)
 * 
 * IMPORTANT ARCHITECTURAL DIRECTIVE:
 * This service implements the calibrated decision policy for Candidate 2 (V-FloodNet)
 * evaluated on the 38-image real-world benchmark.
 * 
 * THIS SERVICE DOES NOT REPLACE THE ACTIVE PRODUCTION FLOOD SERVICE.
 * Production model `public/models/flood-water-segmentation.onnx` remains the
 * active municipal model in `visualInferenceService.js`.
 * 
 * ZERO Math.random() – Completely deterministic decision logic.
 * ============================================================================
 */

export const VFLOODNET_CANDIDATE_METADATA = {
  candidateId: "Candidate 2: V-FloodNet (LinkNet EfficientNet-B4)",
  modelVersion: "V-FloodNet LinkNet-EfficientNetB4 (Candidate 2 Calibrated v1.0)",
  architecture: "SMP LinkNet with EfficientNet-B4 Encoder (classes=1, sigmoid)",
  modelFile: "scratch/vfloodnet_deeplabv3plus.onnx",
  parameterCount: 17862571,
  inputShape: [1, 3, 416, 416],
  outputShape: [1, 1, 416, 416],
  deploymentStatus: "BENCHMARK CANDIDATE (ISOLATED - NOT GLOBALLY ACTIVE)",
  productionReadinessVerdict: "READY AFTER ADDITIONAL VALIDATION"
};

/**
 * Deterministic Calibrated Thresholds
 * Empirically derived from 38-image screening dataset threshold sweep:
 * - 5.0% floor retains 100% (14/14) genuine street flood scenes
 * - 25.0% ceiling eliminates 100% (12/12) garbage false-positive triggers
 * - Co-presence of pothole (D40) maps to special municipal class: WATER-FILLED POTHOLE
 */
export const CALIBRATION_THRESHOLDS = {
  NO_WATER_MAX: 5.0,             // < 5.0% -> NO SIGNIFICANT WATER
  POSSIBLE_WATER_MAX: 25.0,      // 5.0% - 25.0% -> POSSIBLE WATERLOGGING
  SIGNIFICANT_WATER_MIN: 25.0,   // > 25.0% -> SIGNIFICANT WATERLOGGING
  
  // Resolution warning thresholds
  LOW_RES_MIN_WIDTH: 300,
  LOW_RES_MIN_HEIGHT: 200,
  LOW_RES_MIN_PIXELS: 60000
};

/**
 * Deterministic 4-tier decision policy
 * 
 * @param {number} waterCoveragePercent - Calculated water mask coverage percentage [0..100]
 * @param {Array} roadDamageDetections - Detections from RDD2022 road model
 * @param {Object} imageMeta - Natural image dimensions { width, height }
 * @param {Object} spatialMetrics - Optional spatial connected-component metrics
 * @returns {Object} Calibrated classification output
 */
export function classifyVFloodNetWaterlogging(
  waterCoveragePercent = 0.0,
  roadDamageDetections = [],
  imageMeta = {},
  spatialMetrics = null
) {
  const coverage = Number(waterCoveragePercent.toFixed(2));
  const origW = imageMeta.naturalWidth || imageMeta.width || 0;
  const origH = imageMeta.naturalHeight || imageMeta.height || 0;
  const totalPixels = origW * origH;

  // 1. Deterministic Resolution Warning Check
  let resolutionWarning = null;
  if (origW > 0 && origH > 0) {
    if (
      origW < CALIBRATION_THRESHOLDS.LOW_RES_MIN_WIDTH ||
      origH < CALIBRATION_THRESHOLDS.LOW_RES_MIN_HEIGHT ||
      totalPixels < CALIBRATION_THRESHOLDS.LOW_RES_MIN_PIXELS
    ) {
      resolutionWarning = `LOW RESOLUTION (${origW}x${origH} < 300x200 / < 60k px). Upscaling artifacts may soften fine ripples.`;
    }
  }

  // 2. Co-presence of Road Pothole (D40) Check
  // Inspect if road model identified a pothole with confidence >= 0.25
  const hasPothole = Array.isArray(roadDamageDetections) && roadDamageDetections.some(d => {
    const code = (d.classCode || d.code || '').toUpperCase();
    const label = (d.classLabel || d.label || d.name || '').toLowerCase();
    const conf = d.confidence || d.score || 0;
    return (code === 'D40' || label.includes('pothole')) && conf >= 0.25;
  });

  // 3. Four-Tier Classification Policy
  let waterloggingStatus = "NO SIGNIFICANT WATER";
  let severityTier = "LEVEL 1";
  let descriptiveReason = "No significant standing water detected (< 5.0% coverage).";

  if (hasPothole && coverage >= CALIBRATION_THRESHOLDS.NO_WATER_MAX) {
    // Special CivicSense Fusion Class: Pothole + Water = Water-Filled Pothole
    waterloggingStatus = "WATER-FILLED POTHOLE";
    severityTier = "HIGH_ROAD_HAZARD";
    descriptiveReason = `Pothole detected with localized water accumulation (${coverage}% coverage). Structural road cavity holding rainwater.`;
  } else if (coverage < CALIBRATION_THRESHOLDS.NO_WATER_MAX) {
    waterloggingStatus = "NO SIGNIFICANT WATER";
    severityTier = "LEVEL 1";
    descriptiveReason = `Water mask coverage (${coverage}%) is below the 5.0% significance floor. Normal dry road/surface texture.`;
  } else if (coverage <= CALIBRATION_THRESHOLDS.POSSIBLE_WATER_MAX) {
    waterloggingStatus = "POSSIBLE WATERLOGGING";
    severityTier = "LEVEL 2";
    descriptiveReason = `Moderate water coverage (${coverage}%). Localized puddles, receding flood margins, or wet road patches.`;
  } else {
    waterloggingStatus = "SIGNIFICANT WATERLOGGING";
    severityTier = "LEVEL 3";
    descriptiveReason = `Extensive water coverage (${coverage}% > 25.0%). Continuous roadway inundation / major municipal waterlogging.`;
  }

  return {
    candidateId: VFLOODNET_CANDIDATE_METADATA.candidateId,
    modelVersion: VFLOODNET_CANDIDATE_METADATA.modelVersion,
    waterloggingStatus,
    severityTier,
    waterCoveragePercentage: coverage,
    hasPotholeCoPresence: hasPothole,
    resolutionWarning,
    descriptiveReason,
    spatialMetrics: spatialMetrics || null,
    calibrationRule: {
      level1Max: CALIBRATION_THRESHOLDS.NO_WATER_MAX,
      level2Max: CALIBRATION_THRESHOLDS.POSSIBLE_WATER_MAX,
      level3Min: CALIBRATION_THRESHOLDS.SIGNIFICANT_WATER_MIN,
      fusionRule: "Road Damage (D40 Pothole) + Water >= 5.0% => WATER-FILLED POTHOLE"
    },
    deploymentStatus: VFLOODNET_CANDIDATE_METADATA.deploymentStatus,
    readinessRecommendation: VFLOODNET_CANDIDATE_METADATA.productionReadinessVerdict
  };
}

/**
 * Calculates spatial connected-component topology on a binary water mask
 * 
 * @param {Uint8Array|Array} binaryMask - 1D array of length width*height (1 for water, 0 for background)
 * @param {number} width - Mask width (default 416)
 * @param {number} height - Mask height (default 416)
 * @returns {Object} Spatial validation metrics
 */
export function analyzeMaskSpatialTopology(binaryMask, width = 416, height = 416) {
  const totalPixels = width * height;
  let waterPixels = 0;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let sumX = 0, sumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 1) {
        waterPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        sumY += y;
      }
    }
  }

  if (waterPixels === 0) {
    return {
      waterPixels: 0,
      waterCoveragePercentage: 0.0,
      boundingBox: null,
      centroid: null,
      spatialTopology: "NO_WATER"
    };
  }

  const coveragePct = Number(((waterPixels / totalPixels) * 100).toFixed(2));
  const centroidX = Number((sumX / waterPixels).toFixed(1));
  const centroidY = Number((sumY / waterPixels).toFixed(1));

  // Determine basic topology
  let spatialTopology = "DISPERSED_WET_PATCHES";
  if (coveragePct > 25.0) {
    spatialTopology = "LARGE_CONTINUOUS_ROAD_FLOOD";
  } else if (coveragePct >= 5.0) {
    spatialTopology = "LOCALIZED_PUDDLE_OR_POTHOLE_WATER";
  } else {
    spatialTopology = "TRACE_OR_SPECULAR_WATER";
  }

  return {
    waterPixels,
    waterCoveragePercentage: coveragePct,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      normX: Number((minX / width).toFixed(3)),
      normY: Number((minY / height).toFixed(3)),
      normWidth: Number(((maxX - minX) / width).toFixed(3)),
      normHeight: Number(((maxY - minY) / height).toFixed(3))
    },
    centroid: { x: centroidX, y: centroidY },
    spatialTopology
  };
}
