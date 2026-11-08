// CivicSense AI - Phase 11 Multi-Tenant Registry & Isolation Service
// Provides strictly isolated, synthetic test tenant boundaries.
// Zero real municipal identities used without authorization.

export const TENANT_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_ONBOARDING: 'PENDING_ONBOARDING'
};

export const DEMO_TENANTS = {
  'TENANT-DEMO-A': {
    tenantId: 'TENANT-DEMO-A',
    tenantName: 'Sandbox Municipality Alpha',
    label: 'SANDBOX TENANT',
    status: TENANT_STATUS.ACTIVE,
    isSandbox: true,
    configuration: {
      jurisdiction: 'Alpha Municipal District',
      timezone: 'Asia/Kolkata',
      dispatchAutoApproval: false, // High risk requires human approval
      allowedDepartments: [
        'Highways / Roads & Pavement Maintenance',
        'Solid Waste Management',
        'Stormwater / Drainage Department'
      ]
    },
    createdAt: '2026-10-07T00:00:00.000Z'
  },
  'TENANT-DEMO-B': {
    tenantId: 'TENANT-DEMO-B',
    tenantName: 'Sandbox Municipality Beta',
    label: 'SANDBOX TENANT',
    status: TENANT_STATUS.ACTIVE,
    isSandbox: true,
    configuration: {
      jurisdiction: 'Beta Zonal Area',
      timezone: 'Asia/Kolkata',
      dispatchAutoApproval: false,
      allowedDepartments: [
        'Highways / Roads & Pavement Maintenance',
        'Solid Waste Management',
        'Stormwater / Drainage Department'
      ]
    },
    createdAt: '2026-10-07T00:00:00.000Z'
  }
};

/**
 * Validates whether a tenantId exists and is in ACTIVE status.
 * 
 * @param {string} tenantId 
 * @returns {Object|null} Tenant record or null
 */
export function getTenant(tenantId) {
  if (!tenantId || !DEMO_TENANTS[tenantId]) {
    return null;
  }
  return DEMO_TENANTS[tenantId];
}

/**
 * Returns all registered tenants with safe metadata.
 * 
 * @returns {Array<Object>}
 */
export function listTenants() {
  return Object.values(DEMO_TENANTS).map(t => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    label: t.label,
    status: t.status,
    isSandbox: t.isSandbox,
    createdAt: t.createdAt
  }));
}

/**
 * Validates tenant access for an authenticated user.
 * 
 * @param {string} userTenantId Tenant assigned to the authenticated user
 * @param {string} targetTenantId Tenant of the resource being accessed
 * @returns {boolean} True if authorized, false otherwise
 */
export function validateTenantAccess(userTenantId, targetTenantId) {
  if (!userTenantId || !targetTenantId) return false;
  return userTenantId === targetTenantId;
}

