/**
 * Audit Logs API Endpoint
 * Provides read-only access to audit logs for administrators
 *
 * GET /api/audit-logs - Query audit logs with filters
 *
 * Features:
 * - Standardized pagination (page[size], page[number])
 * - Multiple filter options (actor, resource, action, date range, request_id)
 * - Admin-only access (admin and super_admin roles)
 * - Joins with users table for user details
 * - Hypermedia links for navigation
 * - Request correlation tracking
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
  buildQuery,
} from '@/lib/query-builder';
import {
  standardErrorResponse,
  ErrorCodes,
  authorizationErrorResponse,
} from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';

/**
 * GET /api/audit-logs - Query audit logs with filters
 *
 * Query Parameters:
 * - page[size]=25 - Number of items per page (default: 25)
 * - page[number]=1 - Page number (default: 1)
 * - actor=123 - Filter by user ID
 * - resource=quotation - Filter by resource type
 * - resource_id=456 - Filter by specific resource ID
 * - action=quotation.created - Filter by specific action
 * - date_from=2025-01-01 - Filter by start date (inclusive)
 * - date_to=2025-12-31 - Filter by end date (inclusive)
 * - request_id=req_123 - Filter by request correlation ID
 * - sort=-created_at - Sort by field (prefix with - for DESC)
 *
 * Security:
 * - Only admin and super_admin roles can access audit logs
 * - Users can only view logs from their own organization
 *
 * @example
 * GET /api/audit-logs?page[size]=50&page[number]=1&actor=123
 * GET /api/audit-logs?resource=quotation&action=quotation.created
 * GET /api/audit-logs?date_from=2025-01-01&date_to=2025-01-31
 * GET /api/audit-logs?request_id=req_abc123
 */
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

    // 2. Authorization check - only admin and super_admin can view audit logs
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      logResponse(requestId, 403, Date.now() - startTime, {
        user_id: user.userId,
        role: user.role,
        action: 'audit_logs.access_denied',
      });

      return authorizationErrorResponse(
        'Only administrators can access audit logs',
        requestId
      );
    }

    // 3. Parse pagination
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 4. Extract filters
    const actorFilter = searchParams.get('actor'); // User ID
    const resourceFilter = searchParams.get('resource'); // Resource type
    const resourceIdFilter = searchParams.get('resource_id'); // Specific resource ID
    const actionFilter = searchParams.get('action'); // Specific action
    const dateFromFilter = searchParams.get('date_from'); // Start date
    const dateToFilter = searchParams.get('date_to'); // End date
    const requestIdFilter = searchParams.get('request_id'); // Request correlation ID

    // Build filters object
    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization
      'al.organization_id': parseInt(tenantId),
    };

    if (actorFilter) {
      filters['al.user_id'] = parseInt(actorFilter);
    }

    if (resourceFilter) {
      filters['al.resource_type'] = resourceFilter;
    }

    if (resourceIdFilter) {
      filters['al.resource_id'] = resourceIdFilter;
    }

    if (actionFilter) {
      filters['al.action'] = actionFilter;
    }

    if (requestIdFilter) {
      filters['al.request_id'] = requestIdFilter;
    }

    // 5. Parse sort (default: -created_at for most recent first)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns
    const ALLOWED_COLUMNS = [
      'id',
      'user_id',
      'action',
      'resource_type',
      'resource_id',
      'ip_address',
      'request_id',
      'created_at',
    ];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'al.created_at DESC';

    // 6. Build WHERE clause
    let whereClause = buildWhereClause(filters);

    // Add date range filters (requires manual SQL for BETWEEN/>=/<= operators)
    const whereParts: string[] = [];
    const whereParams: any[] = [];

    if (whereClause.whereSQL) {
      whereParts.push(whereClause.whereSQL);
      whereParams.push(...whereClause.params);
    }

    if (dateFromFilter) {
      whereParts.push('al.created_at >= ?');
      whereParams.push(`${dateFromFilter} 00:00:00`);
    }

    if (dateToFilter) {
      whereParts.push('al.created_at <= ?');
      whereParams.push(`${dateToFilter} 23:59:59`);
    }

    const finalWhereClause = whereParts.length > 0
      ? { whereSQL: whereParts.join(' AND '), params: whereParams }
      : { whereSQL: '', params: [] };

    // 7. Build main query with user details
    const baseQuery = `
      SELECT
        al.id,
        al.organization_id,
        al.user_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.ip_address,
        al.user_agent,
        al.request_id,
        al.changes,
        al.metadata,
        al.created_at,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;

    const { sql, params } = buildQuery(baseQuery, {
      where: finalWhereClause,
      orderBy,
      limit: pageSize,
      offset,
    });

    // 8. Execute query
    const rows = await query(sql, params);

    // 9. Transform rows to include user object
    const transformedRows = (rows as any[]).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      user: row.user_id
        ? {
            id: row.user_id,
            email: row.user_email,
            first_name: row.user_first_name,
            last_name: row.user_last_name,
            role: row.user_role,
          }
        : null,
      action: row.action,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      request_id: row.request_id,
      changes: row.changes ? JSON.parse(row.changes) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      created_at: row.created_at,
    }));

    // 10. Get total count
    const countBaseQuery = 'SELECT COUNT(*) as count FROM audit_logs al';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: finalWhereClause,
    });

    const countResult = (await query(countSql, countParams)) as any[];
    const total = countResult[0]?.count || 0;

    // 11. Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 12. Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (actorFilter) appliedFilters.actor = actorFilter;
    if (resourceFilter) appliedFilters.resource = resourceFilter;
    if (resourceIdFilter) appliedFilters.resource_id = resourceIdFilter;
    if (actionFilter) appliedFilters.action = actionFilter;
    if (dateFromFilter) appliedFilters.date_from = dateFromFilter;
    if (dateToFilter) appliedFilters.date_to = dateToFilter;
    if (requestIdFilter) appliedFilters.request_id = requestIdFilter;

    // 13. Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      transformedRows,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // 14. Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);

    // 15. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: transformedRows.length,
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
      'An unexpected error occurred while fetching audit logs',
      500,
      undefined,
      requestId
    );
  }
}
