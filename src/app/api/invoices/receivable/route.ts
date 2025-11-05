import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseStandardPaginationParams, parseSortParams, buildStandardListResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, buildQuery } from '@/lib/query-builder';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';

// GET - Fetch all receivable invoices with pagination, search, sort, filters
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (100 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      100,
      3600
    );

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

    // Parse sort parameters (default: -invoice_date,-created_at)
    const sortParam = searchParams.get('sort') || '-invoice_date,-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'invoice_number', 'customer_name', 'invoice_date', 'due_date', 'total_amount', 'paid_amount', 'status', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'ir.invoice_date DESC, ir.created_at DESC';

    // Build filters
    const filters: Record<string, any> = {};

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters['ir.status'] = statusFilter;
    }

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in invoice_number, customer_name, quote_number)
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';
    const searchClause = buildSearchClause(searchTerm, ['ir.invoice_number', 'ir.customer_name', 'q.quote_number']);

    // Build main query
    const baseQuery = `
      SELECT
        ir.*,
        q.quote_number
      FROM invoices_receivable ir
      LEFT JOIN quotes q ON ir.booking_id = q.id
    `;

    const { sql, params } = buildQuery(baseQuery, {
      where: whereClause,
      search: searchClause,
      orderBy,
      limit: pageSize,
      offset,
    });

    // Build count query
    const countBaseQuery = 'SELECT COUNT(*) as count FROM invoices_receivable ir LEFT JOIN quotes q ON ir.booking_id = q.id';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause,
    });

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0]?.count || 0;

    // Convert money fields to Money type
    const invoicesWithMoney = (rows as any[]).map(invoice => ({
      ...invoice,
      total_amount: invoice.total_amount ? createMoney(Number(invoice.total_amount), invoice.currency || 'EUR') : null,
      paid_amount: invoice.paid_amount ? createMoney(Number(invoice.paid_amount), invoice.currency || 'EUR') : null,
    }));

    // Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Extract applied filters for metadata
    const appliedFilters: Record<string, any> = {};
    if (statusFilter) appliedFilters.status = statusFilter;
    if (searchTerm) appliedFilters.search = searchTerm;

    // Build standardized response with hypermedia
    const responseData = buildStandardListResponse(
      invoicesWithMoney,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: (rows as any[]).length,
      total_results: total,
      page,
      page_size: pageSize,
    });

    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch receivable invoices',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create new receivable invoice
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (50 creates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_create`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Creation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
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
    const {
      booking_id,
      invoice_number,
      customer_name,
      invoice_date,
      due_date,
      total_amount,
      currency,
      paid_amount,
      payment_date,
      payment_method,
      payment_reference,
      status,
      notes
    } = body;

    // Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!invoice_number || invoice_number.trim() === '') {
      validationErrors.push({
        field: 'invoice_number',
        issue: 'required',
        message: 'Invoice number is required'
      });
    }

    if (!invoice_date) {
      validationErrors.push({
        field: 'invoice_date',
        issue: 'required',
        message: 'Invoice date is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    const result = await query(
      `INSERT INTO invoices_receivable (
        booking_id, invoice_number, customer_name, invoice_date, due_date,
        total_amount, currency, paid_amount, payment_date, payment_method,
        payment_reference, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        booking_id,
        invoice_number,
        customer_name,
        invoice_date,
        due_date,
        total_amount,
        currency || 'EUR',
        paid_amount || 0,
        payment_date,
        payment_method,
        payment_reference,
        status || 'draft',
        notes
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created invoice to return with timestamps
    const [createdInvoice] = await query(
      `SELECT ir.*, q.quote_number
       FROM invoices_receivable ir
       LEFT JOIN quotes q ON ir.booking_id = q.id
       WHERE ir.id = ?`,
      [insertId]
    ) as any[];

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...createdInvoice,
      total_amount: createdInvoice.total_amount ? createMoney(Number(createdInvoice.total_amount), createdInvoice.currency || 'EUR') : null,
      paid_amount: createdInvoice.paid_amount ? createMoney(Number(createdInvoice.paid_amount), createdInvoice.currency || 'EUR') : null,
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, NextResponse.json(invoiceWithMoney, { status: 201 }));
    }

    // Log response
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      invoice_id: insertId,
    });

    const response = NextResponse.json(invoiceWithMoney, {
      status: 201,
      headers: {
        'Location': `/api/invoices/receivable/${insertId}`,
      },
    });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create receivable invoice',
      500,
      undefined,
      requestId
    );
  }
}
