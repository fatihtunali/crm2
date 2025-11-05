import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'requests', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'customer_name', 'customer_email', 'destination', 'start_date', 'end_date', 'status', 'tour_type', 'hotel_category', 'source', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Build filters
    const filters: Record<string, any> = {};

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

    // Add tenant filter
    filters.organization_id = parseInt(tenantId);

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in customer_name, customer_email, destination)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', ['customer_name', 'customer_email', 'destination']);

    // Combine where and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Build main query
    let sql = `
      SELECT
        id,
        uuid,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        adults,
        children,
        total_price,
        price_per_person,
        status,
        tour_type,
        hotel_category,
        source,
        created_at,
        updated_at
      FROM customer_itineraries
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
    let countSql = `SELECT COUNT(*) as total FROM customer_itineraries`;
    if (combined.whereSQL) {
      countSql += ` WHERE ${combined.whereSQL}`;
    }

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, combined.params)
    ]);

    const total = (countResult as any)[0].total;

    // Transform rows to include Money types
    const transformedRows = (rows as any[]).map(row => ({
      ...row,
      total_price: createMoney(parseFloat(row.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(row.price_per_person || 0), 'EUR')
    }));

    // Build paged response
    const pagedResponse = buildPagedResponse(transformedRows, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch requests', '/api/requests')
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'requests', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const { checkIdempotencyKey, storeIdempotencyKey } = await import('@/middleware/idempotency');
      const cachedResponse = await checkIdempotencyKey(request, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();

    // Generate UUID
    const uuid = crypto.randomUUID();

    // Calculate price per person
    const totalPax = body.adults + body.children;
    const pricePerPerson = totalPax > 0 ? body.total_price / totalPax : 0;

    const result = await query(
      `INSERT INTO customer_itineraries (
        uuid,
        organization_id,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        adults,
        children,
        hotel_category,
        tour_type,
        special_requests,
        total_price,
        price_per_person,
        status,
        source,
        city_nights
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'manual', '[]')`,
      [
        uuid,
        parseInt(tenantId),
        body.customer_name,
        body.customer_email,
        body.customer_phone || null,
        body.destination,
        body.start_date,
        body.end_date,
        body.adults,
        body.children,
        body.hotel_category || null,
        body.tour_type || null,
        body.special_requests || null,
        body.total_price,
        pricePerPerson
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created request to return with timestamps
    const [createdRequest] = await query(
      'SELECT * FROM customer_itineraries WHERE id = ?',
      [insertId]
    ) as any[];

    // Transform to include Money types
    const transformedRequest = {
      ...createdRequest,
      total_price: createMoney(parseFloat(createdRequest.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(createdRequest.price_per_person || 0), 'EUR')
    };

    const { createdResponse } = await import('@/lib/response');
    const response = createdResponse(transformedRequest, `/api/requests/${insertId}`);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to create request', '/api/requests')
    );
  }
}

// PUT - Update request
export async function PUT(request: NextRequest) {
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'requests', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Request ID is required',
        instance: request.url,
      });
    }

    // Verify the request exists and belongs to this tenant
    const [existingRequest] = await query(
      'SELECT id FROM customer_itineraries WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingRequest) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: `Request with ID ${id} not found or does not belong to your organization`,
        instance: request.url,
      });
    }

    // Calculate price per person
    const totalPax = body.adults + body.children;
    const pricePerPerson = totalPax > 0 ? body.total_price / totalPax : 0;

    // Update the request
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
        body.customer_name,
        body.customer_email,
        body.customer_phone,
        body.destination,
        body.start_date,
        body.end_date,
        body.adults,
        body.children,
        body.hotel_category,
        body.tour_type,
        body.special_requests,
        body.total_price,
        pricePerPerson,
        body.status,
        id,
        parseInt(tenantId)
      ]
    );

    // Fetch and return the updated request
    const [updatedRequest] = await query(
      'SELECT * FROM customer_itineraries WHERE id = ?',
      [id]
    ) as any[];

    // Transform to include Money types
    const transformedRequest = {
      ...updatedRequest,
      total_price: createMoney(parseFloat(updatedRequest.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(updatedRequest.price_per_person || 0), 'EUR')
    };

    return successResponse(transformedRequest);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update request', '/api/requests')
    );
  }
}

