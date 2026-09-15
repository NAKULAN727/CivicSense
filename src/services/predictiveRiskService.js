// CivicSense AI - Predictive Risk & Forecast Service (Phase 6)
// Deterministic, Rule-Based Short-Term Risk Projection (24h, 48h, 72h)
// Fuses: Current Risk Index (Phase 4), Live Open-Meteo 3-Day Forecast, NDWI Saturation, & Terrain Elevation

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
