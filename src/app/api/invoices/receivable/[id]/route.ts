import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundProblem,
  badRequestProblem,
  internalServerErrorProblem,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { createMoney } from '@/lib/money';

// GET - Fetch a single receivable invoice with Money types
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const invoiceId = id;

    // Validate ID
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return errorResponse(
        badRequestProblem('Invalid invoice ID', `/api/invoices/receivable/${invoiceId}`)
      );
    }

    // Get invoice details
    const [invoice] = await query(
      `SELECT
        ir.*,
        q.quote_number
      FROM invoices_receivable ir
      LEFT JOIN quotes q ON ir.booking_id = q.id
      WHERE ir.id = ?
      LIMIT 1`,
      [invoiceId]
    ) as any[];

    if (!invoice) {
      return errorResponse(
        notFoundProblem(`Receivable invoice with ID ${invoiceId} not found`, `/api/invoices/receivable/${invoiceId}`)
      );
    }

    // Convert money fields to Money type
    const invoiceWithMoney = {
      ...invoice,
      total_amount: invoice.total_amount ? createMoney(Number(invoice.total_amount), invoice.currency || 'EUR') : null,
      paid_amount: invoice.paid_amount ? createMoney(Number(invoice.paid_amount), invoice.currency || 'EUR') : null,
    };

    return successResponse(invoiceWithMoney);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch receivable invoice', `/api/invoices/receivable/${id}`)
    );
  }
}

// PATCH - Update receivable invoice (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'invoices', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const invoiceId = id;

    // Validate ID
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return errorResponse(
        badRequestProblem('Invalid invoice ID', `/api/invoices/receivable/${invoiceId}`)
      );
    }

    // Check if invoice exists
    const [existingInvoice] = await query(
      'SELECT id FROM invoices_receivable WHERE id = ?',
      [invoiceId]
    ) as any[];

    if (!existingInvoice) {
      return errorResponse(
        notFoundProblem(`Receivable invoice with ID ${invoiceId} not found`, `/api/invoices/receivable/${invoiceId}`)
      );
    }

    const body = await request.json();

    // Build dynamic update query for partial updates
    const allowedFields = [
      'booking_id',
      'invoice_number',
      'customer_name',
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
      return errorResponse(
        badRequestProblem('No valid fields to update', `/api/invoices/receivable/${invoiceId}`)
      );
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add invoice ID to values for WHERE clause
    values.push(invoiceId);

    await query(
      `UPDATE invoices_receivable SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch and return the updated invoice
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
    };

    return successResponse(invoiceWithMoney);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update receivable invoice', `/api/invoices/receivable/${id}`)
    );
  }
}
