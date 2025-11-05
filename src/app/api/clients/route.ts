import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

/**
 * GET /api/clients
 * List all clients with pagination, filtering, and search
 */
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

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'first_name', 'last_name', 'email', 'phone', 'client_type', 'nationality', 'status', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Build filters
    const filters: Record<string, any> = {};

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    const clientTypeFilter = searchParams.get('client_type');
    if (clientTypeFilter && clientTypeFilter !== 'all') {
      filters.client_type = clientTypeFilter;
    }

    const nationalityFilter = searchParams.get('nationality');
    if (nationalityFilter && nationalityFilter !== 'all') {
      filters.nationality = nationalityFilter;
    }

    // Add tenant filter
    filters.organization_id = parseInt(tenantId);

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', ['first_name', 'last_name', 'email', 'phone']);

    // Combine where and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Build main query
    let sql = `
      SELECT
        id,
        uuid,
        organization_id,
        first_name,
        last_name,
        email,
        phone,
        client_type,
        tour_operator_id,
        nationality,
        language_preference,
        date_of_birth,
        passport_number,
        preferences,
        dietary_requirements,
        special_needs,
        notes,
        marketing_consent,
        newsletter_subscribed,
        status,
        created_at,
        updated_at
      FROM clients
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
    let countSql = `SELECT COUNT(*) as total FROM clients`;
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
    return errorResponse(internalServerErrorProblem(request.url));
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const body = await request.json();

    const {
      first_name,
      last_name,
      email,
      phone,
      client_type = 'direct_client',
      tour_operator_id,
      nationality,
      language_preference = 'en',
      date_of_birth,
      passport_number,
      preferences,
      dietary_requirements,
      special_needs,
      notes,
      marketing_consent = false,
      newsletter_subscribed = false,
      status = 'active'
    } = body;

    // Validate required fields
    if (!first_name || !last_name || !email) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: 'Missing required fields: first_name, last_name, email',
        instance: request.url,
      });
    }

    // Generate UUID
    const uuid = crypto.randomUUID();

    // Insert client
    const result = await query(
      `INSERT INTO clients (
        uuid, organization_id, first_name, last_name, email, phone,
        client_type, tour_operator_id, nationality, language_preference,
        date_of_birth, passport_number, preferences, dietary_requirements,
        special_needs, notes, marketing_consent, newsletter_subscribed, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid, parseInt(tenantId), first_name, last_name, email, phone,
        client_type, tour_operator_id, nationality, language_preference,
        date_of_birth, passport_number, preferences, dietary_requirements,
        special_needs, notes, marketing_consent, newsletter_subscribed, status
      ]
    );

    const clientId = (result as any).insertId;

    // Fetch the created client
    const [client] = await query(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    ) as any[];

    return successResponse(client, 201);
  } catch (error: any) {
    console.error('Database error:', error);

    // Handle duplicate email
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/duplicate-email',
        title: 'Duplicate Email',
        status: 409,
        detail: 'A client with this email already exists',
        instance: request.url,
      });
    }

    return errorResponse(internalServerErrorProblem(request.url));
  }
}
