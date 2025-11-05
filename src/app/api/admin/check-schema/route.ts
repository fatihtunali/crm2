/**
 * Admin Check Schema API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement (super_admin only)
 *
 * GET /api/admin/check-schema - View database table schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. SECURITY: Require authentication and get tenant context
    const authResult = await requirePermission(request, 'admin', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user } = authResult;

    // 2. SECURITY: Only super_admin can view database schema
    if (user.role !== 'super_admin') {
      return standardErrorResponse(
        ErrorCodes.FORBIDDEN,
        'Only super_admin can view database schema',
        403,
        undefined,
        requestId
      );
    }

    // 3. Rate limiting (20 requests per hour per admin)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `admin_${user.userId}_schema`,
      20,
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

    // 4. Parse query parameters
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') || 'providers';

    // 5. SECURITY: Whitelist of allowed tables to prevent SQL injection
    const ALLOWED_TABLES = [
      'providers', 'clients', 'quotes', 'hotels', 'vehicles', 'guides',
      'daily_tours', 'entrance_fees', 'restaurants', 'transfers',
      'agents', 'bookings', 'extra_expenses', 'customer_itineraries',
      'invoices_receivable', 'invoices_payable', 'invoice_items',
      'users', 'organizations', 'audit_logs'
    ];

    if (!ALLOWED_TABLES.includes(table)) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'table', issue: 'invalid', message: `Table must be one of: ${ALLOWED_TABLES.join(', ')}` }],
        requestId
      );
    }

    // 6. Get table structure - safe now because table is validated
    const columns = await query(`DESCRIBE ${table}`) as any[];

    // 7. Format response
    const responseData = {
      table,
      columns: columns.map((col: any) => ({
        Field: col.Field,
        Type: col.Type,
        Null: col.Null,
        Key: col.Key,
        Default: col.Default,
        Extra: col.Extra
      }))
    };

    // 8. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      table,
      columns_count: columns.length,
    });

    // 9. Return response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to check schema',
      500,
      undefined,
      requestId
    );
  }
}
