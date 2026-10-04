// CivicSense AI - Visual Civic Issue Severity & Priority Assessment Service (Phase 8C-3, 8C-5 & 8C-6)
// Deterministic Visual Heuristics for Defect Severity & Action Prioritization
// Strictly separates Model Detection Confidence from Derived Prototype Severity

/**
 * Calculates prototype severity for an individual visual detection object based on
 * defect class code, bounding box geometry, and relative image frame area ratio.
 * 
 * @param {Object} detection Individual detection object ({ id, type, classCode, confidence, boundingBox, ... })
 * @returns {{ severity: string, severityReason: string, method: string, boxAreaRatio: number|null }}
 */
export function calculateDetectionSeverity(detection) {
  if (!detection || !detection.classCode) {
    return {
      severity: "UNAVAILABLE",
      severityReason: "Insufficient detection data",
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      boxAreaRatio: null
    };
  }

  const { classCode, boundingBox } = detection;

  if (!boundingBox || typeof boundingBox.width !== 'number' || typeof boundingBox.height !== 'number') {
    return {
      severity: "UNAVAILABLE",
      severityReason: "Bounding box geometry missing or incomplete",
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      boxAreaRatio: null
    };
  }

  // boundingBox width and height are percentage values of image [0..100]
  // boxAreaRatio = (width * height) / 10000 -> normalized [0..1]
  const boxAreaRatio = Number(((boundingBox.width * boundingBox.height) / 10000).toFixed(4));
  const boxAreaPercent = Number((boxAreaRatio * 100).toFixed(2));

  // ROAD DAMAGE CLASSES (RDD2022)
  if (classCode === 'D40') {
    // Pothole: Structural surface cavity
    if (boxAreaRatio >= 0.06) {
      return {
        severity: "HIGH",
        severityReason: `Large pothole visual extent (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else if (boxAreaRatio >= 0.02) {
      return {
        severity: "MEDIUM",
        severityReason: `Moderate pothole visual extent (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else {
      return {
        severity: "LOW",
        severityReason: `Small localized pothole (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    }
  }

  if (classCode === 'D20') {
    // Alligator Crack: Interconnected fatigue failure
    if (boxAreaRatio >= 0.08) {
      return {
        severity: "HIGH",
        severityReason: `Extensive alligator crack fatigue pattern (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else if (boxAreaRatio >= 0.03) {
      return {
        severity: "MEDIUM",
        severityReason: `Moderate alligator cracking pattern (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else {
      return {
        severity: "LOW",
        severityReason: `Localized alligator cracking pattern (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    }
  }

  if (classCode === 'D00' || classCode === 'D10') {
    // Longitudinal (D00) or Transverse (D10) linear surface crack
    if (boxAreaRatio >= 0.05 || boundingBox.width >= 40 || boundingBox.height >= 40) {
      return {
        severity: "MEDIUM",
        severityReason: `Extended linear surface crack (span or area >5% of frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else {
      return {
        severity: "LOW",
        severityReason: `Minor linear surface crack (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    }
  }

  // SOLID WASTE CLASSES (W00 - W70 or WASTE)
  if (classCode.startsWith('W') || classCode === 'WASTE') {
    if (boxAreaRatio >= 0.10) {
      return {
        severity: "HIGH",
        severityReason: `Large visual waste accumulation zone (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else if (boxAreaRatio >= 0.03) {
      return {
        severity: "MEDIUM",
        severityReason: `Moderate visual waste accumulation (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    } else {
      return {
        severity: "LOW",
        severityReason: `Localized waste pile (${boxAreaPercent}% of image frame)`,
        method: "PROTOTYPE_VISUAL_HEURISTIC",
        boxAreaRatio
      };
    }
  }

  // Fallback for unrecognized classes
  return {
    severity: "UNAVAILABLE",
    severityReason: `Unrecognized defect class ${classCode}`,
    method: "PROTOTYPE_VISUAL_HEURISTIC",
    boxAreaRatio
  };
}

/**
 * Calculates prototype visual flood severity from segmentation output and environmental context.
 * Clearly labeled: "Prototype visual severity".
 * 
 * @param {Object} floodResult Flood ONNX segmentation payload
 * @param {Object} [satelliteRisk] Phase 4 satellite flood risk assessment
 * @returns {{ severity: string, severityReason: string, method: string, floodedAreaPercent: number, label: string }}
 */
export function calculateFloodSeverity(floodResult, satelliteRisk = null) {
  if (!floodResult || floodResult.modelStatus !== 'VERIFIED_ONNX') {
    return {
      severity: "UNAVAILABLE",
      severityReason: "Flood visual surveillance offline or model unavailable",
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      floodedAreaPercent: 0,
      label: "Prototype visual severity"
    };
  }

  const percent = floodResult.floodedAreaPercent || 0;
  const satLevel = satelliteRisk?.level || satelliteRisk?.riskLevel || 'UNKNOWN';
  const isHighSatRisk = satLevel === 'HIGH' || satLevel === 'CRITICAL' || satLevel === 'SEVERE';

  if (percent >= 35.0 || (percent >= 20.0 && isHighSatRisk)) {
    return {
      severity: "CRITICAL",
      severityReason: `Extensive visible water accumulation (${percent}%) with supporting environmental flood risk evidence (${satLevel})`,
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      floodedAreaPercent: percent,
      label: "Prototype visual severity"
    };
  } else if (percent >= 20.0) {
    return {
      severity: "HIGH",
      severityReason: `Large visible water coverage (${percent}% of image frame)`,
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      floodedAreaPercent: percent,
      label: "Prototype visual severity"
    };
  } else if (percent >= 5.0) {
    return {
      severity: "MEDIUM",
      severityReason: `Moderate visible water coverage (${percent}% of image frame)`,
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      floodedAreaPercent: percent,
      label: "Prototype visual severity"
    };
  } else if (percent > 0.5) {
    return {
      severity: "LOW",
      severityReason: `Small localized water coverage (${percent}% of image frame)`,
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      floodedAreaPercent: percent,
      label: "Prototype visual severity"
    };
  } else {
    return {
      severity: "CLEAR",
      severityReason: "No significant visible flood water detected",
      method: "PROTOTYPE_VISUAL_HEURISTIC",
      floodedAreaPercent: percent,
      label: "Prototype visual severity"
    };
  }
}

/**
 * Calculates dimension-level severity, individual detection severities, and overall
 * area-level action priority for a complete visual detection payload.
 * 
 * @param {Object} visualDetections 
 * @param {Object} [satelliteRisk] Phase 4 satellite flood risk assessment
 * @returns {Object} Enriched visual detection payload with severity & priority analysis
 */
export function calculateVisualDetectionsSeverity(visualDetections, satelliteRisk = null) {
  if (!visualDetections || visualDetections.isAvailable === false) {
    return {
      isAvailable: false,
      road: {
        status: "UNAVAILABLE",
        severity: "UNAVAILABLE",
        severityReason: "No visual image/inference performed",
        count: 0,
        detections: []
      },
      waste: {
        status: "UNAVAILABLE",
        severity: "UNAVAILABLE",
        severityReason: "No visual image/inference performed",
        count: 0,
        detections: []
      },
      flood: {
        status: "UNAVAILABLE",
        severity: "UNAVAILABLE",
        severityReason: "No visual flood inference performed",
        floodedAreaPercent: 0
      },
      overallPriority: "ROUTINE",
      priorityReason: "Visual surveillance feed offline",
      method: "PROTOTYPE_VISUAL_HEURISTIC"
    };
  }

  const rawRoad = visualDetections?.detections?.road ?? visualDetections?.road ?? [];
  const rawWaste = visualDetections?.detections?.waste ?? visualDetections?.waste ?? [];
  const floodResult = visualDetections?.flood ?? null;
  const metadata = visualDetections?.metadata ?? { latitude: null, longitude: null, timestamp: null, isGpsVerified: false };

  // 1. Process individual road detections
  const enrichedRoadDetections = rawRoad.map(det => {
    const sevInfo = calculateDetectionSeverity(det);
    return {
      ...det,
      severity: sevInfo.severity,
      severityReason: sevInfo.severityReason,
      method: sevInfo.method,
      boxAreaRatio: sevInfo.boxAreaRatio
    };
  });

  // 2. Process individual waste detections
  const enrichedWasteDetections = rawWaste.map(det => {
    const sevInfo = calculateDetectionSeverity(det);
    return {
      ...det,
      severity: sevInfo.severity,
      severityReason: sevInfo.severityReason,
      method: sevInfo.method,
      boxAreaRatio: sevInfo.boxAreaRatio
    };
  });

  // 3. Process Flood Segmentation Severity
  const floodSevInfo = calculateFloodSeverity(floodResult, satelliteRisk);

  // 4. Calculate Road Dimension Severity
  let roadSeverity = "UNAVAILABLE";
  let roadReason = "No supported road issue detected";

  if (enrichedRoadDetections.length > 0) {
    const totalRoadArea = enrichedRoadDetections.reduce((sum, d) => sum + (d.boxAreaRatio || 0), 0);
    const hasHigh = enrichedRoadDetections.some(d => d.severity === 'HIGH');
    const hasMed = enrichedRoadDetections.some(d => d.severity === 'MEDIUM');

    if (hasHigh || enrichedRoadDetections.length >= 4 || totalRoadArea >= 0.15) {
      roadSeverity = "HIGH";
      roadReason = `${enrichedRoadDetections.length} defect(s) detected with high visual extent or high-impact defect class`;
    } else if (hasMed || enrichedRoadDetections.length >= 2 || totalRoadArea >= 0.05) {
      roadSeverity = "MEDIUM";
      roadReason = `${enrichedRoadDetections.length} defect(s) detected with moderate visual extent`;
    } else {
      roadSeverity = "LOW";
      roadReason = `${enrichedRoadDetections.length} minor defect(s) detected`;
    }
  } else {
    roadSeverity = "CLEAR";
    roadReason = "No supported road issue detected";
  }

  // 5. Calculate Waste Dimension Severity
  let wasteSeverity = "UNAVAILABLE";
  let wasteReason = "Waste surveillance feed offline or model unavailable";
  let wasteStatus = "UNAVAILABLE";

  const isWasteVerified = visualDetections?.isWasteModelVerified ?? (rawWaste.length > 0);

  if (isWasteVerified || visualDetections?.wasteModelName !== "WASTE MODEL UNAVAILABLE") {
    wasteStatus = "AVAILABLE";
    if (enrichedWasteDetections.length > 0) {
      const totalWasteArea = enrichedWasteDetections.reduce((sum, d) => sum + (d.boxAreaRatio || 0), 0);
      const hasHigh = enrichedWasteDetections.some(d => d.severity === 'HIGH');
      const hasMed = enrichedWasteDetections.some(d => d.severity === 'MEDIUM');

      if (hasHigh || enrichedWasteDetections.length >= 3 || totalWasteArea >= 0.18) {
        wasteSeverity = "HIGH";
        wasteReason = `${enrichedWasteDetections.length} waste object(s) detected with high visual accumulation`;
      } else if (hasMed || enrichedWasteDetections.length >= 2 || totalWasteArea >= 0.06) {
        wasteSeverity = "MEDIUM";
        wasteReason = `${enrichedWasteDetections.length} waste object(s) detected with moderate accumulation`;
      } else {
        wasteSeverity = "LOW";
        wasteReason = `${enrichedWasteDetections.length} localized waste object(s) detected`;
      }
    } else {
      wasteSeverity = "CLEAR";
      wasteReason = "No supported waste issue detected";
    }
  }

  // 6. Calculate Flood Dimension Severity Status
  let floodStatus = "UNAVAILABLE";
  if (floodResult && floodResult.modelStatus === 'VERIFIED_ONNX') {
    floodStatus = "AVAILABLE";
  }

  // 7. Calculate Area-Level Action Priority (ROUTINE, MEDIUM, HIGH, IMMEDIATE)
  let overallPriority = "ROUTINE";
  let priorityReason = "Baseline routine maintenance monitoring";

  const allEnriched = [...enrichedRoadDetections, ...enrichedWasteDetections];
  const isGpsVerified = metadata.isGpsVerified && metadata.latitude !== null && metadata.longitude !== null;

  if (floodSevInfo.severity === 'CRITICAL' || roadSeverity === 'HIGH' || wasteSeverity === 'HIGH') {
    if (floodSevInfo.severity === 'CRITICAL' || allEnriched.length >= 3 || isGpsVerified) {
      overallPriority = "IMMEDIATE";
      priorityReason = floodSevInfo.severity === 'CRITICAL'
        ? "Critical visual flood extent detected with supporting environmental flood risk"
        : "High visual severity with multi-defect spatial concentration or verified GPS location";
    } else {
      overallPriority = "HIGH";
      priorityReason = "High visual defect or flood severity detected in image frame";
    }
  } else if (floodSevInfo.severity === 'HIGH' || roadSeverity === 'MEDIUM' || wasteSeverity === 'MEDIUM' || allEnriched.length >= 2) {
    if (floodSevInfo.severity === 'HIGH' || allEnriched.length >= 3) {
      overallPriority = "HIGH";
      priorityReason = floodSevInfo.severity === 'HIGH'
        ? "High visible water coverage detected in street imagery"
        : "Multiple moderate visual defects detected across frame";
    } else {
      overallPriority = "MEDIUM";
      priorityReason = "Moderate visual defect or flood severity requiring standard field inspection";
    }
  } else if (floodSevInfo.severity === 'MEDIUM' || allEnriched.length === 1) {
    overallPriority = "MEDIUM";
    priorityReason = "Moderate visual waterlogging or single minor/moderate visual defect flagged for review";
  } else {
    overallPriority = "ROUTINE";
    priorityReason = "Zero severe visual defects detected";
  }

  return {
    isAvailable: true,
    road: {
      status: "AVAILABLE",
      severity: roadSeverity,
      severityReason: roadReason,
      count: enrichedRoadDetections.length,
      detections: enrichedRoadDetections
    },
    waste: {
      status: wasteStatus,
      severity: wasteSeverity,
      severityReason: wasteReason,
      count: enrichedWasteDetections.length,
      detections: enrichedWasteDetections
    },
    flood: {
      status: floodStatus,
      severity: floodSevInfo.severity,
      severityReason: floodSevInfo.severityReason,
      floodedAreaPercent: floodSevInfo.floodedAreaPercent,
      rawResult: floodResult
    },
    overallPriority,
    priorityReason,
    metadata,
    source: visualDetections.source || 'Phase 8C ONNX inference',
    modelName: visualDetections.modelName || 'CivicSense ONNX Vision Engine',
    inferenceTimeMs: visualDetections.inferenceTimeMs || 0,
    method: "PROTOTYPE_VISUAL_HEURISTIC"
  };
}
