/**
 * Provider Financial Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/financial/providers - Get provider financial report
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'reports', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (100 requests per hour per user for read-only reports)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_reports`,
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
        const period = searchParams.get('period') || 'last_30_days';
        const { startDate, endDate } = calculateDateRange(period);

        // Payments by provider
        const providerPayments = await query(`
          SELECT
            p.id as provider_id,
            p.provider_name,
            p.provider_type,
            COUNT(ip.id) as invoice_count,
            SUM(ip.total_amount) as total_amount,
            SUM(ip.paid_amount) as paid_amount,
            SUM(ip.total_amount - ip.paid_amount) as outstanding_amount,
            COUNT(CASE WHEN ip.status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN ip.status = 'overdue' THEN 1 END) as overdue_count
          FROM providers p
          LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
          LEFT JOIN quotes q ON ip.booking_id = q.id
          WHERE p.organization_id = ?
          AND (ip.invoice_date IS NULL OR ip.invoice_date BETWEEN ? AND ?)
          GROUP BY p.id
          HAVING invoice_count > 0
          ORDER BY total_amount DESC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Payment history by provider
        const paymentHistory = await query(`
          SELECT
            p.provider_name,
            ip.invoice_number,
            ip.invoice_date,
            ip.due_date,
            ip.payment_date,
            ip.total_amount,
            ip.paid_amount,
            ip.status,
            ip.payment_method
          FROM invoices_payable ip
          JOIN providers p ON ip.provider_id = p.id
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
          AND ip.invoice_date BETWEEN ? AND ?
          ORDER BY ip.invoice_date DESC
          LIMIT 100
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Provider type analysis
        const byProviderType = await query(`
          SELECT
            p.provider_type,
            COUNT(DISTINCT p.id) as provider_count,
            COUNT(ip.id) as invoice_count,
            SUM(ip.total_amount) as total_amount,
            SUM(ip.paid_amount) as paid_amount
          FROM providers p
          LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
          LEFT JOIN quotes q ON ip.booking_id = q.id
          WHERE p.organization_id = ?
          AND ip.invoice_date BETWEEN ? AND ?
          GROUP BY p.provider_type
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Top providers by outstanding amount
        const topOutstanding = await query(`
          SELECT
            p.provider_name,
            SUM(ip.total_amount - ip.paid_amount) as outstanding
          FROM invoices_payable ip
          JOIN providers p ON ip.provider_id = p.id
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
          AND ip.status != 'paid'
          GROUP BY p.id
          ORDER BY outstanding DESC
          LIMIT 10
        `, [parseInt(tenantId)]) as any[];

        const data = {
          period: { start_date: startDate, end_date: endDate },
          providers: providerPayments.map((p: any) => ({
            providerId: p.provider_id,
            providerName: p.provider_name,
            providerType: p.provider_type,
            invoiceCount: parseInt(p.invoice_count || 0),
            totalAmount: createMoney(parseFloat(p.total_amount || 0), 'EUR'),
            paidAmount: createMoney(parseFloat(p.paid_amount || 0), 'EUR'),
            outstandingAmount: createMoney(parseFloat(p.outstanding_amount || 0), 'EUR'),
            paidCount: parseInt(p.paid_count || 0),
            overdueCount: parseInt(p.overdue_count || 0)
          })),
          paymentHistory: paymentHistory.map((h: any) => ({
            providerName: h.provider_name,
            invoiceNumber: h.invoice_number,
            invoiceDate: h.invoice_date,
            dueDate: h.due_date,
            paymentDate: h.payment_date,
            totalAmount: createMoney(parseFloat(h.total_amount || 0), 'EUR'),
            paidAmount: createMoney(parseFloat(h.paid_amount || 0), 'EUR'),
            status: h.status,
            paymentMethod: h.payment_method
          })),
          byProviderType: byProviderType.map((t: any) => ({
            providerType: t.provider_type,
            providerCount: parseInt(t.provider_count || 0),
            invoiceCount: parseInt(t.invoice_count || 0),
            totalAmount: createMoney(parseFloat(t.total_amount || 0), 'EUR'),
            paidAmount: createMoney(parseFloat(t.paid_amount || 0), 'EUR')
          })),
          topOutstanding: topOutstanding.map((t: any) => ({
            providerName: t.provider_name,
            outstanding: createMoney(parseFloat(t.outstanding || 0), 'EUR')
          }))
        };

    // Create response with headers
    const response = NextResponse.json({ data });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      report: 'financial_providers',
    });

    return response;
  } catch (error: any) {
    // Log error
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
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
function calculateDateRange(period: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now);

  switch(period) {
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_90_days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
