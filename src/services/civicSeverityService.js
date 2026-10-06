// CivicSense AI - Visual Civic Issue Severity, Contextual Cross-Model Arbitration & Final Incident Service
// Phase 8C-3, 8C-5, 8C-6, 8C-8, 8C-9, 8C-10 & Phase 9 Live Field Pilot Integration
// Deterministic Multi-Model Evidence-Based Orchestration
// Strictly separates Raw Model Predictions, Contextual Interpretations, and Confirmed Civic Incidents
// ZERO Math.random() – Completely deterministic logic

import { routeIncidentToDepartment } from './boundaryService.js';

/**
 * Generates a deterministic incident ID without Math.random().
 */
export function generateDeterministicIncidentId(domainPrefix, evidenceStr, index = 1) {
  const seed = `${domainPrefix}-${evidenceStr || 'EVIDENCE'}-${index}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(6, '0').slice(0, 6).toUpperCase();
  return `CS-INC-${domainPrefix}-${hex}-${String(index).padStart(2, '0')}`;
}

/**
 * Creates a deterministic 7-step Incident Audit Trail conforming to Phase 9 Section 9.
 */
export function createIncidentAuditTrail({
  incidentId,
  incidentType,
  sourceEvidence,
  arbitrationReason,
  severity,
  priority,
  department,
  locationFormatted,
  processingTimestamp
}) {
  const pTime = processingTimestamp || new Date().toISOString();
  return [
    {
      stepNumber: 1,
      stepName: "INCIDENT_CREATED",
      timestamp: pTime,
      summary: `Deterministic Incident Initialized (${incidentId})`,
      details: `Created from multi-modal sensor/visual detection pipeline without synthetic data.`
    },
    {
      stepNumber: 2,
      stepName: "AI_EVIDENCE_GENERATED",
      timestamp: pTime,
      summary: `Multi-Model Computer Vision Inferences Screened`,
      details: sourceEvidence
    },
    {
      stepNumber: 3,
      stepName: "CONTEXTUAL_ARBITRATION",
      timestamp: pTime,
      summary: `Cross-Model Contextual Arbitration Evaluated`,
      details: arbitrationReason || "Cross-category spatial and semantic conflicts arbitrated."
    },
    {
      stepNumber: 4,
      stepName: "SEVERITY_ASSIGNED",
      timestamp: pTime,
      summary: `Severity: ${severity} | Priority: ${priority}`,
      details: `Assigned based on defect visual extent ratio and multi-modal hazard fusion.`
    },
    {
      stepNumber: 5,
      stepName: "DEPARTMENT_ROUTED",
      timestamp: pTime,
      summary: `Routed to ${department}`,
      details: `Municipal routing evaluated. Location: ${locationFormatted}.`
    },
    {
      stepNumber: 6,
      stepName: "OPERATOR_REVIEW_PENDING",
      timestamp: pTime,
      summary: `Operator Status initialized to NEEDS REVIEW`,
      details: `Awaiting field operator confirmation, rejection, or inspection notes.`
    },
    {
      stepNumber: 7,
      stepName: "STATUS_UPDATE",
      timestamp: pTime,
      summary: `Incident Lifecycle State initialized to NEW`,
      details: `Triage queued for field operator action.`
    }
  ];
}

/**
 * Updates an incident with a human operator review decision without modifying raw AI confidence or bounding boxes.
 */
export function applyOperatorReview(incident, { decision, reason = '', operatorId = 'FIELD-OP-01' }) {
  if (!incident) return null;
  const nowStr = new Date().toISOString();

  const newAuditEntry = {
    stepNumber: (incident.auditTrail?.length || 0) + 1,
    stepName: `OPERATOR_${decision.replace(/\s+/g, '_')}`,
    timestamp: nowStr,
    summary: `Operator Decision: ${decision}`,
    details: reason ? `Operator Notes: "${reason}" (Operator ID: ${operatorId})` : `Operator set status to ${decision} (Operator ID: ${operatorId}).`
  };

  return {
    ...incident,
    operatorStatus: decision,
    operatorDecision: {
      decision,
      reason,
      operatorId,
      timestamp: nowStr
    },
    auditTrail: [...(incident.auditTrail || []), newAuditEntry]
  };
}

/**
 * Updates an incident lifecycle status (NEW, ACKNOWLEDGED, ACTION REQUIRED, IN PROGRESS, RESOLVED).
 * Strictly requires explicit operator action; never automatically marks RESOLVED.
 */
export function updateIncidentLifecycleStatus(incident, newStatus, notes = '') {
  if (!incident) return null;
  const nowStr = new Date().toISOString();

  const newAuditEntry = {
    stepNumber: (incident.auditTrail?.length || 0) + 1,
    stepName: `STATUS_${newStatus.replace(/\s+/g, '_')}`,
    timestamp: nowStr,
    summary: `Lifecycle Status Updated to ${newStatus}`,
    details: notes ? `Notes: "${notes}"` : `Status transitioned to ${newStatus}.`
  };

  return {
    ...incident,
    incidentStatus: newStatus,
    auditTrail: [...(incident.auditTrail || []), newAuditEntry]
  };
}

/**
 * Calculates spatial connected-component topology on a binary water mask using 4-neighborhood BFS.
 * 
 * @param {Uint8Array|Array} binaryMask 1D array of length width*height (1 for water, 0 for background)
 * @param {number} width Mask width (default 128)
 * @param {number} height Mask height (default 128)
 * @returns {{ totalWaterPixels: number, largestComponentPixels: number, numComponents: number, largestCompRatioPct: number }}
 */
export function calculateConnectedComponents(binaryMask, width = 128, height = 128) {
  if (!binaryMask || binaryMask.length < width * height) {
    return { totalWaterPixels: 0, largestComponentPixels: 0, numComponents: 0, largestCompRatioPct: 0 };
  }

  const visited = new Uint8Array(width * height);
  let totalWaterPixels = 0;
  let largestComponentPixels = 0;
  let numComponents = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 1 && visited[idx] === 0) {
        numComponents++;
        let compSize = 0;
        const queue = [idx];
        visited[idx] = 1;
        let head = 0;

        while (head < queue.length) {
          const curr = queue[head++];
          compSize++;
          const cy = Math.floor(curr / width);
          const cx = curr % width;

          // 4-neighborhood
          const neighbors = [
            cy > 0 ? (cy - 1) * width + cx : -1,
            cy < height - 1 ? (cy + 1) * width + cx : -1,
            cx > 0 ? cy * width + (cx - 1) : -1,
            cx < width - 1 ? cy * width + (cx + 1) : -1
          ];

          for (let k = 0; k < 4; k++) {
            const n = neighbors[k];
            if (n >= 0 && binaryMask[n] === 1 && visited[n] === 0) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        totalWaterPixels += compSize;
        if (compSize > largestComponentPixels) {
          largestComponentPixels = compSize;
        }
      }
    }
  }

  const largestCompRatioPct = totalWaterPixels > 0
    ? Number(((largestComponentPixels / totalWaterPixels) * 100).toFixed(2))
    : 0;

  return {
    totalWaterPixels,
    largestComponentPixels,
    numComponents,
    largestCompRatioPct
  };
}

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

  return {
    severity: "UNAVAILABLE",
    severityReason: `Unrecognized defect class ${classCode}`,
    method: "PROTOTYPE_VISUAL_HEURISTIC",
    boxAreaRatio
  };
}

/**
 * Calculates prototype visual flood severity from segmentation output and environmental context.
 * 
 * @param {Object} floodResult Flood ONNX segmentation payload
 * @param {Object} [satelliteRisk] Phase 4 satellite flood risk assessment
 * @returns {{ severity: string, severityReason: string, method: string, floodedAreaPercent: number, label: string }}
 */
export function calculateFloodSeverity(floodResult, satelliteRisk = null) {
  if (!floodResult || (floodResult.modelStatus !== 'VERIFIED_ONNX' && floodResult.inferenceStatus !== 'SUCCESS')) {
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
 * Executes Contextual Cross-Model Arbitration across Road, Waste, and Flood detections.
 * Validated Phase 8C-9 Logic:
 * - A monolithic waste box (width >= 75% AND height >= 75%) is suppressed ONLY if
 *   road damage (D00-D40) or significant flood (>25% water AND component ratio >= 60%) is co-present.
 * - Raw detections are ALWAYS retained in diagnostic/audit payloads.
 * - Road Pothole (D40) + Water (>= 5%) is prioritized as WATER-FILLED POTHOLE.
 * 
 * @param {Object} params
 * @param {Array} params.roadDetections Post-NMS road detections
 * @param {Array} params.wasteDetections Post-NMS waste detections
 * @param {Object} params.floodResult Flood segmentation payload
 * @param {Object} params.metadata EXIF metadata { latitude, longitude, timestamp, isGpsVerified }
 * @returns {Object} Contextually arbitrated results with confirmed Civic Incidents
 */
export function performContextualArbitration({
  roadDetections = [],
  wasteDetections = [],
  floodResult = null,
  metadata = { latitude: null, longitude: null, timestamp: null, isGpsVerified: false }
}) {
  const rawRoad = Array.isArray(roadDetections) ? roadDetections : [];
  const rawWaste = Array.isArray(wasteDetections) ? wasteDetections : [];

  // 1. Analyze Flood & Water Topology
  const waterCoverage = floodResult 
    ? Number((floodResult.floodedAreaPercent ?? floodResult.waterCoveragePercentage ?? 0).toFixed(2))
    : 0.0;

  let topologyRatio = null;
  if (floodResult?.largest_comp_ratio_pct !== undefined) {
    topologyRatio = Number(floodResult.largest_comp_ratio_pct.toFixed(2));
  } else if (floodResult?.spatialMetrics?.largest_comp_ratio_pct !== undefined) {
    topologyRatio = Number(floodResult.spatialMetrics.largest_comp_ratio_pct.toFixed(2));
  } else if (floodResult?.maskClassArray && floodResult.maskClassArray.length > 0) {
    const maskW = floodResult.maskWidth || 128;
    const maskH = floodResult.maskHeight || 128;
    const binary = new Uint8Array(maskW * maskH);
    for (let i = 0; i < floodResult.maskClassArray.length; i++) {
      const cls = floodResult.maskClassArray[i];
      if (cls === 1 || cls === 3 || cls === 5) {
        binary[i] = 1;
      }
    }
    const comps = calculateConnectedComponents(binary, maskW, maskH);
    topologyRatio = comps.largestCompRatioPct;
  }

  // Flood status according to validated topology rule
  let floodStatus = "NO_SIGNIFICANT_WATER";
  let floodReason = "Water coverage is below 5.0% threshold.";
  let isSignificantFlood = false;
  let isPossibleWater = false;

  if (waterCoverage > 25.0) {
    if (topologyRatio !== null) {
      if (topologyRatio >= 60.0) {
        floodStatus = "SIGNIFICANT_WATERLOGGING";
        isSignificantFlood = true;
        floodReason = `Extensive water coverage (${waterCoverage}%) with continuous spatial component (${topologyRatio}% >= 60%).`;
      } else {
        floodStatus = "POSSIBLE_WATERLOGGING";
        floodReason = `Water coverage (${waterCoverage}%) is dispersed (component ratio ${topologyRatio}% < 60%).`;
      }
    } else {
      floodStatus = "SIGNIFICANT_WATERLOGGING";
      isSignificantFlood = true;
      floodReason = `Extensive water coverage (${waterCoverage}% > 25.0%). Topology guard assumed passed.`;
    }
  } else if (waterCoverage >= 5.0) {
    floodStatus = "POSSIBLE_WATERLOGGING";
    floodReason = `Moderate water coverage (${waterCoverage}%). Localized puddles or surface runoff.`;
  }

  if (waterCoverage >= 5.0) {
    isPossibleWater = true;
  }

  // 2. Analyze Road Damage Evidence
  const hasRoadDamage = rawRoad.length > 0;
  const roadClasses = rawRoad.map(d => d.type || d.classCode || 'Road Defect');
  const potholeDet = rawRoad.find(d => {
    const code = (d.classCode || '').toUpperCase();
    const type = (d.type || '').toLowerCase();
    const conf = d.confidence || 0;
    return (code === 'D40' || type.includes('pothole')) && conf >= 0.25;
  });
  const hasPothole = Boolean(potholeDet);

  // 3. Multi-Modal Water-Filled Pothole Fusion Check
  const isWaterFilledPothole = hasPothole && isPossibleWater;

  // 4. Waste Contextual Arbitration
  const contextualWaste = [];
  const suppressedWaste = [];

  for (const waste of rawWaste) {
    const box = waste.boundingBox || {};
    const isMonolithic = typeof box.width === 'number' && typeof box.height === 'number' &&
      box.width >= 75.0 && box.height >= 75.0;

    if (!isMonolithic) {
      // Case A: Localized waste box -> Retain
      contextualWaste.push({
        ...waste,
        arbitrationDecision: "RETAIN_LOCALIZED_WASTE",
        arbitrationReason: `Localized waste box (${box.width}% × ${box.height}%) represents genuine trash accumulation.`
      });
    } else {
      // Case B: Monolithic waste box (>= 75% x 75%)
      if (hasRoadDamage || isSignificantFlood) {
        // Conflicting primary context exists -> SUPPRESS waste interpretation
        const conflictReason = isSignificantFlood
          ? `Monolithic waste detection box (${box.width}% × ${box.height}%) suppressed because significant flood context (${waterCoverage}%, component ratio ${topologyRatio ?? 'N/A'}%) is present.`
          : `Monolithic waste detection box (${box.width}% × ${box.height}%) suppressed because road damage context (${roadClasses.join(', ')}) is present.`;

        suppressedWaste.push({
          id: waste.id,
          classCode: waste.classCode,
          type: waste.type,
          confidence: waste.confidence,
          boundingBox: waste.boundingBox,
          sourceModel: "YOLOv8 Multi-Class Waste Detector",
          status: "CONTEXTUAL_FALSE_POSITIVE",
          arbitrationDecision: "SUPPRESSED_CONTEXTUAL_CONFLICT",
          arbitrationReason: conflictReason
        });
      } else {
        // Monolithic but unconflicted (genuine full-frame municipal dump scene) -> Retain
        contextualWaste.push({
          ...waste,
          arbitrationDecision: "RETAIN_UNCONFLICTED_MONOLITHIC",
          arbitrationReason: `Monolithic waste box (${box.width}% × ${box.height}%) retained because no conflicting road damage or flood context is present (genuine municipal dump).`
        });
      }
    }
  }

  // 5. Generate Confirmed Final Civic Incidents (Phase 9 Specification)
  const civicIncidents = [];
  const isGpsValid = metadata.isGpsVerified && metadata.latitude !== null && metadata.longitude !== null;
  const locFormatted = isGpsValid
    ? `${metadata.latitude}, ${metadata.longitude}`
    : "LOCATION UNAVAILABLE";
  const locStatus = isGpsValid
    ? `GPS AVAILABLE (${metadata.latitude}, ${metadata.longitude})`
    : "LOCATION UNAVAILABLE";
  const captureTimeStr = metadata.timestamp || "CAPTURE TIME UNAVAILABLE";
  const processingTimeStr = processingTimestamp || new Date().toISOString();

  // A. PRIORITY 1: Water-Filled Pothole
  if (isWaterFilledPothole) {
    const evidenceStr = `RDD2022 Pothole (D40, ${(potholeDet.confidence * 100).toFixed(0)}% conf) holding visible standing water (${waterCoverage}% coverage).`;
    const incidentId = generateDeterministicIncidentId('WFP', `${evidenceStr}-${locFormatted}`, 1);
    const routeInfo = routeIncidentToDepartment({
      primaryDepartment: "Highways / Roads & Pavement Maintenance (Elevated Priority - Drainage Advisory)",
      latitude: metadata.latitude,
      longitude: metadata.longitude
    });

    const auditTrail = createIncidentAuditTrail({
      incidentId,
      incidentType: "WATER_FILLED_POTHOLE",
      sourceEvidence: evidenceStr,
      arbitrationReason: "Multi-modal hazard fusion: Structural road cavity (D40) holding standing water. High vehicular damage and drainage risk.",
      severity: "HIGH",
      priority: "IMMEDIATE",
      department: routeInfo.primaryDepartment,
      locationFormatted: locFormatted,
      processingTimestamp: processingTimeStr
    });

    civicIncidents.push({
      id: incidentId,
      incidentType: "WATER_FILLED_POTHOLE",
      title: "Water-Filled Pothole Hazard",
      sourceEvidence: evidenceStr,
      confidence: potholeDet.confidence,
      severity: "HIGH",
      priority: "IMMEDIATE",
      location: {
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        formatted: locFormatted,
        isGpsVerified: isGpsValid
      },
      locationStatus: locStatus,
      captureTimestamp: captureTimeStr,
      timestamp: captureTimeStr, // Backward compatibility
      processingTimestamp: processingTimeStr,
      contextualInterpretation: "Multi-modal hazard fusion: Structural road cavity (D40) holding standing water. High vehicular damage and drainage risk.",
      recommendedDepartment: routeInfo.primaryDepartment,
      wardAssignmentStatus: routeInfo.wardAssignmentStatus,
      wardId: routeInfo.wardId,
      wardName: routeInfo.wardName,
      departmentOffice: routeInfo.departmentOffice,
      departmentContact: routeInfo.departmentContact,
      recommendedAction: "Inspect and repair pothole and verify drainage/water accumulation.",
      operatorStatus: "NEEDS REVIEW",
      operatorDecision: {
        decision: "NEEDS REVIEW",
        reason: "",
        operatorId: "FIELD-OP-01",
        timestamp: null
      },
      incidentStatus: "NEW",
      auditTrail,
      status: "ACTIVE_EVIDENCE",
      boundingBoxes: [potholeDet.boundingBox].filter(Boolean)
    });
  }

  // B. PRIORITY 2: Significant Flood Inundation (when not captured as isolated WFP)
  if (isSignificantFlood && !isWaterFilledPothole) {
    const evidenceStr = `Flood segmentation: ${waterCoverage}% water coverage (${topologyRatio !== null ? topologyRatio + '% component ratio' : 'continuous inundation'}).`;
    const incidentId = generateDeterministicIncidentId('FLD', `${evidenceStr}-${locFormatted}`, 2);
    const routeInfo = routeIncidentToDepartment({
      primaryDepartment: "Stormwater / Drainage Department",
      latitude: metadata.latitude,
      longitude: metadata.longitude
    });

    const sev = waterCoverage >= 35.0 ? "CRITICAL" : "HIGH";
    const auditTrail = createIncidentAuditTrail({
      incidentId,
      incidentType: "SIGNIFICANT_WATERLOGGING",
      sourceEvidence: evidenceStr,
      arbitrationReason: "Continuous roadway inundation confirmed by topological flood analysis.",
      severity: sev,
      priority: "IMMEDIATE",
      department: routeInfo.primaryDepartment,
      locationFormatted: locFormatted,
      processingTimestamp: processingTimeStr
    });

    civicIncidents.push({
      id: incidentId,
      incidentType: "SIGNIFICANT_WATERLOGGING",
      title: "Significant Roadway Waterlogging",
      sourceEvidence: evidenceStr,
      confidence: null,
      severity: sev,
      priority: "IMMEDIATE",
      location: {
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        formatted: locFormatted,
        isGpsVerified: isGpsValid
      },
      locationStatus: locStatus,
      captureTimestamp: captureTimeStr,
      timestamp: captureTimeStr,
      processingTimestamp: processingTimeStr,
      contextualInterpretation: "Continuous roadway inundation confirmed by topological flood analysis.",
      recommendedDepartment: routeInfo.primaryDepartment,
      wardAssignmentStatus: routeInfo.wardAssignmentStatus,
      wardId: routeInfo.wardId,
      wardName: routeInfo.wardName,
      departmentOffice: routeInfo.departmentOffice,
      departmentContact: routeInfo.departmentContact,
      recommendedAction: "Prioritize drainage inspection and emergency stormwater response.",
      operatorStatus: "NEEDS REVIEW",
      operatorDecision: {
        decision: "NEEDS REVIEW",
        reason: "",
        operatorId: "FIELD-OP-01",
        timestamp: null
      },
      incidentStatus: "NEW",
      auditTrail,
      status: "ACTIVE_EVIDENCE",
      boundingBoxes: []
    });
  } else if (isPossibleWater && !isSignificantFlood && !isWaterFilledPothole) {
    const evidenceStr = `Flood segmentation: ${waterCoverage}% localized water coverage.`;
    const incidentId = generateDeterministicIncidentId('PFL', `${evidenceStr}-${locFormatted}`, 3);
    const routeInfo = routeIncidentToDepartment({
      primaryDepartment: "Stormwater / Drainage Department",
      latitude: metadata.latitude,
      longitude: metadata.longitude
    });

    const auditTrail = createIncidentAuditTrail({
      incidentId,
      incidentType: "POSSIBLE_WATERLOGGING",
      sourceEvidence: evidenceStr,
      arbitrationReason: "Localized standing water or runoff margin detected on road surface.",
      severity: "MEDIUM",
      priority: "MEDIUM",
      department: routeInfo.primaryDepartment,
      locationFormatted: locFormatted,
      processingTimestamp: processingTimeStr
    });

    civicIncidents.push({
      id: incidentId,
      incidentType: "POSSIBLE_WATERLOGGING",
      title: "Possible Roadway Waterlogging",
      sourceEvidence: evidenceStr,
      confidence: null,
      severity: "MEDIUM",
      priority: "MEDIUM",
      location: {
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        formatted: locFormatted,
        isGpsVerified: isGpsValid
      },
      locationStatus: locStatus,
      captureTimestamp: captureTimeStr,
      timestamp: captureTimeStr,
      processingTimestamp: processingTimeStr,
      contextualInterpretation: "Localized standing water or runoff margin detected on road surface.",
      recommendedDepartment: routeInfo.primaryDepartment,
      wardAssignmentStatus: routeInfo.wardAssignmentStatus,
      wardId: routeInfo.wardId,
      wardName: routeInfo.wardName,
      departmentOffice: routeInfo.departmentOffice,
      departmentContact: routeInfo.departmentContact,
      recommendedAction: "Initiate stormwater watch and inspect local drainage.",
      operatorStatus: "NEEDS REVIEW",
      operatorDecision: {
        decision: "NEEDS REVIEW",
        reason: "",
        operatorId: "FIELD-OP-01",
        timestamp: null
      },
      incidentStatus: "NEW",
      auditTrail,
      status: "ACTIVE_EVIDENCE",
      boundingBoxes: []
    });
  }

  // C. PRIORITY 3: Road Damage (if not already handled by WFP)
  if (rawRoad.length > 0 && !isWaterFilledPothole) {
    const hasD40 = rawRoad.some(d => d.classCode === 'D40');
    const roadSev = hasD40 ? "HIGH" : (rawRoad.length >= 2 ? "MEDIUM" : "LOW");
    const evidenceStr = `RDD2022 detections: ${rawRoad.map(d => `${d.type} (${Math.round(d.confidence * 100)}%)`).join(', ')}.`;
    const incidentId = generateDeterministicIncidentId('RD', `${evidenceStr}-${locFormatted}`, 4);
    const routeInfo = routeIncidentToDepartment({
      primaryDepartment: "Highways / Roads & Pavement Maintenance",
      latitude: metadata.latitude,
      longitude: metadata.longitude
    });

    const auditTrail = createIncidentAuditTrail({
      incidentId,
      incidentType: "ROAD_DAMAGE",
      sourceEvidence: evidenceStr,
      arbitrationReason: `${rawRoad.length} pavement defect(s) detected via RDD2022 model.`,
      severity: roadSev,
      priority: roadSev === "HIGH" ? "HIGH" : "MEDIUM",
      department: routeInfo.primaryDepartment,
      locationFormatted: locFormatted,
      processingTimestamp: processingTimeStr
    });

    civicIncidents.push({
      id: incidentId,
      incidentType: "ROAD_DAMAGE",
      title: rawRoad.length === 1 ? `${rawRoad[0].type} (${rawRoad[0].classCode})` : `${rawRoad.length} Road Surface Defects`,
      sourceEvidence: evidenceStr,
      confidence: rawRoad[0]?.confidence || 0.50,
      severity: roadSev,
      priority: roadSev === "HIGH" ? "HIGH" : "MEDIUM",
      location: {
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        formatted: locFormatted,
        isGpsVerified: isGpsValid
      },
      locationStatus: locStatus,
      captureTimestamp: captureTimeStr,
      timestamp: captureTimeStr,
      processingTimestamp: processingTimeStr,
      contextualInterpretation: `${rawRoad.length} pavement defect(s) detected via RDD2022 model.`,
      recommendedDepartment: routeInfo.primaryDepartment,
      wardAssignmentStatus: routeInfo.wardAssignmentStatus,
      wardId: routeInfo.wardId,
      wardName: routeInfo.wardName,
      departmentOffice: routeInfo.departmentOffice,
      departmentContact: routeInfo.departmentContact,
      recommendedAction: "Inspect and repair affected pavement section.",
      operatorStatus: "NEEDS REVIEW",
      operatorDecision: {
        decision: "NEEDS REVIEW",
        reason: "",
        operatorId: "FIELD-OP-01",
        timestamp: null
      },
      incidentStatus: "NEW",
      auditTrail,
      status: "ACTIVE_EVIDENCE",
      boundingBoxes: rawRoad.map(d => d.boundingBox).filter(Boolean)
    });
  }

  // D. PRIORITY 4: Waste Accumulation (Contextually Accepted Only)
  if (contextualWaste.length > 0) {
    const hasLargeWaste = contextualWaste.some(d => {
      const box = d.boundingBox || {};
      return ((box.width * box.height) / 10000) >= 0.10;
    });
    const wasteSev = hasLargeWaste || contextualWaste.length >= 3 ? "HIGH" : (contextualWaste.length >= 2 ? "MEDIUM" : "LOW");
    const evidenceStr = `Waste model detections: ${contextualWaste.map(d => `${d.type} (${Math.round(d.confidence * 100)}%)`).join(', ')}.`;
    const incidentId = generateDeterministicIncidentId('WST', `${evidenceStr}-${locFormatted}`, 5);
    const routeInfo = routeIncidentToDepartment({
      primaryDepartment: "Solid Waste Management",
      latitude: metadata.latitude,
      longitude: metadata.longitude
    });

    const auditTrail = createIncidentAuditTrail({
      incidentId,
      incidentType: "WASTE_ACCUMULATION",
      sourceEvidence: evidenceStr,
      arbitrationReason: `${contextualWaste.length} visible waste accumulation region(s) validated after contextual cross-model arbitration.`,
      severity: wasteSev,
      priority: wasteSev === "HIGH" ? "HIGH" : "MEDIUM",
      department: routeInfo.primaryDepartment,
      locationFormatted: locFormatted,
      processingTimestamp: processingTimeStr
    });

    civicIncidents.push({
      id: incidentId,
      incidentType: "WASTE_ACCUMULATION",
      title: "Visible Waste Accumulation",
      sourceEvidence: evidenceStr,
      confidence: contextualWaste[0]?.confidence || 0.50,
      severity: wasteSev,
      priority: wasteSev === "HIGH" ? "HIGH" : "MEDIUM",
      location: {
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        formatted: locFormatted,
        isGpsVerified: isGpsValid
      },
      locationStatus: locStatus,
      captureTimestamp: captureTimeStr,
      timestamp: captureTimeStr,
      processingTimestamp: processingTimeStr,
      contextualInterpretation: `${contextualWaste.length} visible waste accumulation region(s) validated after contextual cross-model arbitration.`,
      recommendedDepartment: routeInfo.primaryDepartment,
      wardAssignmentStatus: routeInfo.wardAssignmentStatus,
      wardId: routeInfo.wardId,
      wardName: routeInfo.wardName,
      departmentOffice: routeInfo.departmentOffice,
      departmentContact: routeInfo.departmentContact,
      recommendedAction: "Inspect and clear visible waste accumulation.",
      operatorStatus: "NEEDS REVIEW",
      operatorDecision: {
        decision: "NEEDS REVIEW",
        reason: "",
        operatorId: "FIELD-OP-01",
        timestamp: null
      },
      incidentStatus: "NEW",
      auditTrail,
      status: "ACTIVE_EVIDENCE",
      boundingBoxes: contextualWaste.map(d => d.boundingBox).filter(Boolean)
    });
  }

  return {
    rawDetections: {
      road: rawRoad,
      waste: rawWaste,
      flood: floodResult
    },
    contextualDetections: {
      road: rawRoad,
      waste: contextualWaste,
      flood: {
        status: floodStatus,
        waterCoverage,
        topologyRatio,
        isSignificantFlood,
        isPossibleWater
      }
    },
    suppressedDetections: suppressedWaste,
    civicIncidents,
    hasIncidents: civicIncidents.length > 0,
    incidentsSummary: civicIncidents.length > 0
      ? `${civicIncidents.length} verified civic incident(s) from current evidence.`
      : "No verified civic incidents from current evidence.",
    floodInterpretation: {
      status: floodStatus,
      waterCoveragePercent: waterCoverage,
      topologyRatioPercent: topologyRatio,
      isSignificantFlood,
      isPossibleWater,
      reason: floodReason
    },
    wasteInterpretation: {
      status: contextualWaste.length > 0 ? "VISIBLE_WASTE_DETECTED" : "CLEAR",
      rawCount: rawWaste.length,
      acceptedCount: contextualWaste.length,
      suppressedCount: suppressedWaste.length,
      description: contextualWaste.length > 0
        ? `${contextualWaste.length} visible waste accumulation region(s) confirmed.`
        : (suppressedWaste.length > 0 
          ? `All ${suppressedWaste.length} raw waste candidate(s) contextually suppressed as cross-category false alarms.` 
          : "No supported waste issue detected.")
    },
    roadInterpretation: {
      status: rawRoad.length > 0 ? "DEFECT_DETECTED" : "CLEAR",
      defectCount: rawRoad.length,
      hasPothole,
      hasRoadDamage,
      detectedClasses: roadClasses
    },
    fusionEvidence: {
      isWaterFilledPothole,
      conflictsResolved: suppressedWaste.length,
      fusionDescription: isWaterFilledPothole
        ? "Multi-modal fusion: Road Pothole + Water Coverage >= 5% prioritized as WATER-FILLED POTHOLE."
        : (suppressedWaste.length > 0 
          ? `${suppressedWaste.length} monolithic waste trigger(s) contextually resolved.` 
          : "Independent single-hazard or unconflicted detection.")
    }
  };
}

/**
 * Calculates dimension-level severity, individual detection severities, contextual arbitration,
 * and overall area-level action priority for a complete visual detection payload.
 * 
 * @param {Object} visualDetections 
 * @param {Object} [satelliteRisk] Phase 4 satellite flood risk assessment
 * @returns {Object} Enriched visual detection payload with severity & priority analysis
 */
export function calculateVisualDetectionsSeverity(visualDetections, satelliteRisk = null) {
  if (!visualDetections || visualDetections.isAvailable === false) {
    return {
      isAvailable: false,
      rawDetections: { road: [], waste: [], flood: null },
      contextualDetections: { road: [], waste: [], flood: null },
      suppressedDetections: [],
      civicIncidents: [],
      hasIncidents: false,
      incidentsSummary: "Awaiting Visual Inference Stream — No active image evaluated.",
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

  // 1. Run Contextual Cross-Model Arbitration (Benchmarked)
  const arbStart = performance.now();
  const arbitration = performContextualArbitration({
    roadDetections: rawRoad,
    wasteDetections: rawWaste,
    floodResult,
    metadata,
    processingTimestamp: visualDetections?.processingTimestamp
  });
  const arbEnd = performance.now();
  const arbitrationTimeMs = Number((arbEnd - arbStart).toFixed(2));

  // 2. Process individual enriched road detections
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

  // 3. Process individual enriched waste detections (only accepted contextual waste)
  const enrichedWasteDetections = arbitration.contextualDetections.waste.map(det => {
    const sevInfo = calculateDetectionSeverity(det);
    return {
      ...det,
      severity: sevInfo.severity,
      severityReason: sevInfo.severityReason,
      method: sevInfo.method,
      boxAreaRatio: sevInfo.boxAreaRatio
    };
  });

  // 4. Process Flood Segmentation Severity
  const floodSevInfo = calculateFloodSeverity(floodResult, satelliteRisk);

  // 5. Calculate Road Dimension Severity
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

  // 6. Calculate Waste Dimension Severity (Using Arbitrated Accepted Waste ONLY)
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
      wasteReason = arbitration.suppressedDetections.length > 0
        ? `No confirmed waste issues (${arbitration.suppressedDetections.length} raw trigger(s) contextually suppressed).`
        : "No supported waste issue detected";
    }
  }

  // 7. Calculate Flood Dimension Severity Status
  let floodStatus = "UNAVAILABLE";
  if (floodResult && (floodResult.modelStatus === 'VERIFIED_ONNX' || floodResult.inferenceStatus === 'SUCCESS')) {
    floodStatus = "AVAILABLE";
  }

  // 8. Calculate Area-Level Action Priority (ROUTINE, MEDIUM, HIGH, IMMEDIATE)
  let overallPriority = "ROUTINE";
  let priorityReason = "Baseline routine maintenance monitoring";

  const allActiveEnriched = [...enrichedRoadDetections, ...enrichedWasteDetections];
  const isGpsVerified = metadata.isGpsVerified && metadata.latitude !== null && metadata.longitude !== null;

  if (arbitration.fusionEvidence.isWaterFilledPothole || floodSevInfo.severity === 'CRITICAL' || roadSeverity === 'HIGH' || wasteSeverity === 'HIGH') {
    if (arbitration.fusionEvidence.isWaterFilledPothole || floodSevInfo.severity === 'CRITICAL' || allActiveEnriched.length >= 3 || isGpsVerified) {
      overallPriority = "IMMEDIATE";
      priorityReason = arbitration.fusionEvidence.isWaterFilledPothole
        ? "Water-filled pothole hazard requires immediate pavement and drainage dispatch"
        : (floodSevInfo.severity === 'CRITICAL'
          ? "Critical visual flood extent detected with supporting environmental flood risk"
          : "High visual severity with multi-defect spatial concentration or verified GPS location");
    } else {
      overallPriority = "HIGH";
      priorityReason = "High visual defect or flood severity detected in image frame";
    }
  } else if (floodSevInfo.severity === 'HIGH' || roadSeverity === 'MEDIUM' || wasteSeverity === 'MEDIUM' || allActiveEnriched.length >= 2) {
    if (floodSevInfo.severity === 'HIGH' || allActiveEnriched.length >= 3) {
      overallPriority = "HIGH";
      priorityReason = floodSevInfo.severity === 'HIGH'
        ? "High visible water coverage detected in street imagery"
        : "Multiple moderate visual defects detected across frame";
    } else {
      overallPriority = "MEDIUM";
      priorityReason = "Moderate visual defect or flood severity requiring standard field inspection";
    }
  } else if (floodSevInfo.severity === 'MEDIUM' || allActiveEnriched.length === 1) {
    overallPriority = "MEDIUM";
    priorityReason = "Moderate visual waterlogging or single minor/moderate visual defect flagged for review";
  } else {
    overallPriority = "ROUTINE";
    priorityReason = "Zero severe visual defects detected";
  }

  return {
    isAvailable: true,
    // 1. RAW MODEL LAYER
    rawDetections: arbitration.rawDetections,
    // 2. CONTEXTUAL INTERPRETATION LAYER
    contextualDetections: {
      road: enrichedRoadDetections,
      waste: enrichedWasteDetections,
      flood: arbitration.contextualDetections.flood
    },
    suppressedDetections: arbitration.suppressedDetections,
    floodInterpretation: arbitration.floodInterpretation,
    wasteInterpretation: arbitration.wasteInterpretation,
    roadInterpretation: arbitration.roadInterpretation,
    fusionEvidence: arbitration.fusionEvidence,
    // 3. FINAL CIVIC INCIDENT LAYER
    civicIncidents: arbitration.civicIncidents,
    hasIncidents: arbitration.hasIncidents,
    incidentsSummary: arbitration.incidentsSummary,
    // Preserved dimension models for backward compatibility
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
    timingBreakdown: {
      imageLoadTimeMs: visualDetections?.timingBreakdown?.imageLoadTimeMs ?? null,
      roadInferenceTimeMs: visualDetections?.timingBreakdown?.roadInferenceTimeMs ?? null,
      wasteInferenceTimeMs: visualDetections?.timingBreakdown?.wasteInferenceTimeMs ?? null,
      floodInferenceTimeMs: visualDetections?.timingBreakdown?.floodInferenceTimeMs ?? null,
      arbitrationTimeMs,
      totalProcessingTimeMs: Number(((visualDetections?.timingBreakdown?.totalProcessingTimeMs || visualDetections?.inferenceTimeMs || 0) + arbitrationTimeMs).toFixed(1))
    },
    qualityAudit: visualDetections?.qualityAudit || null,
    processingTimestamp: visualDetections?.processingTimestamp || new Date().toISOString(),
    source: visualDetections.source || 'Phase 8C ONNX inference',
    modelName: visualDetections.modelName || 'CivicSense ONNX Vision Engine',
    inferenceTimeMs: visualDetections.inferenceTimeMs || 0,
    method: "PROTOTYPE_VISUAL_HEURISTIC"
  };
}
