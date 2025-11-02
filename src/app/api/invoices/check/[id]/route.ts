import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Check if a booking has invoices
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check for payable invoices
    const payables = await query(
      'SELECT COUNT(*) as count FROM invoices_payable WHERE booking_id = ?',
      [id]
    );

    // Check for receivable invoices
    const receivables = await query(
      'SELECT COUNT(*) as count FROM invoices_receivable WHERE booking_id = ?',
      [id]
    );

    const has_invoices =
      (payables[0]?.count > 0) || (receivables[0]?.count > 0);

    return NextResponse.json({
      has_invoices,
      payables_count: payables[0]?.count || 0,
      receivables_count: receivables[0]?.count || 0
    });
  } catch (error) {
    console.error('Error checking invoices:', error);
    return NextResponse.json(
      { error: 'Failed to check invoices' },
      { status: 500 }
    );
  }
}
