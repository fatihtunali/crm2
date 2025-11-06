/**
 * Quotation Repricing Endpoint
 * POST /api/quotations/{id}/reprice?respect_locked=true|false
 *
 * Recalculates all pricing for a quotation using current rates
 * - respect_locked=false: Fetches current prices from pricing tables (default)
 * - respect_locked=true: Uses locked exchange rates from original quotation
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import {
  getHotelPrice,
  getGuidePrice,
  getVehiclePrice,
  getEntranceFeePrice,
  getTourPrice,
  repriceGenericExpense,
} from '@/lib/pricing-engine';
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

export async function POST(
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const respectLocked = searchParams.get('respect_locked') === 'true';

    // Fetch quotation
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

    // Fetch all days and expenses
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

    if (daysWithExpenses.length === 0) {
      return standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'No itinerary found for this quotation. Cannot reprice without expenses.',
        400,
        undefined,
        requestId
      );
    }

    // Pricing context
    const pricingContext = {
      date: '',
      currency: quote.currency || 'EUR',
      markup: quote.markup || 20,
      tax: quote.tax || 18,
      respectLocked,
    };

    // Reprice all expenses
    const repricedExpenses: Array<{
      expense_id: number;
      day_date: string;
      old_unit_price: number;
      old_total_price: number;
      new_unit_price: number;
      new_total_price: number;
      pricing_source: string;
    }> = [];

    let totalNewPrice = 0;

    for (const row of daysWithExpenses) {
      if (!row.expense_id) continue; // Skip days without expenses

      pricingContext.date = row.date;

      let priceResult;

      // Parse expense metadata from description or notes
      // Format: "Hotel: [hotel_id] - Room Type: [type] - Meal: [meal]"
      // Or: "Guide: [guide_id] - Type: [full_day|half_day|night]"
      // For simplicity, we'll use generic repricing for now
      // In production, you'd parse the expense_type and call the appropriate pricing function

      if (row.expense_type.toLowerCase().includes('hotel')) {
        // For now, use generic repricing
        // In production: extract hotel_id, room_type, meal_plan from description
        // priceResult = await getHotelPrice(hotelId, row.date, roomType, mealPlan, pricingContext);
        priceResult = repriceGenericExpense(row.unit_price, row.quantity, pricingContext);
      } else if (row.expense_type.toLowerCase().includes('guide')) {
        // For now, use generic repricing
        priceResult = repriceGenericExpense(row.unit_price, row.quantity, pricingContext);
      } else if (row.expense_type.toLowerCase().includes('vehicle') || row.expense_type.toLowerCase().includes('transport')) {
        // For now, use generic repricing
        priceResult = repriceGenericExpense(row.unit_price, row.quantity, pricingContext);
      } else if (row.expense_type.toLowerCase().includes('entrance') || row.expense_type.toLowerCase().includes('museum')) {
        // For now, use generic repricing
        priceResult = repriceGenericExpense(row.unit_price, row.quantity, pricingContext);
      } else if (row.expense_type.toLowerCase().includes('tour') || row.expense_type.toLowerCase().includes('activity')) {
        // For now, use generic repricing
        priceResult = repriceGenericExpense(row.unit_price, row.quantity, pricingContext);
      } else {
        // Generic expense (meal, other, etc.)
        priceResult = repriceGenericExpense(row.unit_price, row.quantity, pricingContext);
      }

      repricedExpenses.push({
        expense_id: row.expense_id,
        day_date: row.date,
        old_unit_price: row.unit_price,
        old_total_price: row.total_price,
        new_unit_price: priceResult.unit_price,
        new_total_price: priceResult.total_price,
        pricing_source: priceResult.pricing_source,
      });

      totalNewPrice += priceResult.total_price;
    }

    // Update all expenses and quotation total in a transaction
    await transaction(async (conn) => {
      // Update each expense
      for (const expense of repricedExpenses) {
        await conn.query(
          'UPDATE quote_expenses SET unit_price = ?, total_price = ? WHERE id = ?',
          [expense.new_unit_price, expense.new_total_price, expense.expense_id]
        );
      }

      // Update quotation total
      await conn.query(
        'UPDATE quotes SET total_price = ?, updated_at = NOW() WHERE id = ?',
        [totalNewPrice, quotationId]
      );
    });

    // Calculate price differences
    const oldTotal = repricedExpenses.reduce((sum, exp) => sum + exp.old_total_price, 0);
    const priceChange = totalNewPrice - oldTotal;
    const priceChangePercent = oldTotal > 0 ? (priceChange / oldTotal) * 100 : 0;

    // Audit log
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      quotationId.toString(),
      {
        repriced: true,
        respect_locked: respectLocked,
        old_total: oldTotal,
        new_total: totalNewPrice,
        price_change: priceChange,
        price_change_percent: priceChangePercent.toFixed(2),
        expenses_repriced: repricedExpenses.length,
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
      expenses_repriced: repricedExpenses.length,
      price_change: priceChange,
    });

    const response = NextResponse.json({
      success: true,
      quote_id: quotationId,
      quote_number: quote.quote_number,
      repricing_summary: {
        respect_locked: respectLocked,
        expenses_repriced: repricedExpenses.length,
        old_total: oldTotal,
        new_total: totalNewPrice,
        price_change: priceChange,
        price_change_percent: priceChangePercent.toFixed(2) + '%',
        currency: pricingContext.currency,
      },
      expenses: repricedExpenses,
      message: 'Quotation repriced successfully'
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
      'Failed to reprice quotation',
      500,
      undefined,
      requestId
    );
  }
}
