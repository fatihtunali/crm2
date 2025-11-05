/**
 * Permission Middleware - Usage Examples
 *
 * This file demonstrates various ways to use the RBAC permission system
 * in your API routes. Copy these patterns to your endpoints.
 *
 * @module middleware/permissions.example
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  hasPermission
} from './permissions';
import { query } from '@/lib/db';
import { getRequestId, logResponse } from './correlation';
import {
  standardErrorResponse,
  notFoundErrorResponse,
  ErrorCodes
} from '@/lib/response';

// ============================================
// EXAMPLE 1: Single Permission Check
// ============================================

/**
 * DELETE endpoint - requires specific delete permission
 * Most common pattern for protected endpoints
 */
export async function DELETE_Example(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // Check if user has delete permission for quotations
    const authResult = await requirePermission(request, 'quotations', 'delete');

    // If permission check fails, return the error response
    if ('error' in authResult) {
      return authResult.error;
    }

    // User is authorized, extract context
    const { user, tenantId, permissions } = authResult;

    // Proceed with the operation
    const [item] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    ) as any[];

    if (!item) {
      return notFoundErrorResponse(`Quote ${id} not found`, requestId);
    }

    await query(
      'DELETE FROM quotes WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    );

    logResponse(requestId, 204, Date.now() - startTime, {
      quotation_id: id,
      deleted_by: user.userId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete quotation',
      500,
      undefined,
      requestId
    );
  }
}

// ============================================
// EXAMPLE 2: OR Logic - Any Permission
// ============================================

/**
 * GET endpoint - requires either read OR create permission
 * Useful when multiple permission levels can access the same data
 */
export async function GET_Example_OR(request: NextRequest) {
  const requestId = getRequestId(request);

  // User needs EITHER read OR create permission
  const authResult = await requireAnyPermission(request, [
    { resource: 'quotations', action: 'read' },
    { resource: 'quotations', action: 'create' },
  ]);

  if ('error' in authResult) {
    return authResult.error;
  }

  const { tenantId } = authResult;

  // Proceed with read operation
  const quotes = await query(
    'SELECT * FROM quotes WHERE organization_id = ?',
    [tenantId]
  );

  return NextResponse.json(quotes);
}

// ============================================
// EXAMPLE 3: AND Logic - All Permissions
// ============================================

/**
 * PATCH endpoint - requires both read AND update permissions
 * Useful for operations that need multiple permission levels
 */
export async function PATCH_Example_AND(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);

  const { id } = await params;

  // User needs BOTH read AND update permissions
  const authResult = await requireAllPermissions(request, [
    { resource: 'quotations', action: 'read' },
    { resource: 'quotations', action: 'update' },
  ]);

  if ('error' in authResult) {
    return authResult.error;
  }

  const { tenantId } = authResult;
  const body = await request.json();

  // Proceed with update
  await query(
    'UPDATE quotes SET quote_name = ? WHERE id = ? AND organization_id = ?',
    [body.quote_name, id, tenantId]
  );

  const [updated] = await query(
    'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
    [id, tenantId]
  ) as any[];

  return NextResponse.json(updated);
}

// ============================================
// EXAMPLE 4: Conditional Logic Based on Permissions
// ============================================

/**
 * GET endpoint with conditional filtering based on permissions
 * Shows different data based on user's permission level
 */
export async function GET_Example_Conditional(request: NextRequest) {
  const requestId = getRequestId(request);

  // Check for read permission (minimum required)
  const authResult = await requirePermission(request, 'quotations', 'read');

  if ('error' in authResult) {
    return authResult.error;
  }

  const { user, tenantId, permissions } = authResult;

  // Use hasPermission to check additional permissions for conditional logic
  const canViewAll = await hasPermission(
    user.userId,
    tenantId,
    'quotations',
    'update'
  );

  let quotes;
  if (canViewAll) {
    // User with update permission sees all quotes
    quotes = await query(
      'SELECT * FROM quotes WHERE organization_id = ?',
      [tenantId]
    );
  } else {
    // User with only read permission sees their own quotes
    quotes = await query(
      'SELECT * FROM quotes WHERE organization_id = ? AND created_by = ?',
      [tenantId, user.userId]
    );
  }

  return NextResponse.json(quotes);
}

// ============================================
// EXAMPLE 5: Cross-Resource Permission Check
// ============================================

/**
 * POST endpoint that creates a quotation and assigns to a client
 * Requires permissions for multiple resources
 */
