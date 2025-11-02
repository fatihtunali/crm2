import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all payable invoices
export async function GET() {
  try {
    const invoices = await query(`
      SELECT
        ip.*,
        p.provider_name,
        q.quote_number,
        q.customer_name
      FROM invoices_payable ip
      LEFT JOIN providers p ON ip.provider_id = p.id
      LEFT JOIN quotes q ON ip.booking_id = q.id
      ORDER BY ip.invoice_date DESC, ip.created_at DESC
    `);

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching payable invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payable invoices' },
      { status: 500 }
    );
  }
}
