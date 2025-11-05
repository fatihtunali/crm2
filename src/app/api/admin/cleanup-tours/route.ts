/**
 * Admin Cleanup Tours API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement (super_admin only)
 * - Audit logging
 *
 * POST /api/admin/cleanup-tours - Delete inactive tours
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import {
  standardErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. SECURITY: Require authentication and get tenant context
    const authResult = await requirePermission(request, 'admin', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. SECURITY: Only super_admin can cleanup tours
    if (user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only super_admin can perform cleanup operations',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (5 cleanup operations per hour per admin)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `admin_${user.userId}_cleanup`,
      5,
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

    // 4. Count inactive tours first
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM tours WHERE status = ? AND organization_id = ?',
      ['inactive', parseInt(tenantId)]
    ) as any[];

    const inactiveCount = countResult.total;

    if (inactiveCount === 0) {
      logResponse(requestId, 200, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        deleted: 0,
      });

      const response = NextResponse.json({
        success: true,
        message: 'No inactive tours found',
        deleted: 0
      });
      response.headers.set('X-Request-Id', requestId);
      addRateLimitHeaders(response, rateLimit);
      return response;
    }

    // 5. Delete inactive tours
    await query(
      'DELETE FROM tours WHERE status = ? AND organization_id = ?',
      ['inactive', parseInt(tenantId)]
    );

    // 6. AUDIT: Log cleanup operation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.ADMIN_ACTION,
      AuditResources.TOUR,
      'bulk_cleanup',
      {
        action: 'cleanup_inactive_tours',
        deleted_count: inactiveCount,
      },
      {
        tenant_id: tenantId,
        operation: 'bulk_delete',
      },
      request
    );

    // 7. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      deleted: inactiveCount,
    });

    // 8. Return response with headers
    const response = NextResponse.json({
      success: true,
      message: `Successfully deleted ${inactiveCount} inactive tours`,
      deleted: inactiveCount
    });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to cleanup tours',
      500,
      undefined,
      requestId
    );
  }
}
