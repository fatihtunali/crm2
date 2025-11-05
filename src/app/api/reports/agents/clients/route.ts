/**
 * Agents Clients Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/agents/clients - Get clients per agent report
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

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

    // 3. Execute report queries
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
      LEFT JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci AND q.status = 'accepted'
      WHERE c.organization_id = ?
      AND c.tour_operator_id IS NOT NULL
      GROUP BY c.tour_operator_id
    `, [parseInt(tenantId)]) as any[];

    // 4. Transform data
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

    // 5. Create response with headers
    const response = NextResponse.json({ data });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // 6. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      report: 'agents_clients',
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
