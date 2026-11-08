// CivicSense AI - Phase 12 Enterprise OpenID Connect (OIDC) Service
// Implements Authorization Code Flow with PKCE, claim mapping, token validation, and session rotation.
// Compatible with Keycloak, Microsoft Entra ID, Auth0, and standards-compliant OIDC providers.

import crypto from 'node:crypto';
import { config } from '../config/environment.js';

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

// In-memory PKCE state cache (state -> { codeVerifier, nonce, tenantId, createdAt })
const pkceSessionStore = new Map();

// In-memory active OIDC refresh token store (refreshToken -> { userId, tenantId, expiresAt })
const refreshTokenStore = new Map();

// In-memory JWKS public key cache (jwksUri -> { keys: Map(kid -> KeyObject), fetchedAt: number, ttlMs: number })
const jwksCache = new Map();
const DEFAULT_JWKS_TTL_MS = 3600000; // 1 hour TTL

/**
 * Registers a public key or JWK in the local JWKS cache (useful for mocking, testing, and preloading).
 */
export function registerJwksKey(jwksUri, keyData) {
  let cacheEntry = jwksCache.get(jwksUri);
  if (!cacheEntry) {
    cacheEntry = { keys: new Map(), fetchedAt: Date.now(), ttlMs: DEFAULT_JWKS_TTL_MS };
    jwksCache.set(jwksUri, cacheEntry);
  }

  let keyObj;
  let kid = keyData.kid || 'default-kid';

  if (typeof keyData === 'string' || Buffer.isBuffer(keyData)) {
    keyObj = crypto.createPublicKey(keyData);
  } else if (keyData.kty === 'RSA') {
    keyObj = crypto.createPublicKey({ key: keyData, format: 'jwk' });
  } else if (keyData.type === 'public') {
    keyObj = keyData;
  } else {
    throw new Error('Unsupported key format provided to registerJwksKey');
  }

  cacheEntry.keys.set(kid, keyObj);
  cacheEntry.fetchedAt = Date.now();
  return { jwksUri, kid, keyObj };
}

/**
 * Fetches JWKS keys from remote provider endpoint with caching.
 */
