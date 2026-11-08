// CivicSense AI - Phase 11 Work Order Routes
// Dispatches work orders with idempotency, human approval guards, and conflict management.

import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/rbacMiddleware.js';
import { PERMISSIONS, ERROR_CODES } from '../config/constants.js';
import { validateWorkOrderPayload } from '../validation/schemas.js';
import * as workOrderService from '../services/workOrderService.js';

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/work-orders
 * Dispatches an approved incident to the municipal work order adapter.
 */
router.post('/', async (req, res, next) => {
  try {
    const validation = validateWorkOrderPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        message: `Validation failed: ${validation.errors.join('; ')}`,
        errors: validation.errors,
        requestId: req.requestId
      });
    }

    const workOrder = await workOrderService.dispatchWorkOrder(
      req.tenantId,
      req.user,
      validation.sanitized,
      req.requestId
    );

    res.status(201).json(workOrder);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/work-orders
 * Lists all work orders for caller's tenant.
 */
router.get('/', async (req, res, next) => {
  try {
    const orders = await workOrderService.getTenantWorkOrders(req.tenantId);
    res.json({
      tenantId: req.tenantId,
      count: orders.length,
      workOrders: orders
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/work-orders/:id
 * Retrieves a work order by ID within tenant scope.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const order = await workOrderService.getWorkOrderById(req.tenantId, req.params.id, req.user, req.requestId);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/work-orders/:id/status
 * Updates work order status with conflict detection.
 */
router.patch('/:id/status', requirePermission(PERMISSIONS.WORK_ORDER_MANAGE), async (req, res, next) => {
  try {
    const updated = await workOrderService.updateWorkOrderStatus(
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

