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

    // Note: Assuming agents are tour operators (stored in clients.tour_operator_id)
    // If there's a separate agents table, this query would need adjustment

    // Agent performance (using tour_operator_id from clients)
    const agentPerformance = await query(`
      SELECT
        c.tour_operator_id as agent_id,
        'Tour Operator' as agent_name,
        COUNT(DISTINCT c.id) as total_clients,
        COUNT(q.id) as total_bookings,
        SUM(q.total_price) as total_revenue,
        AVG(q.total_price) as avg_booking_value,
        COUNT(DISTINCT c.nationality) as countries_served
      FROM clients c
      LEFT JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
        AND q.status = 'accepted'
        AND q.start_date BETWEEN ? AND ?
      WHERE c.organization_id = ?
      AND c.tour_operator_id IS NOT NULL
      GROUP BY c.tour_operator_id
      HAVING total_bookings > 0
      ORDER BY total_revenue DESC
    `, [startDate, endDate, parseInt(tenantId)]) as any[];

    // Agent booking trends (monthly)
    const agentTrends = await query(`
      SELECT
        c.tour_operator_id as agent_id,
        DATE_FORMAT(q.start_date, '%Y-%m') as month,
        COUNT(q.id) as bookings,
        SUM(q.total_price) as revenue
      FROM clients c
      JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE c.organization_id = ?
      AND c.tour_operator_id IS NOT NULL
      AND q.status = 'accepted'
      AND q.start_date BETWEEN ? AND ?
      GROUP BY c.tour_operator_id, DATE_FORMAT(q.start_date, '%Y-%m')
      ORDER BY c.tour_operator_id, month
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Agent conversion rates
    const agentConversion = await query(`
      SELECT
        c.tour_operator_id as agent_id,
        COUNT(CASE WHEN q.status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN q.status IN ('sent', 'accepted', 'rejected') THEN 1 END) as sent,
        AVG(CASE
          WHEN q.status = 'accepted' AND q.sent_at IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, q.sent_at, q.updated_at)
        END) as avg_hours_to_close
      FROM clients c
      LEFT JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE c.organization_id = ?
      AND c.tour_operator_id IS NOT NULL
      AND q.created_at BETWEEN ? AND ?
      GROUP BY c.tour_operator_id
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Top destinations by agent
    const agentDestinations = await query(`
      SELECT
        c.tour_operator_id as agent_id,
        q.destination,
        COUNT(q.id) as bookings,
        SUM(q.total_price) as revenue
      FROM clients c
      JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE c.organization_id = ?
      AND c.tour_operator_id IS NOT NULL
      AND q.status = 'accepted'
      AND q.start_date BETWEEN ? AND ?
      AND q.destination IS NOT NULL
      GROUP BY c.tour_operator_id, q.destination
      ORDER BY c.tour_operator_id, revenue DESC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Format agent performance data
    const performanceData = agentPerformance.map((a: any) => {
      const agentId = a.agent_id;
      const conversionData = agentConversion.find((ac: any) => ac.agent_id === agentId);
      const sent = parseInt(conversionData?.sent || 0);
      const accepted = parseInt(conversionData?.accepted || 0);

      return {
        agentId: agentId,
        agentName: `Agent ${agentId}`,
        totalClients: parseInt(a.total_clients || 0),
        totalBookings: parseInt(a.total_bookings || 0),
        totalRevenue: createMoney(parseFloat(a.total_revenue || 0), 'EUR'),
        avgBookingValue: createMoney(parseFloat(a.avg_booking_value || 0), 'EUR'),
        countriesServed: parseInt(a.countries_served || 0),
        conversionRate: sent > 0 ? Math.round((accepted / sent) * 100 * 100) / 100 : 0,
        avgHoursToClose: Math.round(parseFloat(conversionData?.avg_hours_to_close || 0))
      };
    });

    // Group trends by agent
    const trendsGrouped = performanceData.map(agent => {
      const agentTrendData = agentTrends.filter((t: any) => t.agent_id === agent.agentId);
      return {
        agentId: agent.agentId,
        trends: agentTrendData.map((t: any) => ({
          month: t.month,
          bookings: parseInt(t.bookings || 0),
          revenue: createMoney(parseFloat(t.revenue || 0), 'EUR')
        }))
      };
    });

    // Group destinations by agent
    const destinationsGrouped = performanceData.map(agent => {
      const agentDestData = agentDestinations
        .filter((d: any) => d.agent_id === agent.agentId)
        .slice(0, 5);
      return {
        agentId: agent.agentId,
        topDestinations: agentDestData.map((d: any) => ({
          destination: d.destination,
          bookings: parseInt(d.bookings || 0),
          revenue: createMoney(parseFloat(d.revenue || 0), 'EUR')
        }))
      };
    });

    const data = {
      period: { start_date: startDate, end_date: endDate },
      agents: performanceData,
      trends: trendsGrouped,
      topDestinationsByAgent: destinationsGrouped
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
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
