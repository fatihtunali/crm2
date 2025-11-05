/**
 * Role Detail API Endpoint - Phase 2
 * Individual role management with Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting with headers
 * - Request/response logging
 * - Role-based access control (admin/super_admin only for update/delete)
 * - Tenant isolation
 * - System role protection (cannot update/delete system roles)
 *
 * GET    /api/roles/:id - Get role details
 * PUT    /api/roles/:id - Update role (admin/super_admin only, not system roles)
 * DELETE /api/roles/:id - Delete role (admin/super_admin only, not system roles, not if users assigned)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

// GET - Fetch single role details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      );
    }
    const { tenantId, user } = tenantResult;

    // 2. Rate limiting (100 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      100,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // 3. Validate ID parameter
    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId) || roleId <= 0) {
      return validationErrorResponse(
        'Invalid role ID',
        [{ field: 'id', issue: 'invalid', message: 'Role ID must be a positive integer' }],
        requestId
      );
    }

    // 4. Fetch role with user count
    // SECURITY: Filter by organization_id to enforce tenant isolation
    const rows = await query(
      `SELECT
        r.id,
        r.organization_id,
        r.name,
        r.description,
        r.permissions,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM user_roles WHERE role_id = r.id) as user_count
      FROM roles r
      WHERE r.id = ? AND r.organization_id = ?`,
      [roleId, parseInt(tenantId)]
    ) as any[];

    if (rows.length === 0) {
      logResponse(requestId, 404, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        role_id: roleId,
      });

      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Role not found',
        404,
        undefined,
        requestId
      );
    }

    const role = rows[0];

    // 5. Parse permissions JSON
    role.permissions = typeof role.permissions === 'string'
      ? JSON.parse(role.permissions)
      : role.permissions;
    role.is_system_role = Boolean(role.is_system_role);

    // 6. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      role_id: roleId,
    });

    // 7. Return response
    const response = NextResponse.json(role);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred while fetching role',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      );
    }
    const { tenantId, user } = tenantResult;

    // 2. Check if user is admin or super_admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logResponse(requestId, 403, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        user_role: user.role,
        error: 'Insufficient permissions',
      });

      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only administrators can update roles',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (50 updates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_update_role`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Update rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // 4. Validate ID parameter
    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId) || roleId <= 0) {
      return validationErrorResponse(
        'Invalid role ID',
        [{ field: 'id', issue: 'invalid', message: 'Role ID must be a positive integer' }],
        requestId
      );
    }

    // 5. Check if role exists and belongs to organization
    const existingRole = await query(
      'SELECT id, name, is_system_role FROM roles WHERE id = ? AND organization_id = ?',
      [roleId, parseInt(tenantId)]
    ) as any[];

    if (existingRole.length === 0) {
      logResponse(requestId, 404, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        role_id: roleId,
      });

      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Role not found',
        404,
        undefined,
        requestId
      );
    }

    // 6. SECURITY: Cannot update system roles
    if (existingRole[0].is_system_role) {
      logResponse(requestId, 403, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        role_id: roleId,
        error: 'Cannot update system role',
      });

      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'System roles cannot be modified',
        403,
        undefined,
        requestId
      );
    }

    // 7. Parse and validate request body
    const body = await request.json();
    const { name, description, permissions } = body;

    // 8. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        validationErrors.push({
          field: 'name',
          issue: 'required',
          message: 'Role name is required'
        });
      } else if (name.length > 100) {
        validationErrors.push({
          field: 'name',
          issue: 'max_length',
          message: 'Role name must be 100 characters or less'
        });
      }

      // Check if new name is unique (excluding current role)
      if (name && name.trim() !== existingRole[0].name) {
        const duplicateRole = await query(
          'SELECT id FROM roles WHERE organization_id = ? AND name = ? AND id != ?',
          [parseInt(tenantId), name.trim(), roleId]
        ) as any[];

        if (duplicateRole.length > 0) {
          validationErrors.push({
            field: 'name',
            issue: 'duplicate',
            message: 'A role with this name already exists in your organization'
          });
        }
      }
    }

    if (permissions !== undefined) {
      if (typeof permissions !== 'object' || Array.isArray(permissions)) {
        validationErrors.push({
          field: 'permissions',
          issue: 'invalid_format',
          message: 'Permissions must be a JSON object'
        });
      } else {
        // Validate permissions structure
        const validationResult = validatePermissionsStructure(permissions);
        if (!validationResult.valid) {
          validationErrors.push({
            field: 'permissions',
            issue: 'invalid_structure',
            message: validationResult.error || 'Invalid permissions structure'
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 9. Build update query dynamically based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description?.trim() || null);
    }

    if (permissions !== undefined) {
      updateFields.push('permissions = ?');
      updateValues.push(JSON.stringify(permissions));
    }

    // Always update updated_at
    updateFields.push('updated_at = NOW()');

    // Add WHERE clause values
    updateValues.push(roleId, parseInt(tenantId));

    // 10. Execute update
    await query(
      `UPDATE roles SET ${updateFields.join(', ')} WHERE id = ? AND organization_id = ?`,
      updateValues
    );

    // 11. Fetch updated role
    const [updatedRole] = await query(
      'SELECT id, organization_id, name, description, permissions, is_system_role, created_at, updated_at FROM roles WHERE id = ?',
      [roleId]
    ) as any[];

    // Parse permissions JSON
    updatedRole.permissions = typeof updatedRole.permissions === 'string'
      ? JSON.parse(updatedRole.permissions)
      : updatedRole.permissions;
    updatedRole.is_system_role = Boolean(updatedRole.is_system_role);

    // 12. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      role_id: roleId,
    });

    // 13. Return response
    const response = NextResponse.json(updatedRole);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update role',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      );
    }
    const { tenantId, user } = tenantResult;

    // 2. Check if user is admin or super_admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logResponse(requestId, 403, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        user_role: user.role,
        error: 'Insufficient permissions',
      });

      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only administrators can delete roles',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (20 deletes per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_delete_role`,
      20,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Delete rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // 4. Validate ID parameter
    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId) || roleId <= 0) {
      return validationErrorResponse(
        'Invalid role ID',
        [{ field: 'id', issue: 'invalid', message: 'Role ID must be a positive integer' }],
        requestId
      );
    }

    // 5. Check if role exists and belongs to organization
    const existingRole = await query(
      `SELECT
        r.id,
        r.name,
        r.is_system_role,
        (SELECT COUNT(*) FROM user_roles WHERE role_id = r.id) as user_count
      FROM roles r
      WHERE r.id = ? AND r.organization_id = ?`,
      [roleId, parseInt(tenantId)]
    ) as any[];

    if (existingRole.length === 0) {
      logResponse(requestId, 404, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        role_id: roleId,
      });

      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Role not found',
        404,
        undefined,
        requestId
      );
    }

    const role = existingRole[0];

    // 6. SECURITY: Cannot delete system roles
    if (role.is_system_role) {
      logResponse(requestId, 403, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        role_id: roleId,
        error: 'Cannot delete system role',
      });

      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'System roles cannot be deleted',
        403,
        undefined,
        requestId
      );
    }

    // 7. BUSINESS RULE: Cannot delete if users are assigned to role
    if (role.user_count > 0) {
      logResponse(requestId, 409, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        role_id: roleId,
        user_count: role.user_count,
        error: 'Role has assigned users',
      });

      return standardErrorResponse(
        ErrorCodes.CONFLICT,
        `Cannot delete role '${role.name}' because it has ${role.user_count} user(s) assigned. Please reassign these users to a different role first.`,
        409,
        undefined,
        requestId
      );
    }

    // 8. Delete the role (CASCADE will handle related records)
    await query(
      'UPDATE roles SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [roleId, parseInt(tenantId)]
    );

    // 9. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      role_id: roleId,
      role_name: role.name,
    });

    // 10. Return success response
    const response = NextResponse.json({
      success: true,
      message: `Role '${role.name}' has been deleted successfully`
    });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete role',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * Validate permissions JSON structure
 * Expected format:
 * {
 *   "quotations": {"read": true, "create": true, "update": false, "delete": false},
 *   "clients": {"read": true, "create": false, "update": false, "delete": false}
 * }
 */
function validatePermissionsStructure(permissions: any): { valid: boolean; error?: string } {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return { valid: false, error: 'Permissions must be a JSON object' };
  }

  const validActions = ['read', 'create', 'update', 'delete'];
  const validResources = ['quotations', 'clients', 'invoices', 'reports', 'users', 'roles', '*'];

  for (const [resource, actions] of Object.entries(permissions)) {
    // Allow wildcard or specific resources
    if (!validResources.includes(resource)) {
      return {
        valid: false,
        error: `Invalid resource type: ${resource}. Valid resources: ${validResources.join(', ')}`
      };
    }

    if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
      return {
        valid: false,
        error: `Permissions for ${resource} must be an object with action keys`
      };
    }

    for (const [action, value] of Object.entries(actions as any)) {
      if (!validActions.includes(action)) {
        return {
          valid: false,
          error: `Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`
        };
      }

      if (typeof value !== 'boolean') {
        return {
          valid: false,
          error: `Permission value for ${resource}.${action} must be a boolean`
        };
      }
    }
  }

  return { valid: true };
}
