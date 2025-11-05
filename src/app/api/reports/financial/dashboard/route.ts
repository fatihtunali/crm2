/**
 * Financial Dashboard Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/financial/dashboard - Get financial dashboard report
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
        const period = searchParams.get('period') || 'this_quarter';
        const { startDate, endDate } = calculateDateRange(period);

        // Receivables summary
        const [receivablesResult] = await query(`
          SELECT
            SUM(total_amount) as total,
            SUM(paid_amount) as paid,
            SUM(total_amount - paid_amount) as outstanding,
            COUNT(*) as invoice_count,
            COUNT(CASE WHEN ir.status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN ir.status = 'overdue' THEN 1 END) as overdue_count
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE q.organization_id = ?
        `, [parseInt(tenantId)]) as any[];

        // Payables summary
        const [payablesResult] = await query(`
          SELECT
            SUM(total_amount) as total,
            SUM(paid_amount) as paid,
            SUM(total_amount - paid_amount) as outstanding,
            COUNT(*) as invoice_count,
            COUNT(CASE WHEN ip.status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN ip.status = 'overdue' THEN 1 END) as overdue_count
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
        `, [parseInt(tenantId)]) as any[];

        // Aging buckets - Receivables
        const [receivablesAging] = await query(`
          SELECT
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN total_amount - paid_amount ELSE 0 END) as current,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN total_amount - paid_amount ELSE 0 END) as days_1_30,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN total_amount - paid_amount ELSE 0 END) as days_31_60,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN total_amount - paid_amount ELSE 0 END) as days_61_90,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN total_amount - paid_amount ELSE 0 END) as days_90_plus
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE q.organization_id = ?
          AND ir.status != 'paid'
        `, [parseInt(tenantId)]) as any[];

        // Aging buckets - Payables
        const [payablesAging] = await query(`
          SELECT
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN total_amount - paid_amount ELSE 0 END) as current,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN total_amount - paid_amount ELSE 0 END) as days_1_30,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN total_amount - paid_amount ELSE 0 END) as days_31_60,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN total_amount - paid_amount ELSE 0 END) as days_61_90,
            SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN total_amount - paid_amount ELSE 0 END) as days_90_plus
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
          AND ip.status != 'paid'
        `, [parseInt(tenantId)]) as any[];

        // Cash flow projection (next 30 days)
        const [cashFlowResult] = await query(`
          SELECT
            SUM(CASE WHEN due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              THEN total_amount - paid_amount ELSE 0 END) as expected_receivables,
            (SELECT SUM(CASE WHEN due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              THEN total_amount - paid_amount ELSE 0 END)
              FROM invoices_payable ip2
              JOIN quotes q2 ON ip2.booking_id = q2.id
              WHERE q2.organization_id = ? AND ip2.status != 'paid') as expected_payables
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE q.organization_id = ?
          AND ir.status != 'paid'
        `, [parseInt(tenantId), parseInt(tenantId)]) as any[];

        // Monthly revenue and costs trend
        const monthlyTrend = await query(`
          SELECT
            month,
            COALESCE(SUM(receivables), 0) as receivables,
            COALESCE(SUM(payables), 0) as payables
          FROM (
            SELECT
              DATE_FORMAT(ir.invoice_date, '%Y-%m') as month,
              ir.total_amount as receivables,
              0 as payables
            FROM invoices_receivable ir
            JOIN quotes q ON ir.booking_id = q.id
            WHERE q.organization_id = ?
            AND ir.invoice_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)

            UNION ALL

            SELECT
              DATE_FORMAT(ip.invoice_date, '%Y-%m') as month,
              0 as receivables,
              ip.total_amount as payables
            FROM invoices_payable ip
            JOIN quotes q2 ON ip.booking_id = q2.id
            WHERE q2.organization_id = ?
            AND ip.invoice_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
          ) combined
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `, [parseInt(tenantId), parseInt(tenantId)]) as any[];

        // Calculate summary metrics
        const totalTurnover = parseFloat(receivablesResult?.total || 0);
        const totalCosts = parseFloat(payablesResult?.total || 0);
        const grossProfit = totalTurnover - totalCosts;
        const grossMargin = totalTurnover > 0 ? (grossProfit / totalTurnover) * 100 : 0;

        const data = {
          period: {
            start_date: startDate,
            end_date: endDate
          },
          summary: {
            totalTurnover: createMoney(totalTurnover, 'EUR'),
            totalCosts: createMoney(totalCosts, 'EUR'),
            grossProfit: createMoney(grossProfit, 'EUR'),
            grossMargin: Math.round(grossMargin * 100) / 100,
            netProfit: createMoney(grossProfit, 'EUR'), // Simplified: same as gross profit
            netMargin: Math.round(grossMargin * 100) / 100 // Simplified: same as gross margin
          },
          receivables: {
            total: createMoney(parseFloat(receivablesResult?.outstanding || 0), 'EUR'),
            current: createMoney(parseFloat(receivablesAging?.current || 0), 'EUR'),
            days30to60: createMoney(parseFloat(receivablesAging?.days_31_60 || 0), 'EUR'),
            days60plus: createMoney(
              parseFloat(receivablesAging?.days_61_90 || 0) + parseFloat(receivablesAging?.days_90_plus || 0),
              'EUR'
            )
          },
          payables: {
            total: createMoney(parseFloat(payablesResult?.outstanding || 0), 'EUR'),
            current: createMoney(parseFloat(payablesAging?.current || 0), 'EUR'),
            days30to60: createMoney(parseFloat(payablesAging?.days_31_60 || 0), 'EUR'),
            days60plus: createMoney(
              parseFloat(payablesAging?.days_61_90 || 0) + parseFloat(payablesAging?.days_90_plus || 0),
              'EUR'
            )
          },
          cashFlow: {
            opening: createMoney(0, 'EUR'), // Not tracked currently
            inflows: createMoney(parseFloat(cashFlowResult?.expected_receivables || 0), 'EUR'),
            outflows: createMoney(parseFloat(cashFlowResult?.expected_payables || 0), 'EUR'),
            closing: createMoney(
              parseFloat(cashFlowResult?.expected_receivables || 0) - parseFloat(cashFlowResult?.expected_payables || 0),
              'EUR'
            )
          },
          monthlyTrend: monthlyTrend.map((m: any) => ({
            month: m.month,
            receivables: createMoney(parseFloat(m.receivables || 0), 'EUR'),
            payables: createMoney(parseFloat(m.payables || 0), 'EUR'),
            netIncome: createMoney(parseFloat(m.receivables || 0) - parseFloat(m.payables || 0), 'EUR')
          })).reverse()
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
      report: 'financial_dashboard',
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
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
