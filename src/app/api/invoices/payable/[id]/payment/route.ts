import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundProblem,
  badRequestProblem,
  conflictProblem,
  internalServerErrorProblem,
} from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

// POST - Record payment for payable invoice with idempotency and overpayment check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const invoiceId = id;

    // Validate ID
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return errorResponse(
        badRequestProblem('Invalid invoice ID', `/api/invoices/payable/${invoiceId}/payment`)
      );
    }

    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const { checkIdempotencyKey, storeIdempotencyKey } = await import('@/middleware/idempotency');
      const cachedResponse = await checkIdempotencyKey(request, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();
    const { payment_amount, payment_date, payment_method, payment_reference, notes } = body;

    // Validate payment amount
    if (!payment_amount || isNaN(Number(payment_amount)) || Number(payment_amount) <= 0) {
      return errorResponse(
        badRequestProblem('Invalid payment amount', `/api/invoices/payable/${invoiceId}/payment`)
      );
    }

    // Get current invoice
    const [invoice] = await query(
      'SELECT * FROM invoices_payable WHERE id = ?',
      [invoiceId]
    ) as any[];

    if (!invoice) {
      return errorResponse(
        notFoundProblem(`Payable invoice with ID ${invoiceId} not found`, `/api/invoices/payable/${invoiceId}/payment`)
      );
    }

    const currentPaidAmount = Number(invoice.paid_amount || 0);
    const totalAmount = Number(invoice.total_amount);
    const newPaidAmount = currentPaidAmount + Number(payment_amount);

    // Check for overpayment
    if (newPaidAmount > totalAmount) {
      const response = errorResponse(
        conflictProblem(
          `Payment of ${payment_amount} would result in overpayment. Total: ${totalAmount}, Already paid: ${currentPaidAmount}, Maximum allowed: ${totalAmount - currentPaidAmount}`,
          `/api/invoices/payable/${invoiceId}/payment`
        )
      );

      // Store idempotency key even for conflict errors
      if (idempotencyKey) {
        const { storeIdempotencyKey } = await import('@/middleware/idempotency');
        storeIdempotencyKey(idempotencyKey, response);
      }

      return response;
    }

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
        invoiceId
      ]
    );

    // Fetch updated invoice
    const [updatedInvoice] = await query(
      `SELECT ip.*, p.provider_name, q.quote_number, q.customer_name
       FROM invoices_payable ip
       LEFT JOIN providers p ON ip.provider_id = p.id
       LEFT JOIN quotes q ON ip.booking_id = q.id
       WHERE ip.id = ?`,
      [invoiceId]
    ) as any[];

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...updatedInvoice,
      total_amount: updatedInvoice.total_amount ? createMoney(Number(updatedInvoice.total_amount), updatedInvoice.currency || 'EUR') : null,
      paid_amount: updatedInvoice.paid_amount ? createMoney(Number(updatedInvoice.paid_amount), updatedInvoice.currency || 'EUR') : null,
      payment_amount: createMoney(Number(payment_amount), updatedInvoice.currency || 'EUR'),
    };

    const response = successResponse(invoiceWithMoney);

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKey } = await import('@/middleware/idempotency');
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to record payment', `/api/invoices/payable/${id}/payment`)
    );
  }
}
