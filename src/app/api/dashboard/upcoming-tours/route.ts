import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parseSortParams } from '@/lib/pagination';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters (default limit 10 for dashboard widgets)
    const pageSize = parseInt(searchParams.get('limit') || '10');

    // Parse sort parameters (default: start_date ASC)
    const sortParam = searchParams.get('sort') || 'start_date';
    const orderBy = parseSortParams(sortParam);

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

    return successResponse(tours);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch upcoming tours', '/api/dashboard/upcoming-tours')
    );
  }
}
