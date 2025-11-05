import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { successResponse, errorResponse, internalServerErrorProblem, standardErrorResponse, ErrorCodes } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';
import { getRequestId, logResponse } from '@/middleware/correlation';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      );
    }
    const { tenantId, user } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters (default limit 10 for dashboard widgets)
    const pageSize = parseInt(searchParams.get('limit') || '10');
    const page = 1;
    const offset = 0;

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'customer_name', 'destination', 'adults', 'children', 'status', 'created_at', 'total_price'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Get recent itineraries (requests) with tenant filtering
    const sql = `
      SELECT
        id,
        customer_name as agent,
        destination as package,
        adults + children as pax,
        status,
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        total_price
      FROM customer_itineraries
      WHERE organization_id = ?
      ORDER BY ${orderBy || 'created_at DESC'}
      LIMIT ?
    `;

    const requests = await query(sql, [parseInt(tenantId), pageSize]) as any[];

    // Transform to include Money types
    const transformedRequests = requests.map(req => ({
      ...req,
      value: createMoney(parseFloat(req.total_price || 0), 'EUR')
    }));

    // Remove raw total_price from response
    transformedRequests.forEach(req => delete req.total_price);

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: transformedRequests.length,
    });

    const response = NextResponse.json(transformedRequests);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    console.error('Database error:', error);

    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch recent requests',
      500,
      undefined,
      requestId
    );
  }
}
