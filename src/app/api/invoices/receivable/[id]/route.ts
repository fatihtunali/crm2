import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch a single receivable invoice
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get invoice details
    const invoices = await query(
      `SELECT
        ir.*,
        q.quote_number
      FROM invoices_receivable ir
      LEFT JOIN quotes q ON ir.booking_id = q.id
      WHERE ir.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoices[0]);
  } catch (error) {
    console.error('Error fetching receivable invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
