/**
 * Finance Suppliers Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/finance/suppliers - Get supplier financial data
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
        const ALLOWED_COLUMNS = ['provider_id', 'provider_name', 'provider_type', 'contact_email', 'contact_phone', 'invoice_count', 'total_invoiced', 'total_paid', 'outstanding', 'last_payment_date', 'overdue_count', 'pending_count', 'paid_count'];
        const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

        // Build filters
        const filters: Record<string, any> = {};

        const providerTypeFilter = searchParams.get('provider_type');
        if (providerTypeFilter && providerTypeFilter !== 'all') {
          filters.provider_type = providerTypeFilter;
        }

        // Build where clause
        const whereClause = buildWhereClause(filters);

        // Build search clause (search in provider_name, contact_email)
        const searchTerm = searchParams.get('search');
        const searchClause = buildSearchTerm(searchTerm || '');

        // Build main query with tenant filtering
        let sql = `
          SELECT
            p.id as provider_id,
            p.provider_name,
            p.provider_type,
            p.contact_email,
            p.contact_phone,
            COUNT(DISTINCT ip.id) as invoice_count,
            SUM(ip.total_amount) as total_invoiced,
            SUM(ip.paid_amount) as total_paid,
            SUM(ip.total_amount - ip.paid_amount) as outstanding,
            MAX(ip.payment_date) as last_payment_date,
            COUNT(CASE WHEN ip.status = 'overdue' THEN 1 END) as overdue_count,
            COUNT(CASE WHEN ip.status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN ip.status = 'paid' THEN 1 END) as paid_count
          FROM providers p
          LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
          LEFT JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
        `;

        const params: any[] = [parseInt(tenantId)];

        // Add where clause for filters
        if (whereClause.whereSQL) {
          sql += ` AND ${whereClause.whereSQL}`;
          params.push(...whereClause.params);
        }

        // Add search clause
        if (searchClause.searchSQL) {
          sql += ` AND ${searchClause.searchSQL}`;
          params.push(...searchClause.params);
        }

        sql += `
          GROUP BY p.id, p.provider_name, p.provider_type, p.contact_email, p.contact_phone
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
          SELECT COUNT(DISTINCT p.id) as total
          FROM providers p
          LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
          LEFT JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
            AND ip.id IS NOT NULL
        `;
        const countParams: any[] = [parseInt(tenantId)];

        if (whereClause.whereSQL) {
          countSql += ` AND ${whereClause.whereSQL}`;
          countParams.push(...whereClause.params);
        }

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
        const transformedSuppliers = (rows as any[]).map(supplier => ({
          provider_id: supplier.provider_id,
          provider_name: supplier.provider_name,
          provider_type: supplier.provider_type,
          contact_email: supplier.contact_email,
          contact_phone: supplier.contact_phone,
          invoice_count: supplier.invoice_count,
          total_invoiced: createMoney(parseFloat(supplier.total_invoiced || 0), 'EUR'),
          total_paid: createMoney(parseFloat(supplier.total_paid || 0), 'EUR'),
          outstanding: createMoney(parseFloat(supplier.outstanding || 0), 'EUR'),
          last_payment_date: supplier.last_payment_date,
          overdue_count: supplier.overdue_count,
          pending_count: supplier.pending_count,
          paid_count: supplier.paid_count
        }));

    // 4. Build standardized list response with hypermedia links
    const baseUrl = new URL(request.url).origin + new URL(request.url).pathname;
    const responseFilters: Record<string, any> = {};
    if (searchTerm) responseFilters.search = searchTerm;
    if (providerTypeFilter && providerTypeFilter !== 'all') responseFilters.provider_type = providerTypeFilter;

    const responseData = buildStandardListResponse(
      transformedSuppliers,
      total,
      page,
      pageSize,
      baseUrl,
      responseFilters
    );

    // 5. Create response with headers
    const response = NextResponse.json(responseData);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // 6. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      report: 'finance_suppliers',
      count: transformedSuppliers.length
    });

    return response;
  } catch (error: any) {
    console.error('Error in finance suppliers report:', error);
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
    searchSQL: '(p.provider_name LIKE ? OR p.contact_email LIKE ?)',
    params: [searchValue, searchValue]
  };
}
