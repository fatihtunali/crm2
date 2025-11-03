import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    const orderBy = parseSortParams(sortParam);

    // Build filters
    const filters: Record<string, any> = {};

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    const countryFilter = searchParams.get('country');
    if (countryFilter && countryFilter !== 'all') {
      filters.country = countryFilter;
    }

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in name, email, website)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', ['name', 'email', 'website']);

    // Combine where and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Build main query
    let sql = `
      SELECT
        id,
        name,
        slug,
        email,
        phone,
        country,
        website,
        status,
        primary_color,
        secondary_color,
        created_at,
        updated_at
      FROM organizations
    `;

    const params: any[] = [];

    // Add WHERE clause
    if (combined.whereSQL) {
      sql += ` WHERE ${combined.whereSQL}`;
      params.push(...combined.params);
    }

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    } else {
      sql += ` ORDER BY created_at DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `SELECT COUNT(*) as total FROM organizations`;
    if (combined.whereSQL) {
      countSql += ` WHERE ${combined.whereSQL}`;
    }

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, combined.params)
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const pagedResponse = buildPagedResponse(rows, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch agents', '/api/agents')
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Generate slug from name
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const result = await query(
      `INSERT INTO organizations (
        name,
        slug,
        email,
        phone,
        country,
        website,
        status,
        primary_color,
        secondary_color
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', '#3B82F6', '#6366F1')`,
      [
        body.name,
        slug,
        body.email,
        body.phone || null,
        body.country || null,
        body.website || null
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created agent to return with timestamps
    const [createdAgent] = await query(
      'SELECT * FROM organizations WHERE id = ?',
      [insertId]
    ) as any[];

    const { createdResponse } = await import('@/lib/response');
    const response = createdResponse(createdAgent, `/api/agents/${insertId}`);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to create agent', '/api/agents')
    );
  }
}

