import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all receivable invoices
export async function GET() {
  try {
    const invoices = await query(`
      SELECT
        ir.*,
        q.quote_number
      FROM invoices_receivable ir
      LEFT JOIN quotes q ON ir.booking_id = q.id
      ORDER BY ir.invoice_date DESC, ir.created_at DESC
    `);

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching receivable invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receivable invoices' },
      { status: 500 }
    );
  }
}
