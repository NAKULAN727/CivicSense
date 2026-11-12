// CivicSense AI — Phase 15 Isolated Flood Classification Service
// Fully isolated diagnostic service classifying flood events across supported categories F00–F06.
// STRICT GUARANTEE: Does NOT alter, re-infer, or overwrite existing road damage or waste detections.

/**
 * Supported Flood Classification Categories F00–F06 per CivicSense AI Phase 15 Specification.
 */
export const FLOOD_CATEGORIES = {
  F00: {
    code: 'F00',
    name: 'NO_SIGNIFICANT_WATER',
    title: 'No Significant Water / Dry Surface',
    description: 'Surface water coverage is below operational threshold (< 5.0%). Normal dry roadway or negligible surface moisture.',
    defaultSeverity: 'LOW',
    defaultPriority: 'ROUTINE',
    requiresReview: false
  },
  F01: {
    code: 'F01',
    name: 'ROAD_WATERLOGGING',
    title: 'Roadway Waterlogging',
    description: 'Standing water confirmed on roadway surface or corridor, validated by road infrastructure defects (potholes/cracks) or linear road alignment.',
    defaultSeverity: 'HIGH',
    defaultPriority: 'IMMEDIATE',
    requiresReview: true
  },
  F02: {
    code: 'F02',
    name: 'RESIDENTIAL_INUNDATION',
    title: 'Residential Inundation',
    description: 'Floodwater inundating residential zones or private dwelling perimeters. Visual models alone cannot confirm interior water ingress; requires verified cadastral zoning.',
    defaultSeverity: 'CRITICAL',
    defaultPriority: 'IMMEDIATE',
    requiresReview: true
  },
  F03: {
    code: 'F03',
    name: 'BUILDING_SURROUNDING_FLOODING',
    title: 'Building Perimeter Flooding',
    description: 'Surface water pooling in direct proximity to structural foundations without confirmed interior penetration.',
    defaultSeverity: 'HIGH',
    defaultPriority: 'HIGH',
    requiresReview: true
  },
  F04: {
    code: 'F04',
    name: 'RIVER_OVERFLOW',
    title: 'River / Channel Overflow (Fluvial Flooding)',
    description: 'Fluvial flooding resulting from a natural river, canal, or major drainage channel overtopping its banks. Requires verified hydrographic GIS vectors.',
    defaultSeverity: 'CRITICAL',
    defaultPriority: 'IMMEDIATE',
    requiresReview: true
  },
  F05: {
    code: 'F05',
    name: 'LARGE_AREA_INUNDATION',
    title: 'Large-Area Inundation',
    description: 'Landscape-scale contiguous water sheet covering extensive terrain across multiple parcels (water coverage >= 50.0% and connected component ratio >= 80.0%).',
    defaultSeverity: 'CRITICAL',
    defaultPriority: 'IMMEDIATE',
    requiresReview: true
  },
  F06: {
    code: 'F06',
    name: 'GENERAL_SIGNIFICANT_FLOODING',
    title: 'General Significant Flooding (Unclassified / Review Required)',
    description: 'Extensive surface water inundation (water coverage >= 25.0%) where specific land-use (roadway, residential, riverbank) cannot be reliably established from visual segmentation alone.',
    defaultSeverity: 'HIGH',
    defaultPriority: 'IMMEDIATE',
    requiresReview: true
  }
};

/**
 * Classifies a flood event into F00–F06 categories in complete isolation.
 * 
 * @param {Object} params
 * @param {Object} params.floodSegmentation - Output from SegFormer flood segmentation model
 * @param {Object} [params.contextEvidence] - Read-only context (road defects, pothole fusion)
 * @param {Object} [params.geographicContext] - Verified geographic / GIS metadata (cadastre, river vectors)
 * @param {Object} [params.imageMetadata] - Resolution, aspect ratio, perspective hints
 * @returns {Object} Isolated Flood Classification Object (Preserves road/waste intact)
 */
