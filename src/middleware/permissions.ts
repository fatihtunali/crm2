/**
 * Permission Middleware
 * Enforces role-based access control (RBAC) for API endpoints
 *
 * SECURITY: Permission checks are performed on every request and are
 * cached in-memory for performance. Cache is invalidated every 5 minutes
 * to ensure permission changes take effect reasonably quickly.
 *
 * @module middleware/permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Problem } from '@/types/api';
import { requireTenant, type TenantContext } from './tenancy';
import { query } from '@/lib/db';
import {
  type Permissions,
  type Resource,
  type Action,
  checkResourcePermission,
  mergePermissions,
  parsePermissions,
} from '@/lib/rbac';
import { authorizationErrorResponse } from '@/lib/response';
import { getRequestId } from './correlation';

/**
 * Permission check result with user context
 */
export interface PermissionContext extends TenantContext {
  allowed: true;
  permissions: Permissions;
}

/**
 * Permission cache entry
 */
interface PermissionCacheEntry {
  permissions: Permissions;
  timestamp: number;
}

/**
 * In-memory permission cache
 * Maps userId -> PermissionCacheEntry
 * TTL: 5 minutes (300,000 ms)
 */
const permissionCache = new Map<number, PermissionCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Clear expired cache entries
 * Called before each cache check to prevent unbounded growth
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [userId, entry] of permissionCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      permissionCache.delete(userId);
    }
  }
}

/**
 * Get permissions from cache or database
 *
 * @param userId - User ID to get permissions for
 * @param tenantId - Tenant ID to scope permissions to
 * @returns Merged permissions object
 */
async function getUserPermissions(
  userId: number,
  tenantId: string
): Promise<Permissions> {
  // Clean expired cache entries
  cleanExpiredCache();

  // Check cache first
  const cached = permissionCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  // Query database for user's roles and permissions
  // Joins user_roles -> roles to get all permissions for the user
  const roles = await query<{ permissions: string }>(
    `SELECT r.permissions
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?
     AND r.organization_id = ?`,
    [userId, tenantId]
  );

  // If user has no roles, return empty permissions
  if (roles.length === 0) {
    const emptyPermissions: Permissions = {};
    permissionCache.set(userId, {
      permissions: emptyPermissions,
      timestamp: Date.now(),
    });
    return emptyPermissions;
  }

  // Parse and merge all role permissions
  const permissionsArray: Permissions[] = [];
  for (const role of roles) {
    const parsed = parsePermissions(role.permissions);
    if (parsed) {
      permissionsArray.push(parsed);
    }
  }

  // Merge all permissions with OR logic
  const mergedPermissions = mergePermissions(permissionsArray);

  // Cache the result
  permissionCache.set(userId, {
    permissions: mergedPermissions,
    timestamp: Date.now(),
  });

  return mergedPermissions;
}

/**
 * Check if a user has a specific permission
 * Helper function used internally by requirePermission
 *
 * @param userId - User ID to check
 * @param tenantId - Tenant ID to scope check to
 * @param resource - Resource type (e.g., 'quotations')
 * @param action - Action type (e.g., 'read', 'create')
 * @returns True if user has the permission
 *
 * @example
 * const allowed = await hasPermission(1, '1', 'quotations', 'create');
 */
export async function hasPermission(
  userId: number,
  tenantId: string,
  resource: Resource,
  action: Action
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, tenantId);
  return checkResourcePermission(permissions, resource, action);
}

/**
 * Clear permission cache for a specific user
 * Call this when a user's roles or permissions change
 *
 * @param userId - User ID to clear cache for
 *
 * @example
 * clearUserPermissionCache(123);
 */
export function clearUserPermissionCache(userId: number): void {
  permissionCache.delete(userId);
}

/**
 * Clear all permission cache
 * Call this when roles or permissions are updated globally
 *
 * @example
 * clearAllPermissionCache();
 */
export function clearAllPermissionCache(): void {
  permissionCache.clear();
}

/**
 * Require permission for a resource action
 * Validates authentication, tenant context, and specific permission
 *
 * USAGE:
 * ```typescript
 * const authResult = await requirePermission(request, 'quotations', 'delete');
 * if ('error' in authResult) {
 *   return authResult.error;
 * }
 * const { user, tenantId, allowed } = authResult;
 * // Proceed with operation
 * ```
 *
 * @param request - Next.js request object
 * @param resource - Resource type being accessed
 * @param action - Action being performed
 * @returns Permission context with user/tenant or error response
 *
 * @example
 * // In an API route handler
 * export async function DELETE(request: NextRequest) {
 *   const authResult = await requirePermission(request, 'quotations', 'delete');
 *   if ('error' in authResult) {
 *     return authResult.error;
 *   }
 *
 *   const { user, tenantId } = authResult;
 *   // User is authorized, proceed with deletion
 *   await deleteQuotation(id, tenantId);
 *   return noContentResponse();
 * }
 */
