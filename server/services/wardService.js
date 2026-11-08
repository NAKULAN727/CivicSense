// CivicSense AI - Phase 12 GeoJSON Boundary & Versioning Service
// Persists municipal ward boundaries in relational storage with spatial point-in-polygon routing.

import crypto from 'node:crypto';
import { storageEngine } from '../db/storageEngine.js';
import { validateGeoJsonPayload } from '../validation/schemas.js';
import { BOUNDARY_STATUS, AUDIT_EVENTS, ERROR_CODES } from '../config/constants.js';
import { logAuditEvent } from './auditService.js';

/**
 * Validates geometric validity: checks that polygon rings are properly closed.
 */
function validateGeometryClosure(features) {
  const errors = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const geom = f.geometry;
    if (!geom) continue;

    const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    for (const poly of polygons) {
      for (const ring of poly) {
        if (!Array.isArray(ring) || ring.length < 4) {
          errors.push(`Feature [${i}]: Polygon ring must contain at least 4 coordinate positions.`);
          break;
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          errors.push(`Feature [${i}]: LinearRing is not closed (first vertex [${first}] does not match last vertex [${last}]).`);
          break;
        }
      }
    }
  }
  return errors;
}

/**
 * Imports and activates an official GeoJSON ward boundary dataset for a tenant.
 */
export function importWardDataset(tenantId, user, geojson, requestId) {
  const validation = validateGeoJsonPayload(geojson);
  if (!validation.isValid) {
    const err = new Error(`GeoJSON validation failed: ${validation.errors.join('; ')}`);
    err.status = 400;
    err.code = ERROR_CODES.VALIDATION_ERROR;
    throw err;
  }

  const closureErrors = validateGeometryClosure(geojson.features);
  if (closureErrors.length > 0) {
    const err = new Error(`Geometric validity error: ${closureErrors.join('; ')}`);
    err.status = 400;
    err.code = ERROR_CODES.VALIDATION_ERROR;
    throw err;
  }

  const existingDatasets = storageEngine.state.ward_datasets.filter(d => d.tenant_id === tenantId);
  const newVersion = existingDatasets.length + 1;
  const datasetId = `BND-${tenantId}-v${newVersion}`;
  const now = new Date().toISOString();

  // Compute dataset content hash
  const rawJsonString = JSON.stringify(geojson);
  const datasetHash = crypto.createHash('sha256').update(rawJsonString).digest('hex');

  const datasetRecord = {
    dataset_id: datasetId,
    tenant_id: tenantId,
    dataset_version: `v${newVersion}.0`,
    status: BOUNDARY_STATUS.ACTIVE,
    uploaded_by: user.userId,
    feature_count: validation.featureCount,
    raw_geojson: geojson,
    dataset_hash: datasetHash,
    uploaded_at: now
  };

  storageEngine.executeTransaction(tenantId, user.isSuperAdmin, async (tx) => {
    // Supersede previously active datasets for this tenant
    for (const ds of storageEngine.state.ward_datasets) {
      if (ds.tenant_id === tenantId && ds.status === BOUNDARY_STATUS.ACTIVE) {
        ds.status = BOUNDARY_STATUS.SUPERSEDED;
      }
    }

    // Insert new dataset version
    await tx.insert('ward_datasets', datasetRecord);

    // Persist individual features
    for (const f of geojson.features) {
      const props = f.properties || {};
      const wardId = props.ward_id || props.ward_no || props.id || props.ward_number;
      const wardName = props.ward_name || props.name || `Ward ${wardId}`;

      await tx.insert('ward_features', {
        feature_id: `FEAT-${datasetId}-${wardId}`,
        dataset_id: datasetId,
        tenant_id: tenantId,
        ward_id: String(wardId),
        ward_name: wardName,
        geometry: f.geometry,
        properties: props,
        created_at: now
      });
    }
  });

  logAuditEvent({
    eventType: AUDIT_EVENTS.BOUNDARY_UPDATED,
    tenantId,
    actorId: user.userId,
    resource: `/api/wards/datasets/${datasetId}`,
    result: 'SUCCESS',
    details: {
      datasetId,
      version: datasetRecord.dataset_version,
      featureCount: validation.featureCount,
      hash: datasetHash
    },
    requestId
  });

  return {
    datasetId,
    tenantId,
    datasetVersion: datasetRecord.dataset_version,
    status: datasetRecord.status,
    featureCount: datasetRecord.feature_count,
    datasetHash: datasetRecord.dataset_hash,
    uploadedAt: datasetRecord.uploaded_at
  };
}

