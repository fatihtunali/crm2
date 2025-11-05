import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB, markIdempotencyKeyProcessing } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import type { PagedResponse } from '@/types/api';

interface Vehicle {
  id: number;
  organization_id: number;
  provider_id: number | null;
  vehicle_type: string;
  max_capacity: number;
  city: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Pricing fields
  pricing_id?: number | null;
  season_name?: string | null;
  season_start?: string | null;
  season_end?: string | null;
  currency?: string | null;
  price_per_day?: number | null;
  price_half_day?: number | null;
  // Provider fields
  provider_name?: string | null;
}

/**
 * GET /api/vehicles
 * Fetch vehicles with pagination, search, filtering, and sorting
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize/page_size: Items per page (default: 25, max: 200)
 * - search: Search term for vehicle_type, city, description
 * - status: Filter by status (active, inactive)
 * - city: Filter by city
 * - vehicle_type: Filter by vehicle type
 * - sort: Sort order (e.g., "vehicle_type,-max_capacity" for vehicle_type ASC, max_capacity DESC)
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 */
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

    // Parse pagination
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // Build WHERE conditions manually with table qualifiers
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('v.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    const status = searchParams.get('status');
    if (status && status !== 'all') {
      whereConditions.push('v.status = ?');
      params.push(status);
    }

    // City filter
    const city = searchParams.get('city');
    if (city && city !== 'all') {
      whereConditions.push('v.city = ?');
      params.push(city);
    }

    // Vehicle type filter
    const vehicleType = searchParams.get('vehicle_type');
    if (vehicleType && vehicleType !== 'all') {
      whereConditions.push('v.vehicle_type = ?');
      params.push(vehicleType);
    }

    // Build search clause
    const searchTerm = searchParams.get('search');
    if (searchTerm && searchTerm.trim() !== '') {
      whereConditions.push('(v.vehicle_type LIKE ? OR v.city LIKE ? OR v.description LIKE ?)');
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Parse sort
    const sortParam = searchParams.get('sort');
    let orderBy = 'v.vehicle_type ASC, v.city ASC'; // Default sort

    if (sortParam) {
      // Map sort fields to actual column names
      const sortFields = sortParam.split(',').map(field => {
        const trimmed = field.trim();
        const isDesc = trimmed.startsWith('-');
        const fieldName = isDesc ? trimmed.substring(1) : trimmed;
        const direction = isDesc ? 'DESC' : 'ASC';

        // Map field names to actual columns
        const columnMap: Record<string, string> = {
          'vehicle_type': 'v.vehicle_type',
          'max_capacity': 'v.max_capacity',
          'city': 'v.city',
          'status': 'v.status',
          'created_at': 'v.created_at',
          'updated_at': 'v.updated_at',
        };

        const column = columnMap[fieldName] || `v.${fieldName}`;
        return `${column} ${direction}`;
      });

      orderBy = sortFields.join(', ');
    }

    // Build base query
    let sql = `
      SELECT
        v.*,
        p.provider_name,
        vp.id as pricing_id,
        vp.season_name,
        vp.start_date as season_start,
        vp.end_date as season_end,
        vp.currency,
        vp.price_per_day,
        vp.price_half_day
      FROM vehicles v
      LEFT JOIN providers p ON v.provider_id = p.id
      LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
        AND vp.status = 'active'
        AND CURDATE() BETWEEN vp.start_date AND vp.end_date
    `;

    // Add WHERE clause
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    // Add ORDER BY, LIMIT, OFFSET
    sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `
      SELECT COUNT(DISTINCT v.id) as total
      FROM vehicles v
    `;

    if (whereClause) {
      countSql += ` WHERE ${whereClause}`;
    }

    // Build count params (without pagination params)
    const countParams = params.slice(0, -2);

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const baseUrl = new URL(request.url).origin + new URL(request.url).pathname;
    const filters: Record<string, string> = {};
    if (status && status !== 'all') filters.status = status;
    if (city && city !== 'all') filters.city = city;
    if (vehicleType && vehicleType !== 'all') filters.vehicle_type = vehicleType;
    if (searchTerm) filters.search = searchTerm;

    const responseData = buildStandardListResponse(
      rows as Vehicle[],
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
    console.error('Error fetching vehicles:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * POST /api/vehicles
 * Create a new vehicle
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 * - Idempotency-Key: Optional idempotency key for safe retries
 *
 * Body:
 * - vehicle_type: string (required)
 * - max_capacity: number (required)
 * - city: string (required)
 * - description: string (optional)
 * - provider_id: number (optional)
 * - status: string (optional, defaults to 'active')
 */
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

    // Check idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cachedResponse = await checkIdempotencyKeyDB(request, idempotencyKey, Number(tenantId));
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const {
      vehicle_type,
      max_capacity,
      city,
      description,
      provider_id,
      status = 'active',
    } = body;

    // Validate required fields
    if (!vehicle_type || !city) {
      return validationErrorResponse(
        'Required fields missing',
        [
          { field: 'vehicle_type', issue: 'required', message: 'vehicle_type is required' },
          { field: 'city', issue: 'required', message: 'city is required' }
        ],
        requestId
      );
    }

    if (!max_capacity || typeof max_capacity !== 'number' || max_capacity <= 0) {
      return validationErrorResponse(
        'Invalid input',
        [{ field: 'max_capacity', issue: 'invalid', message: 'max_capacity must be a positive number' }],
        requestId
      );
    }

    // Insert vehicle
    const result = await query(
      `INSERT INTO vehicles (
        organization_id, vehicle_type, max_capacity, city, description, provider_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        vehicle_type,
        max_capacity,
        city,
        description || null,
        provider_id || null,
        status,
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created vehicle
    const [createdVehicle] = await query(
      `SELECT * FROM vehicles WHERE id = ?`,
      [insertId]
    ) as Vehicle[];

    // Create response
    const response = NextResponse.json(createdVehicle, {
      status: 201,
      headers: {
        Location: `/api/vehicles/${insertId}`
      }
    });

    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // Store idempotency key if provided
    if (idempotencyKey) {
      await storeIdempotencyKeyDB(idempotencyKey, response, Number(tenantId), user.userId, request);
    }

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      vehicle_id: insertId
    });
    return response;
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update vehicle
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
        [{ field: 'id', issue: 'required', message: 'Vehicle ID is required' }],
        requestId
      );
    }

    // Verify the vehicle exists and belongs to this tenant
    const [existingVehicle] = await query(
      'SELECT id FROM vehicles WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingVehicle) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Vehicle with ID ${id} not found or does not belong to your organization`,
        404,
        undefined,
        requestId
      );
    }

    // Update the vehicle
    await query(
      `UPDATE vehicles SET
        provider_id = ?,
        vehicle_type = ?,
        max_capacity = ?,
        city = ?,
        description = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        body.provider_id,
        body.vehicle_type,
        body.max_capacity,
        body.city,
        body.description,
        body.status,
        id,
        parseInt(tenantId)
      ]
    );

    // Fetch and return the updated vehicle
    const [updatedVehicle] = await query(
      'SELECT * FROM vehicles WHERE id = ?',
      [id]
    ) as Vehicle[];

    const response = NextResponse.json(updatedVehicle);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      vehicle_id: id
    });

    return response;
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}
