import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';

// GET - Fetch all providers with pagination, search, and filters
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Enforce tenant scoping
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 100, 3600);
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

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // Parse filters
    const filters: Record<string, any> = {
      organization_id: tenantId // Tenant scoping
    };

    // Archive filter (default: exclude archived)
    const includeArchived = searchParams.get('include_archived') === 'true';
    if (!includeArchived) {
      filters.archived_at = null; // Only show non-archived by default
    }

    // Exclude hotel and guide providers only if include_all is not set
    // This allows forms to fetch all providers while the list page filters them
    const includeAll = searchParams.get('include_all') === 'true';
    const excludeTypes = includeAll ? [] : ['hotel', 'guide'];

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    // City filter
    const cityFilter = searchParams.get('city');
    if (cityFilter && cityFilter !== 'all') {
      filters.city = cityFilter;
    }

    // Provider type filter
    const providerTypeFilter = searchParams.get('provider_type');
    if (providerTypeFilter && providerTypeFilter !== 'all') {
      filters.provider_type = providerTypeFilter;
    }

    // Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // Search across multiple fields
    const searchTerm = searchParams.get('search') || '';
    const searchClause = buildSearchClause(searchTerm, [
      'provider_name',
      'city',
      'contact_email'
    ]);

    // Combine WHERE and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Add exclusion for hotel and guide providers (use inline SQL since buildWhereClause returns inline values)
    // Only add exclusion if there are types to exclude
    let finalWhereSQL = combined.whereSQL;
    if (excludeTypes.length > 0) {
      const excludeCondition = `provider_type NOT IN ('${excludeTypes.join("', '")}')`;
      finalWhereSQL = combined.whereSQL
        ? `(${combined.whereSQL}) AND ${excludeCondition}`
        : excludeCondition;
    }
    const finalParams = combined.params;

    // Default sort order
    const orderBy = 'p.provider_name ASC';

    // Build main query with service counts
    let sql = `
      SELECT
        p.id,
        p.organization_id,
        p.provider_name,
        p.provider_type,
        p.city,
        p.contact_email,
        p.contact_phone,
        p.status,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM tours WHERE provider_id = p.id) as daily_tours_count,
        (SELECT COUNT(*) FROM intercity_transfers WHERE provider_id = p.id) as transfers_count,
        (SELECT COUNT(*) FROM vehicles WHERE provider_id = p.id) as vehicles_count,
        (SELECT COUNT(*) FROM meal_pricing WHERE provider_id = p.id) as restaurants_count,
        (SELECT COUNT(*) FROM entrance_fees WHERE provider_id = p.id) as entrance_fees_count,
        (SELECT COUNT(*) FROM extra_expenses WHERE provider_id = p.id) as extra_expenses_count
      FROM providers p
    `;

    if (finalWhereSQL) {
      sql += ` WHERE ${finalWhereSQL}`;
    }

    sql += ` ORDER BY ${orderBy}`;
    sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    // Build count query
    let countSql = 'SELECT COUNT(*) as total FROM providers';
    if (finalWhereSQL) {
      countSql += ` WHERE ${finalWhereSQL}`;
    }

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(sql, finalParams),
      query(countSql, finalParams)
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const baseUrl = new URL(request.url).origin + new URL(request.url).pathname;
    const responseFilters: Record<string, string> = {};
    if (statusFilter && statusFilter !== 'all') responseFilters.status = statusFilter;
    if (cityFilter && cityFilter !== 'all') responseFilters.city = cityFilter;
    if (providerTypeFilter && providerTypeFilter !== 'all') responseFilters.provider_type = providerTypeFilter;
    if (searchTerm) responseFilters.search = searchTerm;

    const responseData = buildStandardListResponse(rows, total, page, pageSize, baseUrl, responseFilters);

    const response = NextResponse.json(responseData);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      total_results: total
    });

    return response;
  } catch (error) {
    console.error('Error fetching providers:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new provider
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Enforce tenant scoping
    const authResult = await requirePermission(request, 'providers', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 50, 3600);
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

    // Check idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cachedResponse = await checkIdempotencyKeyDB(request, idempotencyKey, Number(tenantId));
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // Parse request body
    const body = await request.json();
    const {
      provider_name,
      provider_type,
      city,
      address,
      contact_email,
      contact_phone,
      notes,
      status = 'active'
    } = body;

    // Validate required fields
    const errors = [];
    if (!provider_name) errors.push({ field: 'provider_name', issue: 'required', message: 'provider_name is required' });
    if (!provider_type) errors.push({ field: 'provider_type', issue: 'required', message: 'provider_type is required' });

    if (errors.length > 0) {
      return validationErrorResponse('Validation failed', errors, requestId);
    }

    // Insert provider with organization_id
    const result = await query(
      `INSERT INTO providers (
        organization_id,
        provider_name,
        provider_type,
        city,
        address,
        contact_email,
        contact_phone,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        provider_name,
        provider_type,
        city || null,
        address || null,
        contact_email || null,
        contact_phone || null,
        notes || null,
        status
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created provider
    const [createdProvider] = await query(
      'SELECT * FROM providers WHERE id = ?',
      [insertId]
    ) as any[];

    // Build Location header
    const location = `/api/providers/${insertId}`;

    // Create response
    const response = NextResponse.json(createdProvider, {
      status: 201,
      headers: {
        Location: location
      }
    });

    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // Store idempotency key if provided
    if (idempotencyKey) {
      await storeIdempotencyKeyDB(idempotencyKey, response, Number(tenantId), user.userId, request);
    }

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      provider_id: insertId
    });
    return response;
  } catch (error) {
    console.error('Error creating provider:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}
