// CivicSense AI - Authentication & Enterprise Identity Federation Service (Phase 12)
// Multi-tenant authentication boundary supporting Sandbox & Enterprise OpenID Connect (OIDC).
// Roles: SUPER_ADMIN, TENANT_ADMIN, SUPERVISOR, OPERATOR, AUDITOR, READ_ONLY.
// ZERO Math.random() – Fully deterministic session state. Zero plaintext passwords stored.

export const AUTH_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  OPERATOR: 'OPERATOR',
  AUDITOR: 'AUDITOR',
  READ_ONLY: 'READ_ONLY',
  // Backward-compatible Phase 11 aliases
  ADMIN: 'TENANT_ADMIN',
  FIELD_OPERATOR: 'OPERATOR'
};

export const AUTH_MODES = {
  SANDBOX: 'SANDBOX',
  OIDC: 'OIDC'
};

export const AUTH_TYPE = 'AUTHENTICATION: SANDBOX';

export const DEMO_ACCOUNTS = [
  // Tenant A Accounts (Alpha Sandbox Municipality)
  {
    userId: 'OP-DEMO-A-01',
    role: AUTH_ROLES.OPERATOR,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'R. Kumar (Field Technician)',
    department: 'Zone 1 Engineering & Works',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — OPERATOR (TENANT-A)'
  },
  {
    userId: 'SUP-DEMO-A-01',
    role: AUTH_ROLES.SUPERVISOR,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'S. Meenakshi (Zonal Dispatch Supervisor)',
    department: 'Alpha Command Center',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — SUPERVISOR (TENANT-A)'
  },
  {
    userId: 'ADM-DEMO-A-01',
    role: AUTH_ROLES.TENANT_ADMIN,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'Dr. A. Ramanathan (Spatial & Systems Administrator)',
    department: 'Alpha Municipal IT & Operations',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — TENANT ADMIN (TENANT-A)'
  },
  {
    userId: 'AUD-DEMO-A-01',
    role: AUTH_ROLES.AUDITOR,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'M. Shanthi (Compliance Auditor)',
    department: 'Municipal Oversight & Transparency',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — AUDITOR (TENANT-A)'
  },
  {
    userId: 'RO-DEMO-A-01',
    role: AUTH_ROLES.READ_ONLY,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'K. Priya (Civic Observer)',
    department: 'Public Information Desk',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — READ-ONLY'
  },
  {
    userId: 'SUPER-ADMIN-01',
    role: AUTH_ROLES.SUPER_ADMIN,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Central Mission Directorate',
    tenantLabel: 'PLATFORM GOVERNANCE',
    displayName: 'Central Platform Architect',
    department: 'State Smart City Mission Directorate',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — SUPER ADMIN'
  },

  // Tenant B Accounts (Beta Sandbox Municipality - Strict Isolation)
  {
    userId: 'OP-DEMO-B-01',
    role: AUTH_ROLES.OPERATOR,
    tenantId: 'TENANT-DEMO-B',
    tenantName: 'Sandbox Municipality Beta',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'V. Anand (Field Technician)',
    department: 'Zone 2 Maintenance Division',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — OPERATOR (TENANT-B)'
  },
  {
    userId: 'SUP-DEMO-B-01',
    role: AUTH_ROLES.SUPERVISOR,
    tenantId: 'TENANT-DEMO-B',
    tenantName: 'Sandbox Municipality Beta',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'P. Lakshmi (Zonal Dispatch Supervisor)',
    department: 'Beta Command Center',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — SUPERVISOR (TENANT-B)'
  },
  {
    userId: 'ADM-DEMO-B-01',
    role: AUTH_ROLES.TENANT_ADMIN,
    tenantId: 'TENANT-DEMO-B',
    tenantName: 'Sandbox Municipality Beta',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'K. Suresh (Spatial & Systems Administrator)',
    department: 'Beta Municipal IT & Operations',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — TENANT ADMIN (TENANT-B)'
  },

  // Legacy mappings for Phase 10 demo compatibility
  {
    userId: 'OP-CHENNAI-402',
    role: AUTH_ROLES.OPERATOR,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'R. Kumar (Field Technician)',
    department: 'Zone 13 Engineering & Works',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — OPERATOR'
  },
  {
    userId: 'SUP-CHENNAI-108',
    role: AUTH_ROLES.SUPERVISOR,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'S. Meenakshi (Zonal Dispatch Supervisor)',
    department: 'Greater Chennai Corporation Command Center',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — SUPERVISOR'
  },
  {
    userId: 'ADM-CHENNAI-001',
    role: AUTH_ROLES.TENANT_ADMIN,
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    tenantLabel: 'SANDBOX TENANT',
    displayName: 'Dr. A. Ramanathan (Spatial & Systems Administrator)',
    department: 'Municipal IT & Smart City Operations',
    isDemoAccount: true,
    accountLabel: 'DEMO ACCOUNT — TENANT ADMIN'
  }
];

