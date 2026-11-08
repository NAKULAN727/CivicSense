// CivicSense AI - Phase 12 Authentication & OIDC Routes
// Multi-tenant authentication boundary supporting Sandbox & Enterprise OpenID Connect (OIDC).

import express from 'express';
import { generateToken, findUserById, REGISTERED_USERS } from '../auth/tokenService.js';
import { getPermissionsForRole, validateRoleAssignment } from '../auth/rbacService.js';
import { 
  getOidcStatus, 
  buildAuthorizationUrl, 
  validateIdToken, 
  mapClaimsToUser, 
  issueRefreshToken, 
  rotateRefreshToken, 
  revokeSession 
} from '../auth/oidcService.js';
import { config } from '../config/environment.js';
import { AUDIT_EVENTS, ERROR_CODES } from '../config/constants.js';
import { logAuditEvent } from '../services/auditService.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/auth/accounts
 * Public list of demo accounts for sandbox login across 6 roles.
 */
router.get('/accounts', (req, res) => {
  const safeAccounts = REGISTERED_USERS.map(u => ({
    userId: u.userId,
    displayName: u.displayName,
    role: u.role,
    tenantId: u.tenantId,
    department: u.department,
    isSandboxUser: u.isSandboxUser
  }));
  res.json({ 
    accounts: safeAccounts, 
    authMode: config.auth.mode,
    oidcStatus: getOidcStatus().status
  });
});

/**
 * POST /api/auth/login
 * Sandbox / Local authentication issuing signed JWT.
 */
router.post('/login', (req, res) => {
  const { userId } = req.body || {};

  if (!userId) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.AUTHENTICATION_FAILURE,
      tenantId: 'UNRESOLVED',
      actorId: 'ANONYMOUS',
      resource: '/api/auth/login',
      result: 'FAILURE',
      details: { reason: "Missing required parameter 'userId'" },
      requestId: req.requestId
    });

    return res.status(400).json({
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      message: "Missing required parameter 'userId'",
      requestId: req.requestId
    });
  }

  const user = findUserById(userId);

  if (!user) {
    logAuditEvent({
      eventType: AUDIT_EVENTS.AUTHENTICATION_FAILURE,
      tenantId: 'UNRESOLVED',
      actorId: userId,
      resource: '/api/auth/login',
      result: 'FAILURE',
      details: { reason: 'Unknown user ID' },
      requestId: req.requestId
    });

    return res.status(401).json({
      errorCode: ERROR_CODES.UNAUTHENTICATED,
      message: `User '${userId}' not found in authorization registry.`,
      requestId: req.requestId
    });
  }

  const token = generateToken(user);
  const refreshToken = issueRefreshToken(user);

  logAuditEvent({
    eventType: AUDIT_EVENTS.AUTHENTICATION_SUCCESS,
    tenantId: user.tenantId,
    actorId: user.userId,
    resource: '/api/auth/login',
    result: 'SUCCESS',
    details: { role: user.role, tenantId: user.tenantId },
    requestId: req.requestId
  });

  res.json({
    token,
    refreshToken,
    user: {
      userId: user.userId,
      displayName: user.displayName,
      role: user.role,
      tenantId: user.tenantId,
      department: user.department,
      isSuperAdmin: user.role === 'SUPER_ADMIN'
    },
    authMode: config.auth.mode,
    permissions: getPermissionsForRole(user.role)
  });
});

/**
 * GET /api/auth/me
 * Retrieves current active session profile and permissions.
 */
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: req.user,
    tenant: req.tenant,
    authMode: config.auth.mode,
    permissions: getPermissionsForRole(req.user.role)
  });
});

/**
 * POST /api/auth/switch
 * Switches session to another demo account.
 */
router.post('/switch', (req, res) => {
  const { userId } = req.body || {};
  const user = findUserById(userId);

  if (!user) {
    return res.status(404).json({
      errorCode: ERROR_CODES.RESOURCE_NOT_FOUND,
      message: `Demo account '${userId}' not found`,
      requestId: req.requestId
    });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: {
      userId: user.userId,
      displayName: user.displayName,
      role: user.role,
      tenantId: user.tenantId,
      department: user.department
    },
    authMode: config.auth.mode,
    permissions: getPermissionsForRole(user.role)
  });
});

