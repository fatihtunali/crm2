import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB, markIdempotencyKeyProcessing } from '@/middleware/idempotency-db';

// GET - Fetch all meal pricing records with pagination
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
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

    // Default sort order
    const orderByClause = 'mp.restaurant_name ASC, mp.season_name ASC';

    // Build WHERE conditions manually with table qualifiers
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('mp.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('mp.status = ?');
      params.push(statusFilter);
    }

    // City filter
    const cityFilter = searchParams.get('city');
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push('mp.city = ?');
      params.push(cityFilter);
    }

    // Meal type filter
    const mealTypeFilter = searchParams.get('meal_type');
    if (mealTypeFilter && mealTypeFilter !== 'all') {
      whereConditions.push('mp.meal_type = ?');
      params.push(mealTypeFilter);
    }

    // Provider filter
    const providerFilter = searchParams.get('provider_id');
    if (providerFilter && providerFilter !== 'all') {
      whereConditions.push('mp.provider_id = ?');
      params.push(parseInt(providerFilter));
    }

    // Build search clause
    const searchTerm = searchParams.get('search');
    if (searchTerm && searchTerm.trim() !== '') {
      whereConditions.push('(mp.restaurant_name LIKE ? OR mp.city LIKE ?)');
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Base query
    const baseQuery = `
      SELECT
        mp.*,
        p.provider_name
      FROM meal_pricing mp
      LEFT JOIN providers p ON mp.provider_id = p.id
    `;

    // Build WHERE clause SQL
    const whereSQL = whereClause ? `WHERE ${whereClause}` : '';

    // Build main query with pagination
    const mainSQL = `${baseQuery} ${whereSQL} ORDER BY ${orderByClause} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    const countSQL = `SELECT COUNT(*) as total FROM meal_pricing mp LEFT JOIN providers p ON mp.provider_id = p.id ${whereSQL}`;

    // Build count params (without pagination params)
    const countParams = params.slice(0, -2);

    // Execute both queries in parallel
    const [rows, countResult] = await Promise.all([
      query(mainSQL, params),
      query(countSQL, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const baseUrl = new URL(request.url).origin + new URL(request.url).pathname;
    const filters: Record<string, string> = {};
    if (statusFilter && statusFilter !== 'all') filters.status = statusFilter;
    if (cityFilter && cityFilter !== 'all') filters.city = cityFilter;
    if (mealTypeFilter && mealTypeFilter !== 'all') filters.meal_type = mealTypeFilter;
    if (searchTerm) filters.search = searchTerm;

    const responseData = buildStandardListResponse(rows, total, page, pageSize, baseUrl, filters);

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
    console.error('Error fetching restaurants:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new meal pricing record
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
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

    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cachedResponse = await checkIdempotencyKeyDB(request, idempotencyKey, Number(tenantId));
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();
    const {
      restaurant_name,
      city,
      meal_type,
      season_name,
      start_date,
      end_date,
      currency,
      adult_lunch_price,
      child_lunch_price,
      adult_dinner_price,
      child_dinner_price,
      menu_description,
      effective_from,
      created_by,
      notes
    } = body;

    const result = await query(
      `INSERT INTO meal_pricing (
        organization_id, restaurant_name, city, meal_type, season_name,
        start_date, end_date, currency, adult_lunch_price, child_lunch_price,
        adult_dinner_price, child_dinner_price, menu_description, effective_from,
        created_by, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        tenantId,
        restaurant_name,
        city,
        meal_type,
        season_name,
        start_date,
        end_date,
        currency,
        adult_lunch_price,
        child_lunch_price,
        adult_dinner_price,
        child_dinner_price,
        menu_description,
        effective_from,
        created_by,
        notes
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch created record
    const [created] = await query(
      'SELECT * FROM meal_pricing WHERE id = ?',
      [insertId]
    ) as any[];

    // Return 201 Created with Location header
    const response = NextResponse.json(created, {
      status: 201,
      headers: {
        Location: `/api/restaurants/${insertId}`,
      }
    });

    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    if (idempotencyKey) {
      await storeIdempotencyKeyDB(idempotencyKey, response, Number(tenantId), user.userId, request);
    }

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      restaurant_id: insertId
    });
    return response;
  } catch (error) {
    console.error('Error creating restaurant:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update restaurant (meal pricing)
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
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
        [{ field: 'id', issue: 'required', message: 'Restaurant ID is required' }],
        requestId
      );
    }

    // Verify the restaurant exists and belongs to this tenant
    const [existingRestaurant] = await query(
      'SELECT id FROM meal_pricing WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingRestaurant) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Restaurant not found or does not belong to your organization',
        404,
        undefined,
        requestId
      );
    }

    // Update the restaurant
    await query(
      `UPDATE meal_pricing SET
        provider_id = ?,
        restaurant_name = ?,
        city = ?,
        meal_type = ?,
        season_name = ?,
        start_date = ?,
        end_date = ?,
        currency = ?,
        adult_lunch_price = ?,
        child_lunch_price = ?,
        adult_dinner_price = ?,
        child_dinner_price = ?,
        menu_description = ?,
        effective_from = ?,
        created_by = ?,
        notes = ?,
        status = ?
      WHERE id = ? AND organization_id = ?`,
      [
        body.provider_id,
        body.restaurant_name,
        body.city,
        body.meal_type,
        body.season_name,
        body.start_date,
        body.end_date,
        body.currency,
        body.adult_lunch_price,
        body.child_lunch_price,
        body.adult_dinner_price,
        body.child_dinner_price,
        body.menu_description,
        body.effective_from,
        body.created_by,
        body.notes,
        body.status,
        id,
        parseInt(tenantId)
      ]
    );

    // Fetch updated record
    const [updated] = await query(
      'SELECT * FROM meal_pricing WHERE id = ?',
      [id]
    ) as any[];

    const response = NextResponse.json(updated);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      restaurant_id: id
    });

    return response;
  } catch (error) {
    console.error('Error updating restaurant:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

