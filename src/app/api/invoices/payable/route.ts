import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem, createdResponse } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { createMoney } from '@/lib/money';

// GET - Fetch all payable invoices with pagination, search, sort, filters
export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: -invoice_date,-created_at)
    const sortParam = searchParams.get('sort') || '-invoice_date,-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'invoice_number', 'supplier_invoice_number', 'invoice_date', 'due_date', 'total_amount', 'paid_amount', 'status', 'created_at', 'updated_at'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Build filters
    const filters: Record<string, any> = {};

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in invoice_number, provider_name, quote_number, customer_name)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', ['ip.invoice_number', 'p.provider_name', 'q.quote_number', 'q.customer_name']);

    // Combine where and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Build main query
    let sql = `
      SELECT
        ip.*,
        p.provider_name,
        q.quote_number,
        q.customer_name
      FROM invoices_payable ip
      LEFT JOIN providers p ON ip.provider_id = p.id
      LEFT JOIN quotes q ON ip.booking_id = q.id
    `;

    const params: any[] = [];

    // Add WHERE clause
    if (combined.whereSQL) {
      sql += ` WHERE ${combined.whereSQL}`;
      params.push(...combined.params);
    }

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ip.${orderBy}`;
    } else {
      sql += ` ORDER BY ip.invoice_date DESC, ip.created_at DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `SELECT COUNT(*) as total FROM invoices_payable ip LEFT JOIN providers p ON ip.provider_id = p.id LEFT JOIN quotes q ON ip.booking_id = q.id`;
    if (combined.whereSQL) {
      countSql += ` WHERE ${combined.whereSQL}`;
    }

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, combined.params)
    ]);

    const total = (countResult as any)[0].total;

    // Convert money fields to Money type
    const invoicesWithMoney = (rows as any[]).map(invoice => ({
      ...invoice,
      total_amount: invoice.total_amount ? createMoney(Number(invoice.total_amount), invoice.currency || 'EUR') : null,
      paid_amount: invoice.paid_amount ? createMoney(Number(invoice.paid_amount), invoice.currency || 'EUR') : null,
    }));

    // Build paged response
    const pagedResponse = buildPagedResponse(invoicesWithMoney, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch payable invoices', '/api/invoices/payable')
    );
  }
}

// POST - Create new payable invoice
export async function POST(request: NextRequest) {
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

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
      provider_id,
      invoice_number,
      supplier_invoice_number,
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

    const result = await query(
      `INSERT INTO invoices_payable (
        booking_id, provider_id, invoice_number, supplier_invoice_number, invoice_date, due_date,
        total_amount, currency, paid_amount, payment_date, payment_method,
        payment_reference, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        booking_id,
        provider_id,
        invoice_number,
        supplier_invoice_number,
        invoice_date,
        due_date,
        total_amount,
        currency || 'EUR',
        paid_amount || 0,
        payment_date,
        payment_method,
        payment_reference,
        status || 'pending',
        notes
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created invoice to return with timestamps
    const [createdInvoice] = await query(
      `SELECT ip.*, p.provider_name, q.quote_number, q.customer_name
       FROM invoices_payable ip
       LEFT JOIN providers p ON ip.provider_id = p.id
       LEFT JOIN quotes q ON ip.booking_id = q.id
       WHERE ip.id = ?`,
      [insertId]
    ) as any[];

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...createdInvoice,
      total_amount: createdInvoice.total_amount ? createMoney(Number(createdInvoice.total_amount), createdInvoice.currency || 'EUR') : null,
      paid_amount: createdInvoice.paid_amount ? createMoney(Number(createdInvoice.paid_amount), createdInvoice.currency || 'EUR') : null,
    };

    const response = createdResponse(invoiceWithMoney, `/api/invoices/payable/${insertId}`);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to create payable invoice', '/api/invoices/payable')
    );
  }
}
