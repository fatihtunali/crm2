import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'reports', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'last_12_months';
    const { startDate, endDate } = calculateDateRange(period);

    // New clients per period
    const newClientsTrend = await query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_clients
      FROM clients
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Repeat booking analysis
    const [retentionResult] = await query(`
      SELECT
        COUNT(CASE WHEN booking_count = 1 THEN 1 END) as one_time_customers,
        COUNT(CASE WHEN booking_count = 2 THEN 1 END) as two_bookings,
        COUNT(CASE WHEN booking_count >= 3 THEN 1 END) as three_plus_bookings,
        AVG(booking_count) as avg_bookings_per_customer
      FROM (
        SELECT
          c.id,
          COUNT(q.id) as booking_count
        FROM clients c
        LEFT JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci AND q.status = 'accepted'
        WHERE c.organization_id = ?
        GROUP BY c.id
        HAVING booking_count > 0
      ) as customer_bookings
    `, [parseInt(tenantId)]) as any[];

    // Churn analysis (customers who haven't booked in 180 days)
    const [churnResult] = await query(`
      SELECT
        COUNT(CASE WHEN days_since_last_booking > 180 THEN 1 END) as churned_customers,
        COUNT(CASE WHEN days_since_last_booking <= 180 THEN 1 END) as active_customers,
        AVG(days_since_last_booking) as avg_days_since_last_booking
      FROM (
        SELECT
          c.id,
          DATEDIFF(CURDATE(), MAX(q.start_date)) as days_since_last_booking
        FROM clients c
        JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci AND q.status = 'accepted'
        WHERE c.organization_id = ?
        GROUP BY c.id
      ) as customer_activity
    `, [parseInt(tenantId)]) as any[];

    const totalCustomers = parseInt(churnResult?.churned_customers || 0) + parseInt(churnResult?.active_customers || 0);
    const churnRate = totalCustomers > 0
      ? (parseInt(churnResult?.churned_customers || 0) / totalCustomers) * 100
      : 0;

    // Customer cohort analysis
    const cohortAnalysis = await query(`
      SELECT
        DATE_FORMAT(c.created_at, '%Y-%m') as cohort_month,
        COUNT(DISTINCT c.id) as cohort_size,
        COUNT(DISTINCT q.customer_email) as retained_customers,
        SUM(q.total_price) as cohort_revenue
      FROM clients c
      LEFT JOIN quotes q ON c.email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
        AND q.status = 'accepted'
        AND q.start_date BETWEEN ? AND ?
      WHERE c.organization_id = ?
      AND c.created_at BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
      ORDER BY cohort_month DESC
      LIMIT 12
    `, [startDate, endDate, parseInt(tenantId), startDate, endDate]) as any[];

    // Time between bookings
    const [repeatTimeResult] = await query(`
      SELECT
        AVG(days_between) as avg_days_between_bookings,
        MIN(days_between) as min_days_between,
        MAX(days_between) as max_days_between
      FROM (
        SELECT
          customer_email,
          DATEDIFF(start_date, LAG(start_date) OVER (PARTITION BY customer_email ORDER BY start_date)) as days_between
        FROM quotes
        WHERE organization_id = ?
        AND status = 'accepted'
      ) as booking_intervals
      WHERE days_between IS NOT NULL
    `, [parseInt(tenantId)]) as any[];

    const data = {
      period: { start_date: startDate, end_date: endDate },
      acquisitionTrend: newClientsTrend.map((m: any) => ({
        month: m.month,
        newClients: parseInt(m.new_clients || 0)
      })),
      retention: {
        oneTimeCustomers: parseInt(retentionResult?.one_time_customers || 0),
        twoBookings: parseInt(retentionResult?.two_bookings || 0),
        threePlusBookings: parseInt(retentionResult?.three_plus_bookings || 0),
        avgBookingsPerCustomer: Math.round(parseFloat(retentionResult?.avg_bookings_per_customer || 0) * 10) / 10,
        repeatRate: totalCustomers > 0 ? Math.round(((totalCustomers - parseInt(retentionResult?.one_time_customers || 0)) / totalCustomers) * 100 * 100) / 100 : 0
      },
      churn: {
        churnedCustomers: parseInt(churnResult?.churned_customers || 0),
        activeCustomers: parseInt(churnResult?.active_customers || 0),
        churnRate: Math.round(churnRate * 100) / 100,
        avgDaysSinceLastBooking: Math.round(parseFloat(churnResult?.avg_days_since_last_booking || 0))
      },
      cohorts: cohortAnalysis.map((c: any) => ({
        cohortMonth: c.cohort_month,
        cohortSize: parseInt(c.cohort_size || 0),
        retainedCustomers: parseInt(c.retained_customers || 0),
        retentionRate: parseInt(c.cohort_size || 0) > 0 ? Math.round((parseInt(c.retained_customers || 0) / parseInt(c.cohort_size || 0)) * 100 * 100) / 100 : 0,
        cohortRevenue: createMoney(parseFloat(c.cohort_revenue || 0), 'EUR')
      })),
      repeatBookingMetrics: {
        avgDaysBetweenBookings: Math.round(parseFloat(repeatTimeResult?.avg_days_between_bookings || 0)),
        minDaysBetween: parseInt(repeatTimeResult?.min_days_between || 0),
        maxDaysBetween: parseInt(repeatTimeResult?.max_days_between || 0)
      }
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}

function calculateDateRange(period: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now);

  switch(period) {
    case 'last_12_months':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
