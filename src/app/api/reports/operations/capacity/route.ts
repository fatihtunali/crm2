import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'next_30_days';
    const { startDate, endDate } = calculateDateRange(period);

    // Daily capacity utilization
    const dailyCapacity = await query(`
      SELECT
        qd.date,
        COUNT(DISTINCT qd.quote_id) as active_tours,
        SUM(q.adults + q.children) as total_pax
      FROM quote_days qd
      JOIN quotes q ON qd.quote_id = q.id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND qd.date BETWEEN ? AND ?
      GROUP BY qd.date
      ORDER BY qd.date
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Destination capacity
    const destinationCapacity = await query(`
      SELECT
        q.destination,
        COUNT(DISTINCT q.id) as tour_count,
        SUM(q.adults + q.children) as total_pax,
        MAX(concurrent_tours.count) as max_concurrent
      FROM quotes q
      LEFT JOIN (
        SELECT
          q2.destination,
          qd2.date,
          COUNT(DISTINCT q2.id) as count
        FROM quote_days qd2
        JOIN quotes q2 ON qd2.quote_id = q2.id
        WHERE q2.organization_id = ?
        AND q2.status = 'accepted'
        AND qd2.date BETWEEN ? AND ?
        GROUP BY q2.destination, qd2.date
      ) as concurrent_tours ON q.destination = concurrent_tours.destination
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND q.start_date BETWEEN ? AND ?
      AND q.destination IS NOT NULL
      GROUP BY q.destination
      ORDER BY total_pax DESC
    `, [parseInt(tenantId), startDate, endDate, parseInt(tenantId), startDate, endDate]) as any[];

    // Peak days
    const peakDays = await query(`
      SELECT
        qd.date,
        COUNT(DISTINCT qd.quote_id) as concurrent_tours,
        SUM(q.adults + q.children) as total_pax
      FROM quote_days qd
      JOIN quotes q ON qd.quote_id = q.id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      AND qd.date BETWEEN ? AND ?
      GROUP BY qd.date
      ORDER BY concurrent_tours DESC, total_pax DESC
      LIMIT 10
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Resource utilization by tour type
    const byTourType = await query(`
      SELECT
        tour_type,
        COUNT(*) as tour_count,
        SUM(adults + children) as total_pax,
        AVG(adults + children) as avg_group_size
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      AND tour_type IS NOT NULL
      GROUP BY tour_type
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    const data = {
      period: { start_date: startDate, end_date: endDate },
      dailyCapacity: dailyCapacity.map((d: any) => ({
        date: d.date,
        activeTours: parseInt(d.active_tours || 0),
        totalPax: parseInt(d.total_pax || 0)
      })),
      destinationCapacity: destinationCapacity.map((d: any) => ({
        destination: d.destination,
        tourCount: parseInt(d.tour_count || 0),
        totalPax: parseInt(d.total_pax || 0),
        maxConcurrent: parseInt(d.max_concurrent || 0)
      })),
      peakDays: peakDays.map((p: any) => ({
        date: p.date,
        concurrentTours: parseInt(p.concurrent_tours || 0),
        totalPax: parseInt(p.total_pax || 0)
      })),
      byTourType: byTourType.map((t: any) => ({
        tourType: t.tour_type,
        tourCount: parseInt(t.tour_count || 0),
        totalPax: parseInt(t.total_pax || 0),
        avgGroupSize: Math.round(parseFloat(t.avg_group_size || 0) * 10) / 10
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
  let startDate: Date = new Date(now);
  let endDate: Date;

  switch(period) {
    case 'next_30_days':
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case 'next_90_days':
      endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    default:
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
