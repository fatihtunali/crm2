import { NextRequest } from 'next/server';
import db, { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

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

    return successResponse(stats);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch dashboard stats', '/api/dashboard/stats')
    );
  }
}
