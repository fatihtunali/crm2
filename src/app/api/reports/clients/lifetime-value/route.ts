import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const sortBy = searchParams.get('sort') || 'revenue';

    // Client lifetime value
    const clientLTV = await query(`
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.nationality,
        c.client_type,
        COUNT(q.id) as total_bookings,
        SUM(q.total_price) as total_revenue,
        AVG(q.total_price) as avg_booking_value,
        MIN(q.start_date) as first_booking_date,
        MAX(q.start_date) as last_booking_date,
        DATEDIFF(MAX(q.start_date), MIN(q.start_date)) as customer_lifespan_days
      FROM clients c
      LEFT JOIN quotes q ON c.email = q.customer_email AND q.status = 'accepted'
      WHERE c.organization_id = ?
      GROUP BY c.id
      HAVING total_bookings > 0
      ORDER BY ${sortBy === 'bookings' ? 'total_bookings' : 'total_revenue'} DESC
      LIMIT ?
    `, [parseInt(tenantId), limit]) as any[];

    // LTV segments
    const [segmentResult] = await query(`
      SELECT
        COUNT(CASE WHEN total_revenue >= 10000 THEN 1 END) as vip_clients,
        COUNT(CASE WHEN total_revenue BETWEEN 5000 AND 9999 THEN 1 END) as high_value,
        COUNT(CASE WHEN total_revenue BETWEEN 2000 AND 4999 THEN 1 END) as medium_value,
        COUNT(CASE WHEN total_revenue < 2000 THEN 1 END) as low_value
      FROM (
        SELECT
          c.id,
          SUM(q.total_price) as total_revenue
        FROM clients c
        LEFT JOIN quotes q ON c.email = q.customer_email AND q.status = 'accepted'
        WHERE c.organization_id = ?
        GROUP BY c.id
        HAVING total_revenue > 0
      ) as client_values
    `, [parseInt(tenantId)]) as any[];

    // Repeat customer rate
    const [repeatResult] = await query(`
      SELECT
        COUNT(CASE WHEN booking_count > 1 THEN 1 END) as repeat_customers,
        COUNT(*) as total_customers_with_bookings
      FROM (
        SELECT
          c.id,
          COUNT(q.id) as booking_count
        FROM clients c
        LEFT JOIN quotes q ON c.email = q.customer_email AND q.status = 'accepted'
        WHERE c.organization_id = ?
        GROUP BY c.id
        HAVING booking_count > 0
      ) as customer_bookings
    `, [parseInt(tenantId)]) as any[];

    const repeatRate = parseInt(repeatResult?.total_customers_with_bookings || 0) > 0
      ? (parseInt(repeatResult?.repeat_customers || 0) / parseInt(repeatResult?.total_customers_with_bookings || 0)) * 100
      : 0;

    const data = {
      clients: clientLTV.map((c: any) => ({
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        email: c.email,
        nationality: c.nationality,
        clientType: c.client_type,
        totalBookings: parseInt(c.total_bookings || 0),
        totalRevenue: createMoney(parseFloat(c.total_revenue || 0), 'EUR'),
        avgBookingValue: createMoney(parseFloat(c.avg_booking_value || 0), 'EUR'),
        firstBookingDate: c.first_booking_date,
        lastBookingDate: c.last_booking_date,
        customerLifespanDays: parseInt(c.customer_lifespan_days || 0)
      })),
      segments: {
        vipClients: parseInt(segmentResult?.vip_clients || 0),
        highValue: parseInt(segmentResult?.high_value || 0),
        mediumValue: parseInt(segmentResult?.medium_value || 0),
        lowValue: parseInt(segmentResult?.low_value || 0)
      },
      repeatCustomerRate: Math.round(repeatRate * 100) / 100,
      totalRepeatCustomers: parseInt(repeatResult?.repeat_customers || 0),
      totalCustomersWithBookings: parseInt(repeatResult?.total_customers_with_bookings || 0)
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}
