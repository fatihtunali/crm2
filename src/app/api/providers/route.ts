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

    // Build WHERE clause manually with proper table prefixes
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Tenant scoping (always required)
    whereConditions.push('p.organization_id = ?');
    params.push(tenantId);

    // Archive filter (default: exclude archived)
    const includeArchived = searchParams.get('include_archived') === 'true';
    if (!includeArchived) {
      whereConditions.push('p.archived_at IS NULL');
    }

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('p.status = ?');
      params.push(statusFilter);
    }

    // City filter
    const cityFilter = searchParams.get('city');
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push('p.city = ?');
      params.push(cityFilter);
    }

    // Provider type filter (check both single type and types array for multi-type providers)
    const providerTypeFilter = searchParams.get('provider_type');
    if (providerTypeFilter && providerTypeFilter !== 'all') {
      whereConditions.push('(p.provider_type = ? OR JSON_CONTAINS(p.provider_types, ?))');
      params.push(providerTypeFilter, JSON.stringify(providerTypeFilter));
    }

    // Exclude hotel and guide providers only if include_all is not set
    // Check both single type and types array for multi-type providers
    const includeAll = searchParams.get('include_all') === 'true';
    if (!includeAll) {
      whereConditions.push(`(
        p.provider_type NOT IN ('hotel', 'guide')
        AND NOT JSON_CONTAINS(p.provider_types, '"hotel"')
        AND NOT JSON_CONTAINS(p.provider_types, '"guide"')
      )`);
    }

    // Search across multiple fields
    const searchTerm = searchParams.get('search') || '';
    if (searchTerm) {
      whereConditions.push('(p.provider_name LIKE ? OR p.city LIKE ? OR p.contact_email LIKE ?)');
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const finalWhereSQL = whereConditions.join(' AND ');
    const finalParams = params;

    // Default sort order (favorites first, then by name)
    const orderBy = 'p.favorite_priority DESC, p.provider_name ASC';

    // Build main query with service counts and parent info
    let sql = `
      SELECT
        p.id,
        p.organization_id,
        p.provider_name,
        p.provider_type,
        p.provider_types,
        p.city,
        p.contact_email,
        p.contact_phone,
        p.status,
        p.created_at,
        p.updated_at,
        p.parent_provider_id,
        p.is_parent,
        p.company_tax_id,
        p.company_legal_name,
        parent.provider_name as parent_company_name,
        parent.company_legal_name as parent_legal_name,
        parent.company_tax_id as parent_tax_id,
        (SELECT COUNT(*) FROM tours WHERE provider_id = p.id) as daily_tours_count,
        (SELECT COUNT(*) FROM intercity_transfers WHERE provider_id = p.id) as transfers_count,
        (SELECT COUNT(*) FROM vehicles WHERE provider_id = p.id) as vehicles_count,
        (SELECT COUNT(*) FROM meal_pricing WHERE provider_id = p.id) as restaurants_count,
        (SELECT COUNT(*) FROM entrance_fees WHERE provider_id = p.id) as entrance_fees_count,
        (SELECT COUNT(*) FROM extra_expenses WHERE provider_id = p.id) as extra_expenses_count,
        (SELECT COUNT(*) FROM providers WHERE parent_provider_id = p.id) as child_divisions_count
      FROM providers p
      LEFT JOIN providers parent ON p.parent_provider_id = parent.id
      WHERE ${finalWhereSQL}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Build count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM providers p
      LEFT JOIN providers parent ON p.parent_provider_id = parent.id
      WHERE ${finalWhereSQL}
    `;

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
      provider_types = null,
      city,
      address,
      contact_email,
      contact_phone,
      notes,
      status = 'active',
      is_parent = 0,
      parent_provider_id = null,
      company_tax_id = null,
      company_legal_name = null
    } = body;

    // Validate required fields
    const errors = [];
    if (!provider_name) errors.push({ field: 'provider_name', issue: 'required', message: 'provider_name is required' });
    if (!provider_type) errors.push({ field: 'provider_type', issue: 'required', message: 'provider_type is required' });

    // Validate favorite_priority (0-10)
    if (body.favorite_priority !== undefined && body.favorite_priority !== null) {
      const priority = parseInt(body.favorite_priority);
      if (isNaN(priority) || priority < 0 || priority > 10) {
        errors.push({ field: 'favorite_priority', issue: 'invalid_range', message: 'Favorite priority must be between 0 and 10' });
      }
    }

    if (errors.length > 0) {
      return validationErrorResponse('Validation failed', errors, requestId);
    }

    // Insert provider with organization_id and parent/child fields
    const result = await query(
      `INSERT INTO providers (
        organization_id,
        provider_name,
        provider_type,
        provider_types,
        city,
        address,
        contact_email,
        contact_phone,
        notes,
        status,
        is_parent,
        parent_provider_id,
        company_tax_id,
        company_legal_name,
        favorite_priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        provider_name,
        provider_type,
        provider_types ? JSON.stringify(provider_types) : JSON.stringify([provider_type]),
        city || null,
        address || null,
        contact_email || null,
        contact_phone || null,
        notes || null,
        status,
        is_parent ? 1 : 0,
        parent_provider_id || null,
        company_tax_id || null,
        company_legal_name || null,
        body.favorite_priority || 0
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

// PUT - Update provider
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Enforce tenant scoping
    const authResult = await requirePermission(request, 'providers', 'update');
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

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return validationErrorResponse(
        'Validation failed',
        [{ field: 'id', issue: 'required', message: 'Provider ID is required' }],
        requestId
      );
    }

    // Validate favorite_priority if provided
    if (body.favorite_priority !== undefined && body.favorite_priority !== null) {
      const priority = parseInt(body.favorite_priority);
      if (isNaN(priority) || priority < 0 || priority > 10) {
        return validationErrorResponse(
          'Validation failed',
          [{ field: 'favorite_priority', issue: 'invalid_range', message: 'Favorite priority must be between 0 and 10' }],
          requestId
        );
      }
    }

    // Verify provider exists and belongs to tenant
    const [existingProvider] = await query(
      'SELECT * FROM providers WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    ) as any[];

    if (!existingProvider) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Provider not found',
        404,
        undefined,
        requestId
      );
    }

    // Update provider
    await query(
      `UPDATE providers SET
        provider_name = ?,
        provider_type = ?,
        provider_types = ?,
        city = ?,
        address = ?,
        contact_email = ?,
        contact_phone = ?,
        notes = ?,
        status = ?,
        is_parent = ?,
        parent_provider_id = ?,
        company_tax_id = ?,
        company_legal_name = ?,
        favorite_priority = ?
      WHERE id = ? AND organization_id = ?`,
      [
        body.provider_name,
        body.provider_type,
        body.provider_types ? JSON.stringify(body.provider_types) : JSON.stringify([body.provider_type]),
        body.city || null,
        body.address || null,
        body.contact_email || null,
        body.contact_phone || null,
        body.notes || null,
        body.status,
        body.is_parent ? 1 : 0,
        body.parent_provider_id || null,
        body.company_tax_id || null,
        body.company_legal_name || null,
        body.favorite_priority !== undefined ? body.favorite_priority : existingProvider.favorite_priority,
        id,
        tenantId
      ]
    );

    // Fetch updated provider
    const [updatedProvider] = await query(
      'SELECT * FROM providers WHERE id = ?',
      [id]
    ) as any[];

    const response = NextResponse.json(updatedProvider);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      provider_id: id
    });

    return response;
  } catch (error) {
    console.error('Error updating provider:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}
