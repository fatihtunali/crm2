/**
 * Cost Structure Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/pricing/cost-structure - Get cost structure report
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
        const period = searchParams.get('period') || 'last_90_days';
        const { startDate, endDate } = calculateDateRange(period);

        // Cost structure by category
        const costByCategory = await query(`
          SELECT
            qe.category,
            COUNT(*) as usage_count,
            SUM(qe.price) as total_cost,
            AVG(qe.price) as avg_cost,
            MIN(qe.price) as min_cost,
            MAX(qe.price) as max_cost
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
        const totalCosts = costByCategory.reduce((sum: number, c: any) => sum + parseFloat(c.total_cost || 0), 0);

        // Cost per booking
        const costPerBooking = await query(`
          SELECT
            q.id,
            q.quote_number,
            q.destination,
            q.total_price as selling_price,
            COALESCE(SUM(qe.price), 0) as total_cost,
            q.total_price - COALESCE(SUM(qe.price), 0) as profit
          FROM quotes q
          LEFT JOIN quote_days qd ON q.id = qd.quote_id
          LEFT JOIN quote_expenses qe ON qd.id = qe.quote_day_id
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          GROUP BY q.id
          ORDER BY total_cost DESC
          LIMIT 20
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Cost structure by destination
        const costByDestination = await query(`
          SELECT
            q.destination,
            COUNT(DISTINCT q.id) as booking_count,
            SUM(qe.price) as total_cost,
            AVG(qe.price) as avg_expense_cost,
            SUM(q.total_price) as total_revenue
          FROM quotes q
          LEFT JOIN quote_days qd ON q.id = qd.quote_id
          LEFT JOIN quote_expenses qe ON qd.id = qe.quote_day_id
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          AND q.destination IS NOT NULL
          GROUP BY q.destination
          ORDER BY total_cost DESC
          LIMIT 10
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Average cost breakdown per tour
        const [avgCostBreakdown] = await query(`
          SELECT
            AVG(hotel_cost) as avg_hotel_cost,
            AVG(transport_cost) as avg_transport_cost,
            AVG(tour_cost) as avg_tour_cost,
            AVG(meal_cost) as avg_meal_cost,
            AVG(other_cost) as avg_other_cost
          FROM (
            SELECT
              q.id,
              SUM(CASE WHEN qe.category = 'hotel' THEN qe.price ELSE 0 END) as hotel_cost,
              SUM(CASE WHEN qe.category LIKE '%transport%' THEN qe.price ELSE 0 END) as transport_cost,
              SUM(CASE WHEN qe.category = 'tour' THEN qe.price ELSE 0 END) as tour_cost,
              SUM(CASE WHEN qe.category = 'meal' THEN qe.price ELSE 0 END) as meal_cost,
              SUM(CASE WHEN qe.category NOT IN ('hotel', 'tour', 'meal') AND qe.category NOT LIKE '%transport%' THEN qe.price ELSE 0 END) as other_cost
            FROM quotes q
            LEFT JOIN quote_days qd ON q.id = qd.quote_id
            LEFT JOIN quote_expenses qe ON qd.id = qe.quote_day_id
            WHERE q.organization_id = ?
            AND q.status = 'accepted'
            AND q.start_date BETWEEN ? AND ?
            GROUP BY q.id
          ) as cost_breakdown
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Cost efficiency (cost per pax per day)
        const costEfficiency = await query(`
          SELECT
            q.destination,
            AVG(
              COALESCE(SUM(qe.price), 0) /
              (q.adults + q.children) /
              GREATEST(DATEDIFF(q.end_date, q.start_date), 1)
            ) as cost_per_pax_per_day
          FROM quotes q
          LEFT JOIN quote_days qd ON q.id = qd.quote_id
          LEFT JOIN quote_expenses qe ON qd.id = qe.quote_day_id
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          AND q.destination IS NOT NULL
          GROUP BY q.destination
          ORDER BY cost_per_pax_per_day ASC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        const data = {
          period: { start_date: startDate, end_date: endDate },
          overview: {
            totalCosts: createMoney(totalCosts, 'EUR'),
            avgHotelCost: createMoney(parseFloat(avgCostBreakdown?.avg_hotel_cost || 0), 'EUR'),
            avgTransportCost: createMoney(parseFloat(avgCostBreakdown?.avg_transport_cost || 0), 'EUR'),
            avgTourCost: createMoney(parseFloat(avgCostBreakdown?.avg_tour_cost || 0), 'EUR'),
            avgMealCost: createMoney(parseFloat(avgCostBreakdown?.avg_meal_cost || 0), 'EUR'),
            avgOtherCost: createMoney(parseFloat(avgCostBreakdown?.avg_other_cost || 0), 'EUR')
          },
          byCategory: costByCategory.map((c: any) => ({
            category: c.category,
            usageCount: parseInt(c.usage_count || 0),
            totalCost: createMoney(parseFloat(c.total_cost || 0), 'EUR'),
            avgCost: createMoney(parseFloat(c.avg_cost || 0), 'EUR'),
            minCost: createMoney(parseFloat(c.min_cost || 0), 'EUR'),
            maxCost: createMoney(parseFloat(c.max_cost || 0), 'EUR'),
            percentageOfTotal: totalCosts > 0 ? Math.round((parseFloat(c.total_cost || 0) / totalCosts) * 100 * 100) / 100 : 0
          })),
          costPerBooking: costPerBooking.map((b: any) => ({
            id: b.id,
            quoteNumber: b.quote_number,
            destination: b.destination,
            sellingPrice: createMoney(parseFloat(b.selling_price || 0), 'EUR'),
            totalCost: createMoney(parseFloat(b.total_cost || 0), 'EUR'),
            profit: createMoney(parseFloat(b.profit || 0), 'EUR'),
            profitMargin: parseFloat(b.selling_price || 0) > 0
              ? Math.round((parseFloat(b.profit || 0) / parseFloat(b.selling_price || 0)) * 100 * 100) / 100
              : 0
          })),
          byDestination: costByDestination.map((d: any) => ({
            destination: d.destination,
            bookingCount: parseInt(d.booking_count || 0),
            totalCost: createMoney(parseFloat(d.total_cost || 0), 'EUR'),
            avgExpenseCost: createMoney(parseFloat(d.avg_expense_cost || 0), 'EUR'),
            totalRevenue: createMoney(parseFloat(d.total_revenue || 0), 'EUR'),
            costRatio: parseFloat(d.total_revenue || 0) > 0
              ? Math.round((parseFloat(d.total_cost || 0) / parseFloat(d.total_revenue || 0)) * 100 * 100) / 100
              : 0
          })),
          costEfficiency: costEfficiency.map((e: any) => ({
            destination: e.destination,
            costPerPaxPerDay: createMoney(parseFloat(e.cost_per_pax_per_day || 0), 'EUR')
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
      report: 'pricing_cost_structure',
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
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
