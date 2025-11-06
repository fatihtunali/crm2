import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';
import { validatePaymentOperation } from '@/middleware/currency-validation';
import { emailService } from '@/lib/email-brevo';

// POST - Record payment for receivable invoice with idempotency and overpayment check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (20 payment operations per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_payment`,
      20,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Payment rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    const invoiceId = id;

    // Validate ID
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid invoice ID',
        400,
        undefined,
        requestId
      );
    }

    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const { checkIdempotencyKey, storeIdempotencyKey } = await import('@/middleware/idempotency');
      const cachedResponse = await checkIdempotencyKeyDB(request, idempotencyKey, Number(tenantId));
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();
    const { payment_amount, payment_currency, payment_date, payment_method, payment_reference, notes } = body;

    // Validate payment amount
    if (!payment_amount || isNaN(Number(payment_amount)) || Number(payment_amount) <= 0) {
      return validationErrorResponse(
        'Invalid request data',
        [{
          field: 'payment_amount',
          issue: 'invalid',
          message: 'Payment amount must be a positive number'
        }],
        requestId
      );
    }

    // Get current invoice
    const [invoice] = await query(
      'SELECT * FROM invoices_receivable WHERE id = ? AND organization_id = ?',
      [invoiceId, tenantId]
    ) as any[];

    if (!invoice) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Receivable invoice with ID ${invoiceId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const currentPaidAmount = Number(invoice.paid_amount || 0);
    const totalAmount = Number(invoice.total_amount);
    const invoiceCurrency = invoice.currency || 'EUR';
    const paymentCurrency = payment_currency || invoiceCurrency;

    // Validate payment operation (currency match, amount, overpayment)
    const validation = validatePaymentOperation({
      paymentAmount: Number(payment_amount),
      paymentCurrency: paymentCurrency,
      invoiceTotalAmount: totalAmount,
      invoicePaidAmount: currentPaidAmount,
      invoiceCurrency: invoiceCurrency,
    });

    if (!validation.valid) {
      const response = standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        validation.error || 'Payment validation failed',
        400,
        undefined,
        requestId
      );

      // Store idempotency key even for validation errors
      if (idempotencyKey) {
        const { storeIdempotencyKeyDB } = await import('@/middleware/idempotency-db');
        await storeIdempotencyKeyDB(idempotencyKey, response, Number(tenantId), user.userId, request);
      }

      return response;
    }

    const newPaidAmount = currentPaidAmount + Number(payment_amount);

    // Determine new status
    let newStatus = 'sent';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    // Update invoice
    await query(
      `UPDATE invoices_receivable
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

    // Insert into invoice_payments table for detailed history
    await query(
      `INSERT INTO invoice_payments (
        organization_id,
        invoice_type,
        invoice_id,
        payment_amount,
        payment_currency,
        payment_method,
        payment_reference,
        payment_date,
        payment_notes,
        processed_by,
        created_at,
        updated_at
      ) VALUES (?, 'receivable', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        invoiceId,
        Number(payment_amount).toFixed(2),
        paymentCurrency,
        payment_method,
        payment_reference,
        payment_date,
        notes,
        user.userId,
      ]
    );

    // Send payment receipt email
    try {
      await emailService.sendPaymentReceipt({
        organizationId: Number(tenantId),
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        amount: Number(payment_amount),
        currency: paymentCurrency,
        paymentReference: payment_reference || `PAY-${Date.now()}`,
        paymentDate: payment_date || new Date().toISOString().split('T')[0],
        paymentMethod: payment_method,
      });
    } catch (emailError: any) {
      console.error('Failed to send payment receipt email:', emailError.message);
      // Don't fail the payment if email fails
    }

    // Fetch updated invoice
    const [updatedInvoice] = await query(
      `SELECT ir.*, q.quote_number
       FROM invoices_receivable ir
       LEFT JOIN quotes q ON ir.booking_id = q.id
       WHERE ir.id = ?`,
      [invoiceId]
    ) as any[];

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...updatedInvoice,
      total_amount: updatedInvoice.total_amount ? createMoney(Number(updatedInvoice.total_amount), updatedInvoice.currency || 'EUR') : null,
      paid_amount: updatedInvoice.paid_amount ? createMoney(Number(updatedInvoice.paid_amount), updatedInvoice.currency || 'EUR') : null,
      payment_amount: createMoney(Number(payment_amount), updatedInvoice.currency || 'EUR'),
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      const { storeIdempotencyKeyDB } = await import('@/middleware/idempotency-db');
      await storeIdempotencyKeyDB(idempotencyKey, NextResponse.json(invoiceWithMoney), Number(tenantId), user.userId, request);
    }

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      payment_amount: Number(payment_amount),
    });

    const response = NextResponse.json(invoiceWithMoney);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to record payment',
      500,
      undefined,
      requestId
    );
  }
}
