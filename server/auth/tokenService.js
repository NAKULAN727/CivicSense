// CivicSense AI - Phase 12 Token & Identity Service
// Cryptographically verified tokens with zero Math.random() and zero client-side trust.
// Supports 6 enterprise RBAC roles across isolated tenants.

import crypto from 'node:crypto';
import { config } from '../config/environment.js';
import { AUTH_ROLES } from '../config/constants.js';

export const REGISTERED_USERS = [
  // Tenant A Demo Users
  {
    userId: 'OP-DEMO-A-01',
    role: AUTH_ROLES.OPERATOR,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'R. Kumar (Field Technician)',
    department: 'Zone 1 Engineering & Works',
    isSandboxUser: true
  },
  {
    userId: 'SUP-DEMO-A-01',
    role: AUTH_ROLES.SUPERVISOR,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'S. Meenakshi (Zonal Dispatch Supervisor)',
    department: 'Alpha Command Center',
    isSandboxUser: true
  },
  {
    userId: 'ADM-DEMO-A-01',
    role: AUTH_ROLES.TENANT_ADMIN,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'Dr. A. Ramanathan (Spatial & Systems Administrator)',
    department: 'Alpha Municipal IT & Operations',
    isSandboxUser: true
  },
  {
    userId: 'AUD-DEMO-A-01',
    role: AUTH_ROLES.AUDITOR,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'M. Shanthi (Municipal Compliance Auditor)',
    department: 'Municipal Oversight & Transparency',
    isSandboxUser: true
  },
  {
    userId: 'RO-DEMO-A-01',
    role: AUTH_ROLES.READ_ONLY,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'K. Priya (Civic Observer)',
    department: 'Public Information Desk',
    isSandboxUser: true
  },

  // Global Super Administrator
  {
    userId: 'SUPER-ADMIN-01',
    role: AUTH_ROLES.SUPER_ADMIN,
    tenantId: 'TENANT-DEMO-A', // Primary administrative tenant
    displayName: 'Central Platform Architect (Super Admin)',
    department: 'State Smart City Mission Directorate',
    isSandboxUser: true
  },

  // Tenant B Demo Users (Strict Tenant Isolation)
  {
    userId: 'OP-DEMO-B-01',
    role: AUTH_ROLES.OPERATOR,
    tenantId: 'TENANT-DEMO-B',
    displayName: 'V. Anand (Field Technician)',
    department: 'Zone 2 Maintenance Division',
    isSandboxUser: true
  },
  {
    userId: 'SUP-DEMO-B-01',
    role: AUTH_ROLES.SUPERVISOR,
    tenantId: 'TENANT-DEMO-B',
    displayName: 'P. Lakshmi (Zonal Dispatch Supervisor)',
    department: 'Beta Command Center',
    isSandboxUser: true
  },
  {
    userId: 'ADM-DEMO-B-01',
    role: AUTH_ROLES.TENANT_ADMIN,
    tenantId: 'TENANT-DEMO-B',
    displayName: 'K. Suresh (Spatial & Systems Administrator)',
    department: 'Beta Municipal IT & Operations',
    isSandboxUser: true
  },

  // Legacy mappings for Phase 10 demo compatibility
  {
    userId: 'OP-CHENNAI-402',
    role: AUTH_ROLES.OPERATOR,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'R. Kumar (Field Technician)',
    department: 'Zone 13 Engineering & Works',
    isSandboxUser: true
  },
  {
    userId: 'SUP-CHENNAI-108',
    role: AUTH_ROLES.SUPERVISOR,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'S. Meenakshi (Zonal Dispatch Supervisor)',
    department: 'Command Center',
    isSandboxUser: true
  },
  {
    userId: 'ADM-CHENNAI-001',
    role: AUTH_ROLES.TENANT_ADMIN,
    tenantId: 'TENANT-DEMO-A',
    displayName: 'Dr. A. Ramanathan (Spatial Administrator)',
    department: 'Municipal IT & Operations',
    isSandboxUser: true
  }
];

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * Generates an HMAC-SHA256 signed JWT for a validated identity.
 */
export function generateToken(user, expiresInSeconds = 86400) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.userId,
    role: user.role,
    tenantId: user.tenantId,
    displayName: user.displayName,
    department: user.department,
    isSuperAdmin: user.role === AUTH_ROLES.SUPER_ADMIN,
    iss: 'civicsense-backend',
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', config.auth.jwtSecret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Validates and decodes an incoming JWT token.
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', config.auth.jwtSecret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Token has expired' };
    }

    if (!payload.sub || !payload.role || !payload.tenantId) {
      return { valid: false, error: 'Token missing required identity claims' };
    }

    return {
      valid: true,
      user: {
        userId: payload.sub,
        role: payload.role,
        tenantId: payload.tenantId,
        displayName: payload.displayName,
        department: payload.department,
        isSuperAdmin: Boolean(payload.isSuperAdmin)
      }
    };
  } catch (e) {
    return { valid: false, error: 'Failed to parse token payload' };
  }
}

/**
 * Resolves a user account from registry by userId.
 */
export function findUserById(userId) {
  return REGISTERED_USERS.find(u => u.userId === userId) || null;
}
