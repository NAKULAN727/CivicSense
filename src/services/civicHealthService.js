// CivicSense AI - Civic Health Intelligence Service (Phase 8B, 8C-3, 8C-5 & 8C-6 Integration)
// Deterministic Multi-Hazard Civic Health Aggregator
// Combines Phase 4 Satellite/Environmental Risk Telemetry with Phase 8C Real Visual Inference Architecture

import { calculateVisualDetectionsSeverity } from './civicSeverityService.js';

/**
 * Interface definition for visual detections payload
 */
export const INITIAL_VISUAL_DETECTIONS = {
  road: [],
  waste: [],
  flood: null,
  isAvailable: false
};

/**
 * Calculates a deterministic Civic Health Assessment for the current study area.
 * 
 * @param {Object} params
 * @param {Object} params.studyArea Selected Study Area object (name, region, id, lat, lng)
 * @param {Object} params.riskAssessment Phase 4 AI Flood Risk Assessment payload
 * @param {Object} params.waterAnalysisData Satellite Water Analysis payload
 * @param {Object} params.visualDetections Real Phase 8C visual detection inference payload
 * @returns {Object} Civic Health Assessment payload
 */
export const calculateCivicHealth = ({ 
  studyArea, 
  riskAssessment, 
  waterAnalysisData, 
  visualDetections = null 
}) => {
  const areaName = studyArea?.name || riskAssessment?.studyArea || 'Pallikaranai–Velachery';
  const areaRegion = studyArea?.region || 'Metropolitan Region';

  // Determine if visual inference pipeline has been executed
  const isVisualAvailable = Boolean(
    visualDetections && 
    (visualDetections.isAvailable === true || 
     visualDetections.road !== undefined || 
     visualDetections.waste !== undefined || 
     visualDetections.flood !== undefined ||
     visualDetections.detections !== undefined)
  );

  // Run Phase 8C visual severity and priority analysis
  const visualAnalysis = calculateVisualDetectionsSeverity(visualDetections, riskAssessment);
  const visualMetadata = visualDetections?.metadata ?? { latitude: null, longitude: null, timestamp: null, isGpsVerified: false };

  // 1. DRAINAGE & WATERLOGGING (COMBINED SATELLITE TELEMETRY + RGB VISUAL AI SEGMENTATION)
  let drainage = {
    category: "DRAINAGE",
    name: "Drainage & Waterlogging",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    riskScore: null,
    healthScore: null,
    visualFloodedPercent: null,
    visualSeverity: "UNAVAILABLE",
    sourceType: "REAL / LIVE + DERIVED",
    sourceLabel: "Sentinel-2 NDWI + SegFormer RGB Flood AI Model",
    description: "Multi-sensor flood index derived from Phase 4 Satellite NDWI, Open-Meteo rainfall, DEM elevation, and Phase 8C-6 RGB Flood ONNX Model.",
    details: "Awaiting Phase 4 Satellite Risk Telemetry and/or RGB Visual Flood Inference..."
  };

  const hasSatelliteData = riskAssessment && typeof riskAssessment.score === 'number';
  const hasVisualFloodData = isVisualAvailable && visualAnalysis.flood && visualAnalysis.flood.status === 'AVAILABLE';

  if (hasSatelliteData && hasVisualFloodData) {
    const satScore = riskAssessment.score;
    const satLevel = riskAssessment.level || 'MODERATE';
    const healthScore = Math.max(0, 100 - satScore);
    const visPercent = visualAnalysis.flood.floodedAreaPercent;
    const visSev = visualAnalysis.flood.severity;

    // Combined Level (Satellite NDWI telemetry + RGB Visual Evidence)
    let combinedLevel = satLevel;
    if (visSev === 'CRITICAL' || visSev === 'HIGH') {
      combinedLevel = (satLevel === 'HIGH' || satLevel === 'CRITICAL') ? 'CRITICAL' : 'HIGH';
    }

    drainage = {
      category: "DRAINAGE",
      name: "Drainage & Waterlogging",
      status: "AVAILABLE",
      level: combinedLevel,
      riskScore: satScore,
      healthScore: healthScore,
      score: satScore,
      visualFloodedPercent: visPercent,
      visualSeverity: visSev,
      sourceType: "REAL SATELLITE + REAL RGB VISUAL AI",
      sourceLabel: "Sentinel-2 NDWI Telemetry + SegFormer RGB Flood Model",
      description: "Integrated flood assessment combining Sentinel-2 satellite NDWI/rainfall telemetry with street/aerial RGB flood ONNX segmentation.",
      details: `Satellite NDWI Flood Risk: ${satScore}/100 (${satLevel}) • RGB Visible Water Coverage: ${visPercent}% (Prototype Severity: ${visSev})`
    };
  } else if (hasSatelliteData) {
    const score = riskAssessment.score;
    const level = riskAssessment.level || 'MODERATE';
    const healthScore = Math.max(0, 100 - score);

    drainage = {
      category: "DRAINAGE",
      name: "Drainage & Waterlogging",
      status: "AVAILABLE",
      level: level,
      riskScore: score,
      healthScore: healthScore,
      score: score,
      visualFloodedPercent: null,
      visualSeverity: "UNAVAILABLE",
      sourceType: "REAL SATELLITE TELEMETRY",
      sourceLabel: "Sentinel-2 NDWI + environmental telemetry",
      description: "Derived from Phase 4 Real NDWI satellite water extent, Open-Meteo precipitation, terrain elevation & historical flood references.",
      details: `Satellite Flood Risk Score: ${score}/100 (${level}) • Drainage Health Index: ${healthScore}/100`
    };
  } else if (hasVisualFloodData) {
    const visPercent = visualAnalysis.flood.floodedAreaPercent;
    const visSev = visualAnalysis.flood.severity;

    drainage = {
      category: "DRAINAGE",
      name: "Drainage & Waterlogging",
      status: "AVAILABLE",
      level: visSev === 'CRITICAL' ? 'HIGH' : visSev,
      riskScore: null,
      healthScore: null,
      score: null,
      visualFloodedPercent: visPercent,
      visualSeverity: visSev,
      sourceType: "REAL RGB VISUAL AI",
      sourceLabel: "Phase 8C-6 SegFormer RGB Flood ONNX Model",
      description: "Street/aerial RGB visual flood segmentation ONNX model (Satellite telemetry offline).",
      details: `RGB Visible Water Coverage: ${visPercent}% • Prototype Visual Severity: ${visSev} (Satellite telemetry offline)`
    };
  }

  // 2. ROAD CONDITION (STREET-LEVEL VISUAL DATA FROM PHASE 8C-1 & 8C-4)
  let road = {
    category: "ROAD",
    name: "Road Condition",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    count: 0,
    detectedClasses: [],
    confidences: [],
    severity: "UNAVAILABLE",
    severityReason: "Visual surveillance feed offline",
    priority: "ROUTINE",
    sourceType: "REAL / LIVE VISUAL AI",
    sourceLabel: "Phase 8C-4 RDD2022 ONNX Model",
    description: "Requires street-level geotagged imagery / computer vision model inference for pothole and crack detection.",
    details: "Street-level visual inspection feed offline. Geotagged camera / model inference required.",
    location: "LOCATION UNAVAILABLE",
    latitude: null,
    longitude: null,
    timestamp: "CAPTURE TIME UNAVAILABLE",
    severityLabel: "PROTOTYPE DERIVED FROM VISUAL EVIDENCE",
    rawDetections: []
  };

  if (isVisualAvailable && visualAnalysis.road.status === 'AVAILABLE') {
    const roadDets = visualAnalysis.road.detections;
    const count = roadDets.length;
    const classNames = roadDets.map(d => `${d.type} (${d.classCode})`);
    const confList = roadDets.map(d => d.confidence);
    const roadSev = visualAnalysis.road.severity;

    road = {
      category: "ROAD",
      name: "Road Condition",
      status: "AVAILABLE",
      level: roadSev === 'HIGH' ? "HIGH DEFECT" : roadSev === 'MEDIUM' ? "MODERATE DEFECT" : count === 0 ? "CLEAR" : "LOW DEFECT",
      score: null,
      count: count,
      detectedClasses: classNames,
      confidences: confList,
      severity: roadSev,
      severityReason: visualAnalysis.road.severityReason,
      priority: visualAnalysis.overallPriority,
      sourceType: "REAL / LIVE VISUAL AI",
      sourceLabel: "Phase 8C-4 RDD2022 ONNX Model",
      description: count === 0 
        ? "No supported road issue detected" 
        : `${count} road issue(s) detected via ONNX vision model.`,
      details: count === 0 
        ? "No supported road issue detected" 
        : `${count} defect(s) detected (${classNames.join(', ')}) • Prototype Severity: ${roadSev}`,
      location: visualMetadata.isGpsVerified && visualMetadata.latitude !== null && visualMetadata.longitude !== null
        ? `VERIFIED (${visualMetadata.latitude}, ${visualMetadata.longitude})`
        : "LOCATION UNAVAILABLE",
      latitude: visualMetadata.latitude,
      longitude: visualMetadata.longitude,
      timestamp: visualMetadata.timestamp || "CAPTURE TIME UNAVAILABLE",
      severityLabel: "PROTOTYPE DERIVED FROM VISUAL EVIDENCE",
      rawDetections: roadDets
    };
  }

  // 3. WASTE CONDITION (STREET-LEVEL VISUAL DATA FROM PHASE 8C-5 REAL WASTE MODEL)
  let waste = {
    category: "WASTE",
    name: "Waste Accumulation",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    count: 0,
    detectedClasses: [],
    confidences: [],
    severity: "UNAVAILABLE",
    severityReason: "Waste surveillance feed offline or model unavailable",
    priority: "ROUTINE",
    sourceType: "REAL / LIVE VISUAL AI",
    sourceLabel: "Phase 8C-5 ONNX Waste Model",
    description: "Requires street-level geotagged imagery / computer vision model inference for waste and litter detection.",
    details: "Street-level visual inspection feed offline. Geotagged camera / waste model inference required.",
    location: "LOCATION UNAVAILABLE",
    latitude: null,
    longitude: null,
    timestamp: "CAPTURE TIME UNAVAILABLE",
    severityLabel: "PROTOTYPE DERIVED FROM VISUAL EVIDENCE",
    rawDetections: []
  };

  if (isVisualAvailable && visualAnalysis.waste.status === 'AVAILABLE') {
    const wasteDets = visualAnalysis.waste.detections;
    const count = wasteDets.length;
    const classNames = wasteDets.map(d => `${d.type} (${d.classCode})`);
    const confList = wasteDets.map(d => d.confidence);
    const wasteSev = visualAnalysis.waste.severity;

    waste = {
      category: "WASTE",
      name: "Waste Accumulation",
      status: "AVAILABLE",
      level: wasteSev === 'HIGH' ? "HIGH ACCUMULATION" : wasteSev === 'MEDIUM' ? "MODERATE ACCUMULATION" : count === 0 ? "CLEAR" : "LOW ACCUMULATION",
      score: null,
      count: count,
      detectedClasses: classNames,
      confidences: confList,
      severity: wasteSev,
      severityReason: visualAnalysis.waste.severityReason,
      priority: visualAnalysis.overallPriority,
      sourceType: "REAL / LIVE VISUAL AI",
      sourceLabel: "Phase 8C-5 ONNX Waste Model",
      description: count === 0 
        ? "No supported waste issue detected" 
        : `${count} waste object(s) detected via ONNX vision model.`,
      details: count === 0 
        ? "No supported waste issue detected" 
        : `${count} waste object(s) detected (${classNames.join(', ')}) • Prototype Severity: ${wasteSev}`,
      location: visualMetadata.isGpsVerified && visualMetadata.latitude !== null && visualMetadata.longitude !== null
        ? `VERIFIED (${visualMetadata.latitude}, ${visualMetadata.longitude})`
        : "LOCATION UNAVAILABLE",
      latitude: visualMetadata.latitude,
      longitude: visualMetadata.longitude,
      timestamp: visualMetadata.timestamp || "CAPTURE TIME UNAVAILABLE",
      severityLabel: "PROTOTYPE DERIVED FROM VISUAL EVIDENCE",
      rawDetections: wasteDets
    };
  }

  // 4. ENVIRONMENT & AIR QUALITY (PRESERVED CONTRACT)
  const environment = {
    category: "ENVIRONMENT",
    name: "Environmental Quality",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    sourceType: "SENSOR / SATELLITE",
    sourceLabel: "Awaiting air quality sensor telemetry stream",
    description: "Street-level ambient air quality and environmental pollution index monitoring.",
    details: "Environmental telemetry stream offline."
  };

  // Overall Health Assessment
  const allDimensions = [drainage, road, waste, environment];
  const availableDimensions = allDimensions.filter(d => d.status === 'AVAILABLE');
  const availableCount = availableDimensions.length;
  const unavailableCount = allDimensions.length - availableCount;
  
  let overallHealthLevel = unavailableCount > 0 ? "PARTIAL" : "STABLE";
  let primaryConcern = unavailableCount > 0 
    ? `Civic health assessment is partial (${unavailableCount} required sensor/model dimension(s) offline)` 
    : "Routine surveillance";

  if (road.severity === 'HIGH' || waste.severity === 'HIGH' || drainage.level === 'HIGH' || drainage.level === 'CRITICAL' || drainage.level === 'SEVERE') {
    overallHealthLevel = unavailableCount > 0 ? "CRITICAL CONCERN (PARTIAL DATA)" : "CRITICAL CONCERN";
    primaryConcern = "High-severity flood risk or severe visual infrastructure defect detected";
  } else if (road.severity === 'MEDIUM' || waste.severity === 'MEDIUM' || drainage.level === 'MODERATE' || drainage.level === 'MEDIUM') {
    overallHealthLevel = unavailableCount > 0 ? "ATTENTION REQUIRED (PARTIAL DATA)" : "ATTENTION REQUIRED";
    primaryConcern = "Moderate civic hazard or infrastructure defect flagged for field review";
  } else {
    overallHealthLevel = unavailableCount > 0 ? "PARTIAL" : "STABLE";
    primaryConcern = unavailableCount > 0 
      ? `Civic health assessment is partial (${unavailableCount} required dimension(s) offline)` 
      : "No severe civic hazards flagged across active sensors";
  }

  // Evidence array
  const evidence = [];
  if (drainage.status === 'AVAILABLE') {
    evidence.push(`${drainage.sourceLabel}: ${drainage.details}`);
  }
  if (road.status === 'AVAILABLE') {
    evidence.push(`${road.sourceLabel}: ${road.details}`);
  }
  if (waste.status === 'AVAILABLE') {
    evidence.push(`${waste.sourceLabel}: ${waste.details}`);
  }
  if (environment.status === 'AVAILABLE') {
    evidence.push(`${environment.sourceLabel}: ${environment.details}`);
  }

  // Limitations array
  const limitations = [];
  if (road.status !== 'AVAILABLE') {
    limitations.push("Street-level visual surveillance feed offline. Geotagged camera / model inference required for road defects.");
  }
  if (waste.status !== 'AVAILABLE') {
    limitations.push("Street-level visual surveillance feed offline. Geotagged camera / waste model inference required for waste accumulation.");
  }
  if (environment.status !== 'AVAILABLE') {
    limitations.push("Environmental canopy and air quality sensor telemetry stream is currently offline.");
  }

  const now = new Date();
  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    studyArea: areaName,
    studyAreaName: areaName,
    region: areaRegion,
    studyAreaRegion: areaRegion,
    timestamp: now.toISOString(),
    formattedTime,
    overallStatus: overallHealthLevel,
    overallTitle: primaryConcern,
    overallLevel: overallHealthLevel,
    overallHealthLevel,
    primaryConcern,
    overallActionPriority: visualAnalysis.overallPriority || "ROUTINE",
    availableCount,
    unavailableCount,
    dimensions: {
      drainage,
      road,
      waste,
      environment
    },
    activeSensorsCount: availableCount,
    evidence,
    limitations,
    visualAnalysis
  };
};
