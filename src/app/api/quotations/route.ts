/**
 * Quotations API Endpoint - PHASE 1 FLAGSHIP EXAMPLE
 * Demonstrates all Phase 1 standards:
 * - Standardized pagination with page[size] & page[number]
 * - Hypermedia links (self, first, prev, next, last)
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting with headers
 * - Request/response logging
 *
 * GET    /api/quotations - List quotations with pagination
 * POST   /api/quotations - Create new quotation
 * PUT    /api/quotations - Update quotation
 * DELETE /api/quotations - Soft delete quotation
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
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// GET - Fetch all quotations with standardized pagination
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'quotations', 'read');
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

    // 3. Parse pagination (supports both old and new format)
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 4. Extract filters
    const statusFilter = searchParams.get('status');
    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization
      'q.organization_id': parseInt(tenantId)
    };

    if (statusFilter && statusFilter !== 'all') {
      filters['q.status'] = statusFilter;
    }

    // 5. Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // 6. Parse sort (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns
    const ALLOWED_COLUMNS = [
      'id', 'quote_number', 'customer_name', 'customer_email',
      'destination', 'status', 'start_date', 'end_date',
      'total_price', 'created_at', 'updated_at'
    ];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'q.created_at DESC';

    // 7. Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // 8. Build search clause
    const searchClause = buildSearchClause(searchTerm, [
      'q.customer_name',
      'q.customer_email',
      'q.destination',
      'q.quote_number',
    ]);

    // 9. Build main query
    const baseQuery = `
      SELECT
        q.*,
        (SELECT COUNT(*) FROM quote_days WHERE quote_id = q.id) as total_days
      FROM quotes q
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
    const countBaseQuery = 'SELECT COUNT(*) as count FROM quotes q';
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
    // Log error
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred while fetching quotations',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new quotation
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'quotations', 'create');
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
        'SELECT * FROM quotes WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        const existingQuote = existing[0];

        logResponse(requestId, 201, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          quote_id: existingQuote.id,
          idempotent: true,
        });

        const response = NextResponse.json(existingQuote, {
          status: 201,
          headers: {
            'Location': `/api/quotations/${existingQuote.id}`,
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
      quote_name,
      category,
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup,
      tax,
      transport_pricing_mode,
      season_name,
      valid_from,
      valid_to
    } = body;

    // 5. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!customer_name || customer_name.trim() === '') {
      validationErrors.push({
        field: 'customer_name',
        issue: 'required',
        message: 'Customer name is required'
      });
    }

    if (!customer_email || customer_email.trim() === '') {
      validationErrors.push({
        field: 'customer_email',
        issue: 'required',
        message: 'Customer email is required'
      });
    }

    if (!destination || destination.trim() === '') {
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

    // 6. Generate quote number
    const [lastQuote] = await query(
      'SELECT quote_number FROM quotes ORDER BY id DESC LIMIT 1'
    ) as any[];

    let nextNumber = 1;
    if (lastQuote && lastQuote.quote_number) {
      const match = lastQuote.quote_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const quote_number = `Q-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

    // 7. Build INSERT query
    const insertFields = [
      'organization_id', 'created_by_user_id', 'quote_number', 'category',
      'customer_name', 'customer_email', 'customer_phone', 'destination',
      'start_date', 'end_date', 'tour_type', 'pax', 'adults', 'children',
      'markup', 'tax', 'transport_pricing_mode', 'season_name',
      'valid_from', 'valid_to', 'status'
    ];

    const insertValues = [
      parseInt(tenantId),
      user.userId,
      quote_number,
      category || 'B2C',
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup || 0,
      tax || 0,
      transport_pricing_mode || 'total',
      season_name,
      valid_from || null,
      valid_to || null,
      'draft'
    ];

    // Add idempotency_key if provided
    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO quotes (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // 8. Fetch created quote
    const [createdQuote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [insertId]
    ) as any[];

    // 9. AUDIT: Log quotation creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_CREATED,
      AuditResources.QUOTATION,
      insertId.toString(),
      {
        customer_name,
        customer_email,
        destination,
        start_date,
        end_date,
      },
      {
        quote_number,
        category: category || 'B2C',
        status: 'draft',
      },
      request
    );

    // 10. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quote_id: insertId,
      quote_number,
    });

    // 10. Return 201 Created with Location header
    const response = NextResponse.json(createdQuote, {
      status: 201,
      headers: {
        'Location': `/api/quotations/${insertId}`,
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
      'Failed to create quotation',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update quotation
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'quotations', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Quote ID is required' }],
        requestId
      );
    }

    // Fetch existing quote for audit trail
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingQuote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quotation not found',
        404,
        undefined,
        requestId
      );
    }

    // SECURITY: Update only if belongs to user's organization
    const {
      quote_name,
      category,
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup,
      tax,
      transport_pricing_mode,
      season_name,
      valid_from,
      valid_to,
      status,
      total_price,
      pricing_table
    } = updateFields;

    await query(
      `UPDATE quotes SET
        quote_name = ?, category = ?, customer_name = ?, customer_email = ?,
        customer_phone = ?, destination = ?, start_date = ?, end_date = ?,
        tour_type = ?, pax = ?, adults = ?, children = ?, markup = ?, tax = ?,
        transport_pricing_mode = ?, season_name = ?, valid_from = ?, valid_to = ?,
        status = ?, total_price = ?, pricing_table = ?
      WHERE id = ? AND organization_id = ?`,
      [
        quote_name,
        category,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        tour_type,
        pax,
        adults,
        children,
        markup,
        tax,
        transport_pricing_mode,
        season_name,
        valid_from || null,
        valid_to || null,
        status,
        total_price,
        pricing_table ? JSON.stringify(pricing_table) : null,
        id,
        parseInt(tenantId)
      ]
    );

    // AUDIT: Log quotation update with changes
    const changes: Record<string, any> = {};
    if (customer_name !== existingQuote.customer_name) changes.customer_name = customer_name;
    if (customer_email !== existingQuote.customer_email) changes.customer_email = customer_email;
    if (destination !== existingQuote.destination) changes.destination = destination;
    if (status !== existingQuote.status) changes.status = status;
    if (total_price !== existingQuote.total_price) changes.total_price = total_price;

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      id.toString(),
      changes,
      {
        quote_number: existingQuote.quote_number,
        fields_updated: Object.keys(changes),
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quote_id: id,
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
      'Failed to update quotation',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Soft delete quotation
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'quotations', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const { id } = await request.json();

    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Quote ID is required' }],
        requestId
      );
    }

    // Fetch existing quote for audit trail
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingQuote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quotation not found',
        404,
        undefined,
        requestId
      );
    }

    // SECURITY: Delete only if belongs to user's organization
    await query(
      'UPDATE quotes SET status = ? WHERE id = ? AND organization_id = ?',
      ['expired', id, parseInt(tenantId)]
    );

    // AUDIT: Log quotation deletion (soft delete)
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_DELETED,
      AuditResources.QUOTATION,
      id.toString(),
      {
        status: 'expired',
        previous_status: existingQuote.status,
      },
      {
        quote_number: existingQuote.quote_number,
        customer_name: existingQuote.customer_name,
        deletion_type: 'soft_delete',
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quote_id: id,
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
      'Failed to delete quotation',
      500,
      undefined,
      requestId
    );
  }
}
