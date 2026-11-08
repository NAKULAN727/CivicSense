// CivicSense AI - Phase 12R Step 5: Frontend / Backend Authorization Test
import crypto from 'node:crypto';
import { verifyToken, generateToken, findUserById } from '../server/auth/tokenService.js';
import { AUTH_ROLES } from '../server/config/constants.js';
import { getPool, closePool } from '../server/db/connection.js';

async function runStep5Tests() {
  console.log("=== STEP 5: FRONTEND / BACKEND AUTHORIZATION TEST ===");

  // 1. Test genuine Operator token
  const opUser = findUserById('OP-DEMO-A-01');
  const opToken = generateToken(opUser);
  const opVerification = verifyToken(opToken);
  console.log("\n[TEST 5.1] Genuine Operator Token Verification:");
  console.log("Valid:", opVerification.valid);
  console.log("Role:", opVerification.user?.role);
  console.log("isSuperAdmin:", opVerification.user?.isSuperAdmin);

  // 2. Test genuine Super Admin token
  const saUser = findUserById('SUPER-ADMIN-01');
  const saToken = generateToken(saUser);
  const saVerification = verifyToken(saToken);
  console.log("\n[TEST 5.2] Genuine Super Admin Token Verification:");
  console.log("Valid:", saVerification.valid);
  console.log("Role:", saVerification.user?.role);
  console.log("isSuperAdmin:", saVerification.user?.isSuperAdmin);

  // 3. Test tampered token: Take opToken, tamper payload to have isSuperAdmin: true, keep op signature
  console.log("\n[TEST 5.3] Tampered Token (Payload Modified, Original Signature):");
  const [header, payload, sig] = opToken.split('.');
  const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  decodedPayload.isSuperAdmin = true;
  decodedPayload.role = AUTH_ROLES.SUPER_ADMIN;
  const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload))
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const tamperedToken = `${header}.${tamperedPayloadB64}.${sig}`;
  const tamperedResult = verifyToken(tamperedToken);
  console.log("Tampered token valid:", tamperedResult.valid);
  console.log("Tampered token rejection reason:", tamperedResult.error);

  // 4. Test forged token: Signed with arbitrary external HMAC key
  console.log("\n[TEST 5.4] Forged Token (Signed with Attacker Key):");
  const attackerSignature = crypto
    .createHmac('sha256', 'attacker-secret-key-12345')
    .update(`${header}.${tamperedPayloadB64}`)
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const forgedToken = `${header}.${tamperedPayloadB64}.${attackerSignature}`;
  const forgedResult = verifyToken(forgedToken);
  console.log("Forged token valid:", forgedResult.valid);
  console.log("Forged token rejection reason:", forgedResult.error);

  // 5. Inspect database connection role attributes on PostgreSQL
  console.log("\n[TEST 5.5] Database Connection Role Attributes on PostgreSQL:");
  const pool = getPool();
  const client = await pool.connect();
  try {
    const rolesRes = await client.query(`
      SELECT 
        rolname,
        rolsuper,
        rolcreaterole,
        rolcreatedb,
        rolcanlogin,
        rolbypassrls
      FROM pg_roles 
      WHERE rolname IN ('postgres', 'civicsense_app_role', 'authenticated', 'anon', 'service_role')
      ORDER BY rolname;
    `);
    console.table(rolesRes.rows);
  } finally {
    client.release();
    await closePool();
  }
}

runStep5Tests().catch(console.error);
