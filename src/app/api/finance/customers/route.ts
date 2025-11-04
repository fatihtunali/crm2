import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, combineWhereAndSearch } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

// GET - Fetch aggregated customer financial data
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

    // Parse sort parameters (default: -outstanding DESC, -total_invoiced DESC)
    const sortParam = searchParams.get('sort') || '-outstanding';
    const orderBy = parseSortParams(sortParam);

    // Build search clause (search in customer_name, customer_email)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchTerm(searchTerm || '');

    // Build main query
    let sql = `
      SELECT
        q.customer_name,
        q.customer_email,
        q.customer_phone,
        COUNT(DISTINCT ir.id) as invoice_count,
        COUNT(DISTINCT q.id) as booking_count,
        SUM(ir.total_amount) as total_invoiced,
        SUM(ir.paid_amount) as total_received,
        SUM(ir.total_amount - ir.paid_amount) as outstanding,
        MAX(ir.payment_date) as last_payment_date,
        COUNT(CASE WHEN ir.status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN ir.status = 'partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN ir.status = 'paid' THEN 1 END) as paid_count
      FROM quotes q
      LEFT JOIN invoices_receivable ir ON q.id = ir.booking_id
      WHERE q.status = 'accepted'
        AND q.organization_id = ?
    `;

    const params: any[] = [parseInt(tenantId)];

    // Add search clause
    if (searchClause.searchSQL) {
      sql += ` AND ${searchClause.searchSQL}`;
      params.push(...searchClause.params);
    }

    sql += `
      GROUP BY q.customer_name, q.customer_email, q.customer_phone
      HAVING invoice_count > 0
    `;

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    } else {
      sql += ` ORDER BY outstanding DESC, total_invoiced DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `
      SELECT COUNT(DISTINCT q.customer_name) as total
      FROM quotes q
      LEFT JOIN invoices_receivable ir ON q.id = ir.booking_id
      WHERE q.status = 'accepted'
        AND q.organization_id = ?
        AND ir.id IS NOT NULL
    `;
    const countParams: any[] = [parseInt(tenantId)];

    if (searchClause.searchSQL) {
      countSql += ` AND ${searchClause.searchSQL}`;
      countParams.push(...searchClause.params);
    }

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Transform to use Money types
    const transformedCustomers = (rows as any[]).map(customer => ({
      customer_name: customer.customer_name,
      customer_email: customer.customer_email,
      customer_phone: customer.customer_phone,
      invoice_count: customer.invoice_count,
      booking_count: customer.booking_count,
      total_invoiced: createMoney(parseFloat(customer.total_invoiced || 0), 'EUR'),
      total_received: createMoney(parseFloat(customer.total_received || 0), 'EUR'),
      outstanding: createMoney(parseFloat(customer.outstanding || 0), 'EUR'),
      last_payment_date: customer.last_payment_date,
      overdue_count: customer.overdue_count,
      partial_count: customer.partial_count,
      paid_count: customer.paid_count
    }));

    // Build paged response
    const pagedResponse = buildPagedResponse(transformedCustomers, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch customer financial data', '/api/finance/customers')
    );
  }
}

// Helper function to build search clause for customer data
function buildSearchTerm(searchTerm: string) {
  if (!searchTerm || searchTerm.trim() === '') {
    return { searchSQL: '', params: [] };
  }

  const searchValue = `%${searchTerm}%`;
  return {
    searchSQL: '(q.customer_name LIKE ? OR q.customer_email LIKE ?)',
    params: [searchValue, searchValue]
  };
}
