/**
 * Roles API Endpoint - Phase 2
 * Implements role management with Phase 1 standards:
 * - Standardized pagination with page[size] & page[number]
 * - Hypermedia links (self, first, prev, next, last)
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting with headers
 * - Request/response logging
 * - Role-based access control (admin/super_admin only for create)
 * - Tenant isolation
 *
 * GET  /api/roles - List roles for organization
 * POST /api/roles - Create new custom role (admin/super_admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  parseStandardPaginationParams,
  parseSortParams,
  buildStandardListResponse,
} from '@/lib/pagination';
import {
  buildWhereClause,
  buildSearchClause,
  buildQuery,
} from '@/lib/query-builder';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

// GET - Fetch all roles for organization with standardized pagination
export async function GET(request: NextRequest) {
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

    // 3. Parse pagination (supports both old and new format)
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 4. Extract filters
    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization
      'r.organization_id': parseInt(tenantId)
    };

    // Optional: Filter by is_system_role
    const systemRoleFilter = searchParams.get('is_system_role');
    if (systemRoleFilter !== null) {
      filters['r.is_system_role'] = systemRoleFilter === 'true' ? 1 : 0;
    }

    // 5. Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // 6. Parse sort (default: name ASC)
    const sortParam = searchParams.get('sort') || 'name';
    // SECURITY: Whitelist allowed columns
    const ALLOWED_COLUMNS = [
      'id', 'name', 'description', 'is_system_role', 'created_at', 'updated_at'
    ];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'r.name ASC';

    // 7. Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // 8. Build search clause
    const searchClause = buildSearchClause(searchTerm, [
      'r.name',
      'r.description',
    ]);

    // 9. Build main query
    const baseQuery = `
      SELECT
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
    `;

    const { sql, params } = buildQuery(baseQuery, {
      where: whereClause,
      search: searchClause,
      orderBy,
      limit: pageSize,
      offset,
    });

    // 10. Execute query
    const rows = await query(sql, params) as any[];

    // 11. Parse JSON permissions for each role
    const rolesWithParsedPermissions = rows.map(role => ({
      ...role,
      permissions: typeof role.permissions === 'string'
        ? JSON.parse(role.permissions)
        : role.permissions,
      is_system_role: Boolean(role.is_system_role),
    }));

    // 12. Get total count
    const countBaseQuery = 'SELECT COUNT(*) as count FROM roles r';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause,
    });

    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.count || 0;

    // 13. Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 14. Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (systemRoleFilter !== null) appliedFilters.is_system_role = systemRoleFilter;
    if (searchTerm) appliedFilters.search = searchTerm;

    // 15. Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      rolesWithParsedPermissions,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // 16. Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // 17. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: rolesWithParsedPermissions.length,
      total_results: total,
      page,
      page_size: pageSize,
    });

    return response;
  } catch (error: any) {
    // Log error
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred while fetching roles',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new custom role
export async function POST(request: NextRequest) {
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
        'Only administrators can create roles',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (20 creates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_create_role`,
      20,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Creation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const { name, description, permissions } = body;

    // 5. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!name || name.trim() === '') {
      validationErrors.push({
        field: 'name',
        issue: 'required',
        message: 'Role name is required'
      });
    }

    if (name && name.length > 100) {
      validationErrors.push({
        field: 'name',
        issue: 'max_length',
        message: 'Role name must be 100 characters or less'
      });
    }

    if (!permissions) {
      validationErrors.push({
        field: 'permissions',
        issue: 'required',
        message: 'Permissions object is required'
      });
    } else if (typeof permissions !== 'object' || Array.isArray(permissions)) {
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

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 6. Check if role name is unique within organization
    const existingRole = await query(
      'SELECT id FROM roles WHERE organization_id = ? AND name = ?',
      [parseInt(tenantId), name.trim()]
    ) as any[];

    if (existingRole.length > 0) {
      return validationErrorResponse(
        'Role name already exists',
        [{
          field: 'name',
          issue: 'duplicate',
          message: 'A role with this name already exists in your organization'
        }],
        requestId
      );
    }

    // 7. Insert new role (is_system_role = false for custom roles)
    const result = await query(
      `INSERT INTO roles (organization_id, name, description, permissions, is_system_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, FALSE, NOW(), NOW())`,
      [
        parseInt(tenantId),
        name.trim(),
        description?.trim() || null,
        JSON.stringify(permissions)
      ]
    );

    const insertId = (result as any).insertId;

    // 8. Fetch created role
    const [createdRole] = await query(
      'SELECT id, organization_id, name, description, permissions, is_system_role, created_at, updated_at FROM roles WHERE id = ?',
      [insertId]
    ) as any[];

    // Parse permissions JSON
    createdRole.permissions = typeof createdRole.permissions === 'string'
      ? JSON.parse(createdRole.permissions)
      : createdRole.permissions;
    createdRole.is_system_role = Boolean(createdRole.is_system_role);

    // 9. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      role_id: insertId,
      role_name: name,
    });

    // 10. Return 201 Created with Location header
    const response = NextResponse.json(createdRole, {
      status: 201,
      headers: {
        'Location': `/api/roles/${insertId}`,
      },
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
      'Failed to create role',
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
