import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90'); // next 90 days by default

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    // Upcoming tours
    const upcomingTours = await query(`
      SELECT
        q.id,
        q.quote_number,
        q.customer_name,
        q.customer_email,
        q.customer_phone,
        q.destination,
        q.start_date,
        q.end_date,
        DATEDIFF(q.end_date, q.start_date) + 1 as days,
        q.adults,
        q.children,
        q.adults + q.children as total_pax,
        q.tour_type,
        q.category,
        q.status,
        q.total_price,
        DATEDIFF(q.start_date, CURDATE()) as days_until_start
      FROM quotes q
      WHERE q.organization_id = ?
      AND q.start_date >= CURDATE()
      AND q.start_date <= ?
      AND q.status IN ('accepted', 'sent')
      ORDER BY q.start_date ASC
    `, [parseInt(tenantId), futureDate.toISOString().split('T')[0]]) as any[];

    // Tours by week
    const toursByWeek = await query(`
      SELECT
        YEARWEEK(start_date, 1) as week,
        DATE(DATE_SUB(start_date, INTERVAL WEEKDAY(start_date) DAY)) as week_start,
        COUNT(*) as tour_count,
        SUM(adults + children) as total_pax
      FROM quotes
      WHERE organization_id = ?
      AND start_date >= CURDATE()
      AND start_date <= ?
      AND status IN ('accepted', 'sent')
      GROUP BY YEARWEEK(start_date, 1), week_start
      ORDER BY week_start
    `, [parseInt(tenantId), futureDate.toISOString().split('T')[0]]) as any[];

    // Tours by destination
    const toursByDestination = await query(`
      SELECT
        destination,
        COUNT(*) as tour_count,
        SUM(adults + children) as total_pax
      FROM quotes
      WHERE organization_id = ?
      AND start_date >= CURDATE()
      AND start_date <= ?
      AND status IN ('accepted', 'sent')
      AND destination IS NOT NULL
      GROUP BY destination
      ORDER BY tour_count DESC
    `, [parseInt(tenantId), futureDate.toISOString().split('T')[0]]) as any[];

    // Tours by status
    const toursByStatus = await query(`
      SELECT
        status,
        COUNT(*) as count
      FROM quotes
      WHERE organization_id = ?
      AND start_date >= CURDATE()
      AND start_date <= ?
      GROUP BY status
    `, [parseInt(tenantId), futureDate.toISOString().split('T')[0]]) as any[];

    // Resource requirements summary
    const [resourcesResult] = await query(`
      SELECT
        SUM(adults + children) as total_pax_upcoming,
        COUNT(DISTINCT destination) as destinations_count,
        AVG(DATEDIFF(end_date, start_date) + 1) as avg_duration
      FROM quotes
      WHERE organization_id = ?
      AND start_date >= CURDATE()
      AND start_date <= ?
      AND status = 'accepted'
    `, [parseInt(tenantId), futureDate.toISOString().split('T')[0]]) as any[];

    const data = {
      period: {
        start_date: new Date().toISOString().split('T')[0],
        end_date: futureDate.toISOString().split('T')[0],
        days: days
      },
      summary: {
        totalUpcomingTours: upcomingTours.length,
        totalPax: parseInt(resourcesResult?.total_pax_upcoming || 0),
        destinationsCount: parseInt(resourcesResult?.destinations_count || 0),
        avgDuration: Math.round(parseFloat(resourcesResult?.avg_duration || 0))
      },
      tours: upcomingTours.map((t: any) => ({
        id: t.id,
        quoteNumber: t.quote_number,
        customerName: t.customer_name,
        customerEmail: t.customer_email,
        customerPhone: t.customer_phone,
        destination: t.destination,
        startDate: t.start_date,
        endDate: t.end_date,
        days: parseInt(t.days || 0),
        adults: parseInt(t.adults || 0),
        children: parseInt(t.children || 0),
        totalPax: parseInt(t.total_pax || 0),
        tourType: t.tour_type,
        category: t.category,
        status: t.status,
        totalPrice: createMoney(parseFloat(t.total_price || 0), 'EUR'),
        daysUntilStart: parseInt(t.days_until_start || 0)
      })),
      byWeek: toursByWeek.map((w: any) => ({
        week: w.week,
        weekStart: w.week_start,
        tourCount: parseInt(w.tour_count || 0),
        totalPax: parseInt(w.total_pax || 0)
      })),
      byDestination: toursByDestination.map((d: any) => ({
        destination: d.destination,
        tourCount: parseInt(d.tour_count || 0),
        totalPax: parseInt(d.total_pax || 0)
      })),
      byStatus: toursByStatus.map((s: any) => ({
        status: s.status,
        count: parseInt(s.count || 0)
      }))
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}
