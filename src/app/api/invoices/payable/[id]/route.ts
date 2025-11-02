import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch a single payable invoice with items
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get invoice details
    const invoices = await query(
      `SELECT
        ip.*,
        p.provider_name,
        q.quote_number
      FROM invoices_payable ip
      LEFT JOIN providers p ON ip.provider_id = p.id
      LEFT JOIN quotes q ON ip.booking_id = q.id
      WHERE ip.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoices[0];

    // Get invoice items
    const items = await query(
      `SELECT * FROM invoice_payable_items WHERE invoice_id = ?`,
      [id]
    );

    return NextResponse.json({
      ...invoice,
      items
    });
  } catch (error) {
    console.error('Error fetching payable invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
