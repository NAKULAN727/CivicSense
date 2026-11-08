// CivicSense AI - Phase 12 Role-Based Access Control (RBAC) Service
// 6-Tier Role Permission Enforcement & Privilege Escalation Prevention.

import { AUTH_ROLES, ROLE_PERMISSIONS, ERROR_CODES } from '../config/constants.js';

const ROLE_HIERARCHY = {
  [AUTH_ROLES.SUPER_ADMIN]: 60,
  [AUTH_ROLES.TENANT_ADMIN]: 50,
  [AUTH_ROLES.SUPERVISOR]: 40,
  [AUTH_ROLES.OPERATOR]: 30,
  [AUTH_ROLES.AUDITOR]: 20,
  [AUTH_ROLES.READ_ONLY]: 10,
  // Backward compatibility
  'ADMIN': 50,
  'FIELD_OPERATOR': 30
};

/**
 * Checks whether a given role possesses a specific permission.
 */
export function roleHasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(permission);
}

/**
 * Checks if a user has all required permissions.
 */
export function checkUserPermissions(user, requiredPermissions) {
  if (!user || !user.role) return false;
  const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  return perms.every(p => roleHasPermission(user.role, p));
}

/**
 * Returns the complete list of authorized permissions for a role.
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Privilege Escalation Prevention:
 * Validates whether an actor role has authority to assign or promote a target role.
 * 
 * Rules:
 * 1. An actor can NEVER assign a role higher than or equal to their own level,
 *    except SUPER_ADMIN which has global authority.
 * 2. TENANT_ADMIN can only assign SUPERVISOR, OPERATOR, AUDITOR, or READ_ONLY.
 * 3. Non-admin roles (SUPERVISOR, OPERATOR, AUDITOR, READ_ONLY) cannot assign any roles.
 */
export function canAssignRole(actorRole, targetRole) {
  if (!actorRole || !targetRole) return false;

  const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;

  if (actorRole === AUTH_ROLES.SUPER_ADMIN) {
    return true; // Super admin can provision any role
  }

  if (actorRole === AUTH_ROLES.TENANT_ADMIN || actorRole === 'ADMIN') {
    // Tenant admin can only assign roles lower than TENANT_ADMIN
    return targetLevel < ROLE_HIERARCHY[AUTH_ROLES.TENANT_ADMIN];
  }

  return false;
}

/**
 * Enforces prevention of self-privilege escalation.
 * Throws an error if an actor attempts to grant themselves a higher role.
 */
export function validateRoleAssignment(actor, targetUserId, newRole) {
  if (!actor || !actor.role) {
    const err = new Error('Authentication required to perform role assignment.');
    err.status = 401;
    err.code = ERROR_CODES.UNAUTHENTICATED;
    throw err;
  }

  // Self-escalation check
  if (actor.userId === targetUserId && (ROLE_HIERARCHY[newRole] || 0) > (ROLE_HIERARCHY[actor.role] || 0)) {
    const err = new Error(
      `PRIVILEGE_ESCALATION_DENIED: User '${actor.userId}' cannot escalate their own role from '${actor.role}' to '${newRole}'.`
    );
    err.status = 403;
    err.code = ERROR_CODES.PRIVILEGE_ESCALATION_DENIED;
    throw err;
  }

  if (!canAssignRole(actor.role, newRole)) {
    const err = new Error(
      `PRIVILEGE_ESCALATION_DENIED: Role '${actor.role}' lacks authority to assign role '${newRole}'.`
    );
    err.status = 403;
    err.code = ERROR_CODES.PRIVILEGE_ESCALATION_DENIED;
    throw err;
  }

  return true;
}
