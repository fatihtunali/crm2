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
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// GET - Fetch all hotels with their pricing (with proper table qualifiers)
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

    // 3. Parse pagination (supports both old and new format)
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 4. Extract filters
    const statusFilter = searchParams.get('status');
    const starRatingFilter = searchParams.get('star_rating');
    const hotelCategoryFilter = searchParams.get('hotel_category');
    const cityFilter = searchParams.get('city');

    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization
      'h.organization_id': parseInt(tenantId)
    };

    // Archive filter (Phase 3: default exclude archived)
    const includeArchived = searchParams.get('include_archived') === 'true';
    if (!includeArchived) {
      filters.archived_at = null;
    }

    if (statusFilter && statusFilter !== 'all') {
      filters['h.status'] = statusFilter;
    }

    if (starRatingFilter && starRatingFilter !== 'all') {
      filters['h.star_rating'] = parseInt(starRatingFilter);
    }

    if (hotelCategoryFilter && hotelCategoryFilter !== 'all') {
      filters['h.hotel_category'] = hotelCategoryFilter;
    }

    if (cityFilter && cityFilter !== 'all') {
      filters['h.city'] = cityFilter;
    }

    // 5. Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // 6. Parse sort (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns
    const ALLOWED_COLUMNS = [
      'id', 'hotel_name', 'city', 'region', 'star_rating', 'hotel_category',
      'created_at', 'updated_at', 'status'
    ];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'h.created_at DESC';

    // 7. Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // 8. Build search clause
    const searchClause = buildSearchClause(searchTerm, [
      'h.hotel_name',
      'h.city',
      'h.region',
    ]);

    // 9. Build main query
    const baseQuery = `
      SELECT
        h.*,
        hp.id as pricing_id,
        hp.season_name,
        hp.start_date as season_start,
        hp.end_date as season_end,
        hp.currency,
        hp.double_room_bb,
        hp.single_supplement_bb,
        hp.triple_room_bb,
        hp.child_0_6_bb,
        hp.child_6_12_bb,
        hp.hb_supplement,
        hp.fb_supplement,
        hp.ai_supplement,
        hp.base_meal_plan
      FROM hotels h
      LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
        AND hp.status = 'active'
        AND CURDATE() BETWEEN hp.start_date AND hp.end_date
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
    const countBaseQuery = 'SELECT COUNT(*) as count FROM hotels h';
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
    if (starRatingFilter) appliedFilters.star_rating = starRatingFilter;
    if (hotelCategoryFilter) appliedFilters.hotel_category = hotelCategoryFilter;
    if (cityFilter) appliedFilters.city = cityFilter;
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
      'An unexpected error occurred while fetching hotels',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new hotel
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
        'SELECT * FROM hotels WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        const existingHotel = existing[0];

        logResponse(requestId, 201, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          hotel_id: existingHotel.id,
          idempotent: true,
        });

        const response = NextResponse.json(existingHotel, {
          status: 201,
          headers: {
            'Location': `/api/hotels/${existingHotel.id}`,
          },
        });
        response.headers.set('X-Request-Id', requestId);
        addRateLimitHeaders(response, rateLimit);
        return response;
      }
    }

    const body = await request.json();
    const {
      google_place_id,
      organization_id,
      hotel_name,
      city,
      star_rating,
      hotel_category,
      room_count,
      is_boutique,
      address,
      latitude,
      longitude,
      google_maps_url,
      contact_phone,
      contact_email,
      notes,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website,
      editorial_summary,
      place_types,
      price_level,
      business_status,
      region
    } = body;

    // 4. Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!hotel_name || hotel_name.trim() === '') {
      validationErrors.push({
        field: 'hotel_name',
        issue: 'required',
        message: 'Hotel name is required'
      });
    }

    if (!city || city.trim() === '') {
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

    // 5. Insert hotel
    const insertFields = [
      'google_place_id', 'organization_id', 'hotel_name', 'city', 'star_rating', 'hotel_category',
      'room_count', 'is_boutique', 'address', 'latitude', 'longitude', 'google_maps_url',
      'contact_phone', 'contact_email', 'notes', 'photo_url_1', 'photo_url_2', 'photo_url_3',
      'rating', 'user_ratings_total', 'website', 'editorial_summary', 'place_types',
      'price_level', 'business_status', 'region', 'status'
    ];

    const insertValues = [
      google_place_id, parseInt(tenantId), hotel_name, city, star_rating, hotel_category,
      room_count, is_boutique, address, latitude, longitude, google_maps_url,
      contact_phone, contact_email, notes, photo_url_1, photo_url_2, photo_url_3,
      rating, user_ratings_total, website, editorial_summary, place_types,
      price_level, business_status, region, 'active'
    ];

    // Add idempotency_key if provided
    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO hotels (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // 6. Fetch created hotel
    const [createdHotel] = await query(
      'SELECT * FROM hotels WHERE id = ?',
      [insertId]
    ) as any[];

    // 7. AUDIT: Log hotel creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_CREATED,
      AuditResources.PROVIDER,
      insertId.toString(),
      {
        hotel_name,
        city,
        star_rating,
      },
      {
        provider_type: 'hotel',
        status: 'active',
      },
      request
    );

    // 8. Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      hotel_id: insertId,
    });

    // 9. Return 201 Created with Location header
    const response = NextResponse.json(createdHotel, {
      status: 201,
      headers: {
        'Location': `/api/hotels/${insertId}`,
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
      'Failed to create hotel',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update hotel
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Hotel ID is required' }],
        requestId
      );
    }

    // Fetch existing hotel for audit trail
    const [existingHotel] = await query(
      'SELECT * FROM hotels WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingHotel) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Hotel not found',
        404,
        undefined,
        requestId
      );
    }

    // SECURITY: Update only if belongs to user's organization
    await query(
      `UPDATE hotels SET
        google_place_id = ?, hotel_name = ?, city = ?, star_rating = ?,
        hotel_category = ?, room_count = ?, is_boutique = ?, address = ?,
        latitude = ?, longitude = ?, google_maps_url = ?, contact_phone = ?,
        contact_email = ?, notes = ?, photo_url_1 = ?, photo_url_2 = ?,
        photo_url_3 = ?, rating = ?, user_ratings_total = ?, website = ?,
        editorial_summary = ?, place_types = ?, price_level = ?,
        business_status = ?, status = ?, updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        updateFields.google_place_id, updateFields.hotel_name, updateFields.city,
        updateFields.star_rating, updateFields.hotel_category, updateFields.room_count,
        updateFields.is_boutique, updateFields.address, updateFields.latitude,
        updateFields.longitude, updateFields.google_maps_url, updateFields.contact_phone,
        updateFields.contact_email, updateFields.notes, updateFields.photo_url_1,
        updateFields.photo_url_2, updateFields.photo_url_3, updateFields.rating,
        updateFields.user_ratings_total, updateFields.website, updateFields.editorial_summary,
        updateFields.place_types, updateFields.price_level, updateFields.business_status,
        updateFields.status, id, parseInt(tenantId)
      ]
    );

    // AUDIT: Log hotel update with changes
    const changes: Record<string, any> = {};
    if (updateFields.hotel_name !== existingHotel.hotel_name) changes.hotel_name = updateFields.hotel_name;
    if (updateFields.city !== existingHotel.city) changes.city = updateFields.city;
    if (updateFields.status !== existingHotel.status) changes.status = updateFields.status;

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_UPDATED,
      AuditResources.PROVIDER,
      id.toString(),
      changes,
      {
        provider_type: 'hotel',
        fields_updated: Object.keys(changes),
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      hotel_id: id,
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
      'Failed to update hotel',
      500,
      undefined,
      requestId
    );
  }
}

