// CivicSense AI - Phase 12 Administration, Compliance & Data Export Routes
// Cryptographic audit chain verification, tenant data export, and administrative controls.

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { PERMISSIONS, AUDIT_EVENTS } from '../config/constants.js';
import { verifyAuditChain, logAuditEvent } from '../services/auditService.js';
import { storageEngine } from '../db/storageEngine.js';
import { setEnterpriseErpEnabled, getEnterpriseErpStatus } from '../adapters/enterpriseErpAdapter.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/admin/audit/chain
 * Verifies tamper-evident cryptographic hash chain for caller's tenant.
 */
router.get('/audit/chain', requirePermission(PERMISSIONS.AUDIT_VERIFY_CHAIN), (req, res) => {
  const result = verifyAuditChain(req.tenantId);
  res.json({
    tenantId: req.tenantId,
    timestamp: new Date().toISOString(),
    ...result
  });
});

/**
 * GET /api/admin/export
 * Exports all tenant records cleanly with tenant isolation (Section 7).
 */
router.get('/export', requirePermission(PERMISSIONS.DATA_EXPORT), (req, res) => {
  const exportData = storageEngine.exportTenantData(req.tenantId);

  logAuditEvent({
    eventType: AUDIT_EVENTS.DATA_EXPORTED,
    tenantId: req.tenantId,
    actorId: req.user.userId,
    resource: '/api/admin/export',
    result: 'SUCCESS',
    details: {
      incidentCount: exportData.incidents?.length || 0,
      workOrderCount: exportData.workOrders?.length || 0
    },
    requestId: req.requestId
  });

  res.json(exportData);
});

/**
 * POST /api/admin/erp/toggle
 * Administratively enables or disables the real municipal ERP adapter.
 */
router.post('/erp/toggle', requirePermission(PERMISSIONS.INTEGRATION_CONFIGURE), (req, res) => {
  const { enabled } = req.body || {};
  const status = setEnterpriseErpEnabled(enabled);

  logAuditEvent({
    eventType: AUDIT_EVENTS.CONFIGURATION_CHANGED,
    tenantId: req.tenantId,
    actorId: req.user.userId,
    resource: '/api/admin/erp/toggle',
    result: 'SUCCESS',
    details: { newEnabledState: Boolean(enabled) },
    requestId: req.requestId
  });

  res.json({
    tenantId: req.tenantId,
    erpStatus: status,
    updatedBy: req.user.userId
  });
});

export default router;

