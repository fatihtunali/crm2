import { NextRequest, NextResponse } from 'next/server';
import db, { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem, standardErrorResponse, ErrorCodes } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      );
    }
    const { tenantId, user } = tenantResult;

    // Get counts from database with tenant filtering
    const [
      activeRequestsCount,
      thisMonthBookingsCount,
      pendingQuotesCount,
      allItineraries,
      allQuotes
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM customer_itineraries WHERE organization_id = ?', [parseInt(tenantId)]),
      // Use quotes table with 'accepted' status as proxy for bookings
      query('SELECT COUNT(*) as count FROM quotes WHERE status = "accepted" AND organization_id = ?', [parseInt(tenantId)]),
      query('SELECT COUNT(*) as count FROM quotes WHERE status IN ("draft", "sent") AND organization_id = ?', [parseInt(tenantId)]),
      query('SELECT total_price FROM customer_itineraries WHERE organization_id = ?', [parseInt(tenantId)]),
      query('SELECT * FROM quotes WHERE organization_id = ?', [parseInt(tenantId)])
    ]);

    // Calculate total revenue from itineraries
    const totalRevenue = (allItineraries as any[]).reduce((sum: number, item: any) => {
      return sum + parseFloat(item.total_price || 0);
    }, 0);

    const stats = {
      activeRequests: (activeRequestsCount as any)[0]?.count || 0,
      thisMonthBookings: (thisMonthBookingsCount as any)[0]?.count || 0,
      revenue: createMoney(totalRevenue, 'EUR'),
      pendingQuotes: (pendingQuotesCount as any)[0]?.count || 0
    };

    // Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
    });

    const response = NextResponse.json(stats);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    console.error('Database error:', error);

    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch dashboard stats',
      500,
      undefined,
      requestId
    );
  }
}
