// CivicSense AI - Field Operator Authentication & Session Service (Phase 10)
// Provides a prototype authentication boundary with role-based permissions.
// IMPORTANT: Labeled "AUTHENTICATION PROTOTYPE".
// Production municipal deployment requires an enterprise identity provider (OAuth2 / OIDC / SAML SSO).
// ZERO Math.random() – Fully deterministic session state. Zero plaintext passwords stored.

export const AUTH_ROLES = {
  FIELD_OPERATOR: 'FIELD_OPERATOR',
  SUPERVISOR: 'SUPERVISOR',
  ADMIN: 'ADMIN'
};

export const AUTH_TYPE = 'AUTHENTICATION PROTOTYPE';

export const DEMO_ACCOUNTS = [
  {
    userId: 'OP-CHENNAI-402',
    role: AUTH_ROLES.FIELD_OPERATOR,
    displayName: 'R. Kumar (Field Technician)',
    department: 'Zone 13 Engineering & Works',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — FIELD OPERATOR'
  },
  {
    userId: 'SUP-CHENNAI-108',
    role: AUTH_ROLES.SUPERVISOR,
    displayName: 'S. Meenakshi (Zonal Dispatch Supervisor)',
    department: 'Greater Chennai Corporation Command Center',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — SUPERVISOR'
  },
  {
    userId: 'ADM-CHENNAI-001',
    role: AUTH_ROLES.ADMIN,
    displayName: 'Dr. A. Ramanathan (Spatial & Systems Administrator)',
    department: 'Municipal IT & Smart City Operations',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — ADMIN'
  }
];

const SESSION_STORAGE_KEY = 'civicsense_operator_session';

/**
 * Returns the current active session.
 * Defaults to the Field Operator demo account.
 * 
 * @returns {Object} Session object
 */
export function getCurrentSession() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.userId && parsed.role) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("[AUTH_SESSION_NOTICE] Could not read session from storage, falling back to default.");
    }
  }

  // Default active session: Field Operator
  const defaultAcc = DEMO_ACCOUNTS[0];
  return {
    userId: defaultAcc.userId,
    role: defaultAcc.role,
    displayName: defaultAcc.displayName,
    department: defaultAcc.department,
    loginTime: '2026-10-07T08:00:00.000Z',
    sessionStatus: 'ACTIVE',
    isDemoAccount: true,
    accountLabel: defaultAcc.accountLabel,
    authType: AUTH_TYPE
  };
}

/**
 * Switches the active session to another predefined demo account.
 * 
 * @param {string} userId Account identifier
 * @returns {Object} Updated session
 */
export function switchActiveSession(userId) {
  const account = DEMO_ACCOUNTS.find(a => a.userId === userId) || DEMO_ACCOUNTS[0];
  const newSession = {
    userId: account.userId,
    role: account.role,
    displayName: account.displayName,
    department: account.department,
    loginTime: new Date().toISOString(),
    sessionStatus: 'ACTIVE',
    isDemoAccount: true,
    accountLabel: account.accountLabel,
    authType: AUTH_TYPE
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.warn("[AUTH_STORAGE_NOTICE] Could not persist session:", e);
    }
  }

  return newSession;
}

/**
 * Validates whether the active session holds permission to perform an action.
 * 
 * FIELD_OPERATOR:
 * - Capture incident
 * - Inspect AI result
 * - Confirm/reject/needs-review
 * - Acknowledge incident
 * - Update permitted lifecycle states (NEW -> ACKNOWLEDGED -> ACTION REQUIRED)
 * 
 * SUPERVISOR:
 * - Review incidents
 * - Approve municipal dispatch
 * - Inspect audit trail
 * - Update priority where authorized
 * - Transition lifecycle to IN PROGRESS / RESOLVED
 * 
 * ADMIN:
 * - Integration configuration
 * - Boundary configuration
 * - System configuration
 * 
 * @param {string} action Action key
 * @param {Object} [session] Optional session (defaults to current)
 * @returns {boolean} True if authorized
 */
export function hasPermission(action, session = null) {
  const activeSession = session || getCurrentSession();
  const role = activeSession.role;

  switch (action) {
    case 'CAPTURE_INCIDENT':
    case 'INSPECT_AI_RESULT':
    case 'OPERATOR_REVIEW':
    case 'ACKNOWLEDGE_INCIDENT':
      return [AUTH_ROLES.FIELD_OPERATOR, AUTH_ROLES.SUPERVISOR, AUTH_ROLES.ADMIN].includes(role);

    case 'UPDATE_FIELD_LIFECYCLE':
      // Field operators can acknowledge and flag action required
      return [AUTH_ROLES.FIELD_OPERATOR, AUTH_ROLES.SUPERVISOR, AUTH_ROLES.ADMIN].includes(role);

    case 'UPDATE_ADVANCED_LIFECYCLE':
      // Progressing to IN_PROGRESS or RESOLVED requires supervisor or admin sign-off
      return [AUTH_ROLES.SUPERVISOR, AUTH_ROLES.ADMIN].includes(role);

    case 'APPROVE_DISPATCH':
    case 'DISPATCH_WORK_ORDER':
      // Supervisors and Admins authorize municipal dispatch for high-risk hazards
      return [AUTH_ROLES.SUPERVISOR, AUTH_ROLES.ADMIN].includes(role);

    case 'UPDATE_PRIORITY':
    case 'OVERRIDE_SEVERITY':
      return [AUTH_ROLES.SUPERVISOR, AUTH_ROLES.ADMIN].includes(role);

    case 'CONFIGURE_INTEGRATION':
    case 'CONFIGURE_BOUNDARIES':
    case 'CLEAR_OFFLINE_QUEUE':
      return role === AUTH_ROLES.ADMIN;

    default:
      return false;
  }
}
