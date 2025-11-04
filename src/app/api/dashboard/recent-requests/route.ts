import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters (default limit 10 for dashboard widgets)
    const pageSize = parseInt(searchParams.get('limit') || '10');
    const page = 1;
    const offset = 0;

    // Parse sort parameters (default: -created_at)
    const sortParam = searchParams.get('sort') || '-created_at';
    const orderBy = parseSortParams(sortParam);

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

    return successResponse(transformedRequests);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch recent requests', '/api/dashboard/recent-requests')
    );
  }
}