const SESSION_STORAGE_KEY = 'civicsense_operator_session';

/**
 * Returns the current active session.
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
      console.warn('[AUTH_SESSION_NOTICE] Could not read session from storage, falling back to default.');
    }
  }

  // Default active session: Operator on Tenant A
  const defaultAcc = DEMO_ACCOUNTS[0];
  return {
    userId: defaultAcc.userId,
    role: defaultAcc.role,
    tenantId: defaultAcc.tenantId,
    tenantName: defaultAcc.tenantName,
    tenantLabel: defaultAcc.tenantLabel,
    displayName: defaultAcc.displayName,
    department: defaultAcc.department,
    loginTime: '2026-10-07T08:00:00.000Z',
    sessionStatus: 'ACTIVE',
    isDemoAccount: true,
    accountLabel: defaultAcc.accountLabel,
    authMode: AUTH_MODES.SANDBOX,
    authType: AUTH_TYPE,
    oidcStatus: 'NOT CONFIGURED'
  };
}

/**
 * Switches the active session to another predefined demo account.
 */
export function switchActiveSession(userId) {
  const account = DEMO_ACCOUNTS.find(a => a.userId === userId) || DEMO_ACCOUNTS[0];
  const newSession = {
    userId: account.userId,
    role: account.role,
    tenantId: account.tenantId,
    tenantName: account.tenantName,
    tenantLabel: account.tenantLabel,
    displayName: account.displayName,
    department: account.department,
    loginTime: new Date().toISOString(),
    sessionStatus: 'ACTIVE',
    isDemoAccount: true,
    accountLabel: account.accountLabel,
    authMode: AUTH_MODES.SANDBOX,
    authType: AUTH_TYPE,
    oidcStatus: 'NOT CONFIGURED'
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.warn('[AUTH_STORAGE_NOTICE] Could not persist session:', e);
    }
  }

  return newSession;
}

/**
 * Returns current authentication mode.
 */
export function getAuthMode() {
  return AUTH_MODES.SANDBOX;
}

/**
 * Validates whether the active session holds permission to perform an action.
 */
export function hasPermission(action, session = null) {
  const activeSession = session || getCurrentSession();
  const role = activeSession.role;

  switch (action) {
    case 'CAPTURE_INCIDENT':
    case 'INSPECT_AI_RESULT':
    case 'OPERATOR_REVIEW':
    case 'ACKNOWLEDGE_INCIDENT':
      return [
        AUTH_ROLES.OPERATOR, 
        AUTH_ROLES.SUPERVISOR, 
        AUTH_ROLES.TENANT_ADMIN, 
        AUTH_ROLES.SUPER_ADMIN,
        'ADMIN',
        'FIELD_OPERATOR'
      ].includes(role);

    case 'UPDATE_FIELD_LIFECYCLE':
      return [
        AUTH_ROLES.OPERATOR, 
        AUTH_ROLES.SUPERVISOR, 
        AUTH_ROLES.TENANT_ADMIN, 
        AUTH_ROLES.SUPER_ADMIN,
        'ADMIN',
        'FIELD_OPERATOR'
      ].includes(role);

    case 'UPDATE_ADVANCED_LIFECYCLE':
    case 'APPROVE_DISPATCH':
    case 'DISPATCH_WORK_ORDER':
    case 'UPDATE_PRIORITY':
    case 'OVERRIDE_SEVERITY':
      return [
        AUTH_ROLES.SUPERVISOR, 
        AUTH_ROLES.TENANT_ADMIN, 
        AUTH_ROLES.SUPER_ADMIN,
        'ADMIN'
      ].includes(role);

    case 'CONFIGURE_INTEGRATION':
    case 'CONFIGURE_BOUNDARIES':
    case 'CLEAR_OFFLINE_QUEUE':
    case 'MANAGE_TENANTS':
    case 'EXPORT_DATA':
      return [
        AUTH_ROLES.TENANT_ADMIN, 
        AUTH_ROLES.SUPER_ADMIN,
        'ADMIN'
      ].includes(role);

    case 'VIEW_AUDIT_LOGS':
    case 'VERIFY_AUDIT_CHAIN':
      return [
        AUTH_ROLES.AUDITOR, 
        AUTH_ROLES.SUPERVISOR, 
        AUTH_ROLES.TENANT_ADMIN, 
        AUTH_ROLES.SUPER_ADMIN,
        'ADMIN'
      ].includes(role);

    default:
      return false;
  }
}
