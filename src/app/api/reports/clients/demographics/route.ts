/**
 * Client Demographics Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/reports/clients/demographics - Get client demographics report
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

// By nationality
        const byNationality = await query(`
          SELECT
            nationality,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
          FROM clients
          WHERE organization_id = ?
          AND nationality IS NOT NULL
          GROUP BY nationality
          ORDER BY count DESC
          LIMIT 20
        `, [parseInt(tenantId)]) as any[];

        // By client type
        const byClientType = await query(`
          SELECT
            client_type,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
          FROM clients
          WHERE organization_id = ?
          GROUP BY client_type
        `, [parseInt(tenantId)]) as any[];

        // By language preference
        const byLanguage = await query(`
          SELECT
            language_preference,
            COUNT(*) as count
          FROM clients
          WHERE organization_id = ?
          AND language_preference IS NOT NULL
          GROUP BY language_preference
          ORDER BY count DESC
        `, [parseInt(tenantId)]) as any[];

        // New clients over time
        const newClientsOverTime = await query(`
          SELECT
            DATE_FORMAT(created_at, '%Y-%m') as month,
            COUNT(*) as new_clients
          FROM clients
          WHERE organization_id = ?
          GROUP BY DATE_FORMAT(created_at, '%Y-%m')
          ORDER BY month DESC
          LIMIT 12
        `, [parseInt(tenantId)]) as any[];

        // Client status distribution
        const byStatus = await query(`
          SELECT
            status,
            COUNT(*) as count
          FROM clients
          WHERE organization_id = ?
          GROUP BY status
        `, [parseInt(tenantId)]) as any[];

        // Clients with special requirements
        const [specialRequirementsResult] = await query(`
          SELECT
            COUNT(CASE WHEN dietary_requirements IS NOT NULL AND dietary_requirements != '' THEN 1 END) as with_dietary,
            COUNT(CASE WHEN special_needs IS NOT NULL AND special_needs != '' THEN 1 END) as with_special_needs,
            COUNT(CASE WHEN marketing_consent = 1 THEN 1 END) as marketing_consent,
            COUNT(CASE WHEN newsletter_subscribed = 1 THEN 1 END) as newsletter_subscribed
          FROM clients
          WHERE organization_id = ?
        `, [parseInt(tenantId)]) as any[];

        const data = {
          byNationality: byNationality.map((n: any) => ({
            nationality: n.nationality,
            count: parseInt(n.count || 0),
            activeCount: parseInt(n.active_count || 0)
          })),
          byClientType: byClientType.map((t: any) => ({
            clientType: t.client_type,
            count: parseInt(t.count || 0),
            activeCount: parseInt(t.active_count || 0)
          })),
          byLanguage: byLanguage.map((l: any) => ({
            language: l.language_preference,
            count: parseInt(l.count || 0)
          })),
          newClientsOverTime: newClientsOverTime.map((m: any) => ({
            month: m.month,
            newClients: parseInt(m.new_clients || 0)
          })).reverse(),
          byStatus: byStatus.map((s: any) => ({
            status: s.status,
            count: parseInt(s.count || 0)
          })),
          specialRequirements: {
            withDietary: parseInt(specialRequirementsResult?.with_dietary || 0),
            withSpecialNeeds: parseInt(specialRequirementsResult?.with_special_needs || 0),
            marketingConsent: parseInt(specialRequirementsResult?.marketing_consent || 0),
            newsletterSubscribed: parseInt(specialRequirementsResult?.newsletter_subscribed || 0)
          }
        };

    // Create response with headers
    const response = NextResponse.json({ data });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      report: 'clients_demographics',
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

