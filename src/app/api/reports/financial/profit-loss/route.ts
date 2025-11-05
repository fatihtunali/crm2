/**
 * Profit & Loss Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/financial/profit-loss - Get profit and loss report
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
        const period = searchParams.get('period') || 'this_year';
        const { startDate, endDate } = calculateDateRange(period);

        // Revenue (from accepted quotes)
        const [revenueResult] = await query(`
          SELECT
            SUM(total_price) as total_revenue,
            COUNT(*) as booking_count
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Revenue by category
        const revenueByCategory = await query(`
          SELECT
            category,
            SUM(total_price) as revenue,
            COUNT(*) as bookings
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          AND category IS NOT NULL
          GROUP BY category
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Costs (from quote expenses)
        const costsByCategory = await query(`
          SELECT
            qe.category,
            SUM(qe.price) as total_cost,
            COUNT(*) as expense_count
          FROM quote_expenses qe
          JOIN quote_days qd ON qe.quote_day_id = qd.id
          JOIN quotes q ON qd.quote_id = q.id
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND qd.date BETWEEN ? AND ?
          GROUP BY qe.category
          ORDER BY total_cost DESC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Total costs
        const totalCosts = costsByCategory.reduce((sum: number, c: any) => sum + parseFloat(c.total_cost || 0), 0);

        // Calculate margins
        const totalRevenue = parseFloat(revenueResult?.total_revenue || 0);
        const grossProfit = totalRevenue - totalCosts;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // Monthly P&L
        const monthlyPL = await query(`
          SELECT
            DATE_FORMAT(q.start_date, '%Y-%m') as month,
            SUM(q.total_price) as revenue,
            (SELECT COALESCE(SUM(qe2.price), 0)
             FROM quote_expenses qe2
             JOIN quote_days qd2 ON qe2.quote_day_id = qd2.id
             WHERE qd2.quote_id = q.id) as costs
          FROM quotes q
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          GROUP BY DATE_FORMAT(q.start_date, '%Y-%m')
          ORDER BY month ASC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        const data = {
          period: { start_date: startDate, end_date: endDate },
          summary: {
            totalRevenue: createMoney(totalRevenue, 'EUR'),
            totalCosts: createMoney(totalCosts, 'EUR'),
            grossProfit: createMoney(grossProfit, 'EUR'),
            grossMargin: Math.round(grossMargin * 100) / 100,
            bookingCount: parseInt(revenueResult?.booking_count || 0)
          },
          revenueByCategory: revenueByCategory.map((r: any) => ({
            category: r.category,
            revenue: createMoney(parseFloat(r.revenue || 0), 'EUR'),
            bookings: parseInt(r.bookings || 0)
          })),
          costsByCategory: costsByCategory.map((c: any) => ({
            category: c.category,
            totalCost: createMoney(parseFloat(c.total_cost || 0), 'EUR'),
            expenseCount: parseInt(c.expense_count || 0),
            percentageOfTotal: totalCosts > 0 ? Math.round((parseFloat(c.total_cost || 0) / totalCosts) * 100 * 100) / 100 : 0
          })),
          monthlyPL: monthlyPL.map((m: any) => {
            const monthRevenue = parseFloat(m.revenue || 0);
            const monthCosts = parseFloat(m.costs || 0);
            const monthProfit = monthRevenue - monthCosts;
            return {
              month: m.month,
              revenue: createMoney(monthRevenue, 'EUR'),
              costs: createMoney(monthCosts, 'EUR'),
              profit: createMoney(monthProfit, 'EUR'),
              margin: monthRevenue > 0 ? Math.round((monthProfit / monthRevenue) * 100 * 100) / 100 : 0
            };
          })
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
      report: 'financial_profit_loss',
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
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getFullYear(), 0, 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
