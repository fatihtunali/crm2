/**
 * Users API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized pagination (page[size] & page[number])
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement
 * - Audit logging
 *
 * GET  /api/users - List users with pagination
 * POST /api/users - Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import {
  parseStandardPaginationParams,
  parseSortParams,
  buildStandardListResponse,
} from '@/lib/pagination';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';
import bcrypt from 'bcryptjs';

// GET - List all users in the organization
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
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

    // 3. Rate limiting (200 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      200,
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

    // 4. Parse pagination
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 5. Parse sort (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    const ALLOWED_COLUMNS = ['id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at', 'last_login'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'created_at DESC';

    // 6. Build filters
    const statusFilter = searchParams.get('status');
    const roleFilter = searchParams.get('role');

    let whereClause = 'organization_id = ?';
    const params: any[] = [parseInt(tenantId)];

    if (statusFilter && statusFilter !== 'all') {
      whereClause += ' AND status = ?';
      params.push(statusFilter);
    }

    if (roleFilter && roleFilter !== 'all') {
      whereClause += ' AND role = ?';
      params.push(roleFilter);
    }

    // 7. Build search clause
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';
    if (searchTerm && searchTerm.trim() !== '') {
      whereClause += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    // 8. Execute main query
    const dataParams = [...params, pageSize, offset];
    const sql = `
      SELECT id, email, first_name, last_name, role, organization_id, status, created_at, last_login
      FROM users
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = await query(sql, dataParams);

    // 9. Get total count
    const countSql = `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`;
    const countResult = await query(countSql, params) as any[];
    const total = countResult[0]?.count || 0;

    // 10. Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 11. Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (statusFilter) appliedFilters.status = statusFilter;
    if (roleFilter) appliedFilters.role = roleFilter;
    if (searchTerm) appliedFilters.search = searchTerm;

    // 12. Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      rows,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // 13. Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // 14. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: (rows as any[]).length,
      total_results: total,
      page,
      page_size: pageSize,
    });

    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch users',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'users', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. RBAC: Only org_admin and super_admin can create users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only administrators can create users',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (50 creates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_create`,
      50,
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
    const { email, password, first_name, last_name, role } = body;

    // 5. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!email || email.trim() === '') {
      validationErrors.push({
        field: 'email',
        issue: 'required',
        message: 'Email is required'
      });
    }

    if (!password || password.trim() === '') {
      validationErrors.push({
        field: 'password',
        issue: 'required',
        message: 'Password is required'
      });
    } else if (password.length < 8) {
      validationErrors.push({
        field: 'password',
        issue: 'invalid',
        message: 'Password must be at least 8 characters'
      });
    }

    const validRoles = ['org_admin', 'org_user', 'viewer'];
    if (role && !validRoles.includes(role)) {
      validationErrors.push({
        field: 'role',
        issue: 'invalid',
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 6. Check if email already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as any[];

    if (existingUsers.length > 0) {
      return standardErrorResponse(
        ErrorCodes.DUPLICATE_RESOURCE,
        `A user with email ${email} already exists`,
        409,
        undefined,
        requestId
      );
    }

    // 7. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 8. Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [email, passwordHash, first_name || null, last_name || null, role || 'org_user', parseInt(tenantId)]
    );

    const insertId = (result as any).insertId;

    // 9. Fetch created user
    const [createdUser] = await query(
      `SELECT id, email, first_name, last_name, role, organization_id, status, created_at
       FROM users WHERE id = ?`,
      [insertId]
    ) as any[];

    // 10. AUDIT: Log user creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.USER_CREATED,
      AuditResources.USER,
      insertId.toString(),
      {
        email,
        role: role || 'org_user',
      },
      {
        created_by: user.userId,
        first_name,
        last_name,
      },
      request
    );

    // 11. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      created_user_id: insertId,
      email,
    });

    // 12. Return 201 Created with Location header
    const response = NextResponse.json(createdUser, {
      status: 201,
      headers: {
        'Location': `/api/users/${insertId}`,
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
      'Failed to create user',
      500,
      undefined,
      requestId
    );
  }
}
