import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, buildPagedResponse } from '@/lib/pagination';
import { createdResponse, errorResponse, badRequestProblem, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { handleError } from '@/middleware/errorHandler';
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
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

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
    const response: PagedResponse<Vehicle> = buildPagedResponse(
      rows as Vehicle[],
      total,
      page,
      pageSize
    );

    return NextResponse.json(response);
  } catch (error) {
    return handleError(error, request.url);
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
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    // Check idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cachedResponse = await checkIdempotencyKey(request, idempotencyKey);
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
      return errorResponse(
        badRequestProblem(
          'Missing required fields: vehicle_type and city are required',
          request.url
        )
      );
    }

    if (!max_capacity || typeof max_capacity !== 'number' || max_capacity <= 0) {
      return errorResponse(
        badRequestProblem(
          'Invalid max_capacity: must be a positive number',
          request.url
        )
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
    const response = createdResponse(
      createdVehicle,
      `/api/vehicles/${insertId}`
    );

    // Store idempotency key if provided
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    return handleError(error, request.url);
  }
}
