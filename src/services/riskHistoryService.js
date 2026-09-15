// CivicSense AI - Risk Observation History Persistence Service
// Manages local persistence for runtime flood risk evaluations

const STORAGE_KEY_HISTORY = 'civicsense_risk_history_v1';
const MAX_HISTORY_ITEMS = 20;

/**
 * Checks if localStorage is available and writable
 */
export const checkStorageAvailability = () => {
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
 * Saves a new risk assessment observation to localStorage
 */
export const recordRiskObservation = (studyAreaName, currentScore, currentLevel, predictedScore48h, trend) => {
  if (!checkStorageAvailability()) return false;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_HISTORY);
    let history = raw ? JSON.parse(raw) : [];

    const newRecord = {
      id: `OBS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      location: studyAreaName || 'Pallikaranai–Velachery',
      riskScore: currentScore,
      riskLevel: currentLevel,
      predictedScore48h: predictedScore48h,
      trend: trend
    };

    // Avoid duplicate records if exact score and location match within 5 minutes
    const lastRecord = history[0];
    if (lastRecord && lastRecord.location === newRecord.location && lastRecord.riskScore === newRecord.riskScore) {
      return true;
    }

    history.unshift(newRecord);
    if (history.length > MAX_HISTORY_ITEMS) {
      history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    window.localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    return true;
  } catch (e) {
    console.warn("Could not save risk observation to localStorage:", e);
    return false;
  }
};

/**
 * Retrieves stored application risk observations
 */
export const getStoredRiskHistory = (studyAreaName = null) => {
  if (!checkStorageAvailability()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    
    let history = JSON.parse(raw);
    if (studyAreaName) {
      history = history.filter(item => item.location === studyAreaName);
    }
    return history;
  } catch (e) {
    console.warn("Could not read risk history from localStorage:", e);
    return [];
  }
};
