import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

// GET - Fetch all hotels with their pricing (with proper table qualifiers)
export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Define allowed columns for ORDER BY (whitelist for security)
    const allowedOrderColumns = [
      'id',
      'hotel_name',
      'city',
      'region',
      'star_rating',
      'hotel_category',
      'created_at',
      'updated_at',
      'status'
    ];

    // Parse sort parameters with whitelist validation (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    const orderBy = parseSortParams(sortParam, allowedOrderColumns);

    // Build WHERE conditions manually with table qualifiers
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('h.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('h.status = ?');
      params.push(statusFilter);
    }

    // Star rating filter
    const starRatingFilter = searchParams.get('star_rating');
    if (starRatingFilter && starRatingFilter !== 'all') {
      whereConditions.push('h.star_rating = ?');
      params.push(parseInt(starRatingFilter));
    }

    // Hotel category filter
    const hotelCategoryFilter = searchParams.get('hotel_category');
    if (hotelCategoryFilter && hotelCategoryFilter !== 'all') {
      whereConditions.push('h.hotel_category = ?');
      params.push(hotelCategoryFilter);
    }

    // City filter
    const cityFilter = searchParams.get('city');
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push('h.city = ?');
      params.push(cityFilter);
    }

    // Build search clause (search in hotel_name, city, region)
    const searchTerm = searchParams.get('search');
    if (searchTerm && searchTerm.trim() !== '') {
      whereConditions.push('(h.hotel_name LIKE ? OR h.city LIKE ? OR h.region LIKE ?)');
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Build main query
    let sql = `
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

    // Add WHERE clause
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY h.${orderBy}`;
    } else {
      sql += ` ORDER BY h.created_at DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `SELECT COUNT(*) as total FROM hotels h`;
    if (whereClause) {
      countSql += ` WHERE ${whereClause}`;
    }

    // Build count params (without pagination params)
    const countParams = params.slice(0, -2);

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const pagedResponse = buildPagedResponse(rows, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch hotels', '/api/hotels')
    );
  }
}

// POST - Create new hotel
export async function POST(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

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

    const result = await query(
      `INSERT INTO hotels (
        google_place_id, organization_id, hotel_name, city, star_rating, hotel_category,
        room_count, is_boutique, address, latitude, longitude, google_maps_url,
        contact_phone, contact_email, notes,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website,
        editorial_summary, place_types, price_level, business_status, region, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        google_place_id, organization_id, hotel_name, city, star_rating, hotel_category,
        room_count, is_boutique, address, latitude, longitude, google_maps_url,
        contact_phone, contact_email, notes,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website,
        editorial_summary, place_types, price_level, business_status, region
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created hotel to return with timestamps
    const [createdHotel] = await query(
      'SELECT * FROM hotels WHERE id = ?',
      [insertId]
    ) as any[];

    const { createdResponse } = await import('@/lib/response');
    const response = createdResponse(createdHotel, `/api/hotels/${insertId}`);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to create hotel', '/api/hotels')
    );
  }
}

// PUT - Update hotel
export async function PUT(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Hotel ID is required',
        instance: request.url,
      });
    }

    // Verify the hotel exists and belongs to this tenant
    const [existingHotel] = await query(
      'SELECT id FROM hotels WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingHotel) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: `Hotel with ID ${id} not found or does not belong to your organization`,
        instance: request.url,
      });
    }

    // Update the hotel
    await query(
      `UPDATE hotels SET
        google_place_id = ?,
        hotel_name = ?,
        city = ?,
        star_rating = ?,
        hotel_category = ?,
        room_count = ?,
        is_boutique = ?,
        address = ?,
        latitude = ?,
        longitude = ?,
        google_maps_url = ?,
        contact_phone = ?,
        contact_email = ?,
        notes = ?,
        photo_url_1 = ?,
        photo_url_2 = ?,
        photo_url_3 = ?,
        rating = ?,
        user_ratings_total = ?,
        website = ?,
        editorial_summary = ?,
        place_types = ?,
        price_level = ?,
        business_status = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        body.google_place_id,
        body.hotel_name,
        body.city,
        body.star_rating,
        body.hotel_category,
        body.room_count,
        body.is_boutique,
        body.address,
        body.latitude,
        body.longitude,
        body.google_maps_url,
        body.contact_phone,
        body.contact_email,
        body.notes,
        body.photo_url_1,
        body.photo_url_2,
        body.photo_url_3,
        body.rating,
        body.user_ratings_total,
        body.website,
        body.editorial_summary,
        body.place_types,
        body.price_level,
        body.business_status,
        body.status,
        id,
        parseInt(tenantId)
      ]
    );

    // Fetch and return the updated hotel
    const [updatedHotel] = await query(
      'SELECT * FROM hotels WHERE id = ?',
      [id]
    ) as any[];

    return successResponse(updatedHotel);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update hotel', '/api/hotels')
    );
  }
}

