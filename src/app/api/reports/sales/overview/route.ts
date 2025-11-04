import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'last_30_days';
    const { startDate, endDate } = calculateDateRange(period);

    // Total revenue and bookings
    const [summaryResult] = await query(`
      SELECT
        SUM(total_price) as total_revenue,
        COUNT(*) as total_bookings,
        AVG(total_price) as avg_booking_value,
        MIN(total_price) as min_booking,
        MAX(total_price) as max_booking
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Conversion rate
    const [conversionResult] = await query(`
      SELECT
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    const accepted = parseInt(conversionResult?.accepted || 0);
    const sent = parseInt(conversionResult?.sent || 0);
    const totalSent = accepted + sent;
    const conversionRate = totalSent > 0 ? (accepted / totalSent) * 100 : 0;

    // Revenue by destination
    const revenueByDestination = await query(`
      SELECT
        destination,
        SUM(total_price) as revenue,
        COUNT(*) as bookings,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      AND destination IS NOT NULL
      GROUP BY destination
      ORDER BY revenue DESC
      LIMIT 10
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Revenue by tour type
    const revenueByTourType = await query(`
      SELECT
        tour_type,
        SUM(total_price) as revenue,
        COUNT(*) as bookings,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      AND tour_type IS NOT NULL
      GROUP BY tour_type
      ORDER BY revenue DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Revenue by category (B2B, B2C, etc.)
    const revenueByCategory = await query(`
      SELECT
        category,
        SUM(total_price) as revenue,
        COUNT(*) as bookings,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      AND category IS NOT NULL
      GROUP BY category
      ORDER BY revenue DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Time series data (daily aggregations)
    const timeSeries = await query(`
      SELECT
        DATE(start_date) as date,
        SUM(total_price) as revenue,
        COUNT(*) as bookings
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      GROUP BY DATE(start_date)
      ORDER BY date ASC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Monthly aggregation (if period is longer than 90 days)
    const monthlyData = await query(`
      SELECT
        DATE_FORMAT(start_date, '%Y-%m') as month,
        SUM(total_price) as revenue,
        COUNT(*) as bookings,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(start_date, '%Y-%m')
      ORDER BY month ASC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Average group size
    const [groupSizeResult] = await query(`
      SELECT
        AVG(adults + children) as avg_group_size,
        SUM(adults + children) as total_pax
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Format response
    const data = {
      period: {
        start_date: startDate,
        end_date: endDate,
        label: getPeriodLabel(period)
      },
      summary: {
        totalRevenue: createMoney(parseFloat(summaryResult?.total_revenue || 0), 'EUR'),
        totalBookings: parseInt(summaryResult?.total_bookings || 0),
        avgBookingValue: createMoney(parseFloat(summaryResult?.avg_booking_value || 0), 'EUR'),
        minBooking: createMoney(parseFloat(summaryResult?.min_booking || 0), 'EUR'),
        maxBooking: createMoney(parseFloat(summaryResult?.max_booking || 0), 'EUR'),
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgGroupSize: Math.round(parseFloat(groupSizeResult?.avg_group_size || 0) * 10) / 10,
        totalPax: parseInt(groupSizeResult?.total_pax || 0)
      },
      conversionFunnel: {
        draft: parseInt(conversionResult?.draft || 0),
        sent: parseInt(conversionResult?.sent || 0),
        accepted: parseInt(conversionResult?.accepted || 0),
        rejected: parseInt(conversionResult?.rejected || 0)
      },
      byDestination: revenueByDestination.map((d: any) => ({
        destination: d.destination,
        revenue: createMoney(parseFloat(d.revenue || 0), 'EUR'),
        bookings: parseInt(d.bookings || 0),
        avgValue: createMoney(parseFloat(d.avg_value || 0), 'EUR')
      })),
      byTourType: revenueByTourType.map((t: any) => ({
        tourType: t.tour_type,
        revenue: createMoney(parseFloat(t.revenue || 0), 'EUR'),
        bookings: parseInt(t.bookings || 0),
        avgValue: createMoney(parseFloat(t.avg_value || 0), 'EUR')
      })),
      byCategory: revenueByCategory.map((c: any) => ({
        category: c.category,
        revenue: createMoney(parseFloat(c.revenue || 0), 'EUR'),
        bookings: parseInt(c.bookings || 0),
        avgValue: createMoney(parseFloat(c.avg_value || 0), 'EUR')
      })),
      timeSeries: {
        daily: timeSeries.map((t: any) => ({
          date: t.date,
          revenue: createMoney(parseFloat(t.revenue || 0), 'EUR'),
          bookings: parseInt(t.bookings || 0)
        })),
        monthly: monthlyData.map((m: any) => ({
          month: m.month,
          revenue: createMoney(parseFloat(m.revenue || 0), 'EUR'),
          bookings: parseInt(m.bookings || 0),
          avgValue: createMoney(parseFloat(m.avg_value || 0), 'EUR')
        }))
      }
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

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
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
