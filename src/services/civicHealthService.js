// CivicSense AI - Civic Health Intelligence Service (Phase 8B Foundation)
// Deterministic Multi-Hazard Civic Health Aggregator
// Combines Phase 4 Satellite/Environmental Risk Telemetry with Visual Inspection Architecture

/**
 * Interface definition for future visual detections
 */
export const INITIAL_VISUAL_DETECTIONS = {
  road: [],
  waste: [],
  infrastructure: []
};

/**
 * Calculates a deterministic Civic Health Assessment for the current study area.
 * 
 * @param {Object} params
 * @param {Object} params.studyArea Selected Study Area object (name, region, id, lat, lng)
 * @param {Object} params.riskAssessment Phase 4 AI Flood Risk Assessment payload
 * @param {Object} params.waterAnalysisData Satellite Water Analysis payload
 * @param {Object} params.visualDetections Interface for future street-level visual detections
 * @returns {Object} Civic Health Assessment payload
 */
export const calculateCivicHealth = ({ 
  studyArea, 
  riskAssessment, 
  waterAnalysisData, 
  visualDetections = INITIAL_VISUAL_DETECTIONS 
}) => {
  const areaName = studyArea?.name || riskAssessment?.studyArea || 'Pallikaranai–Velachery';
  const areaRegion = studyArea?.region || 'Metropolitan Region';

  // 1. DRAINAGE & WATERLOGGING (REUSED FROM PHASE 4 REAL TELEMETRY)
  let drainage = {
    category: "DRAINAGE",
    name: "Drainage & Waterlogging",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    riskScore: null,
    healthScore: null,
    sourceType: "REAL / LIVE + DERIVED",
    description: "Multi-sensor flood index derived from Phase 4 Satellite NDWI, Open-Meteo rainfall & Open-Elevation.",
    details: "Awaiting Phase 4 Risk Telemetry stream..."
  };

  if (riskAssessment && typeof riskAssessment.score === 'number') {
    const score = riskAssessment.score;
    const level = riskAssessment.level || 'MODERATE';
    // Health score is inverted flood risk score (Higher flood risk = Lower drainage health)
    const healthScore = Math.max(0, 100 - score);

    drainage = {
      category: "DRAINAGE",
      name: "Drainage & Waterlogging",
      status: "AVAILABLE",
      level: level,
      riskScore: score,
      healthScore: healthScore,
      score: score, // Preserved flood index value
      sourceType: "REAL / LIVE + DERIVED",
      description: "Derived from Phase 4 Real NDWI satellite water extent, Open-Meteo precipitation, terrain elevation & historical flood references.",
      details: `Flood Risk Score: ${score}/100 (${level}) • Drainage Health Index: ${healthScore}/100`
    };
  }

  // 2. ROAD CONDITION (STREET-LEVEL VISUAL DATA REQUIRED)
  let road = {
    category: "ROAD",
    name: "Road Condition",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    sourceType: "PROTOTYPE / VISUAL DATA REQUIRED",
    description: "Requires street-level geotagged imagery / computer vision model inference for pothole and crack detection.",
    details: "Street-level visual inspection feed offline. Geotagged camera / model inference required."
  };

  if (visualDetections.road && Array.isArray(visualDetections.road) && visualDetections.road.length > 0) {
    const count = visualDetections.road.length;
    road = {
      category: "ROAD",
      name: "Road Condition",
      status: "AVAILABLE",
      level: count > 3 ? "HIGH DEFECT" : "MODERATE DEFECT",
      score: Math.max(10, 100 - (count * 15)),
      sourceType: "PROTOTYPE / VISUAL DETECTION",
      description: `${count} road defects detected via computer vision survey feed.`,
      details: `${count} bounding box detections active.`
    };
  }

  // 3. WASTE CONDITION (STREET-LEVEL VISUAL DATA REQUIRED)
  let waste = {
    category: "WASTE",
    name: "Waste Condition",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    sourceType: "PROTOTYPE / VISUAL DATA REQUIRED",
    description: "Requires street-level visual surveillance / sanitation camera stream for garbage accumulation detection.",
    details: "Sanitation visual telemetry offline. Street-level camera feed required."
  };

  if (visualDetections.waste && Array.isArray(visualDetections.waste) && visualDetections.waste.length > 0) {
    const count = visualDetections.waste.length;
    waste = {
      category: "WASTE",
      name: "Waste Condition",
      status: "AVAILABLE",
      level: count > 2 ? "CRITICAL ACCUMULATION" : "MODERATE ACCUMULATION",
      score: Math.max(10, 100 - (count * 20)),
      sourceType: "PROTOTYPE / VISUAL DETECTION",
      description: `${count} waste accumulation zones detected via vision survey.`,
      details: `${count} sanitation bounding boxes active.`
    };
  }

  // 4. ENVIRONMENTAL CONDITION (SATELLITE DERIVED WHERE AVAILABLE)
  let environment = {
    category: "ENVIRONMENT",
    name: "Environmental Condition",
    status: "UNAVAILABLE",
    level: "UNAVAILABLE",
    score: null,
    sourceType: "PROTOTYPE / SATELLITE MULTISPECTRAL REQUIRED",
    description: "Requires multi-temporal Sentinel-2 NDVI canopy loss & wetland boundary change analysis.",
    details: "Multispectral canopy & eco-buffer telemetry stream pending."
  };

  if (waterAnalysisData && waterAnalysisData.metrics && waterAnalysisData.metrics.vegetationChange) {
    const vegMetric = waterAnalysisData.metrics.vegetationChange;
    environment = {
      category: "ENVIRONMENT",
      name: "Environmental Condition",
      status: "AVAILABLE",
      level: vegMetric.severity === 'high' ? 'DEGRADED' : 'STABLE',
      score: vegMetric.direction === 'down' ? 62 : 85,
      sourceType: "REAL / LIVE + DERIVED",
      description: `Satellite-derived vegetation canopy shift: ${vegMetric.value} (${vegMetric.detail})`,
      details: `NDVI Trend: ${vegMetric.value} (${vegMetric.previous} -> ${vegMetric.recent})`
    };
  }

  // 5. DETERMINE OVERALL ASSESSMENT STATUS (FULL vs PARTIAL vs UNAVAILABLE)
  const availableDimensions = [drainage, road, waste, environment].filter(d => d.status === 'AVAILABLE');
  const unavailableDimensions = [drainage, road, waste, environment].filter(d => d.status === 'UNAVAILABLE');

  let overallStatus = "PARTIAL";
  let overallTitle = "Partial Civic Health Assessment";
  let overallScore = null;
  let overallLevel = "PARTIAL ASSESSMENT";

  if (availableDimensions.length === 4) {
    overallStatus = "FULL";
    overallTitle = "Comprehensive Civic Health Index";
    const avgScore = Math.round(availableDimensions.reduce((sum, d) => sum + (d.score || 50), 0) / 4);
    overallScore = avgScore;
    overallLevel = avgScore >= 80 ? 'EXCELLENT' : avgScore >= 60 ? 'GOOD' : avgScore >= 40 ? 'MODERATE' : 'POOR';
  } else if (availableDimensions.length > 0) {
    overallStatus = "PARTIAL";
    overallTitle = "Partial Civic Health Assessment";
    overallScore = null; // Do NOT compute misleading total score when visual dimensions are offline
    overallLevel = "PARTIAL ASSESSMENT";
  } else {
    overallStatus = "UNAVAILABLE";
    overallTitle = "Civic Health Assessment Temporarily Unavailable";
    overallScore = null;
    overallLevel = "UNAVAILABLE";
  }

  // 6. EVIDENTIARY BASIS & SYSTEM LIMITATIONS
  const evidence = [];
  if (drainage.status === 'AVAILABLE') {
    evidence.push(`Drainage Telemetry: Phase 4 Risk Score ${drainage.riskScore}/100 (${drainage.level})`);
  }
  if (environment.status === 'AVAILABLE') {
    evidence.push(`Environmental Telemetry: ${environment.details}`);
  }

  const limitations = [
    "Street-level road condition (potholes/cracks) is marked UNAVAILABLE pending computer vision model inference.",
    "Solid waste accumulation is marked UNAVAILABLE pending street-level sanitation image stream.",
    "Sentinel-2 10m spatial resolution cannot detect objects smaller than 10m x 10m."
  ];

  return {
    studyAreaName: areaName,
    studyAreaRegion: areaRegion,
    overallStatus,
    overallTitle,
    overallScore,
    overallLevel,
    availableCount: availableDimensions.length,
    unavailableCount: unavailableDimensions.length,
    dimensions: {
      road,
      waste,
      drainage,
      environment
    },
    evidence,
    limitations,
    mode: "DECISION SUPPORT ENGINE",
    timestamp: new Date().toISOString(),
    formattedTime: new Date().toLocaleTimeString('en-IN')
  };
};