/**
 * POST /api/auth/roles/assign
 * Assigns or updates a user role with strict privilege escalation prevention.
 */
router.post('/roles/assign', authenticate, (req, res, next) => {
  try {
    const { targetUserId, newRole } = req.body || {};

    if (!targetUserId || !newRole) {
      return res.status(400).json({
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        message: 'targetUserId and newRole are required',
        requestId: req.requestId
      });
    }

    // Privilege escalation check
    validateRoleAssignment(req.user, targetUserId, newRole);

    logAuditEvent({
      eventType: AUDIT_EVENTS.ROLE_CHANGED,
      tenantId: req.tenantId,
      actorId: req.user.userId,
      resource: `/api/auth/users/${targetUserId}/role`,
      result: 'SUCCESS',
      details: { targetUserId, assignedRole: newRole },
      requestId: req.requestId
    });

    res.json({
      success: true,
      targetUserId,
      newRole,
      assignedBy: req.user.userId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// ENTERPRISE OPENID CONNECT (OIDC) ENDPOINTS
// =========================================================================

/**
 * GET /api/auth/oidc/status
 * Returns OIDC readiness status and configuration notice.
 */
router.get('/oidc/status', (req, res) => {
  res.json(getOidcStatus());
});

/**
 * POST /api/auth/oidc/authorize
 * Initiates standard Authorization Code Flow with PKCE.
 */
router.post('/oidc/authorize', (req, res, next) => {
  try {
    const { tenantId, redirectUri } = req.body || {};
    const authData = buildAuthorizationUrl({
      tenantId: tenantId || 'TENANT-DEMO-A',
      redirectUri: redirectUri || 'http://localhost:5173/auth/callback'
    });
    res.json(authData);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/oidc/token
 * Validates OIDC ID token claims, maps identity, and issues application session.
 */
router.post('/oidc/token', (req, res, next) => {
  try {
    const { idToken, expectedNonce, tenantId } = req.body || {};

    const validation = validateIdToken(idToken, { nonce: expectedNonce });
    if (!validation.isValid) {
      return res.status(401).json({
        errorCode: ERROR_CODES.INVALID_TOKEN,
        message: `OIDC Token validation failed: ${validation.reason}`,
        requestId: req.requestId
      });
    }

    // Map claims to internal CivicSense user
    const internalUser = mapClaimsToUser(validation.claims, tenantId);
    const token = generateToken(internalUser);
    const refreshToken = issueRefreshToken(internalUser);

    logAuditEvent({
      eventType: AUDIT_EVENTS.AUTHENTICATION_SUCCESS,
      tenantId: internalUser.tenantId,
      actorId: internalUser.userId,
      resource: '/api/auth/oidc/token',
      result: 'SUCCESS',
      details: { issuer: validation.claims.iss, role: internalUser.role },
      requestId: req.requestId
    });

    res.json({
      token,
      refreshToken,
      user: internalUser,
      authMode: 'OIDC',
      claims: validation.claims
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/oidc/refresh
 * Rotates an active refresh token and returns a new session.
 */
router.post('/oidc/refresh', (req, res) => {
  const { refreshToken } = req.body || {};

  const rotation = rotateRefreshToken(refreshToken);
  if (!rotation.valid) {
    return res.status(401).json({
      errorCode: ERROR_CODES.INVALID_TOKEN,
      message: rotation.error,
      requestId: req.requestId
    });
  }

  const user = findUserById(rotation.session.userId) || {
    userId: rotation.session.userId,
    tenantId: rotation.session.tenantId,
    role: rotation.session.role,
    displayName: 'Refreshed Federated User',
    department: 'Federated Operations'
  };

  const newToken = generateToken(user);

  res.json({
    token: newToken,
    refreshToken: rotation.newRefreshToken,
    user
  });
});

/**
 * POST /api/auth/oidc/logout
 * Revokes refresh token and terminates session.
 */
router.post('/oidc/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  revokeSession(refreshToken);
  res.json({ success: true, message: 'Session logged out and refresh token revoked' });
});

export default router;
