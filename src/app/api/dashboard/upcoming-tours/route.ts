import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parseSortParams } from '@/lib/pagination';
import { successResponse, errorResponse, internalServerErrorProblem, standardErrorResponse, ErrorCodes } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logResponse } from '@/middleware/correlation';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'dashboard', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters (default limit 10 for dashboard widgets)
    const pageSize = parseInt(searchParams.get('limit') || '10');

    // Parse sort parameters (default: start_date ASC)
    const sortParam = searchParams.get('sort') || 'start_date';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'destination', 'customer_name', 'start_date', 'end_date', 'status', 'adults', 'children'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Get upcoming itineraries that are confirmed with tenant filtering
    const sql = `
      SELECT
        id,
        destination as package,
        customer_name as agent,
        DATE_FORMAT(start_date, '%Y-%m-%d') as date,
        adults + children as pax,
        'Pending Assignment' as guide,
        status
      FROM customer_itineraries
      WHERE organization_id = ?
        AND start_date >= CURDATE()
        AND status IN ('confirmed', 'booked', 'pending')
      ORDER BY ${orderBy || 'start_date ASC'}
      LIMIT ?
    `;

    const tours = await query(sql, [parseInt(tenantId), pageSize]);

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: (tours as any[]).length,
    });

    const response = NextResponse.json(tours);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    console.error('Database error:', error);

    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch upcoming tours',
      500,
      undefined,
      requestId
    );
  }
}
