import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { errorResponse, internalServerErrorProblem } from '@/lib/response';

// GET - Fetch all tour packages with their pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    // Search parameters
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // Sort parameters (default: favorites first)
    const sortParam = searchParams.get('sort') || '-favorite_priority,-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'tour_name', 'tour_code', 'city', 'duration_days', 'duration_hours', 'tour_type', 'status', 'created_at', 'updated_at', 'favorite_priority'];
    const orderByClause = parseSortParams(sortParam, ALLOWED_COLUMNS) || 't.favorite_priority DESC, t.tour_name ASC';

    // Filter parameters
    const statusFilter = searchParams.get('status');
    const tourTypeFilter = searchParams.get('tour_type');
    const cityFilter = searchParams.get('city');

    // Build WHERE conditions manually with table qualifiers
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('t.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter (default: only show active tours)
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('t.status = ?');
      params.push(statusFilter);
    } else if (!statusFilter || statusFilter === 'all') {
      // Default: exclude inactive tours
      whereConditions.push("t.status = 'active'");
    }

    // Tour type filter
    if (tourTypeFilter && tourTypeFilter !== 'all') {
      whereConditions.push('t.tour_type = ?');
      params.push(tourTypeFilter);
    }

    // City filter
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push('t.city = ?');
      params.push(cityFilter);
    }

    // Provider filter
    const providerFilter = searchParams.get('provider_id');
    if (providerFilter && providerFilter !== 'all') {
      whereConditions.push('t.provider_id = ?');
      params.push(parseInt(providerFilter));
    }

    // Search filter
    if (searchTerm) {
      whereConditions.push('(t.tour_name LIKE ? OR t.city LIKE ? OR t.description LIKE ?)');
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Build base query - use subquery to get only the first active pricing per tour
    const baseSelect = `
      SELECT
        t.*,
        p.provider_name,
        tp.id as pricing_id,
        tp.season_name,
        tp.start_date as season_start,
        tp.end_date as season_end,
        tp.currency,
        tp.sic_price_2_pax,
        tp.sic_price_4_pax,
        tp.sic_price_6_pax,
        tp.sic_price_8_pax,
        tp.sic_price_10_pax,
        tp.pvt_price_2_pax,
        tp.pvt_price_4_pax,
        tp.pvt_price_6_pax,
        tp.pvt_price_8_pax,
        tp.pvt_price_10_pax,
        tp.sic_provider_id,
        tp.pvt_provider_id,
        sic_provider.provider_name as sic_provider_name,
        pvt_provider.provider_name as pvt_provider_name
      FROM tours t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
        AND tp.status = 'active'
        AND CURDATE() BETWEEN tp.start_date AND tp.end_date
        AND tp.id = (
          SELECT MIN(tp2.id)
          FROM tour_pricing tp2
          WHERE tp2.tour_id = t.id
            AND tp2.status = 'active'
            AND CURDATE() BETWEEN tp2.start_date AND tp2.end_date
        )
      LEFT JOIN providers sic_provider ON tp.sic_provider_id = sic_provider.id
      LEFT JOIN providers pvt_provider ON tp.pvt_provider_id = pvt_provider.id
    `;

    const baseCount = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tours t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
        AND tp.status = 'active'
        AND CURDATE() BETWEEN tp.start_date AND tp.end_date
    `;

    // Build complete SQL queries
    let dataSql = baseSelect;
    let countSql = baseCount;

    if (whereClause) {
      dataSql += ` WHERE ${whereClause}`;
      countSql += ` WHERE ${whereClause}`;
    }

    dataSql += ` ORDER BY ${orderByClause} LIMIT ? OFFSET ?`;
    const dataParams = [...params, pageSize, offset];

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(dataSql, dataParams),
      query(countSql, params)
    ]);

    const total = (countResult as any)[0].total;

    return NextResponse.json(buildPagedResponse(rows, total, page, pageSize));
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch tour packages'));
  }
}

// POST - Create new tour package
export async function POST(request: Request) {
  try {
    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    // Check for Idempotency-Key header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    const body = await request.json();
    const {
      tour_name,
      tour_code,
      city,
      duration_days,
      duration_hours,
      duration_type,
      description,
      tour_type,
      inclusions,
      exclusions,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website,
      provider_id
    } = body;

    // Validate required fields
    if (!tour_name) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'tour_name is required'
      });
    }

    // Validate favorite_priority (0-10)
    if (body.favorite_priority !== undefined && body.favorite_priority !== null) {
      const priority = parseInt(body.favorite_priority);
      if (isNaN(priority) || priority < 0 || priority > 10) {
        return errorResponse({
          type: 'https://httpstatuses.com/400',
          title: 'Bad Request',
          status: 400,
          detail: 'favorite_priority must be between 0 and 10'
        });
      }
    }

    // Check for duplicate tour_code with idempotency
    if (idempotencyKey && tour_code) {
      const existing = await query(
        'SELECT * FROM tours WHERE tour_code = ?',
        [tour_code]
      );

      if ((existing as any[]).length > 0) {
        // Return existing tour for idempotent request
        const tourId = (existing as any[])[0].id;
        return NextResponse.json(
          (existing as any[])[0],
          {
            status: 200,
            headers: {
              Location: `/api/daily-tours/${tourId}`
            }
          }
        );
      }
    }

    const result = await query(
      `INSERT INTO tours (
        tour_name, tour_code, city, duration_days, duration_hours, duration_type,
        description, tour_type, inclusions, exclusions,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website, provider_id, organization_id, status, favorite_priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        tour_name, tour_code, city, duration_days, duration_hours, duration_type,
        description, tour_type, inclusions, exclusions,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website, provider_id, parseInt(tenantId),
        body.favorite_priority || 0
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created record
    const [createdTour] = await query(
      'SELECT * FROM tours WHERE id = ?',
      [insertId]
    ) as any[];

    // Return 201 Created with Location header
    return NextResponse.json(
      createdTour,
      {
        status: 201,
        headers: {
          Location: `/api/daily-tours/${insertId}`
        }
      }
    );
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to create tour package'));
  }
}

