/**
 * Entrance Fees API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized pagination (page[size] & page[number])
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement
 * - Audit logging
 * - Hypermedia links (self, first, prev, next, last)
 *
 * GET  /api/entrance-fees - List entrance fees with pagination
 * POST /api/entrance-fees - Create new entrance fee
 * PUT  /api/entrance-fees - Update entrance fee
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  parseStandardPaginationParams,
  parseSortParams,
  buildStandardListResponse,
} from '@/lib/pagination';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// GET - Fetch all entrance fees with their pricing
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

    // 4. Parse sort (default: city, site_name)
    const sortParam = searchParams.get('sort') || 'ef.city,ef.site_name';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'site_name', 'city', 'description', 'status', 'created_at', 'updated_at'];
    const orderByClause = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'ef.city ASC, ef.site_name ASC';

    // 5. Build WHERE conditions
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('ef.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('ef.status = ?');
      params.push(statusFilter);
    }

    // City filter
    const cityFilter = searchParams.get('city');
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push('ef.city = ?');
      params.push(cityFilter);
    }

    // Build search clause
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';
    if (searchTerm && searchTerm.trim() !== '') {
      whereConditions.push('(ef.site_name LIKE ? OR ef.city LIKE ? OR ef.description LIKE ?)');
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // 6. Build base query
    const baseSelect = `
      SELECT
        ef.*,
        p.provider_name,
        efp.id as pricing_id,
        efp.season_name,
        efp.start_date as season_start,
        efp.end_date as season_end,
        efp.currency,
        efp.adult_price,
        efp.child_price,
        efp.student_price
      FROM entrance_fees ef
      LEFT JOIN providers p ON ef.provider_id = p.id
      LEFT JOIN entrance_fee_pricing efp ON ef.id = efp.entrance_fee_id
        AND efp.status = 'active'
        AND CURDATE() BETWEEN efp.start_date AND efp.end_date
    `;

    const baseCount = `
      SELECT COUNT(DISTINCT ef.id) as count
      FROM entrance_fees ef
      LEFT JOIN providers p ON ef.provider_id = p.id
      LEFT JOIN entrance_fee_pricing efp ON ef.id = efp.entrance_fee_id
        AND efp.status = 'active'
        AND CURDATE() BETWEEN efp.start_date AND efp.end_date
    `;

    // 7. Build complete SQL queries
    let dataSql = baseSelect;
    let countSql = baseCount;

    if (whereClause) {
      dataSql += ` WHERE ${whereClause}`;
      countSql += ` WHERE ${whereClause}`;
    }

    dataSql += ` ORDER BY ${orderByClause} LIMIT ? OFFSET ?`;
    const dataParams = [...params, pageSize, offset];
    const countParams = [...params];

    // 8. Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(dataSql, dataParams),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].count;

    // 9. Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 10. Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (statusFilter) appliedFilters.status = statusFilter;
    if (cityFilter) appliedFilters.city = cityFilter;
    if (searchTerm) appliedFilters.search = searchTerm;

    // 11. Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      rows,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // 12. Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // 13. Log response
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
      'Failed to fetch entrance fees',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new entrance fee
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

    if (idempotencyKey) {
      const existing = await query(
        'SELECT * FROM entrance_fees WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        const existingFee = existing[0];

        logResponse(requestId, 201, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          entrance_fee_id: existingFee.id,
          idempotent: true,
        });

        const response = NextResponse.json(existingFee, {
          status: 201,
          headers: {
            'Location': `/api/entrance-fees/${existingFee.id}`,
          },
        });
        response.headers.set('X-Request-Id', requestId);
        addRateLimitHeaders(response, rateLimit);
        return response;
      }
    }

    // 4. Parse and validate request body
    const body = await request.json();

    // 5. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!body.site_name || body.site_name.trim() === '') {
      validationErrors.push({
        field: 'site_name',
        issue: 'required',
        message: 'Site name is required'
      });
    }

    if (!body.city || body.city.trim() === '') {
      validationErrors.push({
        field: 'city',
        issue: 'required',
        message: 'City is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 6. Build INSERT query
    const insertFields = [
      'google_place_id', 'organization_id', 'site_name', 'city', 'description',
      'latitude', 'longitude', 'google_maps_url',
      'photo_url_1', 'photo_url_2', 'photo_url_3',
      'rating', 'user_ratings_total', 'website', 'status'
    ];

    const insertValues = [
      body.google_place_id || null,
      parseInt(tenantId),
      body.site_name,
      body.city,
      body.description || null,
      body.latitude || null,
      body.longitude || null,
      body.google_maps_url || null,
      body.photo_url_1 || null,
      body.photo_url_2 || null,
      body.photo_url_3 || null,
      body.rating || null,
      body.user_ratings_total || null,
      body.website || null,
      'active'
    ];

    // Add idempotency_key if provided
    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO entrance_fees (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // 7. Fetch created entrance fee
    const [createdFee] = await query(
      'SELECT * FROM entrance_fees WHERE id = ?',
      [insertId]
    ) as any[];

    // 8. AUDIT: Log entrance fee creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_CREATED,
      AuditResources.ENTRANCE_FEE,
      insertId.toString(),
      {
        site_name: body.site_name,
        city: body.city,
      },
      {
        status: 'active',
      },
      request
    );

    // 9. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      entrance_fee_id: insertId,
    });

    // 10. Return 201 Created with Location header
    const response = NextResponse.json(createdFee, {
      status: 201,
      headers: {
        'Location': `/api/entrance-fees/${insertId}`,
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
      'Failed to create entrance fee',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update entrance fee
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Parse and validate request body
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Entrance fee ID is required' }],
        requestId
      );
    }

    // 3. Verify the entrance fee exists and belongs to this tenant
    const [existingFee] = await query(
      'SELECT * FROM entrance_fees WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingFee) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Entrance fee not found',
        404,
        undefined,
        requestId
      );
    }

    // 4. SECURITY: Update only if belongs to user's organization
    await query(
      `UPDATE entrance_fees SET
        provider_id = ?,
        site_name = ?,
        city = ?,
        description = ?,
        google_place_id = ?,
        latitude = ?,
        longitude = ?,
        google_maps_url = ?,
        photo_url_1 = ?,
        photo_url_2 = ?,
        photo_url_3 = ?,
        rating = ?,
        user_ratings_total = ?,
        website = ?,
        status = ?
      WHERE id = ? AND organization_id = ?`,
      [
        updateFields.provider_id !== undefined ? updateFields.provider_id : existingFee.provider_id,
        updateFields.site_name !== undefined ? updateFields.site_name : existingFee.site_name,
        updateFields.city !== undefined ? updateFields.city : existingFee.city,
        updateFields.description !== undefined ? updateFields.description : existingFee.description,
        updateFields.google_place_id !== undefined ? updateFields.google_place_id : existingFee.google_place_id,
        updateFields.latitude !== undefined ? updateFields.latitude : existingFee.latitude,
        updateFields.longitude !== undefined ? updateFields.longitude : existingFee.longitude,
        updateFields.google_maps_url !== undefined ? updateFields.google_maps_url : existingFee.google_maps_url,
        updateFields.photo_url_1 !== undefined ? updateFields.photo_url_1 : existingFee.photo_url_1,
        updateFields.photo_url_2 !== undefined ? updateFields.photo_url_2 : existingFee.photo_url_2,
        updateFields.photo_url_3 !== undefined ? updateFields.photo_url_3 : existingFee.photo_url_3,
        updateFields.rating !== undefined ? updateFields.rating : existingFee.rating,
        updateFields.user_ratings_total !== undefined ? updateFields.user_ratings_total : existingFee.user_ratings_total,
        updateFields.website !== undefined ? updateFields.website : existingFee.website,
        updateFields.status !== undefined ? updateFields.status : existingFee.status,
        id,
        parseInt(tenantId)
      ]
    );

    // 5. AUDIT: Log entrance fee update
    const changes: Record<string, any> = {};
    if (updateFields.site_name !== undefined && updateFields.site_name !== existingFee.site_name) {
      changes.site_name = updateFields.site_name;
    }
    if (updateFields.city !== undefined && updateFields.city !== existingFee.city) {
      changes.city = updateFields.city;
    }
    if (updateFields.status !== undefined && updateFields.status !== existingFee.status) {
      changes.status = updateFields.status;
    }

    if (Object.keys(changes).length > 0) {
      await auditLog(
        parseInt(tenantId),
        user.userId,
        AuditActions.PROVIDER_UPDATED,
        AuditResources.ENTRANCE_FEE,
        id.toString(),
        changes,
        {
          fields_updated: Object.keys(changes),
        },
        request
      );
    }

    // 6. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      entrance_fee_id: id,
    });

    const response = NextResponse.json({ success: true, message: 'Entrance fee updated successfully' });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update entrance fee',
      500,
      undefined,
      requestId
    );
  }
}
