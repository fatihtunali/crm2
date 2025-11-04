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
    const view = searchParams.get('view') || 'current'; // current, upcoming, past

    let dateFilter = '';
    if (view === 'upcoming') {
      dateFilter = 'AND q.start_date >= CURDATE()';
    } else if (view === 'past') {
      dateFilter = 'AND q.end_date < CURDATE()';
    } else {
      // current (ongoing tours)
      dateFilter = 'AND q.start_date <= CURDATE() AND q.end_date >= CURDATE()';
    }

    // Bookings by status
    const statusSummary = await query(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_price) as total_value
      FROM quotes
      WHERE organization_id = ?
      ${dateFilter}
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'accepted' THEN 1
          WHEN 'sent' THEN 2
          WHEN 'draft' THEN 3
          WHEN 'rejected' THEN 4
          WHEN 'expired' THEN 5
        END
    `, [parseInt(tenantId)]) as any[];

    // Bookings by category
    const byCategory = await query(`
      SELECT
        category,
        COUNT(*) as count,
        SUM(total_price) as total_value
      FROM quotes
      WHERE organization_id = ?
      ${dateFilter}
      AND category IS NOT NULL
      GROUP BY category
    `, [parseInt(tenantId)]) as any[];

    // Bookings by destination
    const byDestination = await query(`
      SELECT
        destination,
        COUNT(*) as count,
        AVG(adults + children) as avg_pax
      FROM quotes
      WHERE organization_id = ?
      ${dateFilter}
      AND destination IS NOT NULL
      GROUP BY destination
      ORDER BY count DESC
      LIMIT 10
    `, [parseInt(tenantId)]) as any[];

    // Recent bookings
    const recentBookings = await query(`
      SELECT
        id,
        quote_number,
        customer_name,
        destination,
        start_date,
        end_date,
        adults + children as total_pax,
        status,
        total_price,
        created_at
      FROM quotes
      WHERE organization_id = ?
      ${dateFilter}
      ORDER BY created_at DESC
      LIMIT 20
    `, [parseInt(tenantId)]) as any[];

    // Payment status for accepted bookings
    const paymentStatus = await query(`
      SELECT
        CASE
          WHEN ir.status = 'paid' THEN 'Fully Paid'
          WHEN ir.status = 'partial' THEN 'Partially Paid'
          WHEN ir.status IN ('sent', 'draft') THEN 'Awaiting Payment'
          WHEN ir.status = 'overdue' THEN 'Overdue'
          ELSE 'No Invoice'
        END as payment_status,
        COUNT(DISTINCT q.id) as booking_count
      FROM quotes q
      LEFT JOIN invoices_receivable ir ON q.id = ir.booking_id
      WHERE q.organization_id = ?
      AND q.status = 'accepted'
      ${dateFilter}
      GROUP BY payment_status
    `, [parseInt(tenantId)]) as any[];

    // Status change timeline (last 30 days)
    const statusTimeline = await query(`
      SELECT
        DATE(updated_at) as date,
        status,
        COUNT(*) as count
      FROM quotes
      WHERE organization_id = ?
      AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(updated_at), status
      ORDER BY date DESC, status
    `, [parseInt(tenantId)]) as any[];

    const data = {
      view: view,
      statusSummary: statusSummary.map((s: any) => ({
        status: s.status,
        count: parseInt(s.count || 0),
        totalValue: createMoney(parseFloat(s.total_value || 0), 'EUR')
      })),
      byCategory: byCategory.map((c: any) => ({
        category: c.category,
        count: parseInt(c.count || 0),
        totalValue: createMoney(parseFloat(c.total_value || 0), 'EUR')
      })),
      byDestination: byDestination.map((d: any) => ({
        destination: d.destination,
        count: parseInt(d.count || 0),
        avgPax: Math.round(parseFloat(d.avg_pax || 0) * 10) / 10
      })),
      recentBookings: recentBookings.map((b: any) => ({
        id: b.id,
        quoteNumber: b.quote_number,
        customerName: b.customer_name,
        destination: b.destination,
        startDate: b.start_date,
        endDate: b.end_date,
        totalPax: parseInt(b.total_pax || 0),
        status: b.status,
        totalPrice: createMoney(parseFloat(b.total_price || 0), 'EUR'),
        createdAt: b.created_at
      })),
      paymentStatus: paymentStatus.map((p: any) => ({
        paymentStatus: p.payment_status,
        bookingCount: parseInt(p.booking_count || 0)
      })),
      statusTimeline: statusTimeline.map((t: any) => ({
        date: t.date,
        status: t.status,
        count: parseInt(t.count || 0)
      }))
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}
