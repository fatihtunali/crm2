import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST - Generate invoices from bookings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingIds } = body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return NextResponse.json(
        { error: 'No booking IDs provided' },
        { status: 400 }
      );
    }

    let payablesCount = 0;
    let receivablesCount = 0;

    for (const bookingId of bookingIds) {
      // Get booking details
      const bookings = await query(
        `SELECT * FROM quotes WHERE id = ? AND status = 'accepted'`,
        [bookingId]
      );

      if (bookings.length === 0) {
        console.log(`Booking ${bookingId} not found or not accepted`);
        continue;
      }

      const booking = bookings[0];

      // Generate Receivable Invoice (customer owes us)
      const invoiceNumber = `INV-R-${Date.now()}-${bookingId}`;
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]; // 30 days from now

      // Get sum of expenses (subtotal before markup and tax)
      const expensesResult = await query(
        `SELECT SUM(qe.price) as total_expenses
         FROM quote_expenses qe
         JOIN quote_days qd ON qe.quote_day_id = qd.id
         WHERE qd.quote_id = ? AND qe.price > 0`,
        [bookingId]
      );
      const subtotal = Number(expensesResult[0]?.total_expenses || 0);

      // Calculate markup and tax
      const markupPercent = Number(booking.markup || 0);
      const taxPercent = Number(booking.tax || 0);
      const markupAmount = subtotal * (markupPercent / 100);
      const subtotalAfterMarkup = subtotal + markupAmount;
      const taxAmount = subtotalAfterMarkup * (taxPercent / 100);
      const totalAmount = subtotalAfterMarkup + taxAmount;

      await query(
        `INSERT INTO invoices_receivable (
          booking_id,
          invoice_number,
          invoice_date,
          due_date,
          customer_name,
          customer_email,
          customer_phone,
          subtotal,
          tax_amount,
          total_amount,
          paid_amount,
          status,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          booking.customer_name,
          booking.customer_email,
          booking.customer_phone || '',
          subtotal.toFixed(2),
          taxAmount.toFixed(2),
          totalAmount.toFixed(2),
          0, // paid_amount
          'draft',
          `Auto-generated from booking - Markup: ${markupPercent}%, Tax: ${taxPercent}%`
        ]
      );
      receivablesCount++;

      // Generate Payable Invoices (we owe suppliers)
      // Get all expenses for this booking grouped by provider
      const expenses = await query(
        `SELECT
          qe.*,
          p.id as provider_id,
          p.provider_name
        FROM quote_expenses qe
        LEFT JOIN quote_days qd ON qe.quote_day_id = qd.id
        LEFT JOIN providers p ON qe.provider_id = p.id
        WHERE qd.quote_id = ? AND qe.price > 0 AND qe.provider_id IS NOT NULL`,
        [bookingId]
      );

      // Group expenses by provider
      const expensesByProvider = expenses.reduce((acc: any, expense: any) => {
        const providerId = expense.provider_id || 0;
        if (!acc[providerId]) {
          acc[providerId] = {
            provider_id: providerId,
            provider_name: expense.provider_name || 'Unknown Provider',
            expenses: []
          };
        }
        acc[providerId].expenses.push(expense);
        return acc;
      }, {});

      // Create one payable invoice per provider
      for (const providerGroup of Object.values(expensesByProvider)) {
        const group = providerGroup as any;

        if (group.provider_id === 0) continue; // Skip expenses without provider

        const totalAmount = group.expenses.reduce(
          (sum: number, exp: any) => sum + Number(exp.price),
          0
        );

        const payableInvoiceNumber = `INV-P-${Date.now()}-${bookingId}-${group.provider_id}`;

        const result: any = await query(
          `INSERT INTO invoices_payable (
            booking_id,
            provider_id,
            invoice_number,
            invoice_date,
            due_date,
            total_amount,
            paid_amount,
            status,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bookingId,
            group.provider_id,
            payableInvoiceNumber,
            invoiceDate,
            dueDate,
            totalAmount,
            0, // paid_amount
            'pending',
            `Auto-generated from booking - Provider: ${group.provider_name}`
          ]
        );

        const invoiceId = result.insertId;

        // Add line items
        for (const expense of group.expenses) {
          await query(
            `INSERT INTO invoice_payable_items (
              invoice_id,
              quote_expense_id,
              description,
              quantity,
              unit_price,
              total_price
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              invoiceId,
              expense.id,
              expense.description || expense.category,
              1,
              expense.price,
              expense.price
            ]
          );
        }

        payablesCount++;
      }
    }

    return NextResponse.json({
      success: true,
      payables_count: payablesCount,
      receivables_count: receivablesCount,
      message: `Generated ${payablesCount} payable and ${receivablesCount} receivable invoices`
    });
  } catch (error) {
    console.error('Error generating invoices:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoices' },
      { status: 500 }
    );
  }
}
