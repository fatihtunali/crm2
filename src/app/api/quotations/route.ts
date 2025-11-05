import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  parsePaginationParams,
  parseSortParams,
  buildPagedResponse,
} from '@/lib/pagination';
import {
  buildWhereClause,
  buildSearchClause,
  buildQuery,
} from '@/lib/query-builder';
import {
  successResponse,
  errorResponse,
  internalServerErrorProblem,
} from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

// GET - Fetch all quotations with pagination, search, sort, and filters
export async function GET(request: NextRequest) {
  try {
    // Require authentication and get tenant context
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination params
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse filters
    const statusFilter = searchParams.get('status');
    const filters: Record<string, any> = {
      // SECURITY: Always filter by organization to ensure tenant isolation
      'q.organization_id': parseInt(tenantId)
    };

    if (statusFilter && statusFilter !== 'all') {
      filters['q.status'] = statusFilter;
    }

    // Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // Parse sort (default to -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'quote_number', 'customer_name', 'customer_email', 'destination', 'status', 'start_date', 'end_date', 'total_price', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'q.created_at DESC';

    // Build WHERE clause for filters
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in customer_name, customer_email, destination, quote_number)
    const searchClause = buildSearchClause(searchTerm, [
      'q.customer_name',
      'q.customer_email',
      'q.destination',
      'q.quote_number',
    ]);

    // Build main query
    const baseQuery = `
      SELECT
        q.*,
        (SELECT COUNT(*) FROM quote_days WHERE quote_id = q.id) as total_days
      FROM quotes q
    `;

    const { sql, params } = buildQuery(baseQuery, {
      where: whereClause,
      search: searchClause,
      orderBy,
      limit: pageSize,
      offset,
    });

    // Execute query
    const rows = await query(sql, params);

    // Get total count
    const countBaseQuery = 'SELECT COUNT(*) as count FROM quotes q';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause,
    });

    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.count || 0;

    // Build paged response
    const pagedResponse = buildPagedResponse(rows, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch quotations')
    );
  }
}

// POST - Create new quotation
export async function POST(request: NextRequest) {
  try {
    // Require authentication and get tenant context
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId, user } = tenantResult;

    // Check for Idempotency-Key header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    // If idempotency key is provided, check if we've already processed this request
    // SECURITY: Also check organization_id to ensure tenant isolation
    if (idempotencyKey) {
      const existing = await query(
        'SELECT * FROM quotes WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        // Return the existing quote with 201 status (as if it was just created)
        const existingQuote = existing[0];
        return NextResponse.json(existingQuote, {
          status: 201,
          headers: {
            Location: `/api/quotations/${existingQuote.id}`,
          },
        });
      }
    }

    const body = await request.json();
    const {
      quote_name,
      category,
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup,
      tax,
      transport_pricing_mode,
      season_name,
      valid_from,
      valid_to
    } = body;

    // Generate quote number
    const [lastQuote] = await query(
      'SELECT quote_number FROM quotes ORDER BY id DESC LIMIT 1'
    ) as any[];

    let nextNumber = 1;
    if (lastQuote && lastQuote.quote_number) {
      const match = lastQuote.quote_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const quote_number = `Q-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

    // Build INSERT query with optional idempotency_key
    const insertFields = [
      'organization_id', 'created_by_user_id', 'quote_number', 'category',
      'customer_name', 'customer_email', 'customer_phone', 'destination',
      'start_date', 'end_date', 'tour_type', 'pax', 'adults', 'children',
      'markup', 'tax', 'transport_pricing_mode', 'season_name',
      'valid_from', 'valid_to', 'status'
    ];

    const insertValues = [
      parseInt(tenantId), // SECURITY: Use authenticated user's organization ID
      user.userId, // SECURITY: Use authenticated user's ID
      quote_number,
      category || 'B2C',
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup || 0,
      tax || 0,
      transport_pricing_mode || 'total',
      season_name,
      valid_from || null,
      valid_to || null,
      'draft'
    ];

    // Add idempotency_key if provided
    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO quotes (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // Fetch the created quote
    const [createdQuote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [insertId]
    ) as any[];

    // Return 201 Created with Location header
    return NextResponse.json(createdQuote, {
      status: 201,
      headers: {
        Location: `/api/quotations/${insertId}`,
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to create quotation')
    );
  }
}

// PUT - Update quotation
export async function PUT(request: NextRequest) {
  try {
    // Require authentication and get tenant context
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const body = await request.json();
    const {
      id,
      quote_name,
      category,
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup,
      tax,
      transport_pricing_mode,
      season_name,
      valid_from,
      valid_to,
      status,
      total_price,
      pricing_table
    } = body;

    // SECURITY: Update only if quotation belongs to user's organization
    await query(
      `UPDATE quotes SET
        quote_name = ?, category = ?, customer_name = ?, customer_email = ?,
        customer_phone = ?, destination = ?, start_date = ?, end_date = ?,
        tour_type = ?, pax = ?, adults = ?, children = ?, markup = ?, tax = ?,
        transport_pricing_mode = ?, season_name = ?, valid_from = ?, valid_to = ?,
        status = ?, total_price = ?, pricing_table = ?
      WHERE id = ? AND organization_id = ?`,
      [
        quote_name,
        category,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        tour_type,
        pax,
        adults,
        children,
        markup,
        tax,
        transport_pricing_mode,
        season_name,
        valid_from || null,
        valid_to || null,
        status,
        total_price,
        pricing_table ? JSON.stringify(pricing_table) : null,
        id,
        parseInt(tenantId)
      ]
    );

    return successResponse({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update quotation'));
  }
}

// DELETE - Soft delete quotation
export async function DELETE(request: NextRequest) {
  try {
    // Require authentication and get tenant context
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { id } = await request.json();

    // SECURITY: Delete only if quotation belongs to user's organization
    await query(
      'UPDATE quotes SET status = ? WHERE id = ? AND organization_id = ?',
      ['expired', id, parseInt(tenantId)]
    );

    return successResponse({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to delete quotation'));
  }
}
