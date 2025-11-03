import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'last_30_days';
    const { startDate, endDate } = calculateDateRange(period);

    // Revenue by destination with detailed metrics
    const destinationData = await query(`
      SELECT
        destination,
        SUM(total_price) as total_revenue,
        COUNT(*) as booking_count,
        AVG(total_price) as avg_booking_value,
        SUM(adults + children) as total_pax,
        AVG(adults + children) as avg_group_size,
        MIN(total_price) as min_value,
        MAX(total_price) as max_value,
        AVG(DATEDIFF(end_date, start_date)) as avg_duration
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      AND destination IS NOT NULL
      GROUP BY destination
      ORDER BY total_revenue DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Monthly trend by destination (top 5)
    const topDestinations = destinationData.slice(0, 5).map((d: any) => d.destination);
    let monthlyTrends = [];

    if (topDestinations.length > 0) {
      monthlyTrends = await query(`
        SELECT
          destination,
          DATE_FORMAT(start_date, '%Y-%m') as month,
          SUM(total_price) as revenue,
          COUNT(*) as bookings
        FROM quotes
        WHERE organization_id = ?
        AND status = 'accepted'
        AND start_date BETWEEN ? AND ?
        AND destination IN (${topDestinations.map(() => '?').join(',')})
        GROUP BY destination, DATE_FORMAT(start_date, '%Y-%m')
        ORDER BY destination, month
      `, [parseInt(tenantId), startDate, endDate, ...topDestinations]) as any[];
    }

    // Market share calculation
    const totalRevenue = destinationData.reduce((sum: number, d: any) => sum + parseFloat(d.total_revenue || 0), 0);

    const data = {
      period: { start_date: startDate, end_date: endDate },
      destinations: destinationData.map((d: any) => ({
        destination: d.destination,
        totalRevenue: createMoney(parseFloat(d.total_revenue || 0), 'EUR'),
        bookingCount: parseInt(d.booking_count || 0),
        avgBookingValue: createMoney(parseFloat(d.avg_booking_value || 0), 'EUR'),
        totalPax: parseInt(d.total_pax || 0),
        avgGroupSize: Math.round(parseFloat(d.avg_group_size || 0) * 10) / 10,
        minValue: createMoney(parseFloat(d.min_value || 0), 'EUR'),
        maxValue: createMoney(parseFloat(d.max_value || 0), 'EUR'),
        avgDuration: Math.round(parseFloat(d.avg_duration || 0)),
        marketShare: totalRevenue > 0 ? Math.round((parseFloat(d.total_revenue || 0) / totalRevenue) * 100 * 100) / 100 : 0
      })),
      monthlyTrends: monthlyTrends.map((t: any) => ({
        destination: t.destination,
        month: t.month,
        revenue: createMoney(parseFloat(t.revenue || 0), 'EUR'),
        bookings: parseInt(t.bookings || 0)
      }))
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}

function calculateDateRange(period: string) {
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
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
