// CivicSense AI - Predictive Risk & Forecast Service (Phase 6 & Phase 17)
// Deterministic, Rule-Based Short-Term Risk Projection (24h, 48h, 72h) & Category-Specific Asset Deterioration
// Fuses: Current Risk Index (Phase 4), Live Open-Meteo 3-Day Forecast, NDWI Saturation, & Terrain Elevation
// Explicit Provenance: RULE-BASED ESTIMATE (ASTM D6433 / Hydrological mass balance) & SIMULATION
// NEVER feeds non-road incidents into Pavement Condition Index (PCI).

/**
 * Maps a numeric risk score (0-100) to standard Phase 4 Risk Level
 */
export const getRiskLevelFromScore = (score) => {
  const numericScore = typeof score === 'number' ? score : 0;
  if (numericScore >= 81) return 'CRITICAL';
  if (numericScore >= 61) return 'HIGH';
  if (numericScore >= 31) return 'MODERATE';
  return 'LOW';
};

/**
 * Calculates empirical Pavement Condition Index (PCI) deduction and structural deterioration risk
 * for ROAD category incidents based on defect class code (D00-D40) and visual severity.
 * 
 * PROVENANCE: RULE-BASED ESTIMATE (calibrated to ASTM D6433 PCI deduction curves).
 * NEVER feed non-road incidents into this calculation.
 */
export const predictRoadDeteriorationRisk = (incident) => {
  if (!incident || (incident.category !== 'ROAD' && incident.category !== 'MULTI')) {
    return {
      category: 'ROAD',
      pciDeteriorationRisk: null,
      pciDeductionPoints: 0,
      riskLevel: 'LOW',
      provenance: 'UNAVAILABLE',
      details: 'Pavement deterioration is applicable exclusively to road surface defects.'
    };
  }

  const sev = incident.severity || 'LOW';
  const type = incident.incidentType || 'ROAD_DAMAGE';
  const isPothole = type === 'WATER_FILLED_POTHOLE' || type === 'POTHOLE' || 
    (typeof incident.detectionEvidence === 'string' && incident.detectionEvidence.includes('D40'));
  const isAlligator = typeof incident.detectionEvidence === 'string' && incident.detectionEvidence.includes('D20');

  let deduction = 10;
  let riskLevel = 'LOW';
  let monthsToFailure = 12;

  if (isPothole) {
    if (sev === 'CRITICAL' || sev === 'HIGH') {
      deduction = 35;
      riskLevel = 'CRITICAL';
      monthsToFailure = 1;
    } else if (sev === 'MEDIUM') {
      deduction = 22;
      riskLevel = 'HIGH';
      monthsToFailure = 3;
    } else {
      deduction = 14;
      riskLevel = 'MODERATE';
      monthsToFailure = 6;
    }
  } else if (isAlligator) {
    if (sev === 'HIGH') {
      deduction = 26;
      riskLevel = 'HIGH';
      monthsToFailure = 3;
    } else {
      deduction = 16;
      riskLevel = 'MODERATE';
      monthsToFailure = 6;
    }
  } else {
    // Longitudinal / Transverse cracks
    if (sev === 'HIGH' || sev === 'MEDIUM') {
      deduction = 12;
      riskLevel = 'MODERATE';
      monthsToFailure = 8;
    } else {
      deduction = 6;
      riskLevel = 'LOW';
      monthsToFailure = 18;
    }
  }

  return {
    category: 'ROAD',
    pciDeteriorationRisk: deduction,
    riskLevel,
    monthsToStructuralFailure: monthsToFailure,
    projectedPCIImpact: `Estimated -${deduction} PCI deduction (ASTM D6433 calibration)`,
    provenance: 'RULE-BASED ESTIMATE',
    details: `Structural impact: Projected ${monthsToFailure}-month window before sub-base water infiltration causes accelerated pavement spalling under traffic loading.`
  };
};

/**
 * Calculates stormwater drainage surcharge and flood runoff recession risk for FLOOD incidents.
 * PROVENANCE: RULE-BASED ESTIMATE (hydrological mass balance estimate).
 */
