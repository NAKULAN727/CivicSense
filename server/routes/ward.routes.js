// CivicSense AI - Phase 11 Ward Boundary Management Routes
// Ingestion, versioning, and spatial routing of GeoJSON ward boundaries.

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { PERMISSIONS, ERROR_CODES } from '../config/constants.js';
import * as wardService from '../services/wardService.js';

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/wards/import
 * Ingests a new GeoJSON dataset (ADMIN role only).
 */
router.post('/import', requirePermission(PERMISSIONS.BOUNDARY_IMPORT), (req, res, next) => {
  try {
    const result = wardService.importWardDataset(req.tenantId, req.user, req.body, req.requestId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wards/active
 * Returns the currently active boundary dataset for the tenant.
 */
router.get('/active', (req, res) => {
  const active = wardService.getActiveBoundaryDataset(req.tenantId);
  if (!active) {
    return res.json({
      tenantId: req.tenantId,
      status: 'NOT_CONFIGURED',
      message: 'No official boundary dataset active for this tenant. Central depot fallback in effect.',
      dataset: null
    });
  }

  res.json({
    tenantId: req.tenantId,
    datasetId: active.datasetId,
    datasetVersion: active.datasetVersion,
    status: active.status,
    featureCount: active.featureCount,
    features: active.features
  });
});

/**
 * GET /api/wards/datasets
 * Lists all boundary dataset versions for the tenant.
 */
router.get('/datasets', (req, res) => {
  const datasets = wardService.getTenantBoundaryDatasets(req.tenantId);
  res.json({
    tenantId: req.tenantId,
    datasets
  });
});

/**
 * POST /api/wards/route
 * Routes GPS coordinates to a ward polygon.
 */
router.post('/route', (req, res) => {
  const { latitude, longitude } = req.body || {};
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      message: 'Valid finite latitude and longitude are required for spatial routing.',
      requestId: req.requestId
    });
  }

  const result = wardService.routeIncidentToWard(req.tenantId, lat, lon);
  res.json(result);
});

export default router;

