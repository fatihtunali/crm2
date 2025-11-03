import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, buildPagedResponse } from '@/lib/pagination';
import { createdResponse, errorResponse, badRequestProblem, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { handleError } from '@/middleware/errorHandler';
import type { PagedResponse } from '@/types/api';

interface Guide {
  id: number;
  organization_id: number;
  provider_id: number | null;
  city: string;
  language: string;
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
  full_day_price?: number | null;
  half_day_price?: number | null;
  night_price?: number | null;
  // Provider fields
  provider_name?: string | null;
}

/**
 * GET /api/guides
 * Fetch guides with pagination, search, filtering, and sorting
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize/page_size: Items per page (default: 25, max: 200)
 * - search: Search term for name, city, language
 * - status: Filter by status (active, inactive)
 * - city: Filter by city
 * - language: Filter by language
 * - sort: Sort order (e.g., "city,-language" for city ASC, language DESC)
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
    whereConditions.push('g.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    const status = searchParams.get('status');
    if (status && status !== 'all') {
      whereConditions.push('g.status = ?');
      params.push(status);
    }

    // City filter
    const city = searchParams.get('city');
    if (city && city !== 'all') {
      whereConditions.push('g.city = ?');
      params.push(city);
    }

    // Language filter
    const language = searchParams.get('language');
    if (language && language !== 'all') {
      whereConditions.push('g.language = ?');
      params.push(language);
    }

    // Build search clause
    const searchTerm = searchParams.get('search');
    if (searchTerm && searchTerm.trim() !== '') {
      whereConditions.push('(g.city LIKE ? OR g.language LIKE ? OR g.description LIKE ?)');
      const searchValue = `%${searchTerm}%`;
      params.push(searchValue, searchValue, searchValue);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Parse sort
    const sortParam = searchParams.get('sort');
    let orderBy = 'g.city ASC, g.language ASC'; // Default sort

    if (sortParam) {
      // Map sort fields to actual column names
      const sortFields = sortParam.split(',').map(field => {
        const trimmed = field.trim();
        const isDesc = trimmed.startsWith('-');
        const fieldName = isDesc ? trimmed.substring(1) : trimmed;
        const direction = isDesc ? 'DESC' : 'ASC';

        // Map field names to actual columns
        const columnMap: Record<string, string> = {
          'city': 'g.city',
          'language': 'g.language',
          'status': 'g.status',
          'created_at': 'g.created_at',
          'updated_at': 'g.updated_at',
        };

        const column = columnMap[fieldName] || `g.${fieldName}`;
        return `${column} ${direction}`;
      });

      orderBy = sortFields.join(', ');
    }

    // Build base query
    let sql = `
      SELECT
        g.*,
        p.provider_name,
        p.id as provider_id,
        gp.id as pricing_id,
        gp.season_name,
        gp.start_date as season_start,
        gp.end_date as season_end,
        gp.currency,
        gp.full_day_price,
        gp.half_day_price,
        gp.night_price
      FROM guides g
      LEFT JOIN providers p ON g.provider_id = p.id
      LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
        AND gp.status = 'active'
        AND CURDATE() BETWEEN gp.start_date AND gp.end_date
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
      SELECT COUNT(DISTINCT g.id) as total
      FROM guides g
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
    const response: PagedResponse<Guide> = buildPagedResponse(
      rows as Guide[],
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
 * POST /api/guides
 * Create a new guide
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 * - Idempotency-Key: Optional idempotency key for safe retries
 *
 * Body:
 * - city: string (required)
 * - language: string (required)
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
      city,
      language,
      description,
      provider_id,
      status = 'active',
    } = body;

    // Validate required fields
    if (!city || !language) {
      return errorResponse(
        badRequestProblem(
          'Missing required fields: city and language are required',
          request.url
        )
      );
    }

    // Insert guide
    const result = await query(
      `INSERT INTO guides (
        organization_id, city, language, description, provider_id, status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        city,
        language,
        description || null,
        provider_id || null,
        status,
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created guide
    const [createdGuide] = await query(
      `SELECT * FROM guides WHERE id = ?`,
      [insertId]
    ) as Guide[];

    // Create response
    const response = createdResponse(
      createdGuide,
      `/api/guides/${insertId}`
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
