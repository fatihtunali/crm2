/**
 * Financial Aging Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/financial/aging - Get financial aging report
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
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
        const type = searchParams.get('type') || 'receivables'; // receivables or payables

        let agingData;
        if (type === 'receivables') {
          agingData = await query(`
            SELECT
              ir.id,
              ir.invoice_number,
              ir.customer_name,
              ir.customer_email,
              ir.invoice_date,
              ir.due_date,
              ir.total_amount,
              ir.paid_amount,
              ir.total_amount - ir.paid_amount as outstanding_amount,
              ir.status,
              DATEDIFF(CURDATE(), ir.due_date) as days_overdue,
              CASE
                WHEN DATEDIFF(CURDATE(), ir.due_date) <= 0 THEN 'Current'
                WHEN DATEDIFF(CURDATE(), ir.due_date) BETWEEN 1 AND 30 THEN '1-30 days'
                WHEN DATEDIFF(CURDATE(), ir.due_date) BETWEEN 31 AND 60 THEN '31-60 days'
                WHEN DATEDIFF(CURDATE(), ir.due_date) BETWEEN 61 AND 90 THEN '61-90 days'
                ELSE '90+ days'
              END as aging_bucket,
              q.quote_number,
              q.destination
            FROM invoices_receivable ir
            JOIN quotes q ON ir.booking_id = q.id
            WHERE q.organization_id = ?
            AND ir.status != 'paid'
            ORDER BY days_overdue DESC
          `, [parseInt(tenantId)]) as any[];
        } else {
          agingData = await query(`
            SELECT
              ip.id,
              ip.invoice_number,
              p.provider_name,
              ip.invoice_date,
              ip.due_date,
              ip.total_amount,
              ip.paid_amount,
              ip.total_amount - ip.paid_amount as outstanding_amount,
              ip.status,
              DATEDIFF(CURDATE(), ip.due_date) as days_overdue,
              CASE
                WHEN DATEDIFF(CURDATE(), ip.due_date) <= 0 THEN 'Current'
                WHEN DATEDIFF(CURDATE(), ip.due_date) BETWEEN 1 AND 30 THEN '1-30 days'
                WHEN DATEDIFF(CURDATE(), ip.due_date) BETWEEN 31 AND 60 THEN '31-60 days'
                WHEN DATEDIFF(CURDATE(), ip.due_date) BETWEEN 61 AND 90 THEN '61-90 days'
                ELSE '90+ days'
              END as aging_bucket,
              q.quote_number
            FROM invoices_payable ip
            JOIN providers p ON ip.provider_id = p.id
            JOIN quotes q ON ip.booking_id = q.id
            WHERE q.organization_id = ?
            AND ip.status != 'paid'
            ORDER BY days_overdue DESC
          `, [parseInt(tenantId)]) as any[];
        }

        // Summary by aging bucket
        const bucketSummary = await query(`
          SELECT
            aging_bucket,
            SUM(outstanding_amount) as total_outstanding,
            COUNT(*) as invoice_count
          FROM (
            ${type === 'receivables' ? `
              SELECT
                ir.total_amount - ir.paid_amount as outstanding_amount,
                CASE
                  WHEN DATEDIFF(CURDATE(), ir.due_date) <= 0 THEN 'Current'
                  WHEN DATEDIFF(CURDATE(), ir.due_date) BETWEEN 1 AND 30 THEN '1-30 days'
                  WHEN DATEDIFF(CURDATE(), ir.due_date) BETWEEN 31 AND 60 THEN '31-60 days'
                  WHEN DATEDIFF(CURDATE(), ir.due_date) BETWEEN 61 AND 90 THEN '61-90 days'
                  ELSE '90+ days'
                END as aging_bucket
              FROM invoices_receivable ir
              JOIN quotes q ON ir.booking_id = q.id
              WHERE q.organization_id = ?
              AND ir.status != 'paid'
            ` : `
              SELECT
                ip.total_amount - ip.paid_amount as outstanding_amount,
                CASE
                  WHEN DATEDIFF(CURDATE(), ip.due_date) <= 0 THEN 'Current'
                  WHEN DATEDIFF(CURDATE(), ip.due_date) BETWEEN 1 AND 30 THEN '1-30 days'
                  WHEN DATEDIFF(CURDATE(), ip.due_date) BETWEEN 31 AND 60 THEN '31-60 days'
                  WHEN DATEDIFF(CURDATE(), ip.due_date) BETWEEN 61 AND 90 THEN '61-90 days'
                  ELSE '90+ days'
                END as aging_bucket
              FROM invoices_payable ip
              JOIN quotes q ON ip.booking_id = q.id
              WHERE q.organization_id = ?
              AND ip.status != 'paid'
            `}
          ) as aged_invoices
          GROUP BY aging_bucket
          ORDER BY
            CASE aging_bucket
              WHEN 'Current' THEN 1
              WHEN '1-30 days' THEN 2
              WHEN '31-60 days' THEN 3
              WHEN '61-90 days' THEN 4
              WHEN '90+ days' THEN 5
            END
        `, [parseInt(tenantId)]) as any[];

        const data = {
          type: type,
          invoices: agingData.map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            customerName: type === 'receivables' ? inv.customer_name : inv.provider_name,
            customerEmail: inv.customer_email,
            invoiceDate: inv.invoice_date,
            dueDate: inv.due_date,
            totalAmount: createMoney(parseFloat(inv.total_amount || 0), 'EUR'),
            paidAmount: createMoney(parseFloat(inv.paid_amount || 0), 'EUR'),
            outstandingAmount: createMoney(parseFloat(inv.outstanding_amount || 0), 'EUR'),
            status: inv.status,
            daysOverdue: parseInt(inv.days_overdue || 0),
            agingBucket: inv.aging_bucket,
            quoteNumber: inv.quote_number,
            destination: inv.destination
          })),
          summary: bucketSummary.map((b: any) => ({
            agingBucket: b.aging_bucket,
            totalOutstanding: createMoney(parseFloat(b.total_outstanding || 0), 'EUR'),
            invoiceCount: parseInt(b.invoice_count || 0)
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
      report: 'financial_aging',
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

