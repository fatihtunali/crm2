import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

// GET - Fetch all entrance fees with their pricing
export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Sort parameters
    const sortParam = searchParams.get('sort') || 'ef.city,ef.site_name';
    const orderByClause = parseSortParams(sortParam) || 'ef.city ASC, ef.site_name ASC';

    // Build WHERE conditions manually with table qualifiers
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

    // Build base query
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
      SELECT COUNT(DISTINCT ef.id) as total
      FROM entrance_fees ef
      LEFT JOIN providers p ON ef.provider_id = p.id
      LEFT JOIN entrance_fee_pricing efp ON ef.id = efp.entrance_fee_id
        AND efp.status = 'active'
        AND CURDATE() BETWEEN efp.start_date AND efp.end_date
    `;

    // Build complete SQL queries
    let dataSql = baseSelect;
    let countSql = baseCount;

    if (whereClause) {
      dataSql += ` WHERE ${whereClause}`;
      countSql += ` WHERE ${whereClause}`;
    }

    dataSql += ` ORDER BY ${orderByClause} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count params (without pagination params)
    const countParams = params.slice(0, -2);

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(dataSql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    return NextResponse.json(buildPagedResponse(rows, total, page, pageSize));
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch entrance fees'));
  }
}

// POST - Create new entrance fee
export async function POST(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
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
      site_name,
      city,
      description,
      latitude,
      longitude,
      google_maps_url,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website
    } = body;

    const result = await query(
      `INSERT INTO entrance_fees (
        google_place_id, organization_id, site_name, city, description,
        latitude, longitude, google_maps_url,
        photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        google_place_id, tenantId, site_name, city, description,
        latitude, longitude, google_maps_url,
        photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website
      ]
    );

    const insertId = (result as any).insertId;
    const location = `/api/entrance-fees/${insertId}`;

    const response = NextResponse.json(
      { id: insertId, site_name, city, status: 'active' },
      {
        status: 201,
        headers: {
          Location: location,
        },
      }
    );

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to create entrance fee'));
  }
}