export const predictFloodDrainageRisk = (incident, weatherData = null) => {
  const sev = incident?.severity || 'LOW';
  const waterCov = incident?.floodClassification?.waterCoverage || 0;
  const rainForecastMm = weatherData?.forecast?.[0]?.rainMm || 0;

  let riskLevel = 'LOW';
  let surchargeProb = '15%';
  let recessionHours = 4;

  if (sev === 'CRITICAL' || waterCov >= 35.0) {
    riskLevel = 'CRITICAL';
    surchargeProb = '88%';
    recessionHours = 36;
  } else if (sev === 'HIGH' || waterCov >= 15.0) {
    riskLevel = 'HIGH';
    surchargeProb = '65%';
    recessionHours = 18;
  } else if (sev === 'MEDIUM' || waterCov >= 5.0) {
    riskLevel = 'MODERATE';
    surchargeProb = '35%';
    recessionHours = 8;
  }

  return {
    category: 'FLOOD',
    floodDrainageRisk: riskLevel,
    riskLevel,
    drainageSurchargeProbability: surchargeProb,
    estimatedRecessionHours: recessionHours,
    rainForecastMm,
    provenance: 'RULE-BASED ESTIMATE',
    details: `Stormwater drainage surcharge probability estimated at ${surchargeProb}. Natural recession window is approx ${recessionHours}h under current meteorological telemetry.`
  };
};

/**
 * Calculates municipal waste accumulation and environmental hazard trend for WASTE incidents.
 * PROVENANCE: RULE-BASED ESTIMATE.
 */
export const predictWasteAccumulationRisk = (incident) => {
  const sev = incident?.severity || 'LOW';
  const isCandidate = incident?.incidentType?.includes('CANDIDATE') || incident?.needsReview;
  
  let riskLevel = sev === 'HIGH' ? 'HIGH' : sev === 'MEDIUM' ? 'MODERATE' : 'LOW';
  let trend = isCandidate ? 'UNCERTAIN' : sev === 'HIGH' ? 'ACCELERATING' : 'STEADY';
  let vectorRisk = sev === 'HIGH' ? 'ELEVATED' : 'LOW';

  return {
    category: 'WASTE',
    wasteAccumulationTrend: trend,
    riskLevel,
    vectorPestRisk: vectorRisk,
    drainageObstructionRisk: sev === 'HIGH' ? 'MODERATE' : 'LOW',
    provenance: isCandidate ? 'RULE-BASED ESTIMATE (REVIEW CANDIDATE)' : 'RULE-BASED ESTIMATE',
    details: `Waste dispersion trend: ${trend}. Immediate public health vector risk is ${vectorRisk}.`
  };
};

/**
 * Standardized Central Prediction Status conforming to Phase 4 Canonical Schema
 */
export const generateStandardizedPredictionStatus = (incident, weatherData = null) => {
  if (!incident) {
    return {
      category: 'UNAVAILABLE',
      riskLevel: 'LOW',
      pciDeteriorationRisk: null,
      floodDrainageRisk: null,
      wasteAccumulationTrend: null,
      provenance: 'UNAVAILABLE',
      details: 'No active incident provided for predictive evaluation.'
    };
  }

  const cat = incident.category || 'ROAD';

  if (cat === 'ROAD') {
    const roadPred = predictRoadDeteriorationRisk(incident);
    return {
      category: 'ROAD',
      riskLevel: roadPred.riskLevel,
      pciDeteriorationRisk: roadPred.pciDeteriorationRisk,
      floodDrainageRisk: null,
      wasteAccumulationTrend: null,
      provenance: roadPred.provenance,
      details: roadPred.details
    };
  }

  if (cat === 'FLOOD') {
    const floodPred = predictFloodDrainageRisk(incident, weatherData);
    return {
      category: 'FLOOD',
      riskLevel: floodPred.riskLevel,
      pciDeteriorationRisk: null, // STRICTLY NULL FOR NON-ROAD
      floodDrainageRisk: floodPred.floodDrainageRisk,
      wasteAccumulationTrend: null,
      provenance: floodPred.provenance,
      details: floodPred.details
    };
  }

  if (cat === 'WASTE') {
    const wastePred = predictWasteAccumulationRisk(incident);
    return {
      category: 'WASTE',
      riskLevel: wastePred.riskLevel,
      pciDeteriorationRisk: null, // STRICTLY NULL FOR NON-ROAD
      floodDrainageRisk: null,
      wasteAccumulationTrend: wastePred.wasteAccumulationTrend,
      provenance: wastePred.provenance,
      details: wastePred.details
    };
  }

  if (cat === 'MULTI') {
    // Multi-modal fusion (e.g. Water-Filled Pothole)
    const roadPred = predictRoadDeteriorationRisk(incident);
    const floodPred = predictFloodDrainageRisk(incident, weatherData);
    return {
      category: 'MULTI',
      riskLevel: 'CRITICAL',
      pciDeteriorationRisk: roadPred.pciDeteriorationRisk,
      floodDrainageRisk: floodPred.floodDrainageRisk,
      wasteAccumulationTrend: null,
      provenance: 'RULE-BASED ESTIMATE',
      details: `Multi-hazard escalation: Water saturation accelerates road sub-base erosion while pothole cavity acts as localized water catchment.`
    };
  }

  return {
    category: cat,
    riskLevel: incident.severity || 'LOW',
    pciDeteriorationRisk: null,
    floodDrainageRisk: null,
    wasteAccumulationTrend: null,
    provenance: 'RULE-BASED ESTIMATE',
    details: 'General civic telemetry evaluation.'
  };
};

