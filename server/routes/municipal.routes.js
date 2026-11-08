// CivicSense AI - Phase 11 Municipal Integration Proxy Routes
// Exposes integration status and configuration while keeping credentials strictly server-side.

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { PERMISSIONS } from '../config/constants.js';
import { getSafeConfig } from '../config/environment.js';
import { getErpConnectorStatus } from '../adapters/realErpAdapter.js';
import { getAdapterMode } from '../adapters/municipalAdapter.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/municipal/status
 * Returns integration mode and ERP connection status.
 */
router.get('/status', (req, res) => {
  const erpStatus = getErpConnectorStatus();
  res.json({
    tenantId: req.tenantId,
    tenantName: req.tenant.tenantName,
    municipalMode: getAdapterMode(),
    erpConnector: erpStatus,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/municipal/config
 * Returns safe integration configuration (ADMIN only).
 */
router.get('/config', requirePermission(PERMISSIONS.INTEGRATION_CONFIGURE), (req, res) => {
  const safeConfig = getSafeConfig();
  res.json({
    tenantId: req.tenantId,
    tenantConfig: req.tenant.configuration,
    systemConfig: safeConfig
  });
});

export default router;

