/**
 * Quotation Itinerary Sub-Resource
 * GET    /api/quotations/{id}/itinerary - Retrieve itinerary
 * PUT    /api/quotations/{id}/itinerary - Update itinerary
 *
 * Manages quote_days and quote_expenses as a nested itinerary structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

interface ItineraryDay {
  day_number: number;
  date: string;
  expenses: ItineraryExpense[];
}

interface ItineraryExpense {
  expense_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

/**
 * GET /api/quotations/{id}/itinerary
 * Retrieve the itinerary for a quotation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'quotations', 'read');
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

    const { id } = await params;
    const quotationId = parseInt(id, 10);

    if (isNaN(quotationId) || quotationId <= 0) {
      return validationErrorResponse(
        'Invalid quotation ID',
        [{ field: 'id', issue: 'invalid', message: 'Quotation ID must be a positive number' }],
        requestId
      );
    }

    // Check if quotation exists and belongs to user's organization
    const [quote] = await query<any>(
      'SELECT id, quote_number, status FROM quotes WHERE id = ? AND organization_id = ?',
      [quotationId, parseInt(tenantId)]
    );

    if (!quote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Quotation with ID ${quotationId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Fetch days and expenses in a single optimized query
    const daysWithExpenses = await query<any>(
      `SELECT
        d.id as day_id,
        d.day_number,
        d.date,
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
      [quotationId]
    );

    // Group expenses by day
    const daysMap = new Map();
    for (const row of daysWithExpenses) {
      if (!daysMap.has(row.day_id)) {
        daysMap.set(row.day_id, {
          id: row.day_id,
          day_number: row.day_number,
          date: row.date,
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

    const itinerary = {
      quote_id: quotationId,
      quote_number: quote.quote_number,
      status: quote.status,
      days: Array.from(daysMap.values()),
      total_days: daysMap.size,
      total_expenses: daysWithExpenses.filter(row => row.expense_id).length
    };

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quotation_id: quotationId,
      days_count: itinerary.total_days,
      expenses_count: itinerary.total_expenses,
    });

    const response = NextResponse.json(itinerary);
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch itinerary',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * PUT /api/quotations/{id}/itinerary
 * Update the entire itinerary (replaces all days and expenses)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'quotations', 'update');
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

    const { id } = await params;
    const quotationId = parseInt(id, 10);

    if (isNaN(quotationId) || quotationId <= 0) {
      return validationErrorResponse(
        'Invalid quotation ID',
        [{ field: 'id', issue: 'invalid', message: 'Quotation ID must be a positive number' }],
        requestId
      );
    }

    // Parse request body
    const body = await request.json();
    const { days } = body as { days: ItineraryDay[] };

    // Validation
    if (!Array.isArray(days)) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'days', issue: 'required', message: 'days must be an array' }],
        requestId
      );
    }

    // Validate each day
    const validationErrors: Array<{ field: string; issue: string; message: string }> = [];

    days.forEach((day, index) => {
      if (typeof day.day_number !== 'number' || day.day_number < 1) {
        validationErrors.push({
          field: `days[${index}].day_number`,
          issue: 'invalid',
          message: 'day_number must be a positive number'
        });
      }

      if (!day.date || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
        validationErrors.push({
          field: `days[${index}].date`,
          issue: 'invalid',
          message: 'date must be in YYYY-MM-DD format'
        });
      }

      if (!Array.isArray(day.expenses)) {
        validationErrors.push({
          field: `days[${index}].expenses`,
          issue: 'invalid',
          message: 'expenses must be an array'
        });
      } else {
        day.expenses.forEach((expense, expIndex) => {
          if (!expense.expense_type || expense.expense_type.trim() === '') {
            validationErrors.push({
              field: `days[${index}].expenses[${expIndex}].expense_type`,
              issue: 'required',
              message: 'expense_type is required'
            });
          }

          if (!expense.description || expense.description.trim() === '') {
            validationErrors.push({
              field: `days[${index}].expenses[${expIndex}].description`,
              issue: 'required',
              message: 'description is required'
            });
          }

          if (typeof expense.quantity !== 'number' || expense.quantity < 0) {
            validationErrors.push({
              field: `days[${index}].expenses[${expIndex}].quantity`,
              issue: 'invalid',
              message: 'quantity must be a non-negative number'
            });
          }

          if (typeof expense.unit_price !== 'number' || expense.unit_price < 0) {
            validationErrors.push({
              field: `days[${index}].expenses[${expIndex}].unit_price`,
              issue: 'invalid',
              message: 'unit_price must be a non-negative number'
            });
          }

          if (typeof expense.total_price !== 'number' || expense.total_price < 0) {
            validationErrors.push({
              field: `days[${index}].expenses[${expIndex}].total_price`,
              issue: 'invalid',
              message: 'total_price must be a non-negative number'
            });
          }
        });
      }
    });

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid itinerary data',
        validationErrors,
        requestId
      );
    }

    // Check if quotation exists and belongs to user's organization
    const [quote] = await query<any>(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [quotationId, parseInt(tenantId)]
    );

    if (!quote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Quotation with ID ${quotationId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Update itinerary in a transaction
    await transaction(async (conn) => {
      // Delete existing days and expenses (cascading delete)
      await conn.query('DELETE FROM quote_days WHERE quote_id = ?', [quotationId]);

      // Insert new days and expenses
      for (const day of days) {
        const [dayResult] = await conn.query(
          'INSERT INTO quote_days (quote_id, day_number, date, created_at) VALUES (?, ?, ?, NOW())',
          [quotationId, day.day_number, day.date]
        );

        const dayId = (dayResult as any).insertId;

        // Insert expenses for this day
        for (const expense of day.expenses) {
          await conn.query(
            `INSERT INTO quote_expenses (
              quote_day_id, expense_type, description, quantity,
              unit_price, total_price, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              dayId,
              expense.expense_type,
              expense.description,
              expense.quantity,
              expense.unit_price,
              expense.total_price,
              expense.notes || null
            ]
          );
        }
      }

      // Calculate new total price
      const totalPrice = days.reduce((sum, day) =>
        sum + day.expenses.reduce((daySum, exp) => daySum + exp.total_price, 0),
        0
      );

      // Update quotation total
      await conn.query(
        'UPDATE quotes SET total_price = ?, updated_at = NOW() WHERE id = ?',
        [totalPrice, quotationId]
      );
    });

    // Audit log
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      quotationId.toString(),
      {
        itinerary_updated: true,
        days_count: days.length,
        total_expenses: days.reduce((sum, day) => sum + day.expenses.length, 0),
      },
      {
        quote_number: quote.quote_number,
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quotation_id: quotationId,
      days_updated: days.length,
    });

    const response = NextResponse.json({
      success: true,
      quote_id: quotationId,
      days_count: days.length,
      expenses_count: days.reduce((sum, day) => sum + day.expenses.length, 0),
      message: 'Itinerary updated successfully'
    });
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update itinerary',
      500,
      undefined,
      requestId
    );
  }
}
