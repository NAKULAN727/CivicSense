// CivicSense AI - Phase 11 Incident API Routes
// Enforces schema validation, role authorization, and tenant isolation.

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { PERMISSIONS, ERROR_CODES } from '../config/constants.js';
import { validateIncidentPayload } from '../validation/schemas.js';
import * as incidentService from '../services/incidentService.js';

const router = express.Router();

// All incident routes require authentication
router.use(authenticate);

/**
 * POST /api/incidents
 * Creates a new incident scoped to the user's tenant.
 */
router.post('/', requirePermission(PERMISSIONS.INCIDENT_CREATE), async (req, res, next) => {
  try {
    const validation = validateIncidentPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        message: `Validation failed: ${validation.errors.join('; ')}`,
        errors: validation.errors,
        requestId: req.requestId
      });
    }

    const created = await incidentService.createIncident(
      req.tenantId,
      req.user,
      validation.sanitized,
      req.requestId
    );

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/incidents
 * Lists all incidents belonging to the caller's tenant.
 */
router.get('/', requirePermission(PERMISSIONS.INCIDENT_VIEW_SCOPED), async (req, res, next) => {
  try {
    const incidents = await incidentService.getIncidentsForTenant(req.tenantId, req.query, req.user);
    res.json({
      tenantId: req.tenantId,
      count: incidents.length,
      incidents
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/incidents/:id
 * Retrieves an incident by ID (tenant isolation enforced).
 */
router.get('/:id', requirePermission(PERMISSIONS.INCIDENT_VIEW_SCOPED), async (req, res, next) => {
  try {
    const incident = await incidentService.getIncidentById(req.tenantId, req.params.id, req.user, req.requestId);
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/incidents/:id/status
 * Updates operator review status or incident lifecycle state.
 */
router.patch('/:id/status', requirePermission(PERMISSIONS.INCIDENT_UPDATE_STATUS), async (req, res, next) => {
  try {
    const updated = await incidentService.updateIncidentStatus(
      req.tenantId,
      req.params.id,
      req.user,
      req.body,
      req.requestId
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;

