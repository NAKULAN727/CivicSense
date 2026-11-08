// CivicSense AI - Phase 11 Role-Based Access Control (RBAC) Middleware
// Enforces server-side least privilege checks.

import { checkUserPermissions, roleHasPermission } from '../auth/rbacService.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { logAuditEvent } from '../services/auditService.js';

/**
 * Middleware factory requiring one or more specific permissions.
 * 
 * @param {string|Array<string>} requiredPermissions 
 */
export function requirePermission(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        errorCode: ERROR_CODES.UNAUTHENTICATED,
        message: 'Authentication required.',
        requestId: req.requestId
      });
    }

    const hasAccess = checkUserPermissions(req.user, requiredPermissions);

    if (!hasAccess) {
      logAuditEvent({
        eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
        tenantId: req.tenantId || 'UNKNOWN',
        actorId: req.user.userId,
        resource: req.originalUrl,
        result: 'FORBIDDEN',
        details: {
          userRole: req.user.role,
          requiredPermissions
        },
        requestId: req.requestId
      });

      return res.status(403).json({
        errorCode: ERROR_CODES.FORBIDDEN,
        message: 'Access denied. Insufficient role permissions.',
        requestId: req.requestId
      });
    }

    next();
  };
}

/**
 * Middleware factory requiring a specific role directly.
 * 
 * @param {string|Array<string>} roles 
 */
export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        errorCode: ERROR_CODES.FORBIDDEN,
        message: 'Access denied. Insufficient role privileges.',
        requestId: req.requestId
      });
    }
    next();
  };
}