// PUT - Update tour package
export async function PUT(request: Request) {
  try {
    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Tour ID is required'
      });
    }

    // Validate favorite_priority if provided
    if (body.favorite_priority !== undefined && body.favorite_priority !== null) {
      const priority = parseInt(body.favorite_priority);
      if (isNaN(priority) || priority < 0 || priority > 10) {
        return errorResponse({
          type: 'https://httpstatuses.com/400',
          title: 'Bad Request',
          status: 400,
          detail: 'favorite_priority must be between 0 and 10'
        });
      }
    }

    // Verify tour exists and belongs to tenant
    const [existingTour] = await query(
      'SELECT * FROM tours WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingTour) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Tour not found'
      });
    }

    // Update tour
    await query(
      `UPDATE tours SET
        tour_name = ?,
        tour_code = ?,
        city = ?,
        duration_days = ?,
        duration_hours = ?,
        duration_type = ?,
        description = ?,
        tour_type = ?,
        inclusions = ?,
        exclusions = ?,
        photo_url_1 = ?,
        photo_url_2 = ?,
        photo_url_3 = ?,
        rating = ?,
        user_ratings_total = ?,
        website = ?,
        provider_id = ?,
        status = ?,
        favorite_priority = ?,
        updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        body.tour_name,
        body.tour_code,
        body.city,
        body.duration_days,
        body.duration_hours,
        body.duration_type,
        body.description,
        body.tour_type,
        body.inclusions,
        body.exclusions,
        body.photo_url_1,
        body.photo_url_2,
        body.photo_url_3,
        body.rating,
        body.user_ratings_total,
        body.website,
        body.provider_id,
        body.status,
        body.favorite_priority !== undefined ? body.favorite_priority : existingTour.favorite_priority,
        id,
        parseInt(tenantId)
      ]
    );

    // Fetch updated tour
    const [updatedTour] = await query(
      'SELECT * FROM tours WHERE id = ?',
      [id]
    ) as any[];

    return NextResponse.json(updatedTour);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update tour package'));
  }
}

