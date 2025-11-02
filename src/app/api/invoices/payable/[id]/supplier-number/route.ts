import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// PUT - Update supplier invoice number
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { supplier_invoice_number } = body;

    // Update invoice
    await query(
      `UPDATE invoices_payable
       SET supplier_invoice_number = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [supplier_invoice_number || null, id]
    );

    return NextResponse.json({
      success: true,
      message: 'Supplier invoice number updated successfully'
    });
  } catch (error) {
    console.error('Error updating supplier invoice number:', error);
    return NextResponse.json(
      { error: 'Failed to update supplier invoice number' },
      { status: 500 }
    );
  }
}
