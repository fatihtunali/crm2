import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch aggregated supplier financial data
export async function GET() {
  try {
    // Get all payable invoices grouped by provider
    const suppliers = await query(`
      SELECT
        p.id as provider_id,
        p.provider_name,
        p.provider_type,
        p.contact_email,
        p.contact_phone,
        COUNT(DISTINCT ip.id) as invoice_count,
        SUM(ip.total_amount) as total_invoiced,
        SUM(ip.paid_amount) as total_paid,
        SUM(ip.total_amount - ip.paid_amount) as outstanding,
        MAX(ip.payment_date) as last_payment_date,
        COUNT(CASE WHEN ip.status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN ip.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN ip.status = 'paid' THEN 1 END) as paid_count
      FROM providers p
      LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
      GROUP BY p.id, p.provider_name, p.provider_type, p.contact_email, p.contact_phone
      HAVING invoice_count > 0
      ORDER BY outstanding DESC, total_invoiced DESC
    `);

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching supplier financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supplier financial data' },
      { status: 500 }
    );
  }
}
