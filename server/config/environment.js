// CivicSense AI - Phase 11 Server Environment Configuration
// Safe reading of environment variables with validated defaults.

import fs from 'node:fs';
import path from 'node:path';
import { MUNICIPAL_INTEGRATION_MODES, AUTH_MODES } from './constants.js';

// Automatically load local .env file if present
if (typeof process.loadEnvFile === 'function') {
  try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  } catch {}
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || null,
  databaseSessionSecret: process.env.DB_SESSION_SECRET || 'c1v1cs3ns3-d3fau1t-db-s3ss10n-s1gn1ng-k3y-32b',

  // Authentication configuration
  auth: {
    mode: process.env.AUTH_MODE === AUTH_MODES.OIDC ? AUTH_MODES.OIDC : AUTH_MODES.SANDBOX,
    jwtSecret: process.env.JWT_SECRET || 'civicsense-sandbox-dev-secret-key-32chars-min',
    oidcIssuer: process.env.OIDC_ISSUER || null,
    oidcAudience: process.env.OIDC_AUDIENCE || null,
    oidcClientId: process.env.OIDC_CLIENT_ID || null,
    // Never logged or returned
    oidcClientSecret: process.env.OIDC_CLIENT_SECRET || null
  },

  // Municipal ERP proxy configuration
  municipal: {
    mode: process.env.MUNICIPAL_INTEGRATION_MODE === MUNICIPAL_INTEGRATION_MODES.ERP
      ? MUNICIPAL_INTEGRATION_MODES.ERP 
      : MUNICIPAL_INTEGRATION_MODES.SANDBOX,
    erpBaseUrl: process.env.ERP_BASE_URL || null,
    erpClientId: process.env.ERP_CLIENT_ID || null,
    erpClientSecret: process.env.ERP_CLIENT_SECRET || null,
    erpTimeoutMs: parseInt(process.env.ERP_TIMEOUT_MS, 10) || 5000,
    erpMaxRetries: parseInt(process.env.ERP_MAX_RETRIES, 10) || 3
  },

  // Security & Network controls
  security: {
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 120,
      authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 15
    }
  }
};

/**
 * Returns safe server configuration for diagnostics (strictly strips all secrets).
 */
export function getSafeConfig() {
  return {
    env: config.env,
    port: config.port,
    authMode: config.auth.mode,
    municipalMode: config.municipal.mode,
    hasOidcConfigured: Boolean(config.auth.oidcIssuer && config.auth.oidcClientId),
    hasErpConfigured: Boolean(config.municipal.erpBaseUrl && config.municipal.erpClientId),
    allowedOrigins: config.security.allowedOrigins,
    rateLimit: config.security.rateLimit
  };
}