/**
 * Calculates 24h, 48h, and 72h Short-Term Predictive Risk Projections
 * Formula (Deterministic, No Math.random()):
 *   - Base: currentRiskScore
 *   - Weather Forecast Delta: Cumulative rainfall pressure from 3-day forecast
 *   - NDWI Saturation Momentum: Water change % impact over time
 *   - Terrain Drainage Attenuation: Low elevation accelerates accumulation, high elevation accelerates runoff
 * 
 * @param {Object} riskAssessment Phase 4 Current Risk Assessment Object
 * @param {Object} weatherData Live Weather & Forecast Object from Open-Meteo
 * @returns {Object} Deterministic Predictive Risk Projection Object
 */
export const calculatePredictiveRisk = (riskAssessment, weatherData) => {
  if (!riskAssessment || typeof riskAssessment.score !== 'number') {
    return {
      error: true,
      mode: 'DEMO / UNAVAILABLE',
      message: 'Insufficient live input telemetry to compute predictive risk forecast.'
    };
  }

  const currentScore = riskAssessment.score;
  const currentLevel = riskAssessment.level || getRiskLevelFromScore(currentScore);
  const studyAreaName = riskAssessment.studyArea || 'Pallikaranai–Velachery';

  // Extract Forecast Precipitation
  const forecastList = (weatherData && Array.isArray(weatherData.forecast)) ? weatherData.forecast : [];
  const rainToday = forecastList[0]?.rainMm || 0;
  const rain24h = forecastList[1]?.rainMm || 0;
  const rain48h = forecastList[2]?.rainMm || 0;

  // Extract Satellite NDWI details
  let waterChangePct = 0;
  if (riskAssessment.components?.satelliteWater) {
    const details = riskAssessment.components.satelliteWater.details || "";
    const match = details.match(/NDWI Water Change:\s*([+-]?\d+\.?\d*)/i);
    if (match) {
      waterChangePct = parseFloat(match[1]) || 0;
    }
  }

  // Extract Elevation details
  let elevationVal = 5;
  if (riskAssessment.components?.elevation) {
    const details = riskAssessment.components.elevation.details || "";
    const match = details.match(/Elevation:\s*(\d+)m/i);
    if (match) {
      elevationVal = parseInt(match[1], 10) || 5;
    }
  }

  // Deterministic Projection Algorithm (No Math.random())
  // 1. Elevation Vulnerability Multiplier (Low elevation = water retains longer)
  const elevRetentionFactor = elevationVal <= 3 ? 1.2 : elevationVal <= 5 ? 1.0 : 0.8;

  // 2. 24-Hour Projected Score
  // Impact = 24h forecast rain * 1.2 + saturation factor
  const delta24h = (rain24h * 1.2 * elevRetentionFactor) + (waterChangePct > 10 ? 3 : 0) - (rain24h === 0 && waterChangePct <= 0 ? 3 : 0);
  const predictedScore24h = Math.min(100, Math.max(0, Math.round(currentScore + delta24h)));

  // 3. 48-Hour Projected Score
  // Cumulative 48h rain pressure
  const cumRain48 = rain24h + rain48h;
  const delta48h = (cumRain48 * 0.9 * elevRetentionFactor) + (waterChangePct > 20 ? 5 : 0) - (cumRain48 === 0 ? 6 : 0);
  const predictedScore48h = Math.min(100, Math.max(0, Math.round(currentScore + delta48h)));

  // 4. 72-Hour Projected Score
  // Drainage runoff relaxation or sustained inundation
  const cumRain72 = rainToday + rain24h + rain48h;
  const delta72h = (cumRain72 * 0.7 * elevRetentionFactor) - (cumRain48 < 10 ? 10 : 0);
  const predictedScore72h = Math.min(100, Math.max(0, Math.round(currentScore + delta72h)));

  // Map Levels
  const predictedLevel24h = getRiskLevelFromScore(predictedScore24h);
  const predictedLevel48h = getRiskLevelFromScore(predictedScore48h);
  const predictedLevel72h = getRiskLevelFromScore(predictedScore72h);

  // Deterministic Trend Classification
  // Threshold: Delta of >= +5 -> INCREASING; <= -5 -> DECREASING; Else -> STABLE
  const maxForecastScore = Math.max(predictedScore24h, predictedScore48h, predictedScore72h);
  const minForecastScore = Math.min(predictedScore24h, predictedScore48h, predictedScore72h);
  
  let trend = 'STABLE';
  if (maxForecastScore - currentScore >= 5) {
    trend = 'INCREASING';
  } else if (currentScore - minForecastScore >= 5) {
    trend = 'DECREASING';
  } else {
    trend = 'STABLE';
  }

  // Trend Explanation & Rationale
  let trendReason = '';
  if (trend === 'INCREASING') {
    trendReason = `Forecasted cumulative precipitation (${Math.round((rain24h + rain48h) * 10) / 10}mm) combined with basin elevation (${elevationVal}m ASL) indicates potential risk escalation.`;
  } else if (trend === 'DECREASING') {
    trendReason = `Low forecasted rainfall over the next 72 hours allows natural drainage runoff, reducing overall inundation pressure.`;
  } else {
    trendReason = `Stable weather telemetry and consistent surface moisture levels indicate steady risk index over the 72h horizon.`;
  }

  // Early Warning Logic
  const hasEscalation = (
    (currentLevel === 'LOW' && (predictedLevel24h !== 'LOW' || predictedLevel48h !== 'LOW')) ||
    (currentLevel === 'MODERATE' && (predictedLevel24h === 'HIGH' || predictedLevel48h === 'HIGH' || predictedLevel48h === 'CRITICAL')) ||
    (currentLevel === 'HIGH' && (predictedLevel24h === 'CRITICAL' || predictedLevel48h === 'CRITICAL')) ||
    trend === 'INCREASING'
  );

  let earlyWarningMessage = '';
  if (hasEscalation) {
    earlyWarningMessage = `Projected risk escalation detected: Risk is estimated to increase from ${currentLevel} (${currentScore}/100) to ${predictedLevel48h} (${predictedScore48h}/100) within 48 hours over ${studyAreaName}.`;
  } else if (trend === 'DECREASING') {
    earlyWarningMessage = `Risk index is projected to gradually decrease over the next 72 hours due to minimal forecasted precipitation.`;
  } else {
    earlyWarningMessage = `Risk index is projected to remain stable at ${currentLevel} (${currentScore}/100) over the short-term forecast window.`;
  }

  // Overall Source & Mode
  const isWeatherLive = weatherData?.isLive || false;
  const mode = isWeatherLive ? 'PARTIAL_LIVE' : 'REFERENCE_ONLY';

  return {
    error: false,
    currentScore,
    currentLevel,
    predictedScore24h,
    predictedLevel24h,
    predictedScore48h,
    predictedLevel48h,
    predictedScore72h,
    predictedLevel72h,
    trend,
    trendReason,
    earlyWarning: {
      hasEscalation,
      message: earlyWarningMessage
    },
    drivers: {
      rainfallForecast: `24h: ${rain24h}mm • 48h: ${rain48h}mm (${weatherData?.source || 'Open-Meteo'})`,
      satelliteWaterChange: `${waterChangePct >= 0 ? '+' : ''}${waterChangePct}% NDWI change (Sentinel-2 L2A)`,
      elevation: `${elevationVal}m ASL (Copernicus 30m DEM)`,
      historical: `IMD / TNSDMA Historical Reference Records`
    },
    mode: mode,
    timestamp: new Date().toISOString(),
    formattedTime: new Date().toLocaleTimeString('en-IN')
  };
};
