import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';
import { validateRefundOperation } from '@/middleware/currency-validation';
import { emailService } from '@/lib/email-brevo';

/**
 * POST /api/invoices/receivable/{id}/refund
 * Process refund for a customer invoice
 *
 * Body:
 * {
 *   "refund_amount": 10000, // minor units (cents)
 *   "refund_currency": "EUR",
 *   "refund_method": "bank_transfer" | "credit_card" | "original_method",
 *   "refund_reference": "REF-20251106-001",
 *   "refund_reason": "Booking cancellation",
 *   "cancellation_id": 123, // Optional: Link to booking_cancellations record
 *   "idempotency_key": "unique-key"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant and refund permission
    const authResult = await requirePermission(request, 'invoices', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (10 refund operations per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_refund`,
      10,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Refund rate limit exceeded. Try again in ${minutesLeft} minutes.`,
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
      const cachedResponse = await checkIdempotencyKeyDB(request, idempotencyKey, Number(tenantId));
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body = await request.json();
    const {
      refund_amount,
      refund_currency,
      refund_method,
      refund_reference,
      refund_reason,
      cancellation_id,
    } = body;

    // Validate required fields
    const validationErrors: any[] = [];

    if (!refund_amount || isNaN(Number(refund_amount)) || Number(refund_amount) <= 0) {
      validationErrors.push({
        field: 'refund_amount',
        issue: 'invalid',
        message: 'Refund amount must be a positive number (in minor units)',
      });
    }

    if (!refund_currency || typeof refund_currency !== 'string') {
      validationErrors.push({
        field: 'refund_currency',
        issue: 'required',
        message: 'Refund currency is required',
      });
    }

    if (!refund_method || typeof refund_method !== 'string') {
      validationErrors.push({
        field: 'refund_method',
        issue: 'required',
        message: 'Refund method is required',
      });
    }

    if (!refund_reason || typeof refund_reason !== 'string') {
      validationErrors.push({
        field: 'refund_reason',
        issue: 'required',
        message: 'Refund reason is required',
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse('Invalid request data', validationErrors, requestId);
    }

    // Get current invoice
    const [invoiceRows] = await query<any>(
      `SELECT * FROM invoices_receivable WHERE id = ? AND organization_id = ?`,
      [invoiceId, tenantId]
    );

    if (!invoiceRows || invoiceRows.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Receivable invoice with ID ${invoiceId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const invoice = invoiceRows[0];

    // Get total already refunded for this invoice
    const [refundRows] = await query<any>(
      `SELECT COALESCE(SUM(refund_amount), 0) as total_refunded
       FROM booking_cancellations
       WHERE booking_id = (SELECT booking_id FROM invoices_receivable WHERE id = ?)
         AND refund_status IN ('completed', 'processing')`,
      [invoiceId]
    );

    const alreadyRefunded = Number(refundRows[0]?.total_refunded || 0);

    // Validate refund operation
    const validation = validateRefundOperation({
      refundAmount: Number(refund_amount),
      refundCurrency: refund_currency,
      invoicePaidAmount: Number(invoice.paid_amount || 0),
      invoiceCurrency: invoice.currency || 'EUR',
      alreadyRefundedAmount: alreadyRefunded,
    });

    if (!validation.valid) {
      const response = standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        validation.error || 'Refund validation failed',
        400,
        undefined,
        requestId
      );

      // Store idempotency key even for validation errors
      if (idempotencyKey) {
        await storeIdempotencyKeyDB(
          idempotencyKey,
          response,
          Number(tenantId),
          user.userId,
          request
        );
      }

      return response;
    }

    // If cancellation_id provided, update that record. Otherwise, create new record
    let cancellationRecordId: number;

    if (cancellation_id) {
      // Update existing cancellation record
      await query(
        `UPDATE booking_cancellations
         SET refund_amount = ?,
             refund_status = 'processing',
             refund_method = ?,
             refund_reference = ?,
             refund_processed_by = ?,
             refund_notes = ?,
             updated_at = NOW()
         WHERE id = ? AND organization_id = ?`,
        [
          Number(refund_amount),
          refund_method,
          refund_reference || null,
          user.userId,
          refund_reason,
          cancellation_id,
          tenantId,
        ]
      );
      cancellationRecordId = Number(cancellation_id);
    } else {
      // Create new cancellation record for refund tracking
      const [result] = await query<any>(
        `INSERT INTO booking_cancellations (
          organization_id,
          booking_id,
          cancelled_by_user_id,
          cancellation_reason,
          refund_amount,
          refund_status,
          refund_method,
          refund_reference,
          refund_processed_by,
          refund_notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, NOW(), NOW())`,
        [
          tenantId,
          invoice.booking_id,
          user.userId,
          refund_reason,
          Number(refund_amount),
          refund_method,
          refund_reference || null,
          user.userId,
          refund_reason,
        ]
      );
      cancellationRecordId = result.insertId;
    }

    // Update invoice status if fully refunded
    const newPaidAmount = Number(invoice.paid_amount || 0) - Number(refund_amount);
    let newStatus = invoice.status;

    if (newPaidAmount <= 0) {
      newStatus = 'cancelled';
    } else if (newPaidAmount < Number(invoice.total_amount)) {
      newStatus = 'partial';
    }

    await query(
      `UPDATE invoices_receivable
       SET paid_amount = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [Math.max(0, newPaidAmount), newStatus, invoiceId]
    );

    // Send refund confirmation email
    try {
      await emailService.sendRefundConfirmation({
        organizationId: Number(tenantId),
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        refundAmount: Number(refund_amount),
        currency: refund_currency,
        refundReference: refund_reference || `REFUND-${cancellationRecordId}`,
        refundReason: refund_reason,
      });
    } catch (emailError: any) {
      console.error('Failed to send refund confirmation email:', emailError.message);
      // Don't fail the refund if email fails
    }

    // Fetch updated invoice
    const [updatedInvoiceRows] = await query<any>(
      `SELECT ir.*, q.quote_number
       FROM invoices_receivable ir
       LEFT JOIN quotes q ON ir.booking_id = q.id
       WHERE ir.id = ?`,
      [invoiceId]
    );

    const updatedInvoice = updatedInvoiceRows[0];

    // Format response with Money types
    const responseData = {
      success: true,
      invoice: {
        ...updatedInvoice,
        total_amount: createMoney(
          Number(updatedInvoice.total_amount),
          updatedInvoice.currency || 'EUR'
        ),
        paid_amount: createMoney(
          Number(updatedInvoice.paid_amount || 0),
          updatedInvoice.currency || 'EUR'
        ),
      },
      refund: {
        cancellation_id: cancellationRecordId,
        refund_amount: createMoney(Number(refund_amount), refund_currency),
        refund_method,
        refund_reference: refund_reference || `REFUND-${cancellationRecordId}`,
        refund_reason,
        refund_status: 'processing',
        processed_by: user.userId,
      },
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await storeIdempotencyKeyDB(
        idempotencyKey,
        NextResponse.json(responseData),
        Number(tenantId),
        user.userId,
        request
      );
    }

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      refund_amount: Number(refund_amount),
      cancellation_id: cancellationRecordId,
    });

    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    console.error('Error processing refund:', error);

    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to process refund',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * PATCH /api/invoices/receivable/{id}/refund/{cancellationId}/complete
 * Mark a refund as completed (after manual bank transfer confirmation)
 */
export async function PATCH(
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

    const body = await request.json();
    const { cancellation_id } = body;

    if (!cancellation_id) {
      return standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'cancellation_id is required',
        400,
        undefined,
        requestId
      );
    }

    // Update cancellation record to completed
    await query(
      `UPDATE booking_cancellations
       SET refund_status = 'completed',
           refund_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [cancellation_id, tenantId]
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      cancellation_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Refund marked as completed',
      cancellation_id,
    });
  } catch (error: any) {
    console.error('Error completing refund:', error);

    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to complete refund',
      500,
      undefined,
      requestId
    );
  }
}