export async function POST_Example_MultiResource(request: NextRequest) {
  const requestId = getRequestId(request);
  const body = await request.json();

  // Check quotation creation permission first
  const quotationAuth = await requirePermission(
    request,
    'quotations',
    'create'
  );

  if ('error' in quotationAuth) {
    return quotationAuth.error;
  }

  const { user, tenantId } = quotationAuth;

  // If assigning to a client, check client permissions too
  if (body.client_id) {
    const canAccessClient = await hasPermission(
      user.userId,
      tenantId,
      'clients',
      'read'
    );

    if (!canAccessClient) {
      return standardErrorResponse(
        ErrorCodes.AUTHORIZATION_FAILED,
        'You do not have permission to assign quotations to clients',
        403,
        undefined,
        requestId
      );
    }
  }

  // Proceed with creation
  const result = await query(
    'INSERT INTO quotes (organization_id, client_id, created_by) VALUES (?, ?, ?)',
    [tenantId, body.client_id, user.userId]
  ) as any;

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}

// ============================================
// EXAMPLE 6: Permission-Based Response Filtering
// ============================================

/**
 * GET endpoint that filters response fields based on permissions
 * Shows how to customize responses based on user capabilities
 */
export async function GET_Example_FilteredResponse(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Require basic read permission
  const authResult = await requirePermission(request, 'quotations', 'read');

  if ('error' in authResult) {
    return authResult.error;
  }

  const { user, tenantId } = authResult;

  const [quote] = await query(
    'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
    [id, tenantId]
  ) as any[];

  if (!quote) {
    return notFoundErrorResponse(`Quote ${id} not found`);
  }

  // Check if user can see financial details
  const canViewFinancials = await hasPermission(
    user.userId,
    tenantId,
    'reports',
    'read'
  );

  // Filter response based on permissions
  const response = {
    id: quote.id,
    quote_name: quote.quote_name,
    customer_name: quote.customer_name,
    status: quote.status,
    // Only include financial data if user has reports.read permission
    ...(canViewFinancials && {
      total_price: quote.total_price,
      markup: quote.markup,
      tax: quote.tax,
    }),
  };

  return NextResponse.json(response);
}

// ============================================
// EXAMPLE 7: Manual Permission Check (Advanced)
// ============================================

/**
 * Complex endpoint with manual permission checking
 * Use when you need fine-grained control over permission logic
 */
export async function COMPLEX_Example(request: NextRequest) {
  const requestId = getRequestId(request);

  // Start with basic authentication
  const authResult = await requirePermission(request, 'quotations', 'read');

  if ('error' in authResult) {
    return authResult.error;
  }

  const { user, tenantId, permissions } = authResult;

  // Use the permissions object directly for complex checks
  const hasFullAccess =
    permissions['*']?.read === true || // Wildcard access
    (permissions['quotations']?.read === true &&
     permissions['quotations']?.update === true &&
     permissions['quotations']?.delete === true);

  // Use hasPermission helper for additional checks
  const canManageUsers = await hasPermission(
    user.userId,
    tenantId,
    'users',
    'update'
  );

  // Build response based on combined permission checks
  const response = {
    data: [], // Your data here
    permissions: {
      hasFullAccess,
      canManageUsers,
    },
    user: {
      id: user.userId,
      role: hasFullAccess ? 'admin' : 'user',
    },
  };

  return NextResponse.json(response);
}

// ============================================
// PERMISSION CACHE MANAGEMENT EXAMPLES
// ============================================

import {
  clearUserPermissionCache,
  clearAllPermissionCache,
  getPermissionCacheStats
} from './permissions';

/**
 * EXAMPLE: Clear user cache after role change
 * Call this when you update a user's roles
 */
export async function updateUserRole(userId: number, newRoleId: number) {
  // Update the user's role in database
  await query(
    'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
    [userId, newRoleId]
  );

  // Clear the user's permission cache so changes take effect immediately
  clearUserPermissionCache(userId);
}

/**
 * EXAMPLE: Clear all caches after role permission change
 * Call this when you modify a role's permissions
 */
export async function updateRolePermissions(roleId: number, newPermissions: string) {
  // Update role permissions in database
  await query(
    'UPDATE roles SET permissions = ? WHERE id = ?',
    [newPermissions, roleId]
  );

  // Clear all permission caches since many users might have this role
  clearAllPermissionCache();
}

/**
 * EXAMPLE: Get cache statistics for monitoring
 * Useful for debugging or admin dashboards
 */
export async function GET_CacheStats(request: NextRequest) {
  // Require admin permission to view cache stats
  const authResult = await requirePermission(request, 'users', 'read');

  if ('error' in authResult) {
    return authResult.error;
  }

  const stats = getPermissionCacheStats();
  return NextResponse.json(stats);
}
