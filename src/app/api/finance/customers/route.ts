import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch aggregated customer financial data
export async function GET() {
  try {
    // Get all receivable invoices grouped by customer
    const customers = await query(`
      SELECT
        q.customer_name,
        q.customer_email,
        q.customer_phone,
        COUNT(DISTINCT ir.id) as invoice_count,
        COUNT(DISTINCT q.id) as booking_count,
        SUM(ir.total_amount) as total_invoiced,
        SUM(ir.paid_amount) as total_received,
        SUM(ir.total_amount - ir.paid_amount) as outstanding,
        MAX(ir.payment_date) as last_payment_date,
        COUNT(CASE WHEN ir.status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN ir.status = 'partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN ir.status = 'paid' THEN 1 END) as paid_count
      FROM quotes q
      LEFT JOIN invoices_receivable ir ON q.id = ir.booking_id
      WHERE q.status = 'accepted'
      GROUP BY q.customer_name, q.customer_email, q.customer_phone
      HAVING invoice_count > 0
      ORDER BY outstanding DESC, total_invoiced DESC
    `);

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customer financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer financial data' },
      { status: 500 }
    );
  }
}
