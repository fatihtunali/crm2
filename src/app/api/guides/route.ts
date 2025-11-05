import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, parseSortParams, buildStandardListResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, buildQuery } from '@/lib/query-builder';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

interface Guide {
  id: number;
  organization_id: number;
  provider_id: number | null;
  city: string;
  language: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  pricing_id?: number | null;
  season_name?: string | null;
  season_start?: string | null;
  season_end?: string | null;
  currency?: string | null;
  full_day_price?: number | null;
  half_day_price?: number | null;
  night_price?: number | null;
  provider_name?: string | null;
}

// GET /api/guides - Fetch guides with pagination, search, filtering, and sorting
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

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

    // 3. Parse pagination
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 4. Extract filters
    const statusFilter = searchParams.get('status');
    const cityFilter = searchParams.get('city');
    const languageFilter = searchParams.get('language');

    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization
      'g.organization_id': parseInt(tenantId)
    };

    // Archive filter (Phase 3: default exclude archived)
    const includeArchived = searchParams.get('include_archived') === 'true';
    if (!includeArchived) {
      filters.archived_at = null;
    }

    if (statusFilter && statusFilter !== 'all') {
      filters['g.status'] = statusFilter;
    }

    if (cityFilter && cityFilter !== 'all') {
      filters['g.city'] = cityFilter;
    }

    if (languageFilter && languageFilter !== 'all') {
      filters['g.language'] = languageFilter;
    }

    // 5. Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // 6. Parse sort (default: city ASC, language ASC)
    const sortParam = searchParams.get('sort') || 'city,language';
    // SECURITY: Whitelist allowed columns
    const ALLOWED_COLUMNS = ['id', 'city', 'language', 'status', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'g.city ASC, g.language ASC';

    // 7. Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // 8. Build search clause
    const searchClause = buildSearchClause(searchTerm, [
      'g.city',
      'g.language',
      'g.description',
    ]);

    // 9. Build main query
    const baseQuery = `
      SELECT
        g.*,
        p.provider_name,
        p.id as provider_id,
        gp.id as pricing_id,
        gp.season_name,
        gp.start_date as season_start,
        gp.end_date as season_end,
        gp.currency,
        gp.full_day_price,
        gp.half_day_price,
        gp.night_price
      FROM guides g
      LEFT JOIN providers p ON g.provider_id = p.id
      LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
        AND gp.status = 'active'
        AND CURDATE() BETWEEN gp.start_date AND gp.end_date
    `;

    const { sql, params } = buildQuery(baseQuery, {
      where: whereClause,
      search: searchClause,
      orderBy,
      limit: pageSize,
      offset,
    });

    // 10. Execute query
    const rows = await query(sql, params);

    // 11. Get total count
    const countBaseQuery = 'SELECT COUNT(DISTINCT g.id) as count FROM guides g';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause,
    });

    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.count || 0;

    // 12. Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 13. Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (statusFilter) appliedFilters.status = statusFilter;
    if (cityFilter) appliedFilters.city = cityFilter;
    if (languageFilter) appliedFilters.language = languageFilter;
    if (searchTerm) appliedFilters.search = searchTerm;

    // 14. Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      rows,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // 15. Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // 16. Log response
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
      'An unexpected error occurred while fetching guides',
      500,
      undefined,
      requestId
    );
  }
}

// POST /api/guides - Create a new guide
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (50 creates per hour per user)
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

    // 3. Check for Idempotency-Key header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    // If idempotency key provided, check if already processed
    if (idempotencyKey) {
      const existing = await query(
        'SELECT * FROM guides WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        const existingGuide = existing[0];

        logResponse(requestId, 201, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          guide_id: existingGuide.id,
          idempotent: true,
        });

        const response = NextResponse.json(existingGuide, {
          status: 201,
          headers: {
            'Location': `/api/guides/${existingGuide.id}`,
          },
        });
        response.headers.set('X-Request-Id', requestId);
        addRateLimitHeaders(response, rateLimit);
        return response;
      }
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const {
      city,
      language,
      description,
      provider_id,
      status = 'active',
    } = body;

    // 5. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!city || city.trim() === '') {
      validationErrors.push({
        field: 'city',
        issue: 'required',
        message: 'City is required'
      });
    }

    if (!language || language.trim() === '') {
      validationErrors.push({
        field: 'language',
        issue: 'required',
        message: 'Language is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 6. Insert guide
    const insertFields = [
      'organization_id', 'city', 'language', 'description', 'provider_id', 'status'
    ];

    const insertValues = [
      tenantId,
      city,
      language,
      description || null,
      provider_id || null,
      status,
    ];

    // Add idempotency_key if provided
    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO guides (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // 7. Fetch created guide
    const [createdGuide] = await query(
      'SELECT * FROM guides WHERE id = ?',
      [insertId]
    ) as Guide[];

    // 8. AUDIT: Log guide creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_CREATED,
      AuditResources.PROVIDER,
      insertId.toString(),
      {
        city,
        language,
      },
      {
        provider_type: 'guide',
        status,
      },
      request
    );

    // 9. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      guide_id: insertId,
    });

    // 10. Return 201 Created with Location header
    const response = NextResponse.json(createdGuide, {
      status: 201,
      headers: {
        'Location': `/api/guides/${insertId}`,
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
      'Failed to create guide',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update guide
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (50 updates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_update`,
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

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Guide ID is required' }],
        requestId
      );
    }

    // Fetch existing guide for audit trail
    const [existingGuide] = await query(
      'SELECT * FROM guides WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingGuide) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Guide not found',
        404,
        undefined,
        requestId
      );
    }

    // SECURITY: Update only if belongs to user's organization
    await query(
      `UPDATE guides SET
        provider_id = ?,
        city = ?,
        language = ?,
        description = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        body.provider_id,
        body.city,
        body.language,
        body.description,
        body.status,
        id,
        parseInt(tenantId)
      ]
    );

    // AUDIT: Log guide update with changes
    const changes: Record<string, any> = {};
    if (body.city !== existingGuide.city) changes.city = body.city;
    if (body.language !== existingGuide.language) changes.language = body.language;
    if (body.status !== existingGuide.status) changes.status = body.status;

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_UPDATED,
      AuditResources.PROVIDER,
      id.toString(),
      changes,
      {
        provider_type: 'guide',
        fields_updated: Object.keys(changes),
      },
      request
    );

    // Fetch and return the updated guide
    const [updatedGuide] = await query(
      'SELECT * FROM guides WHERE id = ?',
      [id]
    ) as Guide[];

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      guide_id: id,
    });

    const response = NextResponse.json(updatedGuide);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update guide',
      500,
      undefined,
      requestId
    );
  }
}
