import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'this_year';
    const { startDate, endDate } = calculateDateRange(period);

    // Monthly trends
    const monthlyTrends = await query(`
      SELECT
        DATE_FORMAT(start_date, '%Y-%m') as month,
        SUM(total_price) as revenue,
        COUNT(*) as bookings,
        AVG(total_price) as avg_value,
        SUM(adults + children) as total_pax
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(start_date, '%Y-%m')
      ORDER BY month ASC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Year-over-year comparison
    const previousYearStart = new Date(startDate);
    previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);
    const previousYearEnd = new Date(endDate);
    previousYearEnd.setFullYear(previousYearEnd.getFullYear() - 1);

    const previousYearData = await query(`
      SELECT
        DATE_FORMAT(start_date, '%Y-%m') as month,
        SUM(total_price) as revenue,
        COUNT(*) as bookings
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(start_date, '%Y-%m')
      ORDER BY month ASC
    `, [parseInt(tenantId), previousYearStart.toISOString().split('T')[0], previousYearEnd.toISOString().split('T')[0]]) as any[];

    // Seasonal patterns (by quarter)
    const quarterlyData = await query(`
      SELECT
        CONCAT('Q', QUARTER(start_date)) as quarter,
        SUM(total_price) as revenue,
        COUNT(*) as bookings,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      GROUP BY QUARTER(start_date)
      ORDER BY QUARTER(start_date)
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Day of week analysis
    const dayOfWeekData = await query(`
      SELECT
        DAYNAME(start_date) as day_name,
        DAYOFWEEK(start_date) as day_num,
        COUNT(*) as bookings,
        SUM(total_price) as revenue,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      GROUP BY DAYNAME(start_date), DAYOFWEEK(start_date)
      ORDER BY day_num
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Growth rate calculation
    const trendsWithGrowth = monthlyTrends.map((trend: any, index: number) => {
      let growthRate = 0;
      if (index > 0) {
        const prevRevenue = parseFloat(monthlyTrends[index - 1].revenue || 0);
        const currRevenue = parseFloat(trend.revenue || 0);
        if (prevRevenue > 0) {
          growthRate = ((currRevenue - prevRevenue) / prevRevenue) * 100;
        }
      }

      return {
        month: trend.month,
        revenue: createMoney(parseFloat(trend.revenue || 0), 'EUR'),
        bookings: parseInt(trend.bookings || 0),
        avgValue: createMoney(parseFloat(trend.avg_value || 0), 'EUR'),
        totalPax: parseInt(trend.total_pax || 0),
        growthRate: Math.round(growthRate * 100) / 100
      };
    });

    const data = {
      period: { start_date: startDate, end_date: endDate },
      monthlyTrends: trendsWithGrowth,
      yearOverYear: {
        current: monthlyTrends.map((t: any) => ({
          month: t.month,
          revenue: createMoney(parseFloat(t.revenue || 0), 'EUR'),
          bookings: parseInt(t.bookings || 0)
        })),
        previous: previousYearData.map((t: any) => ({
          month: t.month,
          revenue: createMoney(parseFloat(t.revenue || 0), 'EUR'),
          bookings: parseInt(t.bookings || 0)
        }))
      },
      quarterly: quarterlyData.map((q: any) => ({
        quarter: q.quarter,
        revenue: createMoney(parseFloat(q.revenue || 0), 'EUR'),
        bookings: parseInt(q.bookings || 0),
        avgValue: createMoney(parseFloat(q.avg_value || 0), 'EUR')
      })),
      byDayOfWeek: dayOfWeekData.map((d: any) => ({
        dayName: d.day_name,
        bookings: parseInt(d.bookings || 0),
        revenue: createMoney(parseFloat(d.revenue || 0), 'EUR'),
        avgValue: createMoney(parseFloat(d.avg_value || 0), 'EUR')
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
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    case 'last_24_months':
      startDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getFullYear(), 0, 1);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
