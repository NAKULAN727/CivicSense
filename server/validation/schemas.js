// CivicSense AI - Phase 11 Request Validation Schemas
// Rejects malformed input, invalid enums, invalid coordinates, and oversized strings.

import { INCIDENT_SEVERITY, INCIDENT_PRIORITY, OPERATOR_DECISION } from '../config/constants.js';

const VALID_SEVERITIES = Object.values(INCIDENT_SEVERITY);
const VALID_PRIORITIES = Object.values(INCIDENT_PRIORITY);
const VALID_DECISIONS = Object.values(OPERATOR_DECISION);

/**
 * Validates GPS location coordinates.
 * Coordinates must be strictly in range:
 * - latitude: -90 to +90
 * - longitude: -180 to +180
 * If absent, status is marked UNAVAILABLE. Zero fallback coordinates inserted.
 * 
 * @param {Object} location 
 * @returns {{ isValid: boolean, normalizedLocation: Object, error?: string }}
 */
export function validateLocation(location) {
  if (!location || typeof location !== 'object') {
    return {
      isValid: true,
      normalizedLocation: {
        isGpsVerified: false,
        status: 'UNAVAILABLE',
        latitude: null,
        longitude: null,
        formatted: 'Location Unavailable'
      }
    };
  }

  const { latitude, longitude, isGpsVerified } = location;

  // If both coordinates are missing or null
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return {
      isValid: true,
      normalizedLocation: {
        isGpsVerified: false,
        status: 'UNAVAILABLE',
        latitude: null,
        longitude: null,
        formatted: 'Location Unavailable'
      }
    };
  }

  const latNum = Number(latitude);
  const lonNum = Number(longitude);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return {
      isValid: false,
      error: 'Coordinates must be valid finite numbers'
    };
  }

  if (latNum < -90 || latNum > 90) {
    return {
      isValid: false,
      error: `Latitude out of range [-90, +90]: received ${latNum}`
    };
  }

  if (lonNum < -180 || lonNum > 180) {
    return {
      isValid: false,
      error: `Longitude out of range [-180, +180]: received ${lonNum}`
    };
  }

  return {
    isValid: true,
    normalizedLocation: {
      isGpsVerified: Boolean(isGpsVerified !== false),
      status: 'VERIFIED',
      latitude: latNum,
      longitude: lonNum,
      formatted: location.formatted || `${Math.abs(latNum).toFixed(4)}° ${latNum >= 0 ? 'N' : 'S'}, ${Math.abs(lonNum).toFixed(4)}° ${lonNum >= 0 ? 'E' : 'W'}`
    }
  };
}

/**
 * Validates an incident creation payload.
 * 
 * @param {Object} payload 
 * @returns {{ isValid: boolean, errors: Array<string>, sanitized?: Object }}
 */
