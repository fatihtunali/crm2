import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST - Record payment for payable invoice
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { payment_amount, payment_date, payment_method, payment_reference, notes } = body;

    // Get current invoice
    const invoices = await query(
      'SELECT * FROM invoices_payable WHERE id = ?',
      [id]
    );

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoices[0];
    const currentPaidAmount = Number(invoice.paid_amount || 0);
    const totalAmount = Number(invoice.total_amount);
    const newPaidAmount = currentPaidAmount + Number(payment_amount);

    // Determine new status
    let newStatus = 'pending';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    // Update invoice
    await query(
      `UPDATE invoices_payable
       SET paid_amount = ?,
           payment_date = ?,
           payment_method = ?,
           payment_reference = ?,
           notes = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        newPaidAmount.toFixed(2),
        payment_date,
        payment_method,
        payment_reference,
        notes || invoice.notes,
        newStatus,
        id
      ]
    );

    return NextResponse.json({
      success: true,
      paid_amount: newPaidAmount,
      status: newStatus,
      message: `Payment of $${Number(payment_amount).toFixed(2)} recorded successfully`
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    );
  }
}
