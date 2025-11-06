/**
 * Duplicate Quotation Endpoint
 * POST /api/quotations/{id}/duplicate
 *
 * Creates a copy of an existing quotation with all days and expenses
 * Allows optional modifications via request body
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

interface DuplicateQuotationRequest {
  // Optional modifications to apply to the duplicated quote
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  pax?: number;
  adults?: number;
  children?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'quotations', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (50 creates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_create`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Creation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    const { id } = await params;
    const quotationId = parseInt(id, 10);

    // Validate ID
    if (isNaN(quotationId) || quotationId <= 0) {
      return validationErrorResponse(
        'Invalid quotation ID',
        [{ field: 'id', issue: 'invalid', message: 'Quotation ID must be a positive number' }],
        requestId
      );
    }

    // 3. Parse optional modifications
    const modifications: DuplicateQuotationRequest = await request.json().catch(() => ({}));

    // 4. Fetch original quotation with all related data
    const [originalQuote] = await query<any>(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [quotationId, parseInt(tenantId)]
    );

    if (!originalQuote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Quotation with ID ${quotationId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 5. Fetch all days and expenses
    const quoteDays = await query<any>(
      'SELECT * FROM quote_days WHERE quote_id = ? ORDER BY day_number',
      [quotationId]
    );

    const quoteExpenses = await query<any>(
      'SELECT * FROM quote_expenses WHERE quote_day_id IN (SELECT id FROM quote_days WHERE quote_id = ?)',
      [quotationId]
    );

    // 6. Create duplicate in a transaction
    const newQuote = await transaction(async (conn) => {
      // Generate new quote number
      const [lastQuote] = await conn.query(
        'SELECT quote_number FROM quotes ORDER BY id DESC LIMIT 1'
      ) as any[];

      let nextNumber = 1;
      if (lastQuote && lastQuote[0]?.quote_number) {
        const match = lastQuote[0].quote_number.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      const newQuoteNumber = `Q-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

      // Prepare new quote data
      const newQuoteData = {
        organization_id: parseInt(tenantId),
        created_by_user_id: user.userId,
        quote_number: newQuoteNumber,
        category: originalQuote.category,
        customer_name: modifications.customer_name || originalQuote.customer_name,
        customer_email: modifications.customer_email || originalQuote.customer_email,
        customer_phone: modifications.customer_phone || originalQuote.customer_phone,
        destination: modifications.destination || originalQuote.destination,
        start_date: modifications.start_date || originalQuote.start_date,
        end_date: modifications.end_date || originalQuote.end_date,
        tour_type: originalQuote.tour_type,
        pax: modifications.pax ?? originalQuote.pax,
        adults: modifications.adults ?? originalQuote.adults,
        children: modifications.children ?? originalQuote.children,
        markup: originalQuote.markup,
        tax: originalQuote.tax,
        transport_pricing_mode: originalQuote.transport_pricing_mode,
        season_name: originalQuote.season_name,
        valid_from: null, // Reset validity dates
        valid_to: null,
        status: 'draft', // Always start as draft
        total_price: originalQuote.total_price,
        pricing_table: originalQuote.pricing_table,
      };

      // Insert new quote
      const insertFields = Object.keys(newQuoteData);
      const insertValues = Object.values(newQuoteData);
      const placeholders = insertValues.map(() => '?').join(', ');

      const [insertResult] = await conn.query(
        `INSERT INTO quotes (${insertFields.join(', ')}) VALUES (${placeholders})`,
        insertValues
      );

      const newQuoteId = (insertResult as any).insertId;

      // Copy all quote days
      const dayIdMap = new Map(); // Map old day IDs to new day IDs

      for (const day of quoteDays) {
        const [dayInsertResult] = await conn.query(
          `INSERT INTO quote_days (quote_id, day_number, date, created_at)
           VALUES (?, ?, ?, NOW())`,
          [newQuoteId, day.day_number, day.date]
        );

        const newDayId = (dayInsertResult as any).insertId;
        dayIdMap.set(day.id, newDayId);
      }

      // Copy all expenses
      for (const expense of quoteExpenses) {
        const newDayId = dayIdMap.get(expense.quote_day_id);
        if (newDayId) {
          await conn.query(
            `INSERT INTO quote_expenses (
              quote_day_id, expense_type, description, quantity,
              unit_price, total_price, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              newDayId,
              expense.expense_type,
              expense.description,
              expense.quantity,
              expense.unit_price,
              expense.total_price,
              expense.notes
            ]
          );
        }
      }

      // Fetch the created quote
      const [createdQuote] = await conn.query(
        'SELECT * FROM quotes WHERE id = ?',
        [newQuoteId]
      ) as any[];

      return createdQuote[0];
    });

    // 7. Audit log
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_CREATED,
      AuditResources.QUOTATION,
      newQuote.id.toString(),
      {
        duplicated_from: quotationId,
        modifications,
        days_copied: quoteDays.length,
        expenses_copied: quoteExpenses.length,
      },
      {
        quote_number: newQuote.quote_number,
        original_quote_number: originalQuote.quote_number,
      },
      request
    );

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      original_quote_id: quotationId,
      new_quote_id: newQuote.id,
      days_copied: quoteDays.length,
      expenses_copied: quoteExpenses.length,
    });

    const response = NextResponse.json(
      {
        ...newQuote,
        days_count: quoteDays.length,
        expenses_count: quoteExpenses.length,
      },
      {
        status: 201,
        headers: {
          'Location': `/api/quotations/${newQuote.id}`,
        },
      }
    );
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to duplicate quotation',
      500,
      undefined,
      requestId
    );
  }
}
