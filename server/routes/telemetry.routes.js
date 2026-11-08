// CivicSense AI - Phase 11 Operational Telemetry Routes
// Ingests and queries operational performance telemetry scoped to tenant.

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as telemetryService from '../services/telemetryService.js';
import { ERROR_CODES } from '../config/constants.js';

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/telemetry
 * Records a client-side or proxy operational event.
 */
router.post('/', (req, res) => {
  const { eventType, durationMs, status, metadata } = req.body || {};

  if (!eventType) {
    return res.status(400).json({
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      message: "Missing required parameter 'eventType'",
      requestId: req.requestId
    });
  }

  const record = telemetryService.recordTelemetryEvent({
    eventType,
    tenantId: req.tenantId,
    durationMs,
    status: status || 'SUCCESS',
    metadata: metadata || {}
  });

  res.status(201).json(record);
});

/**
 * GET /api/telemetry/events
 * Returns recent operational telemetry events for the tenant.
 */
router.get('/events', (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const events = telemetryService.getTenantTelemetry(req.tenantId, limit);
  res.json({
    tenantId: req.tenantId,
    count: events.length,
    events
  });
});

/**
 * GET /api/telemetry/stats
 * Returns operational performance statistics.
 */
router.get('/stats', (req, res) => {
  const stats = telemetryService.getTenantTelemetryStats(req.tenantId);
  res.json(stats);
});

export default router;

