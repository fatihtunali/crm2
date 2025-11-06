import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, ErrorCodes } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';

/**
 * GET /api/payments/receivable
 * List all customer payments across all invoices
 *
 * Query params:
 * - date_from: YYYY-MM-DD (filter by payment date)
 * - date_to: YYYY-MM-DD (filter by payment date)
 * - payment_method: Filter by payment method
 * - customer_id: Filter by customer ID
 * - invoice_id: Filter by specific invoice
 * - limit: Number of records (default 100, max 500)
 * - offset: Pagination offset (default 0)
 */
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

    // Rate limiting (100 requests per minute per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_payments_list`,
      100,
      60
    );

    if (rateLimit.remaining === 0) {
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded. Try again in a moment.',
        429,
        undefined,
        requestId
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const paymentMethod = searchParams.get('payment_method');
    const customerId = searchParams.get('customer_id');
    const invoiceId = searchParams.get('invoice_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build WHERE clause
    const whereClauses: string[] = ['ip.organization_id = ?', 'ip.invoice_type = ?'];
    const queryParams: any[] = [tenantId, 'receivable'];

    if (dateFrom) {
      whereClauses.push('ip.payment_date >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereClauses.push('ip.payment_date <= ?');
      queryParams.push(dateTo);
    }

    if (paymentMethod) {
      whereClauses.push('ip.payment_method = ?');
      queryParams.push(paymentMethod);
    }

    if (customerId) {
      whereClauses.push('ir.customer_id = ?');
      queryParams.push(customerId);
    }

    if (invoiceId) {
      whereClauses.push('ip.invoice_id = ?');
      queryParams.push(invoiceId);
    }

    const whereClause = whereClauses.join(' AND ');

    // Get payments with invoice details
    const [paymentsResult] = await query<any>(
      `SELECT
        ip.id as payment_id,
        ip.invoice_id,
        ip.payment_amount,
        ip.payment_currency,
        ip.payment_method,
        ip.payment_reference,
        ip.payment_date,
        ip.payment_notes,
        ip.created_at,
        ir.invoice_number,
        ir.customer_id,
        ir.customer_name,
        ir.customer_email,
        ir.total_amount as invoice_total,
        ir.paid_amount as invoice_paid,
        ir.status as invoice_status,
        u.full_name as processed_by_name
      FROM invoice_payments ip
      INNER JOIN invoices_receivable ir ON ip.invoice_id = ir.id
      LEFT JOIN users u ON ip.processed_by = u.id
      WHERE ${whereClause}
      ORDER BY ip.payment_date DESC, ip.created_at DESC
      LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // Get summary aggregations
    const [summaryResult] = await query<any>(
      `SELECT
        SUM(ip.payment_amount) as total_received,
        ip.payment_currency as currency,
        COUNT(DISTINCT ip.invoice_id) as invoice_count,
        COUNT(ip.id) as payment_count
      FROM invoice_payments ip
      INNER JOIN invoices_receivable ir ON ip.invoice_id = ir.id
      WHERE ${whereClause}
      GROUP BY ip.payment_currency`,
      queryParams
    );

    // Get pending amount (invoices not fully paid)
    const [pendingResult] = await query<any>(
      `SELECT
        SUM(ir.total_amount - COALESCE(ir.paid_amount, 0)) as total_pending,
        ir.currency
      FROM invoices_receivable ir
      WHERE ir.organization_id = ?
        AND ir.status IN ('sent', 'partial', 'overdue')
      GROUP BY ir.currency`,
      [tenantId]
    );

    // Format payments with Money types
    const payments = paymentsResult.map((payment: any) => ({
      payment_id: payment.payment_id,
      invoice_id: payment.invoice_id,
      invoice_number: payment.invoice_number,
      customer_id: payment.customer_id,
      customer_name: payment.customer_name,
      customer_email: payment.customer_email,
      payment_amount: createMoney(
        Number(payment.payment_amount),
        payment.payment_currency || 'EUR'
      ),
      payment_method: payment.payment_method,
      payment_reference: payment.payment_reference,
      payment_date: payment.payment_date,
      payment_notes: payment.payment_notes,
      invoice_total: createMoney(
        Number(payment.invoice_total),
        payment.payment_currency || 'EUR'
      ),
      invoice_paid: createMoney(
        Number(payment.invoice_paid),
        payment.payment_currency || 'EUR'
      ),
      invoice_status: payment.invoice_status,
      processed_by_name: payment.processed_by_name,
      created_at: payment.created_at,
    }));

    // Format summary
    const summary = summaryResult.map((s: any) => ({
      total_received: createMoney(Number(s.total_received || 0), s.currency || 'EUR'),
      currency: s.currency || 'EUR',
      invoice_count: parseInt(s.invoice_count || '0'),
      payment_count: parseInt(s.payment_count || '0'),
    }));

    const pending = pendingResult.map((p: any) => ({
      total_pending: createMoney(Number(p.total_pending || 0), p.currency || 'EUR'),
      currency: p.currency || 'EUR',
    }));

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      payment_count: payments.length,
    });

    const response = NextResponse.json({
      success: true,
      payments,
      summary,
      pending,
      pagination: {
        limit,
        offset,
        has_more: payments.length === limit,
      },
    });

    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    console.error('Error fetching receivable payments:', error);

    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch payments',
      500,
      undefined,
      requestId
    );
  }
}
