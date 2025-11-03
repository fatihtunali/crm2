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

    // Clients per agent
    const clientsPerAgent = await query(`
      SELECT
        tour_operator_id as agent_id,
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_clients
      FROM clients
      WHERE organization_id = ?
      AND tour_operator_id IS NOT NULL
      GROUP BY tour_operator_id
      ORDER BY total_clients DESC
    `, [parseInt(tenantId)]) as any[];

    // Client nationalities by agent
    const nationalitiesByAgent = await query(`
      SELECT
        tour_operator_id as agent_id,
        nationality,
        COUNT(*) as client_count
      FROM clients
      WHERE organization_id = ?
      AND tour_operator_id IS NOT NULL
      AND nationality IS NOT NULL
      GROUP BY tour_operator_id, nationality
      ORDER BY tour_operator_id, client_count DESC
    `, [parseInt(tenantId)]) as any[];

    // Booking patterns by agent's clients
    const bookingPatterns = await query(`
      SELECT
        c.tour_operator_id as agent_id,
        COUNT(q.id) as total_bookings,
        AVG(q.adults + q.children) as avg_group_size,
        AVG(DATEDIFF(q.end_date, q.start_date)) as avg_trip_duration
      FROM clients c
      LEFT JOIN quotes q ON c.email = q.customer_email AND q.status = 'accepted'
      WHERE c.organization_id = ?
      AND c.tour_operator_id IS NOT NULL
      GROUP BY c.tour_operator_id
    `, [parseInt(tenantId)]) as any[];

    // Group nationalities by agent
    const nationalitiesGrouped = clientsPerAgent.map(agent => {
      const agentNats = nationalitiesByAgent
        .filter((n: any) => n.agent_id === agent.agent_id)
        .slice(0, 10);
      return {
        agentId: agent.agent_id,
        nationalities: agentNats.map((n: any) => ({
          nationality: n.nationality,
          clientCount: parseInt(n.client_count || 0)
        }))
      };
    });

    const data = {
      clientsPerAgent: clientsPerAgent.map((a: any) => ({
        agentId: a.agent_id,
        totalClients: parseInt(a.total_clients || 0),
        activeClients: parseInt(a.active_clients || 0),
        inactiveClients: parseInt(a.inactive_clients || 0)
      })),
      nationalitiesByAgent: nationalitiesGrouped,
      bookingPatterns: bookingPatterns.map((b: any) => ({
        agentId: b.agent_id,
        totalBookings: parseInt(b.total_bookings || 0),
        avgGroupSize: Math.round(parseFloat(b.avg_group_size || 0) * 10) / 10,
        avgTripDuration: Math.round(parseFloat(b.avg_trip_duration || 0))
      }))
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}
