/**
 * Finance Customers Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/finance/customers - Get customer financial data
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';
import { parseStandardPaginationParams, buildStandardListResponse, parseSortParams } from '@/lib/pagination';
import { buildWhereClause, buildSearchClause, buildQuery } from '@/lib/query-builder';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'finance', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (100 requests per hour per user for read-only reports)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_finance`,
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

    // 3. Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

        // Parse sort parameters (default: -outstanding DESC, -total_invoiced DESC)
        const sortParam = searchParams.get('sort') || '-outstanding';
        // SECURITY: Whitelist allowed columns to prevent SQL injection
        const ALLOWED_COLUMNS = ['customer_name', 'customer_email', 'invoice_count', 'booking_count', 'total_invoiced', 'total_received', 'outstanding', 'last_payment_date', 'overdue_count', 'partial_count', 'paid_count'];
        const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

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

    // 4. Build standardized list response with hypermedia links
    const baseUrl = new URL(request.url).origin + new URL(request.url).pathname;
    const filters = searchTerm ? { search: searchTerm } : {};
    const responseData = buildStandardListResponse(
      transformedCustomers,
      total,
      page,
      pageSize,
      baseUrl,
      filters
    );

    // 5. Create response with headers
    const response = NextResponse.json(responseData);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // 6. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      report: 'finance_customers',
      count: transformedCustomers.length
    });

    return response;
  } catch (error: any) {
    console.error('Error in finance customers report:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message
    });
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred while generating the report',
      500,
      undefined,
      requestId
    );
  }
}
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