/**
 * Returns all boundary dataset versions for a tenant.
 */
export function getTenantBoundaryDatasets(tenantId) {
  return storageEngine.state.ward_datasets
    .filter(d => d.tenant_id === tenantId)
    .map(d => ({
      datasetId: d.dataset_id,
      tenantId: d.tenant_id,
      datasetVersion: d.dataset_version,
      status: d.status,
      uploadedBy: d.uploaded_by,
      uploadedAt: d.uploaded_at,
      featureCount: d.feature_count,
      datasetHash: d.dataset_hash
    }));
}

/**
 * Returns the currently ACTIVE boundary dataset for a tenant.
 */
export function getActiveBoundaryDataset(tenantId) {
  const active = storageEngine.state.ward_datasets.find(
    d => d.tenant_id === tenantId && d.status === BOUNDARY_STATUS.ACTIVE
  );
  if (!active) return null;

  return {
    datasetId: active.dataset_id,
    tenantId: active.tenant_id,
    datasetVersion: active.dataset_version,
    status: active.status,
    featureCount: active.feature_count,
    features: active.raw_geojson?.features || []
  };
}

/**
 * Ray-casting algorithm to test if a coordinate [lon, lat] is inside a polygon ring.
 */
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Tests if a coordinate [lon, lat] is inside a GeoJSON Polygon or MultiPolygon geometry.
 */
function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    if (!pointInRing(lon, lat, geometry.coordinates[0])) return false;
    for (let h = 1; h < geometry.coordinates.length; h++) {
      if (pointInRing(lon, lat, geometry.coordinates[h])) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (pointInRing(lon, lat, poly[0])) {
        let inHole = false;
        for (let h = 1; h < poly.length; h++) {
          if (pointInRing(lon, lat, poly[h])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

/**
 * Routes GPS coordinates to a ward polygon strictly using tenant's active boundaries.
 */
export function routeIncidentToWard(tenantId, latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      status: 'UNAVAILABLE',
      wardId: null,
      wardName: null,
      routingMethod: 'CENTRAL_DEPOT_DEFAULT'
    };
  }

  const activeDataset = getActiveBoundaryDataset(tenantId);
  if (!activeDataset || !activeDataset.features || activeDataset.features.length === 0) {
    return {
      status: 'NOT_CONFIGURED',
      wardId: null,
      wardName: null,
      routingMethod: 'CENTRAL_DEPOT_FALLBACK',
      notice: 'WARD ASSIGNMENT UNAVAILABLE'
    };
  }

  for (const feature of activeDataset.features) {
    if (pointInGeometry(longitude, latitude, feature.geometry)) {
      const props = feature.properties || {};
      const wardId = props.ward_id || props.ward_no || props.id || props.ward_number;
      const wardName = props.ward_name || props.name || `Ward ${wardId}`;
      return {
        status: 'ASSIGNED',
        wardId,
        wardName,
        routingMethod: 'OFFICIAL_GEOJSON_ACTIVE',
        datasetVersion: activeDataset.datasetVersion
      };
    }
  }

  return {
    status: 'OUT_OF_BOUNDS',
    wardId: null,
    wardName: null,
    routingMethod: 'CENTRAL_DEPOT_FALLBACK',
    notice: 'WARD ASSIGNMENT UNAVAILABLE'
  };
}

/**
 * Clears boundaries (for testing only).
 */
export function clearBoundariesForTest() {
  storageEngine.state.ward_datasets = [];
  storageEngine.state.ward_features = [];
  storageEngine.persistToDisk();
}
