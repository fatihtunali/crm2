/**
 * Admin Migrate Providers API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement (super_admin only)
 * - Audit logging
 *
 * POST /api/admin/migrate-providers - Add city column to providers table
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
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
    const { user } = authResult;

    // 2. SECURITY: Only super_admin can perform database migrations
    if (user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only super_admin can perform database migrations',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (5 migration operations per hour per admin)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `admin_${user.userId}_migration`,
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

    // 4. Check if city column already exists
    const columns = await query(
      "SHOW COLUMNS FROM providers LIKE 'city'"
    ) as any[];

    if (columns && columns.length > 0) {
      logResponse(requestId, 200, Date.now() - startTime, {
        user_id: user.userId,
        already_exists: true,
      });

      const response = NextResponse.json({
        success: true,
        message: 'City column already exists in providers table'
      });
      response.headers.set('X-Request-Id', requestId);
      addRateLimitHeaders(response, rateLimit);
      return response;
    }

    // 5. Add city column after provider_type
    await query(`
      ALTER TABLE providers
      ADD COLUMN city VARCHAR(100) NULL
      AFTER provider_type
    `);

    // 6. AUDIT: Log migration operation
    await auditLog(
      1, // System-level operation, use tenant 1 or 0
      user.userId,
      AuditActions.ADMIN_ACTION,
      AuditResources.PROVIDER,
      'schema_migration',
      {
        action: 'add_city_column',
        table: 'providers',
        column: 'city',
      },
      {
        migration: 'add_city_column_to_providers',
        operation: 'ALTER TABLE',
      },
      request
    );

    // 7. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      migration: 'add_city_column',
    });

    // 8. Return response with headers
    const response = NextResponse.json({
      success: true,
      message: 'Successfully added city column to providers table'
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
      'Failed to migrate providers table',
      500,
      undefined,
      requestId
    );
  }
}
