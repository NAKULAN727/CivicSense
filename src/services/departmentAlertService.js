// CivicSense AI - Department Alert & Response Service (Phase 5 Prototype)
// Deterministic Alert Generation & Status Workflow Service
// Consumes Phase 4 Flood Risk Index output and routes structured alerts.

import { getDepartmentMapping } from '../data/departmentData.js';

const STORAGE_KEY_ALERTS = 'civicsense_department_alerts_v1';

/**
 * Checks if localStorage is available and writable
 */
export const checkLocalStorageAvailability = () => {
  try {
    const testKey = '__civicsense_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Deterministic Alert ID Generator (No Math.random())
 * Format: CSA-YYYYMMDD-SCORE-INDEX
 */
export const generateAlertId = (studyAreaName = 'PV', score = 60) => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const areaCode = (studyAreaName || 'PV').substring(0, 3).toUpperCase();
  const scorePad = String(score).padStart(3, '0');
  return `CSA-${dateStr}-${areaCode}${scorePad}`;
};

/**
 * Extracts and formats Phase 3/4 evidence values cleanly for alert display
 */
export const extractEvidenceData = (riskAssessment) => {
  if (!riskAssessment || !riskAssessment.components) {
    return {
      ndwiWaterChange: "Unavailable",
      recentWaterArea: "Unavailable",
      baselineWaterArea: "Unavailable",
      floodRiskScore: "Pending Index",
      rainfall: "Unavailable",
      elevation: "Unavailable",
      historical: "Reference data"
    };
  }

  const { components, score } = riskAssessment;

  // Extract Satellite NDWI Details
  let ndwiWaterChange = "Unavailable";
  let recentWaterArea = "Unavailable";
  let baselineWaterArea = "Unavailable";

  if (components.satelliteWater) {
    const details = components.satelliteWater.details || "";
    // Details format: "NDWI Water Change: -59.3% (Recent: 0.24km² • Base: 0.59km²)"
    const changeMatch = details.match(/NDWI Water Change:\s*([+-]?\d+\.?\d*%)/i);
    const recentMatch = details.match(/Recent:\s*([\d\.]+\s*km²)/i);
    const baseMatch = details.match(/Base:\s*([\d\.]+\s*km²)/i);

    if (changeMatch) ndwiWaterChange = changeMatch[1];
    if (recentMatch) recentWaterArea = recentMatch[1];
    if (baseMatch) baselineWaterArea = baseMatch[1];

    if (ndwiWaterChange === "Unavailable" && components.satelliteWater.mode === 'LIVE_NDWI') {
      ndwiWaterChange = `${components.satelliteWater.score > 20 ? '+' : ''}${components.satelliteWater.score}%`;
    }
  }

  // Extract Rainfall
  let rainfall = "Unavailable";
  if (components.rainfall && components.rainfall.details) {
    rainfall = components.rainfall.details;
  }

  // Extract Elevation
  let elevation = "Unavailable";
  if (components.elevation && components.elevation.details) {
    elevation = components.elevation.details;
  }

  // Extract Historical
  let historical = "Reference data";
  if (components.historical && components.historical.details) {
    historical = components.historical.details;
  }

  return {
    ndwiWaterChange,
    recentWaterArea,
    baselineWaterArea,
    floodRiskScore: `${score}/100`,
    rainfall,
    elevation,
    historical
  };
};

/**
 * Generates a structured Alert Reason string based on actual Phase 3/4 inputs
 */
export const generateAlertReason = (studyAreaName, riskScore, riskLevel, evidence) => {
  let reason = `${riskLevel} flood risk detected in ${studyAreaName || 'Pallikaranai–Velachery'} (Score: ${riskScore}/100) based on `;

  const factors = [];
  if (evidence.rainfall !== "Unavailable") factors.push(`rainfall data (${evidence.rainfall})`);
  if (evidence.elevation !== "Unavailable") factors.push(`terrain elevation (${evidence.elevation})`);
  if (evidence.historical !== "Unavailable") factors.push(`historical flood reference records (${evidence.historical})`);
  if (evidence.ndwiWaterChange !== "Unavailable") factors.push(`satellite-derived NDWI water analysis (${evidence.ndwiWaterChange})`);

  if (factors.length > 0) {
    reason += factors.join(", ") + " and GIS factors.";
  } else {
    reason += "environmental risk analysis telemetry.";
  }

  return reason;
};

/**
 * Generates a structured Department Alert object based on Phase 4 Flood Risk Index output
 */
export const generateDepartmentAlert = (riskAssessment, studyArea) => {
  if (!riskAssessment) {
    return {
      error: true,
      message: "No flood risk assessment available to generate alert."
    };
  }

  const score = typeof riskAssessment.score === 'number' ? riskAssessment.score : 60;
  const level = riskAssessment.level || 'MODERATE';
  const location = studyArea?.name || riskAssessment.studyArea || 'Pallikaranai–Velachery';

  // Alert Threshold Mapping
  // 0-30: LOW (No default alert)
  // 31-60: MODERATE (MONITORING)
  // 61-80: HIGH (ACTION REQUIRED)
  // 81-100: CRITICAL (URGENT)
  let alertType = 'NONE';
  let shouldGenerateAlert = false;
  let severity = 'LOW';

  if (score >= 81) {
    alertType = 'URGENT';
    severity = 'CRITICAL';
    shouldGenerateAlert = true;
  } else if (score >= 61) {
    alertType = 'ACTION REQUIRED';
    severity = 'HIGH';
    shouldGenerateAlert = true;
  } else if (score >= 31) {
    alertType = 'MONITORING';
    severity = 'MODERATE';
    shouldGenerateAlert = true;
  } else {
    alertType = 'NONE';
    severity = 'LOW';
    shouldGenerateAlert = false;
  }

  const deptMapping = getDepartmentMapping('FLOOD');
  const alertId = generateAlertId(location, score);
  const evidence = extractEvidenceData(riskAssessment);
  const reason = generateAlertReason(location, score, level, evidence);
  const createdAt = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const alertObject = {
    id: alertId,
    location: location,
    riskScore: score,
    riskLevel: level,
    alertType: alertType,
    severity: severity,
    shouldGenerateAlert: shouldGenerateAlert,
    category: deptMapping.category,
    department: deptMapping.primaryDepartment,
    secondaryDepartment: deptMapping.secondaryDepartment,
    fieldCategory: deptMapping.fieldCategory,
    trigger: "Satellite + Environmental Risk Analysis",
    reason: reason,
    createdAt: createdAt,
    timestamp: new Date().toISOString(),
    status: "NEW",
    mode: "PROTOTYPE",
    evidence: evidence,
    isPersistenceAvailable: checkLocalStorageAvailability()
  };

  // Check if there is an existing persisted status in localStorage
  if (alertObject.isPersistenceAvailable) {
    try {
      const stored = getStoredAlert(alertId);
      if (stored && stored.status) {
        alertObject.status = stored.status;
        alertObject.statusHistory = stored.statusHistory || [];
      }
    } catch (e) {
      console.warn("Could not read stored alert status:", e);
    }
  }

  return alertObject;
};

/**
 * Returns allowed next workflow statuses based on current status
 * Workflow: NEW -> ACKNOWLEDGED -> ACTION REQUIRED -> IN PROGRESS -> RESOLVED
 */
export const getNextAllowedStatuses = (currentStatus) => {
  switch (currentStatus) {
    case 'NEW':
      return [
        { status: 'ACKNOWLEDGED', label: 'ACKNOWLEDGE', buttonClass: 'btn-primary' }
      ];
    case 'ACKNOWLEDGED':
      return [
        { status: 'ACTION REQUIRED', label: 'MARK ACTION REQUIRED', buttonClass: 'btn-warning' }
      ];
    case 'ACTION REQUIRED':
      return [
        { status: 'IN PROGRESS', label: 'MARK IN PROGRESS', buttonClass: 'btn-info' }
      ];
    case 'IN PROGRESS':
      return [
        { status: 'RESOLVED', label: 'RESOLVE', buttonClass: 'btn-success' }
      ];
    case 'RESOLVED':
      return [
        { status: 'NEW', label: 'RESET PROTOTYPE WORKFLOW', buttonClass: 'btn-secondary' }
      ];
    default:
      return [];
  }
};

/**
 * Saves or updates alert status in localStorage
 */
export const saveAlertToStorage = (alertData) => {
  if (!checkLocalStorageAvailability()) {
    return { success: false, message: "Local persistence unavailable — prototype session only." };
  }

  try {
    const existingStr = window.localStorage.getItem(STORAGE_KEY_ALERTS);
    const existing = existingStr ? JSON.parse(existingStr) : {};

    existing[alertData.id] = {
      ...alertData,
      updatedAt: new Date().toISOString()
    };

    window.localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(existing));
    return { success: true };
  } catch (e) {
    console.warn("Error saving alert to localStorage:", e);
    return { success: false, message: "Local persistence error — using in-memory state." };
  }
};

