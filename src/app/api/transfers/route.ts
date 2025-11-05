import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { PagedResponse } from '@/types/api';

interface Transfer {
  id: number;
  organization_id: number;
  provider_id?: number;
  vehicle_id?: number;
  from_city: string;
  to_city: string;
  season_name?: string;
  start_date: string;
  end_date: string;
  price_oneway: number;
  price_roundtrip: number;
  estimated_duration_hours?: number;
  notes?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  provider_name?: string;
  vehicle_type?: string;
  max_capacity?: number;
}

interface TransferResponse extends Omit<Transfer, 'price_oneway' | 'price_roundtrip'> {
  price_oneway: {
    amount_minor: number;
    currency: string;
  };
  price_roundtrip: {
    amount_minor: number;
    currency: string;
  };
}

// GET - Fetch all intercity transfers with filters, pagination, and search
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
    const orderBy = 't.from_city ASC, t.to_city ASC, t.start_date DESC';

    // Build WHERE conditions manually with table qualifiers
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('t.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('t.status = ?');
      params.push(statusFilter);
    }

    // From city filter
    const fromCityFilter = searchParams.get('from_city');
    if (fromCityFilter && fromCityFilter !== 'all') {
      whereConditions.push('t.from_city = ?');
      params.push(fromCityFilter);
    }

    // To city filter
    const toCityFilter = searchParams.get('to_city');
    if (toCityFilter && toCityFilter !== 'all') {
      whereConditions.push('t.to_city = ?');
      params.push(toCityFilter);
    }

    // From location filter (alternative name for from_city)
    const fromLocationFilter = searchParams.get('from_location');
    if (fromLocationFilter && fromLocationFilter !== 'all') {
      whereConditions.push('t.from_city = ?');
      params.push(fromLocationFilter);
    }

    // To location filter (alternative name for to_city)
    const toLocationFilter = searchParams.get('to_location');
    if (toLocationFilter && toLocationFilter !== 'all') {
      whereConditions.push('t.to_city = ?');
      params.push(toLocationFilter);
    }

    // Build search clause
    const searchTerm = searchParams.get('search');
    if (searchTerm && searchTerm.trim() !== '') {
      whereConditions.push('(t.from_city LIKE ? OR t.to_city LIKE ? OR t.season_name LIKE ? OR v.vehicle_type LIKE ? OR p.provider_name LIKE ?)');
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Build main query
    let sql = `
      SELECT
        t.*,
        p.provider_name,
        v.vehicle_type,
        v.max_capacity as capacity
      FROM intercity_transfers t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
    `;

    // Add WHERE clause
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    // Add ORDER BY clause
    sql += ` ORDER BY ${orderBy}`;

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `
      SELECT COUNT(*) as total
      FROM intercity_transfers t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
    `;

    if (whereClause) {
      countSql += ` WHERE ${whereClause}`;
    }

    // Build count params (without pagination params)
    const countParams = params.slice(0, -2);

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Transform price fields to Money type
    const transformedRows = (rows as Transfer[]).map(transfer => ({
      ...transfer,
      price_oneway: {
        amount_minor: toMinorUnits(transfer.price_oneway),
        currency: 'EUR' // Default currency, could be from DB
      },
      price_roundtrip: {
        amount_minor: toMinorUnits(transfer.price_roundtrip),
        currency: 'EUR'
      }
    }));

    // Build paged response
    const baseUrl = new URL(request.url).origin + new URL(request.url).pathname;
    const filters: Record<string, string> = {};
    if (statusFilter && statusFilter !== 'all') filters.status = statusFilter;
    if (fromCityFilter && fromCityFilter !== 'all') filters.from_city = fromCityFilter;
    if (toCityFilter && toCityFilter !== 'all') filters.to_city = toCityFilter;
    if (searchTerm) filters.search = searchTerm;

    const responseData = buildStandardListResponse(
      transformedRows,
      total,
      page,
      pageSize,
      baseUrl,
      filters
    );

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
    console.error('Error fetching transfers:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new intercity transfer
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
      const cachedResponse = await checkIdempotencyKey(request, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();
    const {
      provider_id,
      vehicle_id,
      from_city,
      to_city,
      season_name,
      start_date,
      end_date,
      price_oneway,
      price_roundtrip,
      estimated_duration_hours,
      notes
    } = body;

    // Convert Money type to decimal for database storage
    // If price_oneway is already a Money object with amount_minor
    let priceOnewayDecimal: number;
    let priceRoundtripDecimal: number;

    if (typeof price_oneway === 'object' && 'amount_minor' in price_oneway) {
      priceOnewayDecimal = fromMinorUnits(price_oneway.amount_minor);
    } else {
      // Legacy: if it's a number, assume it's already in decimal format
      priceOnewayDecimal = price_oneway;
    }

    if (typeof price_roundtrip === 'object' && 'amount_minor' in price_roundtrip) {
      priceRoundtripDecimal = fromMinorUnits(price_roundtrip.amount_minor);
    } else {
      priceRoundtripDecimal = price_roundtrip;
    }

    const result = await query(
      `INSERT INTO intercity_transfers (
        organization_id, provider_id, vehicle_id, from_city, to_city, season_name,
        start_date, end_date, price_oneway, price_roundtrip,
        estimated_duration_hours, notes, status, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
      [
        tenantId,
        provider_id || null,
        vehicle_id || null,
        from_city,
        to_city,
        season_name || null,
        start_date,
        end_date,
        priceOnewayDecimal,
        priceRoundtripDecimal,
        estimated_duration_hours || null,
        notes || null,
        idempotencyKey || null
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch created transfer
    const [created] = await query(
      'SELECT * FROM intercity_transfers WHERE id = ?',
      [insertId]
    ) as any[];

    const response = NextResponse.json(created, {
      status: 201,
      headers: {
        Location: `/api/transfers/${insertId}`
      }
    });

    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, response);
    }

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      transfer_id: insertId
    });
    return response;
  } catch (error) {
    console.error('Error creating transfer:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update existing intercity transfer
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
    const {
      id,
      provider_id,
      vehicle_id,
      from_city,
      to_city,
      season_name,
      start_date,
      end_date,
      price_oneway,
      price_roundtrip,
      estimated_duration_hours,
      notes,
      status
    } = body;

    if (!id) {
      return validationErrorResponse(
        'Validation failed',
        [{ field: 'id', issue: 'required', message: 'Transfer ID is required' }],
        requestId
      );
    }

    // Verify transfer belongs to tenant
    const existing = await query(
      'SELECT id FROM intercity_transfers WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    );

    if ((existing as any[]).length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Transfer not found',
        404,
        undefined,
        requestId
      );
    }

    // Update transfer
    await query(
      `UPDATE intercity_transfers SET
        provider_id = ?,
        vehicle_id = ?,
        from_city = ?,
        to_city = ?,
        season_name = ?,
        start_date = ?,
        end_date = ?,
        price_oneway = ?,
        price_roundtrip = ?,
        estimated_duration_hours = ?,
        notes = ?,
        status = ?
      WHERE id = ? AND organization_id = ?`,
      [
        provider_id || null,
        vehicle_id || null,
        from_city,
        to_city,
        season_name || null,
        start_date,
        end_date,
        price_oneway,
        price_roundtrip,
        estimated_duration_hours || null,
        notes || null,
        status,
        id,
        tenantId
      ]
    );

    // Fetch updated transfer
    const [updated] = await query(
      'SELECT * FROM intercity_transfers WHERE id = ?',
      [id]
    ) as any[];

    const response = NextResponse.json(updated);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      transfer_id: id
    });

    return response;
  } catch (error) {
    console.error('Error updating transfer:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}
