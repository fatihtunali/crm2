/**
 * Executive Summary Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/executive/summary - Get executive summary report
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

// Require tenant
        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'last_30_days';
        const comparison = searchParams.get('comparison') || 'previous_period';

        // Calculate date range
        const { startDate, endDate, comparisonStartDate, comparisonEndDate } = calculateDateRanges(period, comparison);

        // --- KEY METRICS ---

        // Total Revenue (from accepted quotes)
        const [revenueResult] = await query(`
          SELECT
            SUM(total_price) as total_revenue,
            COUNT(*) as total_bookings,
            AVG(total_price) as avg_booking_value
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Revenue from previous period for comparison
        const [prevRevenueResult] = await query(`
          SELECT
            SUM(total_price) as total_revenue,
            COUNT(*) as total_bookings,
            AVG(total_price) as avg_booking_value
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
        `, [parseInt(tenantId), comparisonStartDate, comparisonEndDate]) as any[];

        // Total Costs (from invoices payable)
        const [costsResult] = await query(`
          SELECT SUM(total_amount) as total_costs
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
          AND ip.invoice_date BETWEEN ? AND ?
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        const [prevCostsResult] = await query(`
          SELECT SUM(total_amount) as total_costs
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
          AND ip.invoice_date BETWEEN ? AND ?
        `, [parseInt(tenantId), comparisonStartDate, comparisonEndDate]) as any[];

        // Client metrics
        const [clientsResult] = await query(`
          SELECT
            COUNT(*) as total_clients,
            COUNT(CASE WHEN created_at BETWEEN ? AND ? THEN 1 END) as new_clients
          FROM clients
          WHERE organization_id = ?
        `, [startDate, endDate, parseInt(tenantId)]) as any[];

        const [prevClientsResult] = await query(`
          SELECT COUNT(*) as new_clients
          FROM clients
          WHERE organization_id = ?
          AND created_at BETWEEN ? AND ?
        `, [parseInt(tenantId), comparisonStartDate, comparisonEndDate]) as any[];

        // Active agents (tour operators with bookings in period)
        const [agentsResult] = await query(`
          SELECT COUNT(DISTINCT c.tour_operator_id) as active_agents
          FROM quotes q
          JOIN clients c ON q.customer_email COLLATE utf8mb4_unicode_ci = c.email COLLATE utf8mb4_unicode_ci
          WHERE q.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          AND c.tour_operator_id IS NOT NULL
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Calculate metrics
        const totalRevenue = parseFloat(revenueResult?.total_revenue || 0);
        const totalBookings = parseInt(revenueResult?.total_bookings || 0);
        const avgBookingValue = parseFloat(revenueResult?.avg_booking_value || 0);
        const totalCosts = parseFloat(costsResult?.total_costs || 0);
        const netMargin = totalRevenue - totalCosts;
        const netMarginPercentage = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

        const prevTotalRevenue = parseFloat(prevRevenueResult?.total_revenue || 0);
        const prevTotalBookings = parseInt(prevRevenueResult?.total_bookings || 0);
        const prevTotalCosts = parseFloat(prevCostsResult?.total_costs || 0);
        const prevNetMargin = prevTotalRevenue - prevTotalCosts;

        // --- TOP PERFORMERS ---

        // Top destinations
        const topDestinations = await query(`
          SELECT
            destination as name,
            SUM(total_price) as revenue,
            COUNT(*) as bookings
          FROM quotes
          WHERE organization_id = ?
          AND status = 'accepted'
          AND start_date BETWEEN ? AND ?
          AND destination IS NOT NULL
          GROUP BY destination
          ORDER BY revenue DESC
          LIMIT 5
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Top clients
        const topClients = await query(`
          SELECT
            c.id,
            CONCAT(c.first_name, ' ', c.last_name) as name,
            SUM(q.total_price) as revenue,
            COUNT(q.id) as bookings
          FROM clients c
          JOIN quotes q ON q.customer_email COLLATE utf8mb4_unicode_ci = c.email COLLATE utf8mb4_unicode_ci
          WHERE c.organization_id = ?
          AND q.status = 'accepted'
          AND q.start_date BETWEEN ? AND ?
          GROUP BY c.id
          ORDER BY revenue DESC
          LIMIT 5
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // --- FINANCIAL HEALTH ---

        // Outstanding receivables and payables
        const [receivablesResult] = await query(`
          SELECT
            SUM(total_amount - paid_amount) as outstanding_receivables,
            AVG(DATEDIFF(CURDATE(), due_date)) as days_receivable_outstanding
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE q.organization_id = ?
          AND ir.status != 'paid'
          AND ir.due_date < CURDATE()
        `, [parseInt(tenantId)]) as any[];

        const [payablesResult] = await query(`
          SELECT
            SUM(total_amount - paid_amount) as outstanding_payables,
            AVG(DATEDIFF(CURDATE(), due_date)) as days_payable_outstanding
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
          AND ip.status != 'paid'
          AND ip.due_date < CURDATE()
        `, [parseInt(tenantId)]) as any[];

        const outstandingReceivables = parseFloat(receivablesResult?.outstanding_receivables || 0);
        const outstandingPayables = parseFloat(payablesResult?.outstanding_payables || 0);
        const cashPosition = outstandingReceivables - outstandingPayables;

        // --- OPERATIONAL METRICS ---

        // Conversion rate
        const [conversionResult] = await query(`
          SELECT
            COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_quotes,
            COUNT(CASE WHEN status IN ('sent', 'accepted', 'rejected') THEN 1 END) as sent_quotes,
            AVG(total_price) as avg_quote_value
          FROM quotes
          WHERE organization_id = ?
          AND created_at BETWEEN ? AND ?
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        const acceptedQuotes = parseInt(conversionResult?.accepted_quotes || 0);
        const sentQuotes = parseInt(conversionResult?.sent_quotes || 0);
        const conversionRate = sentQuotes > 0 ? (acceptedQuotes / sentQuotes) * 100 : 0;

        // Average response time (hours between request and quote)
        const [responseTimeResult] = await query(`
          SELECT AVG(TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at)) as avg_response_hours
          FROM customer_itineraries ci
          JOIN quotes q ON ci.customer_email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
          WHERE q.organization_id = ?
          AND q.created_at BETWEEN ? AND ?
        `, [parseInt(tenantId), startDate, endDate]) as any[];

        // Upcoming tours
        const [upcomingToursResult] = await query(`
          SELECT COUNT(*) as upcoming_count
          FROM quotes
          WHERE organization_id = ?
          AND status IN ('accepted', 'sent')
          AND start_date >= CURDATE()
        `, [parseInt(tenantId)]) as any[];

        // Format response
        const data = {
          period: {
            start_date: startDate,
            end_date: endDate,
            label: getPeriodLabel(period)
          },
          keyMetrics: {
            totalRevenue: createMoney(totalRevenue, 'EUR'),
            totalBookings: totalBookings,
            averageBookingValue: createMoney(avgBookingValue, 'EUR'),
            netMargin: createMoney(netMargin, 'EUR'),
            netMarginPercentage: Math.round(netMarginPercentage * 100) / 100,
            totalClients: parseInt(clientsResult?.total_clients || 0),
            newClients: parseInt(clientsResult?.new_clients || 0),
            activeAgents: parseInt(agentsResult?.active_agents || 0)
          },
          comparison: {
            revenueChange: calculatePercentageChange(totalRevenue, prevTotalRevenue),
            bookingsChange: calculatePercentageChange(totalBookings, prevTotalBookings),
            marginChange: calculatePercentageChange(netMargin, prevNetMargin),
            clientsChange: calculatePercentageChange(
              parseInt(clientsResult?.new_clients || 0),
              parseInt(prevClientsResult?.new_clients || 0)
            )
          },
          topPerformers: {
            destinations: topDestinations.map((d: any) => ({
              name: d.name,
              revenue: createMoney(parseFloat(d.revenue || 0), 'EUR'),
              bookings: parseInt(d.bookings || 0)
            })),
            clients: topClients.map((c: any) => ({
              id: c.id,
              name: c.name,
              revenue: createMoney(parseFloat(c.revenue || 0), 'EUR'),
              bookings: parseInt(c.bookings || 0)
            }))
          },
          financialHealth: {
            outstandingReceivables: createMoney(outstandingReceivables, 'EUR'),
            outstandingPayables: createMoney(outstandingPayables, 'EUR'),
            cashPosition: createMoney(cashPosition, 'EUR'),
            daysReceivableOutstanding: Math.round(parseFloat(receivablesResult?.days_receivable_outstanding || 0)),
            daysPayableOutstanding: Math.round(parseFloat(payablesResult?.days_payable_outstanding || 0))
          },
          operationalMetrics: {
            conversionRate: Math.round(conversionRate * 100) / 100,
            averageQuoteValue: createMoney(parseFloat(conversionResult?.avg_quote_value || 0), 'EUR'),
            averageResponseTime: Math.round(parseFloat(responseTimeResult?.avg_response_hours || 0)),
            upcomingToursCount: parseInt(upcomingToursResult?.upcoming_count || 0),
            resourceUtilization: 0 // TODO: Calculate based on booking density
          }
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
      report: 'executive_summary',
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
function calculateDateRanges(period: string, comparison: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now);

  switch(period) {
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_90_days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Calculate comparison period
  const periodLength = endDate.getTime() - startDate.getTime();
  let comparisonStartDate: Date;
  let comparisonEndDate: Date;

  if (comparison === 'last_year') {
    comparisonStartDate = new Date(startDate);
    comparisonStartDate.setFullYear(startDate.getFullYear() - 1);
    comparisonEndDate = new Date(endDate);
    comparisonEndDate.setFullYear(endDate.getFullYear() - 1);
  } else {
    // previous_period
    comparisonEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    comparisonStartDate = new Date(comparisonEndDate.getTime() - periodLength);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    comparisonStartDate: comparisonStartDate.toISOString().split('T')[0],
    comparisonEndDate: comparisonEndDate.toISOString().split('T')[0]
  };
}

function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    'last_7_days': 'Last 7 Days',
    'last_30_days': 'Last 30 Days',
    'last_90_days': 'Last 90 Days',
    'this_month': 'This Month',
    'last_month': 'Last Month',
    'this_year': 'This Year',
    'last_year': 'Last Year'
  };
  return labels[period] || 'Last 30 Days';
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 100) / 100;
}
