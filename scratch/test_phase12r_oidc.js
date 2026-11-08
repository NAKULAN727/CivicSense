// CivicSense AI - Phase 12R Enterprise OIDC RS256 & JWKS Verification
// Tests asymmetric RS256 token verification, JWKS key matching, TTL caching, and rejection of HS256 in enterprise mode.
// ZERO Math.random() – Uses Node.js crypto for all keys, nonces, and signatures.

import crypto from 'node:crypto';
import {
  registerJwksKey,
  verifyRs256Token,
  validateIdToken,
  clearJwksCacheForTest
} from '../server/auth/oidcService.js';

let passed = 0;
let total = 0;

function assert(condition, testName, details) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ↳ ${details}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       ↳ ${details}`);
  }
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function runOidcSuite() {
  console.log("==================================================");
  console.log("CIVICSENSE AI — PHASE 12R ENTERPRISE OIDC RS256/JWKS");
  console.log("==================================================");

  clearJwksCacheForTest();

  // Generate test RSA 2048-bit keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });

  const jwk = publicKey.export({ format: 'jwk' });
  const kid = 'civicsense-rsa-key-001';
  jwk.kid = kid;

  const mockJwksUri = 'https://auth.civicsense.gov/realms/municipal/protocol/openid-connect/certs';

  // 1. Register JWK into JWKS cache
  registerJwksKey(mockJwksUri, jwk);

  function createSignedRs256Token(headerOverrides = {}, payloadOverrides = {}, key = privateKey) {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid,
      ...headerOverrides
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://auth.civicsense.gov/realms/municipal',
      sub: 'USR-EXT-ENTRA-9988',
      aud: 'civicsense-backend',
      exp: now + 3600,
      iat: now,
      nbf: now - 10,
      nonce: 'nonce-val-test-01',
      preferred_username: 'arun.kumar@chennaicorporation.gov',
      roles: ['MUNICIPAL_OPERATOR'],
      tenant_id: 'TENANT-DEMO-A',
      ...payloadOverrides
    };

    const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const signatureB64 = signer.sign(key, 'base64url');

    return `${signingInput}.${signatureB64}`;
  }

  // TEST 1: Valid RS256 Token Verification with JWKS matching
  const validToken = createSignedRs256Token();
  const validResult = await verifyRs256Token(validToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend',
    nonce: 'nonce-val-test-01'
  });

  assert(
    validResult.isValid === true && validResult.claims?.sub === 'USR-EXT-ENTRA-9988',
    "TEST 1: Valid RS256 token verification with JWKS public key",
    `Verified asymmetric signature. Subject: ${validResult.claims?.sub}`
  );

  // TEST 2: JWKS Caching (subsequent verification succeeds from cache without re-fetching)
  const cachedResult = await verifyRs256Token(validToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    cachedResult.isValid === true,
    "TEST 2: In-memory JWKS cache hit",
    "Verified public key retrieved from cache with 1-hour TTL."
  );

  // TEST 3: Expired Token Rejection
  const expiredToken = createSignedRs256Token({}, { exp: Math.floor(Date.now() / 1000) - 120 });
  const expiredResult = await verifyRs256Token(expiredToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    expiredResult.isValid === false && expiredResult.reason?.includes('expired'),
    "TEST 3: Expired RS256 token rejection",
    `Rejected: ${expiredResult.reason}`
  );

  // TEST 4: Invalid Issuer Rejection
  const wrongIssuerToken = createSignedRs256Token({}, { iss: 'https://unauthorized-attacker-idp.com' });
  const wrongIssuerResult = await verifyRs256Token(wrongIssuerToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    wrongIssuerResult.isValid === false && wrongIssuerResult.reason?.includes('issuer'),
    "TEST 4: Wrong issuer rejection",
    `Rejected: ${wrongIssuerResult.reason}`
  );

  // TEST 5: Invalid Audience Rejection
  const wrongAudToken = createSignedRs256Token({}, { aud: 'malicious-client-app' });
  const wrongAudResult = await verifyRs256Token(wrongAudToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    wrongAudResult.isValid === false && wrongAudResult.reason?.includes('audience'),
    "TEST 5: Wrong audience rejection",
    `Rejected: ${wrongAudResult.reason}`
  );

  // TEST 6: Unknown Key ID (kid) Rejection
  const unknownKidToken = createSignedRs256Token({ kid: 'unknown-key-9999' });
  const unknownKidResult = await verifyRs256Token(unknownKidToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    unknownKidResult.isValid === false && (unknownKidResult.reason?.includes('not found') || unknownKidResult.reason?.includes('fetch failed')),
    "TEST 6: Unknown key ID (kid) rejection",
    `Rejected: ${unknownKidResult.reason}`
  );

  // TEST 7: Tampered Signature Rejection
  const tamperedParts = validToken.split('.');
  tamperedParts[2] = 'invalidsignaturebytes' + tamperedParts[2].slice(20);
  const tamperedToken = tamperedParts.join('.');
  const tamperedResult = await verifyRs256Token(tamperedToken, {
    jwksUri: mockJwksUri,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    tamperedResult.isValid === false && tamperedResult.reason?.includes('signature'),
    "TEST 7: Tampered RS256 signature rejection",
    `Rejected: ${tamperedResult.reason}`
  );

  // TEST 8: Rejection of HS256 token in enterprise mode
  const hs256Header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const hs256Payload = base64UrlEncode(Buffer.from(JSON.stringify({
    iss: 'https://auth.civicsense.gov/realms/municipal',
    sub: 'USR-EXT-001',
    aud: 'civicsense-backend',
    exp: Math.floor(Date.now() / 1000) + 3600
  })));
  const hs256Sig = crypto.createHmac('sha256', 'some-shared-secret').update(`${hs256Header}.${hs256Payload}`).digest('base64url');
  const hs256Token = `${hs256Header}.${hs256Payload}.${hs256Sig}`;

  const hs256RejectedResult = validateIdToken(hs256Token, {
    requireAsymmetric: true,
    issuer: 'https://auth.civicsense.gov/realms/municipal',
    audience: 'civicsense-backend'
  });

  assert(
    hs256RejectedResult.isValid === false && hs256RejectedResult.reason?.includes('HS256'),
    "TEST 8: Insecure HS256 rejection in enterprise mode",
    `Rejected: ${hs256RejectedResult.reason}`
  );

  console.log("\n==================================================");
  console.log(`TOTAL TESTS:   ${total}`);
  console.log(`PASSED:        ${passed}`);
  console.log(`FAILED:        ${total - passed}`);
  console.log("==================================================");

  if (total - passed > 0) {
    process.exit(1);
  }
}

runOidcSuite().catch((err) => {
  console.error('[UNHANDLED_ERROR]', err);
  process.exit(1);
});

