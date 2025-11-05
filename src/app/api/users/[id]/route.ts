/**
 * User by ID API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement
 * - Audit logging
 *
 * GET    /api/users/[id] - Get single user
 * PATCH  /api/users/[id] - Update user
 * DELETE /api/users/[id] - Delete user
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';
import bcrypt from 'bcryptjs';

// GET - Get single user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'users', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. RBAC: Only org_admin and super_admin can view users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only administrators can view users',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (300 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      300,
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

    // 4. Fetch user
    const users = await query(
      `SELECT id, email, first_name, last_name, role, organization_id, status, created_at, last_login
       FROM users
       WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (users.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `User with ID ${id} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 5. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      target_user_id: id,
    });

    // 6. Return response with headers
    const response = NextResponse.json(users[0]);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch user',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH - Update user details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'users', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. RBAC: Only org_admin and super_admin can update users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only administrators can update users',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (100 updates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_update`,
      100,
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

    // 4. Parse request body
    const body = await request.json();
    const { first_name, last_name, role, status, password } = body;

    // 5. Verify user exists and belongs to same organization
    const existingUsers = await query(
      'SELECT id, email, role, status FROM users WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (existingUsers.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `User with ID ${id} not found`,
        404,
        undefined,
        requestId
      );
    }

    const existingUser = existingUsers[0];

    // 6. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (role) {
      const validRoles = ['org_admin', 'org_user', 'viewer'];
      if (!validRoles.includes(role)) {
        validationErrors.push({
          field: 'role',
          issue: 'invalid',
          message: `Role must be one of: ${validRoles.join(', ')}`
        });
      }
    }

    if (status && !['active', 'inactive'].includes(status)) {
      validationErrors.push({
        field: 'status',
        issue: 'invalid',
        message: 'Status must be either "active" or "inactive"'
      });
    }

    if (password && password.length < 8) {
      validationErrors.push({
        field: 'password',
        issue: 'invalid',
        message: 'Password must be at least 8 characters'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 7. Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    const changes: Record<string, any> = {};

    if (first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(first_name || null);
      if (first_name !== existingUser.first_name) {
        changes.first_name = first_name;
      }
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(last_name || null);
      if (last_name !== existingUser.last_name) {
        changes.last_name = last_name;
      }
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
      if (role !== existingUser.role) {
        changes.role = role;
      }
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
      if (status !== existingUser.status) {
        changes.status = status;
      }
    }

    // Handle password update separately
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
      changes.password = '***changed***';
    }

    if (updates.length === 0) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'body', issue: 'required', message: 'No fields to update' }],
        requestId
      );
    }

    values.push(id);
    values.push(parseInt(tenantId));

    // 8. Execute update
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    // 9. Fetch updated user
    const [updatedUser] = await query(
      `SELECT id, email, first_name, last_name, role, organization_id, status, created_at, last_login
       FROM users WHERE id = ?`,
      [id]
    ) as any[];

    // 10. AUDIT: Log user update
    if (Object.keys(changes).length > 0) {
      await auditLog(
        parseInt(tenantId),
        user.userId,
        AuditActions.USER_UPDATED,
        AuditResources.USER,
        id,
        changes,
        {
          updated_by: user.userId,
          email: existingUser.email,
          fields_updated: Object.keys(changes),
        },
        request
      );
    }

    // 11. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      target_user_id: id,
      fields_updated: Object.keys(changes),
    });

    // 12. Return response with headers
    const response = NextResponse.json(updatedUser);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update user',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'users', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. RBAC: Only org_admin and super_admin can delete users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only administrators can delete users',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (50 deletes per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_delete`,
      50,
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

    // 4. Prevent self-deletion
    if (parseInt(id) === user.userId) {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'You cannot delete your own account',
        403,
        undefined,
        requestId
      );
    }

    // 5. Verify user exists and belongs to same organization
    const existingUsers = await query(
      'SELECT id, email FROM users WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (existingUsers.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `User with ID ${id} not found`,
        404,
        undefined,
        requestId
      );
    }

    const existingUser = existingUsers[0];

    // 6. Delete the user
    await query('UPDATE users SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?', [id, parseInt(tenantId)]);

    // 7. AUDIT: Log user deletion
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.USER_DELETED,
      AuditResources.USER,
      id,
      {
        email: existingUser.email,
      },
      {
        deleted_by: user.userId,
        deletion_type: 'hard_delete',
      },
      request
    );

    // 8. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      deleted_user_id: id,
    });

    // 9. Return response with headers
    const response = NextResponse.json({ success: true, message: 'User deleted successfully' });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete user',
      500,
      undefined,
      requestId
    );
  }
}
