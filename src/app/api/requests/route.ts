/**
 * Customer Requests API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized pagination (page[size] & page[number])
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement
 * - Audit logging
 * - Hypermedia links (self, first, prev, next, last)
 *
 * GET  /api/requests - List requests with pagination
 * POST /api/requests - Create new request
 * PUT  /api/requests - Update request
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
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';
import { createMoney } from '@/lib/money';

// GET - Fetch all customer requests with standardized pagination
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'requests', 'read');
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
    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization
      organization_id: parseInt(tenantId)
    };

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    const tourTypeFilter = searchParams.get('tour_type');
    if (tourTypeFilter && tourTypeFilter !== 'all') {
      filters.tour_type = tourTypeFilter;
    }

    const hotelCategoryFilter = searchParams.get('hotel_category');
    if (hotelCategoryFilter && hotelCategoryFilter !== 'all') {
      filters.hotel_category = hotelCategoryFilter;
    }

    const sourceFilter = searchParams.get('source');
    if (sourceFilter && sourceFilter !== 'all') {
      filters.source = sourceFilter;
    }

    // 5. Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // 6. Parse sort (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns
    const ALLOWED_COLUMNS = [
      'id', 'customer_name', 'customer_email', 'destination', 'start_date',
      'end_date', 'status', 'tour_type', 'hotel_category', 'source',
      'created_at', 'updated_at'
    ];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'created_at DESC';

    // 7. Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // 8. Build search clause
    const searchClause = buildSearchClause(searchTerm, [
      'customer_name',
      'customer_email',
      'destination',
    ]);

    // 9. Build main query
    const baseQuery = `
      SELECT
        id, uuid, customer_name, customer_email, customer_phone,
        destination, start_date, end_date, adults, children,
        total_price, price_per_person, status, tour_type,
        hotel_category, source, created_at, updated_at
      FROM customer_itineraries
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
    const countBaseQuery = 'SELECT COUNT(*) as count FROM customer_itineraries';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause,
    });

    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.count || 0;

    // 12. Transform rows to include Money types
    const transformedRows = (rows as any[]).map(row => ({
      ...row,
      total_price: createMoney(parseFloat(row.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(row.price_per_person || 0), 'EUR')
    }));

    // 13. Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 14. Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (statusFilter) appliedFilters.status = statusFilter;
    if (tourTypeFilter) appliedFilters.tour_type = tourTypeFilter;
    if (hotelCategoryFilter) appliedFilters.hotel_category = hotelCategoryFilter;
    if (sourceFilter) appliedFilters.source = sourceFilter;
    if (searchTerm) appliedFilters.search = searchTerm;

    // 15. Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      transformedRows,
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
      'Failed to fetch requests',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new customer request
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'requests', 'create');
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
        'SELECT * FROM customer_itineraries WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        const existingRequest = existing[0];

        logResponse(requestId, 201, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          request_id: existingRequest.id,
          idempotent: true,
        });

        const transformedRequest = {
          ...existingRequest,
          total_price: createMoney(parseFloat(existingRequest.total_price || 0), 'EUR'),
          price_per_person: createMoney(parseFloat(existingRequest.price_per_person || 0), 'EUR')
        };

        const response = NextResponse.json(transformedRequest, {
          status: 201,
          headers: {
            'Location': `/api/requests/${existingRequest.id}`,
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

    if (!body.customer_name || body.customer_name.trim() === '') {
      validationErrors.push({
        field: 'customer_name',
        issue: 'required',
        message: 'Customer name is required'
      });
    }

    if (!body.customer_email || body.customer_email.trim() === '') {
      validationErrors.push({
        field: 'customer_email',
        issue: 'required',
        message: 'Customer email is required'
      });
    }

    if (!body.destination || body.destination.trim() === '') {
      validationErrors.push({
        field: 'destination',
        issue: 'required',
        message: 'Destination is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 6. Generate UUID
    const uuid = crypto.randomUUID();

    // 7. Calculate price per person
    const totalPax = (body.adults || 0) + (body.children || 0);
    const pricePerPerson = totalPax > 0 ? (body.total_price || 0) / totalPax : 0;

    // 8. Build INSERT query
    const insertFields = [
      'uuid', 'organization_id', 'customer_name', 'customer_email', 'customer_phone',
      'destination', 'start_date', 'end_date', 'adults', 'children',
      'hotel_category', 'tour_type', 'special_requests', 'total_price',
      'price_per_person', 'status', 'source', 'city_nights'
    ];

    const insertValues = [
      uuid,
      parseInt(tenantId),
      body.customer_name,
      body.customer_email,
      body.customer_phone || null,
      body.destination,
      body.start_date || null,
      body.end_date || null,
      body.adults || 0,
      body.children || 0,
      body.hotel_category || null,
      body.tour_type || null,
      body.special_requests || null,
      body.total_price || 0,
      pricePerPerson,
      'pending',
      body.source || 'manual',
      '[]'
    ];

    // Add idempotency_key if provided
    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO customer_itineraries (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // 9. Fetch created request
    const [createdRequest] = await query(
      'SELECT * FROM customer_itineraries WHERE id = ?',
      [insertId]
    ) as any[];

    // 10. Transform to include Money types
    const transformedRequest = {
      ...createdRequest,
      total_price: createMoney(parseFloat(createdRequest.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(createdRequest.price_per_person || 0), 'EUR')
    };

    // 11. AUDIT: Log request creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.REQUEST_CREATED,
      AuditResources.REQUEST,
      insertId.toString(),
      {
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        destination: body.destination,
      },
      {
        uuid,
        status: 'pending',
        source: body.source || 'manual',
      },
      request
    );

    // 12. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      request_id: insertId,
      uuid,
    });

    // 13. Return 201 Created with Location header
    const response = NextResponse.json(transformedRequest, {
      status: 201,
      headers: {
        'Location': `/api/requests/${insertId}`,
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
      'Failed to create request',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update customer request
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'requests', 'update');
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
        [{ field: 'id', issue: 'required', message: 'Request ID is required' }],
        requestId
      );
    }

    // 3. Fetch existing request for audit trail
    const [existingRequest] = await query(
      'SELECT * FROM customer_itineraries WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingRequest) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Request not found',
        404,
        undefined,
        requestId
      );
    }

    // 4. Calculate price per person if needed
    const totalPax = (updateFields.adults || existingRequest.adults) +
                     (updateFields.children || existingRequest.children);
    const totalPrice = updateFields.total_price !== undefined ?
                       updateFields.total_price : existingRequest.total_price;
    const pricePerPerson = totalPax > 0 ? totalPrice / totalPax : 0;

    // 5. SECURITY: Update only if belongs to user's organization
    await query(
      `UPDATE customer_itineraries SET
        customer_name = ?,
        customer_email = ?,
        customer_phone = ?,
        destination = ?,
        start_date = ?,
        end_date = ?,
        adults = ?,
        children = ?,
        hotel_category = ?,
        tour_type = ?,
        special_requests = ?,
        total_price = ?,
        price_per_person = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        updateFields.customer_name !== undefined ? updateFields.customer_name : existingRequest.customer_name,
        updateFields.customer_email !== undefined ? updateFields.customer_email : existingRequest.customer_email,
        updateFields.customer_phone !== undefined ? updateFields.customer_phone : existingRequest.customer_phone,
        updateFields.destination !== undefined ? updateFields.destination : existingRequest.destination,
        updateFields.start_date !== undefined ? updateFields.start_date : existingRequest.start_date,
        updateFields.end_date !== undefined ? updateFields.end_date : existingRequest.end_date,
        updateFields.adults !== undefined ? updateFields.adults : existingRequest.adults,
        updateFields.children !== undefined ? updateFields.children : existingRequest.children,
        updateFields.hotel_category !== undefined ? updateFields.hotel_category : existingRequest.hotel_category,
        updateFields.tour_type !== undefined ? updateFields.tour_type : existingRequest.tour_type,
        updateFields.special_requests !== undefined ? updateFields.special_requests : existingRequest.special_requests,
        totalPrice,
        pricePerPerson,
        updateFields.status !== undefined ? updateFields.status : existingRequest.status,
        id,
        parseInt(tenantId)
      ]
    );

    // 6. AUDIT: Log request update with changes
    const changes: Record<string, any> = {};
    if (updateFields.customer_name !== undefined && updateFields.customer_name !== existingRequest.customer_name) {
      changes.customer_name = updateFields.customer_name;
    }
    if (updateFields.status !== undefined && updateFields.status !== existingRequest.status) {
      changes.status = updateFields.status;
    }
    if (updateFields.destination !== undefined && updateFields.destination !== existingRequest.destination) {
      changes.destination = updateFields.destination;
    }

    if (Object.keys(changes).length > 0) {
      await auditLog(
        parseInt(tenantId),
        user.userId,
        AuditActions.REQUEST_UPDATED,
        AuditResources.REQUEST,
        id.toString(),
        changes,
        {
          uuid: existingRequest.uuid,
          fields_updated: Object.keys(changes),
        },
        request
      );
    }

    // 7. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      request_id: id,
    });

    const response = NextResponse.json({ success: true });
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update request',
      500,
      undefined,
      requestId
    );
  }
}
