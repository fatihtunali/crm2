import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { Money } from '@/types/api';
import {
  successResponse,
  errorResponse,
  notFoundProblem,
  internalServerErrorProblem,
} from '@/lib/response';

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get quote
    const [quote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!quote) {
      return errorResponse(notFoundProblem('Quote not found', `/api/quotations/${id}`));
    }

    // Get days
    const days = await query(
      'SELECT * FROM quote_days WHERE quote_id = ? ORDER BY day_number',
      [id]
    ) as any[];

    // Get expenses for each day
    for (const day of days) {
      day.expenses = await query(
        'SELECT * FROM quote_expenses WHERE quote_day_id = ? ORDER BY id',
        [day.id]
      );
    }

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

    return successResponse(responseQuote);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch quotation')
    );
  }
}

// PATCH - Partially update quotation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if quote exists
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!existingQuote) {
      return errorResponse(notFoundProblem('Quote not found', `/api/quotations/${id}`));
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
      return successResponse(existingQuote);
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

    return successResponse(updatedQuote);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update quotation')
    );
  }
}
