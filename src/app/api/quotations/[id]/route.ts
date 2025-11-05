import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { Money } from '@/types/api';
import {
  standardErrorResponse,
  notFoundErrorResponse,
  ErrorCodes
} from '@/lib/response';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { requirePermission } from '@/middleware/permissions';

/**
 * Convert a decimal string price to Money type
 * Assumes 2 decimal places (e.g., "100.50" -> 10050 minor units)
 */
function convertToMoney(price: string | null, currency: string = 'USD'): Money | null {
  if (!price) return null;

  const amount = parseFloat(price);
  if (isNaN(amount)) return null;

  // Convert to minor units (cents)
  const amount_minor = Math.round(amount * 100);

  return {
    amount_minor,
    currency,
  };
}

// GET - Fetch single quotation with days and expenses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // Get quote
    const [quote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!quote) {
      return notFoundErrorResponse(`Quote ${id} not found`, requestId);
    }

    // Get days and expenses in a single query with JOIN (optimized - no N+1)
    const daysWithExpenses = await query(
      `SELECT
        d.id as day_id,
        d.quote_id,
        d.day_number,
        d.date as day_date,
        d.created_at as day_created_at,
        e.id as expense_id,
        e.expense_type,
        e.description,
        e.quantity,
        e.unit_price,
        e.total_price,
        e.notes
      FROM quote_days d
      LEFT JOIN quote_expenses e ON d.id = e.quote_day_id
      WHERE d.quote_id = ?
      ORDER BY d.day_number, e.id`,
      [id]
    ) as any[];

    // Group expenses by day
    const daysMap = new Map();
    for (const row of daysWithExpenses) {
      if (!daysMap.has(row.day_id)) {
        daysMap.set(row.day_id, {
          id: row.day_id,
          quote_id: row.quote_id,
          day_number: row.day_number,
          date: row.day_date,
          created_at: row.day_created_at,
          expenses: []
        });
      }

      // Add expense if it exists (LEFT JOIN may have null expenses)
      if (row.expense_id) {
        daysMap.get(row.day_id).expenses.push({
          id: row.expense_id,
          expense_type: row.expense_type,
          description: row.description,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price,
          notes: row.notes
        });
      }
    }

    // Convert map to array
    const days = Array.from(daysMap.values());

    // Convert total_price to Money type if it exists
    const responseQuote = {
      ...quote,
      days,
    };

    if (quote.total_price) {
      responseQuote.total_price_money = convertToMoney(
        quote.total_price,
        quote.currency || 'USD'
      );
    }

    logResponse(requestId, 200, Date.now() - startTime, {
      quotation_id: id,
      days_count: days.length,
    });

    const response = NextResponse.json(responseQuote);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch quotation',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH - Partially update quotation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // Check if quote exists
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!existingQuote) {
      return notFoundErrorResponse(`Quote ${id} not found`, requestId);
    }

    const body = await request.json();

    // Allowed fields for partial update
    const allowedFields = [
      'quote_name',
      'category',
      'customer_name',
      'customer_email',
      'customer_phone',
      'destination',
      'start_date',
      'end_date',
      'tour_type',
      'pax',
      'adults',
      'children',
      'markup',
      'tax',
      'transport_pricing_mode',
      'season_name',
      'valid_from',
      'valid_to',
      'status',
      'total_price',
      'pricing_table',
    ];

    // Build dynamic UPDATE query based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    for (const field of allowedFields) {
      if (body.hasOwnProperty(field)) {
        updateFields.push(`${field} = ?`);

        // Handle JSON fields
        if (field === 'pricing_table' && body[field] !== null) {
          updateValues.push(JSON.stringify(body[field]));
        } else {
          updateValues.push(body[field]);
        }
      }
    }

    // If no fields to update, return current quote
    if (updateFields.length === 0) {
      logResponse(requestId, 200, Date.now() - startTime, {
        quotation_id: id,
        no_updates: true,
      });

      const response = NextResponse.json(existingQuote);
      response.headers.set('X-Request-Id', requestId);
      return response;
    }

    // Add id to the end of params
    updateValues.push(id);

    // Execute update
    await query(
      `UPDATE quotes SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Fetch updated quote
    const [updatedQuote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    // Convert total_price to Money type if it exists
    if (updatedQuote.total_price) {
      updatedQuote.total_price_money = convertToMoney(
        updatedQuote.total_price,
        updatedQuote.currency || 'USD'
      );
    }

    logResponse(requestId, 200, Date.now() - startTime, {
      quotation_id: id,
      fields_updated: updateFields.length,
    });

    const response = NextResponse.json(updatedQuote);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update quotation',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Delete quotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // RBAC: Check if user has delete permission for quotations
    const authResult = await requirePermission(request, 'quotations', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user, tenantId } = authResult;

    // Check if quote exists and belongs to user's organization
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    ) as any[];

    if (!existingQuote) {
      return notFoundErrorResponse(`Quote ${id} not found`, requestId);
    }

    // Delete the quote (cascading deletes will handle quote_days and quote_expenses)
    await query('DELETE FROM quotes WHERE id = ? AND organization_id = ?', [
      id,
      tenantId,
    ]);

    logResponse(requestId, 204, Date.now() - startTime, {
      quotation_id: id,
      deleted_by: user.userId,
    });

    return new NextResponse(null, {
      status: 204,
      headers: {
        'X-Request-Id': requestId,
      },
    });
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete quotation',
      500,
      undefined,
      requestId
    );
  }
}
