import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundProblem,
  badRequestProblem,
  internalServerErrorProblem,
} from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

// GET - Fetch a single payable invoice with items and Money types
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const invoiceId = id;

    // Validate ID
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return errorResponse(
        badRequestProblem('Invalid invoice ID', `/api/invoices/payable/${invoiceId}`)
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
      return errorResponse(
        notFoundProblem(`Payable invoice with ID ${invoiceId} not found`, `/api/invoices/payable/${invoiceId}`)
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

    return successResponse(invoiceWithMoney);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch payable invoice', `/api/invoices/payable/${id}`)
    );
  }
}

// PATCH - Update payable invoice (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const invoiceId = id;

    // Validate ID
    if (!invoiceId || isNaN(parseInt(invoiceId))) {
      return errorResponse(
        badRequestProblem('Invalid invoice ID', `/api/invoices/payable/${invoiceId}`)
      );
    }

    // Check if invoice exists
    const [existingInvoice] = await query(
      'SELECT id FROM invoices_payable WHERE id = ?',
      [invoiceId]
    ) as any[];

    if (!existingInvoice) {
      return errorResponse(
        notFoundProblem(`Payable invoice with ID ${invoiceId} not found`, `/api/invoices/payable/${invoiceId}`)
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
      return errorResponse(
        badRequestProblem('No valid fields to update', `/api/invoices/payable/${invoiceId}`)
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

    return successResponse(invoiceWithMoney);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update payable invoice', `/api/invoices/payable/${id}`)
    );
  }
}
