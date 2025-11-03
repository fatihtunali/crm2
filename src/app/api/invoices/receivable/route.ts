import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem, createdResponse } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

// GET - Fetch all receivable invoices with pagination, search, sort, filters
export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: -invoice_date,-created_at)
    const sortParam = searchParams.get('sort') || '-invoice_date,-created_at';
    const orderBy = parseSortParams(sortParam);

    // Build filters
    const filters: Record<string, any> = {};

    const statusFilter = searchParams.get('status');
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in invoice_number, customer_name, quote_number)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchClause(searchTerm || '', ['ir.invoice_number', 'ir.customer_name', 'q.quote_number']);

    // Combine where and search
    const combined = combineWhereAndSearch(whereClause, searchClause);

    // Build main query
    let sql = `
      SELECT
        ir.*,
        q.quote_number
      FROM invoices_receivable ir
      LEFT JOIN quotes q ON ir.booking_id = q.id
    `;

    const params: any[] = [];

    // Add WHERE clause
    if (combined.whereSQL) {
      sql += ` WHERE ${combined.whereSQL}`;
      params.push(...combined.params);
    }

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ir.${orderBy}`;
    } else {
      sql += ` ORDER BY ir.invoice_date DESC, ir.created_at DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `SELECT COUNT(*) as total FROM invoices_receivable ir LEFT JOIN quotes q ON ir.booking_id = q.id`;
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
      internalServerErrorProblem('Failed to fetch receivable invoices', '/api/invoices/receivable')
    );
  }
}

// POST - Create new receivable invoice
export async function POST(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

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

    const response = createdResponse(invoiceWithMoney, `/api/invoices/receivable/${insertId}`);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to create receivable invoice', '/api/invoices/receivable')
    );
  }
}