/**
 * Retrieves stored alert from localStorage by alertId
 */
export const getStoredAlert = (alertId) => {
  if (!checkLocalStorageAvailability()) return null;

  try {
    const existingStr = window.localStorage.getItem(STORAGE_KEY_ALERTS);
    if (!existingStr) return null;
    const existing = JSON.parse(existingStr);
    return existing[alertId] || null;
  } catch (e) {
    console.warn("Error retrieving alert from localStorage:", e);
    return null;
  }
};

/**
 * Updates status of an alert in localStorage and returns updated alert
 */
export const updateAlertStatus = (alertData, newStatus) => {
  const nextAllowed = getNextAllowedStatuses(alertData.status).map(a => a.status);
  
  if (!nextAllowed.includes(newStatus)) {
    console.warn(`Invalid status transition from ${alertData.status} to ${newStatus}`);
  }

  const updatedHistory = [
    ...(alertData.statusHistory || []),
    {
      from: alertData.status,
      to: newStatus,
      timestamp: new Date().toLocaleTimeString('en-IN')
    }
  ];

  const updatedAlert = {
    ...alertData,
    status: newStatus,
    statusHistory: updatedHistory,
    updatedAt: new Date().toISOString()
  };

  const storageResult = saveAlertToStorage(updatedAlert);
  if (!storageResult.success) {
    updatedAlert.persistenceNotice = storageResult.message;
  }

  return updatedAlert;
};
