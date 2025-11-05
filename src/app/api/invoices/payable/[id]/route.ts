import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';

// GET - Fetch a single payable invoice with items and Money types
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (100 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      100,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
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

    // Get invoice details
    const [invoice] = await query(
      `SELECT
        ip.*,
        p.provider_name,
        q.quote_number,
        q.customer_name
      FROM invoices_payable ip
      LEFT JOIN providers p ON ip.provider_id = p.id
      LEFT JOIN quotes q ON ip.booking_id = q.id
      WHERE ip.id = ?
      LIMIT 1`,
      [invoiceId]
    ) as any[];

    if (!invoice) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Payable invoice with ID ${invoiceId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Get invoice items
    const items = await query(
      `SELECT * FROM invoice_payable_items WHERE invoice_id = ?`,
      [invoiceId]
    ) as any[];

    // Convert money fields to Money type for items
    const itemsWithMoney = items.map(item => ({
      ...item,
      unit_price: item.unit_price ? createMoney(Number(item.unit_price), invoice.currency || 'EUR') : null,
      total_price: item.total_price ? createMoney(Number(item.total_price), invoice.currency || 'EUR') : null,
    }));

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...invoice,
      total_amount: invoice.total_amount ? createMoney(Number(invoice.total_amount), invoice.currency || 'EUR') : null,
      paid_amount: invoice.paid_amount ? createMoney(Number(invoice.paid_amount), invoice.currency || 'EUR') : null,
      items: itemsWithMoney,
    };

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
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
      'Failed to fetch payable invoice',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH - Update payable invoice (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (50 updates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_update`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Update rate limit exceeded. Try again in ${minutesLeft} minutes.`,
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

    // Check if invoice exists
    const [existingInvoice] = await query(
      'SELECT id FROM invoices_payable WHERE id = ?',
      [invoiceId]
    ) as any[];

    if (!existingInvoice) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Payable invoice with ID ${invoiceId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const body = await request.json();

    // Build dynamic update query for partial updates
    const allowedFields = [
      'booking_id',
      'provider_id',
      'invoice_number',
      'supplier_invoice_number',
      'invoice_date',
      'due_date',
      'total_amount',
      'currency',
      'paid_amount',
      'payment_date',
      'payment_method',
      'payment_reference',
      'status',
      'notes',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No valid fields to update',
        400,
        undefined,
        requestId
      );
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add invoice ID to values for WHERE clause
    values.push(invoiceId);

    await query(
      `UPDATE invoices_payable SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch and return the updated invoice
    const [updatedInvoice] = await query(
      `SELECT ip.*, p.provider_name, q.quote_number, q.customer_name
       FROM invoices_payable ip
       LEFT JOIN providers p ON ip.provider_id = p.id
       LEFT JOIN quotes q ON ip.booking_id = q.id
       WHERE ip.id = ?`,
      [invoiceId]
    ) as any[];

    // Get invoice items
    const items = await query(
      `SELECT * FROM invoice_payable_items WHERE invoice_id = ?`,
      [invoiceId]
    ) as any[];

    // Convert money fields to Money type for items
    const itemsWithMoney = items.map(item => ({
      ...item,
      unit_price: item.unit_price ? createMoney(Number(item.unit_price), updatedInvoice.currency || 'EUR') : null,
      total_price: item.total_price ? createMoney(Number(item.total_price), updatedInvoice.currency || 'EUR') : null,
    }));

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...updatedInvoice,
      total_amount: updatedInvoice.total_amount ? createMoney(Number(updatedInvoice.total_amount), updatedInvoice.currency || 'EUR') : null,
      paid_amount: updatedInvoice.paid_amount ? createMoney(Number(updatedInvoice.paid_amount), updatedInvoice.currency || 'EUR') : null,
      items: itemsWithMoney,
    };

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
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
      'Failed to update payable invoice',
      500,
      undefined,
      requestId
    );
  }
}
