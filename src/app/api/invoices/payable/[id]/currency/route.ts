import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// PUT - Update currency information
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { currency, original_amount, exchange_rate, exchange_rate_date } = body;

    // Calculate EUR equivalent if not EUR
    let eurAmount = Number(original_amount);
    if (currency !== 'EUR' && exchange_rate) {
      eurAmount = Number(original_amount) / Number(exchange_rate);
    }

    // Update invoice
    await query(
      `UPDATE invoices_payable
       SET currency = ?,
           original_amount = ?,
           exchange_rate = ?,
           exchange_rate_date = ?,
           total_amount = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        currency,
        Number(original_amount).toFixed(2),
        currency === 'EUR' ? null : Number(exchange_rate).toFixed(4),
        currency === 'EUR' ? null : exchange_rate_date,
        eurAmount.toFixed(2),
        id
      ]
    );

    return NextResponse.json({
      success: true,
      eur_amount: eurAmount.toFixed(2),
      message: 'Currency information updated successfully'
    });
  } catch (error) {
    console.error('Error updating currency:', error);
    return NextResponse.json(
      { error: 'Failed to update currency information' },
      { status: 500 }
    );
  }
}
