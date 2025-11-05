/**
 * Pricing Analysis Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/pricing/analysis - Get pricing analysis report
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

        // Price statistics
        const [priceStats] = await query(`
          SELECT
            AVG(total_price) as avg_price,
            MIN(total_price) as min_price,
            MAX(total_price) as max_price,
            STDDEV(total_price) as price_stddev,
            AVG(total_price / (adults + children)) as avg_price_per_pax,
            AVG(total_price / GREATEST(DATEDIFF(end_date, start_date), 1)) as avg_price_per_day
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Price by destination
        const priceByDestination = await query(`
          SELECT
            destination,
            COUNT(*) as booking_count,
            AVG(total_price) as avg_price,
            MIN(total_price) as min_price,
            MAX(total_price) as max_price,
            AVG(total_price / (adults + children)) as avg_price_per_pax
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          AND destination IS NOT NULL
          GROUP BY destination
          ORDER BY booking_count DESC
          LIMIT 10
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Price by tour type
        const priceByTourType = await query(`
          SELECT
            tour_type,
            COUNT(*) as booking_count,
            AVG(total_price) as avg_price,
            AVG(total_price / (adults + children)) as avg_price_per_pax
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          AND tour_type IS NOT NULL
          GROUP BY tour_type
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Price by group size
        const priceByGroupSize = await query(`
          SELECT
            CASE
              WHEN adults + children = 1 THEN 'Solo (1 pax)'
              WHEN adults + children BETWEEN 2 AND 4 THEN 'Small (2-4 pax)'
              WHEN adults + children BETWEEN 5 AND 10 THEN 'Medium (5-10 pax)'
              ELSE 'Large (10+ pax)'
            END as group_size,
            COUNT(*) as booking_count,
            AVG(total_price) as avg_price,
            AVG(total_price / (adults + children)) as avg_price_per_pax
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          GROUP BY group_size
          ORDER BY
            CASE group_size
              WHEN 'Solo (1 pax)' THEN 1
              WHEN 'Small (2-4 pax)' THEN 2
              WHEN 'Medium (5-10 pax)' THEN 3
              WHEN 'Large (10+ pax)' THEN 4
            END
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Price by duration
        const priceByDuration = await query(`
          SELECT
            CASE
              WHEN DATEDIFF(end_date, start_date) + 1 <= 3 THEN '1-3 days'
              WHEN DATEDIFF(end_date, start_date) + 1 BETWEEN 4 AND 7 THEN '4-7 days'
              WHEN DATEDIFF(end_date, start_date) + 1 BETWEEN 8 AND 14 THEN '8-14 days'
              ELSE '14+ days'
            END as duration_range,
            COUNT(*) as booking_count,
            AVG(total_price) as avg_price,
            AVG(total_price / GREATEST(DATEDIFF(end_date, start_date), 1)) as avg_price_per_day
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          GROUP BY duration_range
          ORDER BY
            CASE duration_range
              WHEN '1-3 days' THEN 1
              WHEN '4-7 days' THEN 2
              WHEN '8-14 days' THEN 3
              WHEN '14+ days' THEN 4
            END
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Price trends over time
        const priceTrends = await query(`
          SELECT
            DATE_FORMAT(start_date, '%Y-%m') as month,
            AVG(total_price) as avg_price,
            AVG(total_price / (adults + children)) as avg_price_per_pax
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          GROUP BY DATE_FORMAT(start_date, '%Y-%m')
          ORDER BY month ASC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        const data = {
          period: { start_date: startDate, end_date: endDate },
          overview: {
            avgPrice: createMoney(parseFloat(priceStats?.avg_price || 0), 'EUR'),
            minPrice: createMoney(parseFloat(priceStats?.min_price || 0), 'EUR'),
            maxPrice: createMoney(parseFloat(priceStats?.max_price || 0), 'EUR'),
            priceStdDev: createMoney(parseFloat(priceStats?.price_stddev || 0), 'EUR'),
            avgPricePerPax: createMoney(parseFloat(priceStats?.avg_price_per_pax || 0), 'EUR'),
            avgPricePerDay: createMoney(parseFloat(priceStats?.avg_price_per_day || 0), 'EUR')
          },
          byDestination: priceByDestination.map((d: any) => ({
            destination: d.destination,
            bookingCount: parseInt(d.booking_count || 0),
            avgPrice: createMoney(parseFloat(d.avg_price || 0), 'EUR'),
            minPrice: createMoney(parseFloat(d.min_price || 0), 'EUR'),
            maxPrice: createMoney(parseFloat(d.max_price || 0), 'EUR'),
            avgPricePerPax: createMoney(parseFloat(d.avg_price_per_pax || 0), 'EUR')
          })),
          byTourType: priceByTourType.map((t: any) => ({
            tourType: t.tour_type,
            bookingCount: parseInt(t.booking_count || 0),
            avgPrice: createMoney(parseFloat(t.avg_price || 0), 'EUR'),
            avgPricePerPax: createMoney(parseFloat(t.avg_price_per_pax || 0), 'EUR')
          })),
          byGroupSize: priceByGroupSize.map((g: any) => ({
            groupSize: g.group_size,
            bookingCount: parseInt(g.booking_count || 0),
            avgPrice: createMoney(parseFloat(g.avg_price || 0), 'EUR'),
            avgPricePerPax: createMoney(parseFloat(g.avg_price_per_pax || 0), 'EUR')
          })),
          byDuration: priceByDuration.map((d: any) => ({
            durationRange: d.duration_range,
            bookingCount: parseInt(d.booking_count || 0),
            avgPrice: createMoney(parseFloat(d.avg_price || 0), 'EUR'),
            avgPricePerDay: createMoney(parseFloat(d.avg_price_per_day || 0), 'EUR')
          })),
          trends: priceTrends.map((t: any) => ({
            month: t.month,
            avgPrice: createMoney(parseFloat(t.avg_price || 0), 'EUR'),
            avgPricePerPax: createMoney(parseFloat(t.avg_price_per_pax || 0), 'EUR')
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
      report: 'pricing_analysis',
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
