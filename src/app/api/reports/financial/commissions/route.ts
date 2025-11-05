/**
 * Financial Commissions Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/financial/commissions - Get financial commissions report
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
        const period = searchParams.get('period') || 'last_30_days';
        const { startDate, endDate } = calculateDateRange(period);

        // Commission/Markup analysis per quote
        const commissionData = await query(`
          SELECT
            q.id,
            q.quote_number,
            q.customer_name,
            q.destination,
            q.start_date,
            q.total_price as selling_price,
            COALESCE(
              (SELECT SUM(qe.price)
               FROM quote_expenses qe
               JOIN quote_days qd ON qe.quote_day_id = qd.id
               WHERE qd.quote_id = q.id), 0
            ) as total_cost,
            q.total_price - COALESCE(
              (SELECT SUM(qe.price)
               FROM quote_expenses qe
               JOIN quote_days qd ON qe.quote_day_id = qd.id
               WHERE qd.quote_id = q.id), 0
            ) as markup,
            CASE
              WHEN q.total_price > 0 THEN
                ((q.total_price - COALESCE(
                  (SELECT SUM(qe.price)
                   FROM quote_expenses qe
                   JOIN quote_days qd ON qe.quote_day_id = qd.id
                   WHERE qd.quote_id = q.id), 0
                )) / q.total_price * 100)
              ELSE 0
            END as markup_percentage
          FROM quotes q
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          ORDER BY markup_percentage DESC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Summary statistics
        const totalSellingPrice = commissionData.reduce((sum: number, q: any) => sum + parseFloat(q.selling_price || 0), 0);
        const totalCost = commissionData.reduce((sum: number, q: any) => sum + parseFloat(q.total_cost || 0), 0);
        const totalMarkup = totalSellingPrice - totalCost;
        const avgMarkupPercentage = totalSellingPrice > 0 ? (totalMarkup / totalSellingPrice) * 100 : 0;

        // Markup by destination
        const markupByDestination = await query(`
          SELECT
            q.destination,
            COUNT(*) as booking_count,
            SUM(q.total_price) as total_revenue,
            SUM(COALESCE(
              (SELECT SUM(qe.price)
               FROM quote_expenses qe
               JOIN quote_days qd ON qe.quote_day_id = qd.id
               WHERE qd.quote_id = q.id), 0
            )) as total_cost,
            AVG(CASE
              WHEN q.total_price > 0 THEN
                ((q.total_price - COALESCE(
                  (SELECT SUM(qe.price)
                   FROM quote_expenses qe
                   JOIN quote_days qd ON qe.quote_day_id = qd.id
                   WHERE qd.quote_id = q.id), 0
                )) / q.total_price * 100)
              ELSE 0
            END) as avg_markup_percentage
          FROM quotes q
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          AND q.destination IS NOT NULL
          GROUP BY q.destination
          ORDER BY avg_markup_percentage DESC
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Markup by category
        const markupByCategory = await query(`
          SELECT
            q.category,
            COUNT(*) as booking_count,
            AVG(CASE
              WHEN q.total_price > 0 THEN
                ((q.total_price - COALESCE(
                  (SELECT SUM(qe.price)
                   FROM quote_expenses qe
                   JOIN quote_days qd ON qe.quote_day_id = qd.id
                   WHERE qd.quote_id = q.id), 0
                )) / q.total_price * 100)
              ELSE 0
            END) as avg_markup_percentage
          FROM quotes q
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          AND q.category IS NOT NULL
          GROUP BY q.category
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        const data = {
          period: { start_date: startDate, end_date: endDate },
          summary: {
            totalSellingPrice: createMoney(totalSellingPrice, 'EUR'),
            totalCost: createMoney(totalCost, 'EUR'),
            totalMarkup: createMoney(totalMarkup, 'EUR'),
            avgMarkupPercentage: Math.round(avgMarkupPercentage * 100) / 100,
            bookingCount: commissionData.length
          },
          commissions: commissionData.map((c: any) => ({
            id: c.id,
            quoteNumber: c.quote_number,
            customerName: c.customer_name,
            destination: c.destination,
            startDate: c.start_date,
            sellingPrice: createMoney(parseFloat(c.selling_price || 0), 'EUR'),
            totalCost: createMoney(parseFloat(c.total_cost || 0), 'EUR'),
            markup: createMoney(parseFloat(c.markup || 0), 'EUR'),
            markupPercentage: Math.round(parseFloat(c.markup_percentage || 0) * 100) / 100
          })),
          byDestination: markupByDestination.map((d: any) => ({
            destination: d.destination,
            bookingCount: parseInt(d.booking_count || 0),
            totalRevenue: createMoney(parseFloat(d.total_revenue || 0), 'EUR'),
            totalCost: createMoney(parseFloat(d.total_cost || 0), 'EUR'),
            avgMarkupPercentage: Math.round(parseFloat(d.avg_markup_percentage || 0) * 100) / 100
          })),
          byCategory: markupByCategory.map((c: any) => ({
            category: c.category,
            bookingCount: parseInt(c.booking_count || 0),
            avgMarkupPercentage: Math.round(parseFloat(c.avg_markup_percentage || 0) * 100) / 100
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
      report: 'financial_commissions',
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
