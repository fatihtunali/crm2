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
    const period = searchParams.get('period') || 'last_30_days';
    const { startDate, endDate } = calculateDateRange(period);

    // Service usage by category
    const serviceUsage = await query(`
      SELECT
        qe.category,
        COUNT(*) as usage_count,
        SUM(qe.price) as total_cost,
        AVG(qe.price) as avg_cost
      FROM quote_expenses qe
      JOIN quote_days qd ON qe.quote_day_id = qd.id
      JOIN quotes q ON qd.quote_id = q.id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND qd.date BETWEEN ? AND ?
      GROUP BY qe.category
      ORDER BY total_cost DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Most used locations
    const locationUsage = await query(`
      SELECT
        qe.location,
        COUNT(*) as usage_count,
        SUM(qe.price) as total_cost
      FROM quote_expenses qe
      JOIN quote_days qd ON qe.quote_day_id = qd.id
      JOIN quotes q ON qd.quote_id = q.id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND qd.date BETWEEN ? AND ?
      AND qe.location IS NOT NULL
      AND qe.location != ''
      GROUP BY qe.location
      ORDER BY usage_count DESC
      LIMIT 20
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Hotel category usage
    const hotelCategoryUsage = await query(`
      SELECT
        qe.hotel_category,
        COUNT(*) as usage_count,
        AVG(qe.price) as avg_price
      FROM quote_expenses qe
      JOIN quote_days qd ON qe.quote_day_id = qd.id
      JOIN quotes q ON qd.quote_id = q.id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND qd.date BETWEEN ? AND ?
      AND qe.category = 'hotel'
      AND qe.hotel_category IS NOT NULL
      GROUP BY qe.hotel_category
      ORDER BY usage_count DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Service usage trends (monthly)
    const monthlyTrends = await query(`
      SELECT
        DATE_FORMAT(qd.date, '%Y-%m') as month,
        qe.category,
        COUNT(*) as usage_count,
        SUM(qe.price) as total_cost
      FROM quote_expenses qe
      JOIN quote_days qd ON qe.quote_day_id = qd.id
      JOIN quotes q ON qd.quote_id = q.id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND qd.date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(qd.date, '%Y-%m'), qe.category
      ORDER BY month, total_cost DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    const data = {
      period: { start_date: startDate, end_date: endDate },
      serviceUsage: serviceUsage.map((s: any) => ({
        category: s.category,
        usageCount: parseInt(s.usage_count || 0),
        totalCost: createMoney(parseFloat(s.total_cost || 0), 'EUR'),
        avgCost: createMoney(parseFloat(s.avg_cost || 0), 'EUR')
      })),
      locationUsage: locationUsage.map((l: any) => ({
        location: l.location,
        usageCount: parseInt(l.usage_count || 0),
        totalCost: createMoney(parseFloat(l.total_cost || 0), 'EUR')
      })),
      hotelCategoryUsage: hotelCategoryUsage.map((h: any) => ({
        hotelCategory: h.hotel_category,
        usageCount: parseInt(h.usage_count || 0),
        avgPrice: createMoney(parseFloat(h.avg_price || 0), 'EUR')
      })),
      monthlyTrends: monthlyTrends.map((t: any) => ({
        month: t.month,
        category: t.category,
        usageCount: parseInt(t.usage_count || 0),
        totalCost: createMoney(parseFloat(t.total_cost || 0), 'EUR')
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