export async function requirePermission(
  request: NextRequest,
  resource: Resource,
  action: Action
): Promise<PermissionContext | { error: NextResponse }> {
  const requestId = getRequestId(request);

  // First, require authentication and tenant context
  const tenantResult = await requireTenant(request);

  if ('error' in tenantResult) {
    // Return the authentication/tenant error as NextResponse
    return {
      error: NextResponse.json(tenantResult.error, {
        status: tenantResult.error.status,
        headers: {
          'Content-Type': 'application/problem+json',
          'X-Request-Id': requestId,
        },
      }),
    };
  }

  const { user, tenantId } = tenantResult;

  // Get user's permissions
  const permissions = await getUserPermissions(user.userId, tenantId);

  // Check if user has the required permission
  const allowed = checkResourcePermission(permissions, resource, action);

  if (!allowed) {
    return {
      error: authorizationErrorResponse(
        `You do not have permission to ${action} ${resource}`,
        requestId
      ),
    };
  }

  // User has permission, return context
  return {
    user,
    tenantId,
    allowed: true,
    permissions,
  };
}

/**
 * Require any of multiple permissions (OR logic)
 * User needs at least one of the specified permissions
 *
 * @param request - Next.js request object
 * @param checks - Array of resource/action pairs to check
 * @returns Permission context or error response
 *
 * @example
 * // User needs either quotations.read OR quotations.create
 * const authResult = await requireAnyPermission(request, [
 *   { resource: 'quotations', action: 'read' },
 *   { resource: 'quotations', action: 'create' },
 * ]);
 */
export async function requireAnyPermission(
  request: NextRequest,
  checks: Array<{ resource: Resource; action: Action }>
): Promise<PermissionContext | { error: NextResponse }> {
  const requestId = getRequestId(request);

  // First, require authentication and tenant context
  const tenantResult = await requireTenant(request);

  if ('error' in tenantResult) {
    return {
      error: NextResponse.json(tenantResult.error, {
        status: tenantResult.error.status,
        headers: {
          'Content-Type': 'application/problem+json',
          'X-Request-Id': requestId,
        },
      }),
    };
  }

  const { user, tenantId } = tenantResult;

  // Get user's permissions
  const permissions = await getUserPermissions(user.userId, tenantId);

  // Check if user has ANY of the required permissions
  let allowed = false;
  for (const check of checks) {
    if (checkResourcePermission(permissions, check.resource, check.action)) {
      allowed = true;
      break;
    }
  }

  if (!allowed) {
    const permissionsDesc = checks
      .map((c) => `${c.action} ${c.resource}`)
      .join(' OR ');

    return {
      error: authorizationErrorResponse(
        `You do not have permission to perform this action. Required: ${permissionsDesc}`,
        requestId
      ),
    };
  }

  // User has at least one permission
  return {
    user,
    tenantId,
    allowed: true,
    permissions,
  };
}

/**
 * Require all of multiple permissions (AND logic)
 * User needs all specified permissions
 *
 * @param request - Next.js request object
 * @param checks - Array of resource/action pairs to check
 * @returns Permission context or error response
 *
 * @example
 * // User needs both quotations.read AND quotations.update
 * const authResult = await requireAllPermissions(request, [
 *   { resource: 'quotations', action: 'read' },
 *   { resource: 'quotations', action: 'update' },
 * ]);
 */
export async function requireAllPermissions(
  request: NextRequest,
  checks: Array<{ resource: Resource; action: Action }>
): Promise<PermissionContext | { error: NextResponse }> {
  const requestId = getRequestId(request);

  // First, require authentication and tenant context
  const tenantResult = await requireTenant(request);

  if ('error' in tenantResult) {
    return {
      error: NextResponse.json(tenantResult.error, {
        status: tenantResult.error.status,
        headers: {
          'Content-Type': 'application/problem+json',
          'X-Request-Id': requestId,
        },
      }),
    };
  }

  const { user, tenantId } = tenantResult;

  // Get user's permissions
  const permissions = await getUserPermissions(user.userId, tenantId);

  // Check if user has ALL required permissions
  const missingPermissions: string[] = [];
  for (const check of checks) {
    if (!checkResourcePermission(permissions, check.resource, check.action)) {
      missingPermissions.push(`${check.action} ${check.resource}`);
    }
  }

  if (missingPermissions.length > 0) {
    return {
      error: authorizationErrorResponse(
        `You do not have all required permissions. Missing: ${missingPermissions.join(', ')}`,
        requestId
      ),
    };
  }

  // User has all permissions
  return {
    user,
    tenantId,
    allowed: true,
    permissions,
  };
}

/**
 * Get permission cache statistics
 * Useful for monitoring and debugging
 *
 * @returns Cache statistics
 */
export function getPermissionCacheStats() {
  cleanExpiredCache();
  return {
    size: permissionCache.size,
    ttl: CACHE_TTL,
    entries: Array.from(permissionCache.entries()).map(([userId, entry]) => ({
      userId,
      age: Date.now() - entry.timestamp,
      permissionCount: Object.keys(entry.permissions).length,
    })),
  };
}
