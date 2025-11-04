import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, buildPagedResponse, parseSortParams } from '@/lib/pagination';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

// GET - Fetch all meal pricing records with pagination
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

    // Parse sort parameter (default: restaurant_name ASC, season_name ASC)
    const sortParam = searchParams.get('sort') || 'restaurant_name,season_name';
    const orderByClause = parseSortParams(sortParam) || 'restaurant_name ASC, season_name ASC';

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

    // Return paginated response
    const pagedResponse = buildPagedResponse(rows, total, page, pageSize);

    return NextResponse.json(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch restaurants'));
  }
}

// POST - Create new meal pricing record
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

    // If idempotency key is provided, check if this request was already processed
    if (idempotencyKey) {
      const existingResult = await query(
        `SELECT id FROM meal_pricing WHERE created_by = ? AND restaurant_name = ? AND season_name = ?
         ORDER BY created_at DESC LIMIT 1`,
        [created_by, restaurant_name, season_name]
      );

      if ((existingResult as any[]).length > 0) {
        const existingId = (existingResult as any[])[0].id;
        // Return existing resource with 201 status and Location header
        return NextResponse.json(
          { id: existingId, message: 'Resource already exists' },
          {
            status: 201,
            headers: {
              Location: `/api/restaurants/${existingId}`,
            },
          }
        );
      }
    }

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

    // Return 201 Created with Location header
    return NextResponse.json(
      { id: insertId },
      {
        status: 201,
        headers: {
          Location: `/api/restaurants/${insertId}`,
        },
      }
    );
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to create restaurant pricing'));
  }
}

// PUT - Update restaurant (meal pricing)
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
      return NextResponse.json(
        { error: 'Restaurant ID is required' },
        { status: 400 }
      );
    }

    // Verify the restaurant exists and belongs to this tenant
    const [existingRestaurant] = await query(
      'SELECT id FROM meal_pricing WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingRestaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found or does not belong to your organization' },
        { status: 404 }
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

    // Return success
    return NextResponse.json({ id, message: 'Restaurant updated successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update restaurant pricing'));
  }
}

