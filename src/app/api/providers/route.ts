import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, createdResponse, errorResponse, internalServerErrorProblem, badRequestProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';

// GET - Fetch all providers with pagination, search, and filters
export async function GET(request: NextRequest) {
  try {
    // Enforce tenant scoping
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse filters
    const filters: Record<string, any> = {
      organization_id: tenantId // Tenant scoping
    };

    // Status filter
    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    // City filter
    const cityFilter = searchParams.get('city');
    if (cityFilter && cityFilter !== 'all') {
      filters.city = cityFilter;
    }

    // Provider type filter
    const providerTypeFilter = searchParams.get('provider_type');
    if (providerTypeFilter && providerTypeFilter !== 'all') {
      filters.provider_type = providerTypeFilter;
    }

    // Build WHERE clause
    const whereClause = buildWhereClause(filters);

    // Search across multiple fields
    const searchTerm = searchParams.get('search') || '';
    const searchClause = buildSearchClause(searchTerm, [
      'provider_name',
      'city',
      'contact_email'
    ]);

    // Combine WHERE and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Parse sort parameters (default: provider_name ASC)
    const sortParam = searchParams.get('sort') || 'provider_name';
    const orderBy = parseSortParams(sortParam) || 'provider_name ASC';

    // Build main query
    let sql = `
      SELECT
        id,
        organization_id,
        provider_name,
        provider_type,
        city,
        contact_email,
        contact_phone,
        status,
        created_at,
        updated_at
      FROM providers
    `;

    if (combined.whereSQL) {
      sql += ` WHERE ${combined.whereSQL}`;
    }

    sql += ` ORDER BY ${orderBy}`;
    sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    // Build count query
    let countSql = 'SELECT COUNT(*) as total FROM providers';
    if (combined.whereSQL) {
      countSql += ` WHERE ${combined.whereSQL}`;
    }

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(sql, combined.params),
      query(countSql, combined.params)
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const response = buildPagedResponse(rows, total, page, pageSize);

    return successResponse(response);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch providers'));
  }
}

// POST - Create new provider
export async function POST(request: NextRequest) {
  try {
    // Enforce tenant scoping
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

    // Parse request body
    const body = await request.json();
    const {
      provider_name,
      provider_type,
      city,
      address,
      contact_email,
      contact_phone,
      notes,
      status = 'active'
    } = body;

    // Validate required fields
    if (!provider_name) {
      return errorResponse(badRequestProblem('provider_name is required'));
    }

    if (!provider_type) {
      return errorResponse(badRequestProblem('provider_type is required'));
    }

    // Insert provider with organization_id
    const result = await query(
      `INSERT INTO providers (
        organization_id,
        provider_name,
        provider_type,
        city,
        address,
        contact_email,
        contact_phone,
        notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        provider_name,
        provider_type,
        city || null,
        address || null,
        contact_email || null,
        contact_phone || null,
        notes || null,
        status
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created provider
    const [createdProvider] = await query(
      'SELECT * FROM providers WHERE id = ?',
      [insertId]
    ) as any[];

    // Build Location header
    const location = `/api/providers/${insertId}`;

    // Create response
    const response = createdResponse(createdProvider, location);

    // Store idempotency key if provided
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Error creating provider:', error);
    return errorResponse(internalServerErrorProblem('Failed to create provider'));
  }
}
