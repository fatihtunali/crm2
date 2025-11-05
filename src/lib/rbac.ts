/**
 * RBAC Utilities
 * Core utilities for Role-Based Access Control
 * Provides permission validation, merging, and default configurations
 *
 * @module lib/rbac
 */

/**
 * Permission structure for a single resource
 */
export interface ResourcePermissions {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
}

/**
 * Complete permissions object mapping resources to actions
 */
export interface Permissions {
  [resource: string]: ResourcePermissions;
}

/**
 * Resource types available in the system
 */
export const RESOURCES = {
  QUOTATIONS: 'quotations',
  CLIENTS: 'clients',
  INVOICES: 'invoices',
  USERS: 'users',
  REPORTS: 'reports',
  BOOKINGS: 'bookings',
  ROLES: 'roles',
  AUDIT_LOGS: 'audit_logs',
  WILDCRAD: '*', // Super admin wildcard
} as const;

/**
 * Action types available for resources
 */
export const ACTIONS = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export type Resource = typeof RESOURCES[keyof typeof RESOURCES];
export type Action = typeof ACTIONS[keyof typeof ACTIONS];

/**
 * Check if permissions include wildcard access
 * Wildcard grants all permissions for all resources
 *
 * @param permissions - Permissions object to check
 * @param action - Specific action to check wildcard for
 * @returns True if wildcard grants the action
 *
 * @example
 * checkWildcardPermission({ "*": { read: true, create: true }}, 'read') // true
 * checkWildcardPermission({ "*": { read: false }}, 'read') // false
 */
export function checkWildcardPermission(
  permissions: Permissions,
  action: Action
): boolean {
  const wildcardPerms = permissions[RESOURCES.WILDCRAD];
  if (!wildcardPerms) return false;

  return wildcardPerms[action] === true;
}

/**
 * Check if a specific resource action is permitted
 * Checks both wildcard and specific resource permissions
 *
 * @param permissions - Permissions object to check
 * @param resource - Resource type to check
 * @param action - Action to check
 * @returns True if the action is permitted
 *
 * @example
 * checkResourcePermission(perms, 'quotations', 'read') // true/false
 */
export function checkResourcePermission(
  permissions: Permissions,
  resource: Resource,
  action: Action
): boolean {
  // Check wildcard first
  if (checkWildcardPermission(permissions, action)) {
    return true;
  }

  // Check specific resource
  const resourcePerms = permissions[resource];
  if (!resourcePerms) return false;

  return resourcePerms[action] === true;
}

/**
 * Validate that permissions object has correct structure
 * Ensures JSON structure follows expected format
 *
 * @param permissions - Permissions object to validate
 * @returns Object with isValid flag and error message if invalid
 *
 * @example
 * validatePermissionsStructure(perms)
 * // { isValid: true } or { isValid: false, error: "..." }
 */
export function validatePermissionsStructure(
  permissions: any
): { isValid: boolean; error?: string } {
  // Must be an object
  if (typeof permissions !== 'object' || permissions === null) {
    return {
      isValid: false,
      error: 'Permissions must be an object',
    };
  }

  // Check each resource
  for (const [resource, actions] of Object.entries(permissions)) {
    // Resource must map to an object
    if (typeof actions !== 'object' || actions === null) {
      return {
        isValid: false,
        error: `Resource "${resource}" must map to an actions object`,
      };
    }

    // Each action must be a boolean
    for (const [action, value] of Object.entries(actions as object)) {
      if (typeof value !== 'boolean') {
        return {
          isValid: false,
          error: `Action "${action}" for resource "${resource}" must be a boolean`,
        };
      }

      // Validate known actions
      if (
        action !== 'read' &&
        action !== 'create' &&
        action !== 'update' &&
        action !== 'delete'
      ) {
        return {
          isValid: false,
          error: `Unknown action "${action}" for resource "${resource}"`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Merge multiple permission objects into one
 * Used when a user has multiple roles
 * Uses OR logic - if any role grants permission, it's granted
 *
 * @param permissionsArray - Array of permission objects to merge
 * @returns Merged permissions object
 *
 * @example
 * const merged = mergePermissions([
 *   { quotations: { read: true }},
 *   { quotations: { create: true }},
 * ]);
 * // Result: { quotations: { read: true, create: true }}
 */
export function mergePermissions(
  permissionsArray: Permissions[]
): Permissions {
  const merged: Permissions = {};

  for (const permissions of permissionsArray) {
    for (const [resource, actions] of Object.entries(permissions)) {
      if (!merged[resource]) {
        merged[resource] = {};
      }

      // Merge actions with OR logic
      for (const [action, value] of Object.entries(actions)) {
        if (value === true) {
          merged[resource][action as Action] = true;
        }
      }
    }
  }

  return merged;
}

/**
 * Default permission sets for common roles
 * Can be used as templates when creating new roles
 */
export const DEFAULT_PERMISSIONS = {
  /**
   * Super Admin - Full access to everything
   */
  SUPER_ADMIN: {
    '*': {
      read: true,
      create: true,
      update: true,
      delete: true,
    },
  } as Permissions,

  /**
   * Admin - Organizational administrator
   */
  ADMIN: {
    quotations: { read: true, create: true, update: true, delete: true },
    clients: { read: true, create: true, update: true, delete: true },
    invoices: { read: true, create: true, update: true, delete: true },
    bookings: { read: true, create: true, update: true, delete: true },
    reports: { read: true },
    users: { read: true, create: true, update: true },
    roles: { read: true },
  } as Permissions,

  /**
   * Agent - Sales agent with limited access
   */
  AGENT: {
    quotations: { read: true, create: true, update: true, delete: false },
    clients: { read: true, create: true, update: true, delete: false },
    bookings: { read: true, create: true, update: true, delete: false },
    reports: { read: true },
  } as Permissions,

  /**
   * User - Basic read-only user
   */
  USER: {
    quotations: { read: true },
    clients: { read: true },
    bookings: { read: true },
    reports: { read: true },
  } as Permissions,

  /**
   * Viewer - Read-only access to reports
   */
  VIEWER: {
    reports: { read: true },
  } as Permissions,
} as const;

/**
 * Get a formatted permissions summary
 * Useful for displaying user capabilities
 *
 * @param permissions - Permissions object to summarize
 * @returns Array of permission strings
 *
 * @example
 * getPermissionsSummary(perms)
 * // ['quotations.read', 'quotations.create', 'clients.read']
 */
export function getPermissionsSummary(permissions: Permissions): string[] {
  const summary: string[] = [];

  for (const [resource, actions] of Object.entries(permissions)) {
    for (const [action, value] of Object.entries(actions)) {
      if (value === true) {
        summary.push(`${resource}.${action}`);
      }
    }
  }

  return summary.sort();
}

/**
 * Parse permissions from JSON string
 * Safely parses and validates permissions from database
 *
 * @param json - JSON string to parse
 * @returns Parsed permissions or null if invalid
 */
export function parsePermissions(json: string): Permissions | null {
  try {
    const parsed = JSON.parse(json);
    const validation = validatePermissionsStructure(parsed);

    if (!validation.isValid) {
      console.error('Invalid permissions structure:', validation.error);
      return null;
    }

    return parsed as Permissions;
  } catch (error) {
    console.error('Failed to parse permissions JSON:', error);
    return null;
  }
}
