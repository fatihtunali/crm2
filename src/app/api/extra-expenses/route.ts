import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, buildQuery } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';

// GET - Fetch all extra expenses with pagination, search, and sorting
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: expense_name ASC)
    const sortParam = searchParams.get('sort') || 'expense_name';
    const orderBy = parseSortParams(sortParam) || 'expense_name ASC';

    // Build filters
    const filters: Record<string, any> = {};

    const status = searchParams.get('status');
    if (status && status !== 'all') {
      filters['ee.status'] = status;
    }

    const category = searchParams.get('category');
    if (category && category !== 'all') {
      filters['ee.expense_category'] = category;
    }

    const city = searchParams.get('city');
    if (city && city !== 'all') {
      filters['ee.city'] = city;
    }

    const whereClause = buildWhereClause(filters);

    // Build search clause (search in expense_name and category)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', [
      'ee.expense_name',
      'ee.expense_category'
    ]);

    // Base query
    const baseQuery = `
      SELECT
        ee.id,
        ee.organization_id,
        ee.provider_id,
        ee.expense_name,
        ee.expense_category,
        ee.city,
        ee.currency,
        ee.unit_price,
        ee.unit_type,
        ee.description,
        ee.status,
        ee.created_at,
        ee.updated_at,
        p.provider_name
      FROM extra_expenses ee
      LEFT JOIN providers p ON ee.provider_id = p.id
    `;

    // Build complete query with pagination
    const { sql, params } = buildQuery(baseQuery, {
      where: whereClause,
      search: searchClause,
      orderBy,
      limit: pageSize,
      offset
    });

    // Count query for total
    const countBaseQuery = `
      SELECT COUNT(*) as total
      FROM extra_expenses ee
      LEFT JOIN providers p ON ee.provider_id = p.id
    `;

    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause
    });

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Return paginated response
    return successResponse(buildPagedResponse(rows, total, page, pageSize));
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch extra expenses'));
  }
}

// POST - Create new extra expense
export async function POST(request: Request) {
  try {
    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const { checkIdempotencyKey } = await import('@/middleware/idempotency');
      const cachedResponse = await checkIdempotencyKey(request as any, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();
    const {
      organization_id,
      provider_id,
      expense_name,
      expense_category,
      city,
      currency,
      unit_price,
      unit_type,
      description
    } = body;

    // Handle unit_price with Money type (store as minor units if decimal provided)
    const unitPriceValue = typeof unit_price === 'number' ? unit_price : parseFloat(unit_price);

    const result = await query(
      `INSERT INTO extra_expenses (
        organization_id, provider_id, expense_name, expense_category, city, currency,
        unit_price, unit_type, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        organization_id || 1,
        provider_id || null,
        expense_name,
        expense_category,
        city,
        currency || 'EUR',
        unitPriceValue,
        unit_type,
        description || null
      ]
    );

    const insertId = (result as any).insertId;
    const location = `/api/extra-expenses/${insertId}`;

    // Fetch the created expense to return
    const [createdExpense] = await query(
      `SELECT
        ee.id,
        ee.organization_id,
        ee.provider_id,
        ee.expense_name,
        ee.expense_category,
        ee.city,
        ee.currency,
        ee.unit_price,
        ee.unit_type,
        ee.description,
        ee.status,
        ee.created_at,
        ee.updated_at,
        p.provider_name
      FROM extra_expenses ee
      LEFT JOIN providers p ON ee.provider_id = p.id
      WHERE ee.id = ?`,
      [insertId]
    ) as any[];

    const { createdResponse } = await import('@/lib/response');
    const response = createdResponse(createdExpense, location);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to create extra expense'));
  }
}