export function classifyFloodEvent({
  floodSegmentation = null,
  contextEvidence = {},
  geographicContext = {},
  imageMetadata = {}
} = {}) {
  // 1. Extract water metrics safely
  const waterCoveragePercent = Number(
    floodSegmentation?.floodedAreaPercent ??
    floodSegmentation?.waterCoveragePct ??
    floodSegmentation?.water_coverage_pct ??
    0.0
  );

  const topologyRatio = floodSegmentation?.connectedComponents?.largestCompRatioPct ??
    floodSegmentation?.largest_comp_ratio_pct ??
    floodSegmentation?.topologyRatio ??
    null;

  const spatialTopology = floodSegmentation?.spatialTopology ||
    floodSegmentation?.vflood_spatial_topology ||
    (topologyRatio !== null && topologyRatio >= 60.0 ? 'CONTINUOUS_WATER_BODY' : 'DISPERSED_WATER');

  // 2. Read-only inspection of context (Zero mutations to road or waste)
  const roadDetections = contextEvidence?.roadDetections || contextEvidence?.rawRoad || [];
  const hasRoadDamage = roadDetections.length > 0;
  const hasPothole = roadDetections.some(d => {
    const code = (d.classCode || '').toUpperCase();
    const type = (d.type || '').toLowerCase();
    const conf = d.confidence || 0;
    return (code === 'D40' || type.includes('pothole')) && conf >= 0.25;
  });

  const isWaterFilledPothole = Boolean(
    contextEvidence?.isWaterFilledPothole ||
    (hasPothole && waterCoveragePercent >= 5.0)
  );

  // 3. Geographic Context & Grounding
  const isGpsVerified = Boolean(
    geographicContext?.isGpsVerified ||
    geographicContext?.metadata?.isGpsVerified
  );
  const isNearRiver = Boolean(geographicContext?.isNearRiver);
  const isResidentialZone = Boolean(geographicContext?.isResidentialZone);
  const hasBuildingProximity = Boolean(geographicContext?.hasBuildingProximity);
  const hasWaterIngressEvidence = Boolean(geographicContext?.hasWaterIngressEvidence);

  // 4. Determine Flood Category F00–F06
  let category = FLOOD_CATEGORIES.F00;
  let severity = 'LOW';
  let priority = 'ROUTINE';
  let evidenceReason = 'Water coverage is below 5.0% threshold. Normal dry road/surface.';
  let recommendedDepartment = 'Highways / Roads & Pavement Maintenance (Routine Monitoring)';
  let recommendedAction = 'Routine maintenance monitoring.';

  // F00: No Significant Water
  if (waterCoveragePercent < 5.0) {
    category = FLOOD_CATEGORIES.F00;
    severity = 'LOW';
    priority = 'ROUTINE';
    evidenceReason = `Water coverage is ${waterCoveragePercent.toFixed(1)}% (< 5.0% threshold). Negligible surface water.`;
    recommendedDepartment = 'Highways / Roads & Pavement Maintenance';
    recommendedAction = 'Routine monitoring.';
  }
  // Special Multi-Modal Priority: Water-Filled Pothole (Priority 1)
  else if (isWaterFilledPothole) {
    category = FLOOD_CATEGORIES.F01;
    severity = 'HIGH';
    priority = 'IMMEDIATE';
    evidenceReason = `Structural road cavity (D40 Pothole) holding visible water (${waterCoveragePercent.toFixed(1)}%). Elevated vehicular safety and drainage risk.`;
    recommendedDepartment = 'Highways / Roads & Pavement Maintenance (Elevated Priority - Drainage Advisory)';
    recommendedAction = 'Inspect and repair road cavity and address local drainage accumulation.';
  }
  // Large Area Inundation: Extensive continuous water sheet
  else if (waterCoveragePercent >= 50.0 && (topologyRatio === null || topologyRatio >= 80.0)) {
    if (hasRoadDamage) {
      category = FLOOD_CATEGORIES.F01;
      severity = waterCoveragePercent >= 35.0 ? 'CRITICAL' : 'HIGH';
      priority = 'IMMEDIATE';
      evidenceReason = `Extensive waterlogging (${waterCoveragePercent.toFixed(1)}%) confirmed on roadway corridor with verified pavement damage context.`;
      recommendedDepartment = 'Stormwater / Drainage Department (Coordinated with Highways)';
      recommendedAction = 'Deploy emergency drainage pumping and inspect compromised pavement.';
    } else if (isNearRiver) {
      category = FLOOD_CATEGORIES.F04;
      severity = 'CRITICAL';
      priority = 'IMMEDIATE';
      evidenceReason = `Extensive inundation (${waterCoveragePercent.toFixed(1)}%) in verified river corridor proximity. Fluvial channel overflow confirmed via hydrographic GIS overlay.`;
      recommendedDepartment = 'Water Resources / River Basin Authority & Emergency Management';
      recommendedAction = 'Issue flood advisory, monitor stream gauge telemetry, and coordinate with flood control.';
    } else {
      category = FLOOD_CATEGORIES.F05; // Large-Area Inundation
      severity = 'CRITICAL';
      priority = 'IMMEDIATE';
      evidenceReason = `Continuous landscape-scale inundation (${waterCoveragePercent.toFixed(1)}% coverage, ${topologyRatio !== null ? topologyRatio.toFixed(1) + '%' : 'continuous'} component ratio). Land-use context requires operator review.`;
      recommendedDepartment = 'Stormwater / Drainage Department & Civil Defense';
      recommendedAction = 'Prioritize area-level flood assessment, verify emergency stormwater drainage, and review for GIS zone alignment.';
    }
  }
  // Significant Flooding: >= 25.0%
  else if (waterCoveragePercent > 25.0 && (topologyRatio === null || topologyRatio >= 60.0)) {
    if (hasRoadDamage) {
      category = FLOOD_CATEGORIES.F01;
      severity = waterCoveragePercent >= 35.0 ? 'CRITICAL' : 'HIGH';
      priority = 'IMMEDIATE';
      evidenceReason = `Continuous roadway waterlogging (${waterCoveragePercent.toFixed(1)}%) supported by detected pavement defect context.`;
      recommendedDepartment = 'Stormwater / Drainage Department';
      recommendedAction = 'Prioritize drainage inspection and roadway clearance.';
    } else if (isResidentialZone && hasWaterIngressEvidence) {
      category = FLOOD_CATEGORIES.F02;
      severity = 'CRITICAL';
      priority = 'IMMEDIATE';
      evidenceReason = `Residential parcel inundation (${waterCoveragePercent.toFixed(1)}%) with verified GIS cadastral alignment and structural water ingress evidence.`;
      recommendedDepartment = 'Municipal Disaster Management & Emergency Services';
      recommendedAction = 'Dispatch emergency response and evaluate resident evacuation support.';
    } else if (hasBuildingProximity) {
      category = FLOOD_CATEGORIES.F03;
      severity = 'HIGH';
      priority = 'HIGH';
      evidenceReason = `Surface water (${waterCoveragePercent.toFixed(1)}%) surrounding building perimeter foundations without confirmed interior penetration.`;
      recommendedDepartment = 'Stormwater / Drainage Department & Building Safety Inspection';
      recommendedAction = 'Inspect perimeter drainage and verify structural foundation clearance.';
    } else if (isNearRiver) {
      category = FLOOD_CATEGORIES.F04;
      severity = 'CRITICAL';
      priority = 'IMMEDIATE';
      evidenceReason = `Surface inundation (${waterCoveragePercent.toFixed(1)}%) adjoining river corridor. Potential fluvial overtopping identified.`;
      recommendedDepartment = 'Water Resources Department & Drainage';
      recommendedAction = 'Inspect river embankment and verify canal outfall gates.';
    } else {
      category = FLOOD_CATEGORIES.F06; // General Significant Flooding Fallback
      severity = waterCoveragePercent >= 35.0 ? 'CRITICAL' : 'HIGH';
      priority = 'IMMEDIATE';
      evidenceReason = `Extensive water coverage (${waterCoveragePercent.toFixed(1)}%). Specific land-use (road vs. residential vs. open land) cannot be established from 2D pixels alone; operator review required.`;
      recommendedDepartment = 'Stormwater / Drainage Department';
      recommendedAction = 'Prioritize drainage inspection, verify affected land-use zone, and conduct operator triage.';
    }
  }
  // Moderate Surface Water: 5.0% <= water < 25.0%
  else if (waterCoveragePercent >= 5.0) {
    if (hasRoadDamage) {
      category = FLOOD_CATEGORIES.F01;
      severity = 'MEDIUM';
      priority = 'MEDIUM';
      evidenceReason = `Moderate localized water (${waterCoveragePercent.toFixed(1)}%) on roadway with pavement defects.`;
      recommendedDepartment = 'Highways / Roads & Pavement Maintenance';
      recommendedAction = 'Inspect affected road section and clear surface puddles.';
    } else {
      category = FLOOD_CATEGORIES.F06; // General minor/moderate
      severity = 'MEDIUM';
      priority = 'MEDIUM';
      evidenceReason = `Moderate localized water (${waterCoveragePercent.toFixed(1)}%). Localized puddles or surface runoff margin.`;
      recommendedDepartment = 'Stormwater / Drainage Department';
      recommendedAction = 'Initiate stormwater watch and inspect local runoff drainage.';
    }
  }

  // 5. Construct Isolated Return Payload
  return {
    categoryCode: category.code,
    categoryName: category.name,
    title: category.title,
    severity,
    priority,
    operatorStatus: category.requiresReview ? 'NEEDS REVIEW' : 'CONFIRMED',
    waterCoveragePercent,
    topologyRatio,
    spatialTopology,
    evidence: evidenceReason,
    arbitrationReason: evidenceReason,
    recommendedDepartment,
    recommendedAction,
    guards: {
      buildingDamageInferred: false,
      humanDangerInferred: false,
      gpsFabricated: false,
      populationFabricated: false,
      unverifiedLandUseSubmersion: false
    },
    geographicContextSummary: {
      isGpsVerified,
      isNearRiver,
      isResidentialZone,
      hasBuildingProximity,
      perspective: imageMetadata?.perspective || 'UNKNOWN'
    }
  };
}