export async function fetchJwks(jwksUri, forceRefresh = false) {
  const existing = jwksCache.get(jwksUri);
  const now = Date.now();

  if (existing && !forceRefresh && (now - existing.fetchedAt) < existing.ttlMs) {
    return existing.keys;
  }

  try {
    const res = await fetch(jwksUri, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`JWKS HTTP error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const keyMap = new Map();

    if (Array.isArray(data.keys)) {
      for (const jwk of data.keys) {
        if (jwk.kty === 'RSA' && jwk.kid) {
          try {
            const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
            keyMap.set(jwk.kid, pubKey);
          } catch (e) {
            console.warn(`[JWKS_WARNING] Failed to parse RSA JWK kid=${jwk.kid}:`, e.message);
          }
        }
      }
    }

    jwksCache.set(jwksUri, { keys: keyMap, fetchedAt: now, ttlMs: DEFAULT_JWKS_TTL_MS });
    return keyMap;
  } catch (err) {
    if (existing) {
      console.warn('[JWKS_WARNING] Failed to refresh JWKS; returning stale cached keys:', err.message);
      return existing.keys;
    }
    throw err;
  }
}

/**
 * Retrieves public key for a specific key ID (kid) from JWKS cache.
 */
export async function getJwksPublicKey(jwksUri, kid) {
  let keys = await fetchJwks(jwksUri, false);
  let key = keys.get(kid);

  // If not found in cache, attempt on-demand refresh once
  if (!key) {
    keys = await fetchJwks(jwksUri, true);
    key = keys.get(kid);
  }

  return key || null;
}

/**
 * Clears JWKS cache (for testing only).
 */
export function clearJwksCacheForTest() {
  jwksCache.clear();
}

export const OIDC_STATUS = {
  CONFIGURED: 'CONFIGURED',
  NOT_CONFIGURED: 'OIDC: NOT CONFIGURED',
  SANDBOX: 'SANDBOX'
};

/**
 * Returns OIDC configuration readiness status.
 */
export function getOidcStatus() {
  const isConfigured = Boolean(
    config.auth.oidcIssuer &&
    config.auth.oidcClientId &&
    config.auth.oidcClientSecret
  );

  return {
    status: isConfigured ? OIDC_STATUS.CONFIGURED : OIDC_STATUS.NOT_CONFIGURED,
    isAvailable: isConfigured,
    issuer: config.auth.oidcIssuer || null,
    clientId: config.auth.oidcClientId ? `${config.auth.oidcClientId.slice(0, 4)}...` : null,
    mode: config.auth.mode,
    notice: isConfigured 
      ? 'Enterprise OIDC identity federation active.' 
      : 'Enterprise SSO is NOT CONFIGURED. Local sandbox authentication boundary in effect.'
  };
}

/**
 * Generates cryptographic PKCE code_verifier and code_challenge using SHA-256 (S256).
 * ZERO Math.random() – Uses crypto.randomBytes().
 */
export function generatePkcePair() {
  const verifierBytes = crypto.randomBytes(32);
  const codeVerifier = base64UrlEncode(verifierBytes);

  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64UrlEncode(hash);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * Builds standard OIDC authorization code URL with PKCE.
 */
export function buildAuthorizationUrl({ tenantId, redirectUri }) {
  const status = getOidcStatus();
  if (!status.isAvailable) {
    const err = new Error('OIDC identity provider is NOT CONFIGURED. Enterprise SSO cannot initiate.');
    err.status = 503;
    err.code = 'OIDC_NOT_CONFIGURED';
    throw err;
  }

  const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkcePair();
  const state = base64UrlEncode(crypto.randomBytes(16));
  const nonce = base64UrlEncode(crypto.randomBytes(16));

  // Store PKCE session with 10-minute expiry
  pkceSessionStore.set(state, {
    codeVerifier,
    nonce,
    tenantId: tenantId || 'TENANT-DEMO-A',
    redirectUri,
    createdAt: Date.now(),
    expiresAt: Date.now() + 600000
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.auth.oidcClientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod
  });

  return {
    authUrl: `${config.auth.oidcIssuer}/protocol/openid-connect/auth?${params.toString()}`,
    state,
    codeVerifier
  };
}

/**
 * Asymmetrically verifies an enterprise RS256 token using RSA-SHA256 and public keys from JWKS.
 * Enforces:
 *   - alg === 'RS256'
 *   - kid matching from JWKS or provided public key
 *   - Cryptographic verification via crypto.createVerify('RSA-SHA256')
 *   - Standard claims: exp, nbf, iss, aud, nonce
 */
export async function verifyRs256Token(idToken, expected = {}) {
  if (!idToken || typeof idToken !== 'string') {
    return { isValid: false, reason: 'ID Token missing or empty' };
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    return { isValid: false, reason: 'Malformed ID Token structure (expected 3 parts)' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch (e) {
    return { isValid: false, reason: 'Malformed token header JSON' };
  }

  if (!header.alg || header.alg !== 'RS256') {
    return {
      isValid: false,
      reason: `Unsupported algorithm '${header.alg}'. Enterprise OIDC strictly requires asymmetric 'RS256' verification with JWKS.`
    };
  }

  let publicKey = expected.publicKey;

  if (!publicKey) {
    const jwksUri = expected.jwksUri || config.auth.oidcJwksUri;
    if (!jwksUri) {
      return { isValid: false, reason: 'JWKS URI not configured and no public key provided' };
    }
    const kid = header.kid;
    if (!kid) {
      return { isValid: false, reason: "Token header missing required 'kid' for JWKS key matching" };
    }

    try {
      publicKey = await getJwksPublicKey(jwksUri, kid);
    } catch (fetchErr) {
      return { isValid: false, reason: `Failed to retrieve JWKS key: ${fetchErr.message}` };
    }

    if (!publicKey) {
      return { isValid: false, reason: `Key with kid '${kid}' not found in JWKS endpoint '${jwksUri}'` };
    }
  }

  // Cryptographic RS256 Verification
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const isSignatureValid = verifier.verify(publicKey, signatureB64, 'base64url');
    if (!isSignatureValid) {
      return { isValid: false, reason: 'Invalid token signature (RS256 verification failed)' };
    }
  } catch (err) {
    return { isValid: false, reason: `RS256 signature verification error: ${err.message}` };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (e) {
    return { isValid: false, reason: 'Malformed token payload JSON' };
  }

  const now = Math.floor(Date.now() / 1000);

  // Expiration Check
  if (!payload.exp || payload.exp < now) {
    return { isValid: false, reason: `Token expired at ${new Date(payload.exp * 1000).toISOString()}` };
  }

  // Not Before Check
  if (payload.nbf && payload.nbf > now + 60) {
    return { isValid: false, reason: `Token not valid before ${new Date(payload.nbf * 1000).toISOString()}` };
  }

  // Issuer Validation
  const expectedIssuer = expected.issuer || config.auth.oidcIssuer;
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    return { isValid: false, reason: `Invalid token issuer '${payload.iss}'; expected '${expectedIssuer}'` };
  }

  // Audience Validation
  const expectedAudience = expected.audience || config.auth.oidcAudience || config.auth.oidcClientId;
  if (expectedAudience) {
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audArray.includes(expectedAudience)) {
      return { isValid: false, reason: `Invalid audience '${payload.aud}'; expected '${expectedAudience}'` };
    }
  }

  // Nonce Replay Verification
  if (expected.nonce && payload.nonce !== expected.nonce) {
    return { isValid: false, reason: `Nonce mismatch: expected '${expected.nonce}', received '${payload.nonce}'` };
  }

  return {
    isValid: true,
    claims: payload
  };
}

/**
 * Validates and verifies an incoming OIDC ID Token against strict enterprise criteria.
 * Supports asymmetric RS256 with JWKS, with backward compatible HS256 for local sandbox tests.
 * Enforces:
 * 1. Signature verification
 * 2. Issuer check ('iss')
 * 3. Audience check ('aud')
 * 4. Expiration check ('exp')
 * 5. Replay prevention ('nonce')
 */
export function validateIdToken(idToken, expected = {}) {
  if (!idToken || typeof idToken !== 'string') {
    return { isValid: false, reason: 'ID Token missing or empty' };
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    return { isValid: false, reason: 'Malformed ID Token structure (expected 3 parts)' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch (e) {
    return { isValid: false, reason: 'Malformed token header JSON' };
  }

  // Reject HS256 if enterprise mode is enforced
  if (header.alg === 'HS256' && (expected.requireAsymmetric || expected.enterpriseMode)) {
    return {
      isValid: false,
      reason: "Unsupported or insecure algorithm 'HS256': Enterprise OIDC strictly requires asymmetric RS256 verification with JWKS."
    };
  }

  // If RS256, verify with public key
  if (header.alg === 'RS256') {
    if (expected.publicKey) {
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(`${headerB64}.${payloadB64}`);
        const isSigValid = verifier.verify(expected.publicKey, signatureB64, 'base64url');
        if (!isSigValid) {
          return { isValid: false, reason: 'Invalid token signature' };
        }
      } catch (e) {
        return { isValid: false, reason: `RS256 signature verification failed: ${e.message}` };
      }
    } else {
      // Defer to async RS256 verification
      return verifyRs256Token(idToken, expected);
    }
  } else if (header.alg === 'HS256') {
    // 1. Signature Verification for sandbox/mock tokens
    const signingSecret = expected.clientSecret || config.auth.oidcClientSecret || config.auth.jwtSecret;
    const signatureInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', signingSecret)
      .update(signatureInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigBuffer = Buffer.from(signatureB64);
    const expectedBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { isValid: false, reason: 'Invalid token signature' };
    }
  } else {
    return { isValid: false, reason: `Unsupported token algorithm '${header.alg}'` };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (e) {
    return { isValid: false, reason: 'Malformed token payload JSON' };
  }

  const now = Math.floor(Date.now() / 1000);

  // 2. Expiration Check
  if (!payload.exp || payload.exp < now) {
    return { isValid: false, reason: `Token expired at ${new Date(payload.exp * 1000).toISOString()}` };
  }

  // 3. Issuer Validation
  const expectedIssuer = expected.issuer || config.auth.oidcIssuer;
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    return { isValid: false, reason: `Invalid token issuer '${payload.iss}'; expected '${expectedIssuer}'` };
  }

  // 4. Audience Validation
  const expectedAudience = expected.audience || config.auth.oidcAudience || config.auth.oidcClientId;
  if (expectedAudience) {
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audArray.includes(expectedAudience)) {
      return { isValid: false, reason: `Invalid audience '${payload.aud}'; expected '${expectedAudience}'` };
    }
  }

  // 5. Nonce / Replay Verification
  if (expected.nonce && payload.nonce !== expected.nonce) {
    return { isValid: false, reason: `Nonce mismatch: expected '${expected.nonce}', received '${payload.nonce}'` };
  }

  return {
    isValid: true,
    claims: payload
  };
}

/**
 * Enterprise Identity Mapping Policy:
 * Maps external OIDC provider claims to internal CivicSense user models.
 * Strictly avoids trusting untyped external role claims without an explicit mapping table.
 */
export function mapClaimsToUser(claims, tenantId = 'TENANT-DEMO-A') {
  if (!claims || !claims.sub) {
    throw new Error('IDENTITY_MAPPING_ERROR: Claims missing mandatory subject identifier (sub).');
  }

  const externalRoles = Array.isArray(claims.roles) 
    ? claims.roles 
    : (Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles : []);

  // Explicit Role Mapping Policy
  let mappedRole = 'OPERATOR'; // Default least privilege
  if (externalRoles.includes('civicsense_super_admin') || externalRoles.includes('SuperAdmin')) {
    mappedRole = 'SUPER_ADMIN';
  } else if (externalRoles.includes('civicsense_admin') || externalRoles.includes('TenantAdmin')) {
    mappedRole = 'TENANT_ADMIN';
  } else if (externalRoles.includes('civicsense_supervisor') || externalRoles.includes('Supervisor')) {
    mappedRole = 'SUPERVISOR';
  } else if (externalRoles.includes('civicsense_auditor') || externalRoles.includes('Auditor')) {
    mappedRole = 'AUDITOR';
  } else if (externalRoles.includes('civicsense_readonly') || externalRoles.includes('Viewer')) {
    mappedRole = 'READ_ONLY';
  }

  // Organization / Tenant mapping
  const mappedTenantId = claims.organization_id || claims.tenant_id || claims.tid || tenantId;

  return {
    userId: `OIDC-${claims.sub}`,
    tenantId: mappedTenantId,
    email: claims.email || null,
    displayName: claims.name || claims.preferred_username || claims.email || `OIDC User (${claims.sub.slice(0, 8)})`,
    role: mappedRole,
    department: claims.department || 'Enterprise Federated Division',
    isSandboxUser: false
  };
}

/**
 * Creates and registers a rotated refresh token session.
 */
export function issueRefreshToken(user) {
  const refreshToken = `RT-${base64UrlEncode(crypto.randomBytes(32))}`;
  refreshTokenStore.set(refreshToken, {
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    expiresAt: Date.now() + 7 * 86400 * 1000 // 7 days
  });
  return refreshToken;
}

/**
 * Rotates a refresh token: consumes existing, issues new, invalidates old.
 */
export function rotateRefreshToken(oldRefreshToken) {
  const session = refreshTokenStore.get(oldRefreshToken);
  if (!session) {
    return { valid: false, error: 'Invalid or revoked refresh token' };
  }

  if (Date.now() > session.expiresAt) {
    refreshTokenStore.delete(oldRefreshToken);
    return { valid: false, error: 'Refresh token expired' };
  }

  // Invalidate consumed token (Rotation security standard)
  refreshTokenStore.delete(oldRefreshToken);

  const newRefreshToken = `RT-${base64UrlEncode(crypto.randomBytes(32))}`;
  refreshTokenStore.set(newRefreshToken, {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    expiresAt: Date.now() + 7 * 86400 * 1000
  });

  return {
    valid: true,
    newRefreshToken,
    session
  };
}

/**
 * Revokes an active session on logout.
 */
export function revokeSession(refreshToken) {
  if (refreshToken) {
    refreshTokenStore.delete(refreshToken);
  }
}

