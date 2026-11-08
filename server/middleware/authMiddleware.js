// CivicSense AI - Phase 11 Authentication & Tenant Resolution Middleware
// Enforces mandatory authentication boundary and server-side tenant isolation.

import { verifyToken } from '../auth/tokenService.js';
import { getTenant, validateTenantAccess } from '../tenants/tenantRegistry.js';
import { ERROR_CODES, AUDIT_EVENTS } from '../config/constants.js';
import { logAuditEvent } from '../services/auditService.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.AUTHENTICATION_FAILURE,
      tenantId: 'UNRESOLVED',
      actorId: 'ANONYMOUS',
      resource: req.originalUrl,
      result: 'FAILURE',
      details: { reason: 'Missing or malformed Authorization header' },
      requestId: req.requestId
    });

    return res.status(401).json({
      errorCode: ERROR_CODES.UNAUTHENTICATED,
      message: 'Authentication required. Authorization header with Bearer token is missing.',
      requestId: req.requestId
    });
  }

  const token = authHeader.slice(7).trim();
  const verification = verifyToken(token);

  if (!verification.valid || !verification.user) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.AUTHENTICATION_FAILURE,
      tenantId: 'UNRESOLVED',
      actorId: 'INVALID_TOKEN',
      resource: req.originalUrl,
      result: 'FAILURE',
      details: { reason: verification.error || 'Invalid token' },
      requestId: req.requestId
    });

    return res.status(401).json({
      errorCode: ERROR_CODES.INVALID_TOKEN,
      message: `Invalid or expired session token: ${verification.error}`,
      requestId: req.requestId
    });
  }

  const user = verification.user;

  // Resolve and validate user's assigned tenant
  const tenant = getTenant(user.tenantId);
  if (!tenant) {
    return res.status(403).json({
      errorCode: ERROR_CODES.TENANT_NOT_FOUND,
      message: 'Access denied. The tenant associated with this identity is unrecognized or inactive.',
      requestId: req.requestId
    });
  }

  // Cross-tenant verification: check if client explicitly requested another tenant
  const requestedTenant = req.headers['x-tenant-id'] || req.query.tenantId;
  if (requestedTenant && !validateTenantAccess(user.tenantId, requestedTenant)) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
      tenantId: user.tenantId,
      actorId: user.userId,
      resource: req.originalUrl,
      result: 'DENIED',
      details: { attemptedTenant: requestedTenant, userTenant: user.tenantId },
      requestId: req.requestId
    });

    return res.status(403).json({
      errorCode: ERROR_CODES.TENANT_ACCESS_DENIED,
      message: 'Access denied.',
      requestId: req.requestId
    });
  }

  // Bind resolved user and tenant scope to request
  req.user = user;
  req.tenantId = user.tenantId;
  req.tenant = tenant;

  next();
}

