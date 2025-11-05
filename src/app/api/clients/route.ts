import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, buildStandardListResponse, parseSortParams } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { standardErrorResponse, validationErrorResponse, ErrorCodes } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { getRequestId, logResponse } from '@/middleware/correlation';

/**
 * GET /api/clients
 * List all clients with pagination, filtering, and search
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
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

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters (supports both old and new format)
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'first_name', 'last_name', 'email', 'phone', 'client_type', 'nationality', 'status', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Build filters
    const filters: Record<string, any> = {};

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    const clientTypeFilter = searchParams.get('client_type');
    if (clientTypeFilter && clientTypeFilter !== 'all') {
      filters.client_type = clientTypeFilter;
    }

    const nationalityFilter = searchParams.get('nationality');
    if (nationalityFilter && nationalityFilter !== 'all') {
      filters.nationality = nationalityFilter;
    }

    // Add tenant filter
    filters.organization_id = parseInt(tenantId);

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', ['first_name', 'last_name', 'email', 'phone']);

    // Combine where and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Build main query
    let sql = `
      SELECT
        id,
        uuid,
        organization_id,
        first_name,
        last_name,
        email,
        phone,
        client_type,
        tour_operator_id,
        nationality,
        language_preference,
        date_of_birth,
        passport_number,
        preferences,
        dietary_requirements,
        special_needs,
        notes,
        marketing_consent,
        newsletter_subscribed,
        status,
        created_at,
        updated_at
      FROM clients
    `;

    const params: any[] = [];

    // Add WHERE clause
    if (combined.whereSQL) {
      sql += ` WHERE ${combined.whereSQL}`;
      params.push(...combined.params);
    }

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    } else {
      sql += ` ORDER BY created_at DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `SELECT COUNT(*) as total FROM clients`;
    if (combined.whereSQL) {
      countSql += ` WHERE ${combined.whereSQL}`;
    }

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, combined.params)
    ]);

    const total = (countResult as any)[0].total;

    // Build base URL for links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Extract filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (statusFilter && statusFilter !== 'all') appliedFilters.status = statusFilter;
    if (clientTypeFilter && clientTypeFilter !== 'all') appliedFilters.client_type = clientTypeFilter;
    if (nationalityFilter && nationalityFilter !== 'all') appliedFilters.nationality = nationalityFilter;
    if (searchTerm) appliedFilters.search = searchTerm;
    if (sortParam !== '-created_at') appliedFilters.sort = sortParam;

    const responseData = buildStandardListResponse(rows, total, page, pageSize, baseUrl, appliedFilters);

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: (rows as any[]).length,
    });

    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch clients',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
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

    const body = await request.json();

    const {
      first_name,
      last_name,
      email,
      phone,
      client_type = 'direct_client',
      tour_operator_id,
      nationality,
      language_preference = 'en',
      date_of_birth,
      passport_number,
      preferences,
      dietary_requirements,
      special_needs,
      notes,
      marketing_consent = false,
      newsletter_subscribed = false,
      status = 'active'
    } = body;

    // Validate required fields
    const errors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!first_name) {
      errors.push({ field: 'first_name', issue: 'required', message: 'First name is required' });
    }
    if (!last_name) {
      errors.push({ field: 'last_name', issue: 'required', message: 'Last name is required' });
    }
    if (!email) {
      errors.push({ field: 'email', issue: 'required', message: 'Email is required' });
    }

    if (errors.length > 0) {
      return validationErrorResponse('Invalid client data', errors, requestId);
    }

    // Generate UUID
    const uuid = crypto.randomUUID();

    // Insert client
    const result = await query(
      `INSERT INTO clients (
        uuid, organization_id, first_name, last_name, email, phone,
        client_type, tour_operator_id, nationality, language_preference,
        date_of_birth, passport_number, preferences, dietary_requirements,
        special_needs, notes, marketing_consent, newsletter_subscribed, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, parseInt(tenantId), first_name, last_name, email, phone,
        client_type, tour_operator_id, nationality, language_preference,
        date_of_birth, passport_number, preferences, dietary_requirements,
        special_needs, notes, marketing_consent, newsletter_subscribed, status
      ]
    );

    const clientId = (result as any).insertId;

    // Fetch the created client
    const [client] = await query(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    ) as any[];

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      client_id: clientId,
    });

    const response = NextResponse.json(client, { status: 201 });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, error.code === 'ER_DUP_ENTRY' ? 409 : 500, Date.now() - startTime, {
      error: error.message,
    });

    // Handle duplicate email
    if (error.code === 'ER_DUP_ENTRY') {
      return standardErrorResponse(
        ErrorCodes.CONFLICT,
        'A client with this email already exists',
        409,
        undefined,
        requestId
      );
    }

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create client',
      500,
      undefined,
      requestId
    );
  }
}