export function validateIncidentPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { isValid: false, errors: ['Request body must be a valid JSON object'] };
  }

  // 1. Title / description check
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) {
    errors.push("Missing required field: 'title'");
  } else if (title.length > 200) {
    errors.push("'title' exceeds maximum length of 200 characters");
  }

  // 2. Incident Type
  const incidentType = typeof payload.incidentType === 'string' ? payload.incidentType.trim() : '';
  if (!incidentType) {
    errors.push("Missing required field: 'incidentType'");
  } else if (incidentType.length > 100) {
    errors.push("'incidentType' exceeds maximum length of 100 characters");
  }

  // 3. Severity
  const severity = payload.severity ? String(payload.severity).toUpperCase() : null;
  if (!severity) {
    errors.push("Missing required field: 'severity'");
  } else if (!VALID_SEVERITIES.includes(severity)) {
    errors.push(`Invalid severity '${severity}'. Expected one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  // 4. Priority
  const priority = payload.priority ? String(payload.priority).toUpperCase() : null;
  if (!priority) {
    errors.push("Missing required field: 'priority'");
  } else if (!VALID_PRIORITIES.includes(priority)) {
    errors.push(`Invalid priority '${priority}'. Expected one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // 5. Department
  const department = typeof payload.recommendedDepartment === 'string' 
    ? payload.recommendedDepartment.trim() 
    : (typeof payload.department === 'string' ? payload.department.trim() : '');
  if (!department) {
    errors.push("Missing required field: 'recommendedDepartment'");
  } else if (department.length > 200) {
    errors.push("'recommendedDepartment' exceeds maximum length of 200 characters");
  }

  // 6. Operator Decision
  let operatorDecision = payload.operatorDecision || payload.operatorStatus || null;
  if (operatorDecision) {
    operatorDecision = String(operatorDecision).toUpperCase();
    if (!VALID_DECISIONS.includes(operatorDecision)) {
      errors.push(`Invalid operatorDecision '${operatorDecision}'. Expected: ${VALID_DECISIONS.join(', ')}`);
    }
  }

  // 7. Location validation
  const locValidation = validateLocation(payload.location);
  if (!locValidation.isValid) {
    errors.push(`Invalid location: ${locValidation.error}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const sanitized = {
    id: payload.id || null,
    title,
    incidentType,
    severity,
    priority,
    recommendedDepartment: department,
    recommendedAction: typeof payload.recommendedAction === 'string' ? payload.recommendedAction.slice(0, 500) : '',
    sourceEvidence: typeof payload.sourceEvidence === 'string' ? payload.sourceEvidence.slice(0, 500) : '',
    confidence: Number.isFinite(payload.confidence) ? payload.confidence : null,
    operatorStatus: operatorDecision || OPERATOR_DECISION.NEEDS_REVIEW,
    location: locValidation.normalizedLocation,
    notes: typeof payload.notes === 'string' ? payload.notes.slice(0, 500) : ''
  };

  return { isValid: true, errors: [], sanitized };
}

/**
 * Validates a work-order creation request.
 */
export function validateWorkOrderPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Work order payload must be a valid JSON object'] };
  }

  if (!payload.incidentId || typeof payload.incidentId !== 'string') {
    errors.push("Missing required field: 'incidentId'");
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      incidentId: payload.incidentId?.trim(),
      approvedBySupervisor: Boolean(payload.approvedBySupervisor),
      notes: typeof payload.notes === 'string' ? payload.notes.slice(0, 500) : ''
    }
  };
}

/**
 * Validates GeoJSON FeatureCollection boundaries.
 */
export function validateGeoJsonPayload(geojson) {
  const errors = [];

  if (!geojson || typeof geojson !== 'object') {
    return { isValid: false, errors: ['INVALID GEOJSON: Boundary payload must be a non-null object'] };
  }

  if (geojson.type !== 'FeatureCollection') {
    errors.push("INVALID GEOJSON: Root element must have type 'FeatureCollection'");
  }

  if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
    errors.push("INVALID GEOJSON: FeatureCollection must contain a non-empty 'features' array");
  } else {
    for (let i = 0; i < geojson.features.length; i++) {
      const f = geojson.features[i];
      if (!f || f.type !== 'Feature') {
        errors.push(`Feature [${i}]: Invalid type, must be 'Feature'`);
        continue;
      }

      const wardId = f.properties?.ward_id || f.properties?.ward_no || f.properties?.id || f.properties?.ward_number;
      if (!wardId) {
        errors.push(`Feature [${i}]: MISSING WARD ID. Must include 'ward_id' property`);
      }

      if (!f.geometry || !['Polygon', 'MultiPolygon'].includes(f.geometry.type)) {
        errors.push(`Feature [${i}]: UNSUPPORTED GEOMETRY '${f.geometry?.type}'. Only Polygon and MultiPolygon are supported`);
        continue;
      }

      // Coordinate boundary check
      const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat(1);
      for (const ring of rings) {
        if (!Array.isArray(ring)) continue;
        for (const pt of ring) {
          if (!Array.isArray(pt) || pt.length < 2) continue;
          const [lon, lat] = pt;
          if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            errors.push(`Feature [${i}]: INVALID COORDINATES [${lon}, ${lat}] out of world bounds`);
            break;
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    featureCount: Array.isArray(geojson?.features) ? geojson.features.length : 0
  };
}

