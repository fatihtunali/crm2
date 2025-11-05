import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireAuth } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    // Require authentication and super_admin role
    const user = await requireAuth(request);

    if (user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only super administrators can manage organizations',
        instance: request.url,
      });
    }

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'name', 'email', 'phone', 'country', 'website', 'status', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

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
    // Require authentication and super_admin role
    const user = await requireAuth(request);

    if (user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only super administrators can create organizations',
        instance: request.url,
      });
    }

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

// PUT - Update agent (organization)
export async function PUT(request: NextRequest) {
  try {
    // Require authentication and super_admin role
    const user = await requireAuth(request);

    if (user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only super administrators can update organizations',
        instance: request.url,
      });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'Agent ID is required',
        instance: request.url,
      });
    }

    // Verify the agent exists
    const [existingAgent] = await query(
      'SELECT id FROM organizations WHERE id = ?',
      [id]
    ) as any[];

    if (!existingAgent) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: `Agent with ID ${id} not found`,
        instance: request.url,
      });
    }

    // Update the agent
    await query(
      `UPDATE organizations SET
        name = ?,
        email = ?,
        phone = ?,
        country = ?,
        website = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        body.name,
        body.email,
        body.phone,
        body.country,
        body.website,
        body.status,
        id
      ]
    );

    // Fetch and return the updated agent
    const [updatedAgent] = await query(
      'SELECT * FROM organizations WHERE id = ?',
      [id]
    ) as any[];

    return successResponse(updatedAgent);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update agent', '/api/agents')
    );
  }
}

