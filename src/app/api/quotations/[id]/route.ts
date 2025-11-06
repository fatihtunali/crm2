import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { Money } from '@/types/api';
import {
  standardErrorResponse,
  notFoundErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

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
    const authResult = await requirePermission(request, 'quotations', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

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
        e.category,
        e.hotel_category,
        e.location,
        e.description,
        e.price,
        e.single_supplement,
        e.child_0to2,
        e.child_3to5,
        e.child_6to11,
        e.vehicle_count,
        e.price_per_vehicle
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
          category: row.category,
          hotel_category: row.hotel_category,
          location: row.location,
          description: row.description,
          price: row.price,
          single_supplement: row.single_supplement,
          child_0to2: row.child_0to2,
          child_3to5: row.child_3to5,
          child_6to11: row.child_6to11,
          vehicle_count: row.vehicle_count,
          price_per_vehicle: row.price_per_vehicle
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
      user_id: user.userId,
      tenant_id: tenantId,
      quotation_id: id,
      days_count: days.length,
    });

    const response = NextResponse.json(responseQuote);
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
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
    const authResult = await requirePermission(request, 'quotations', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting (50 requests per hour per user)
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

    // Check if quote exists and belongs to user's organization
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingQuote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quotation not found',
        404,
        undefined,
        requestId
      );
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
        user_id: user.userId,
        tenant_id: tenantId,
        quotation_id: id,
        no_updates: true,
      });

      const response = NextResponse.json(existingQuote);
      addStandardHeaders(response, requestId);
      addRateLimitHeaders(response, rateLimit);
      return response;
    }

    // Add id and organization_id to the end of params
    updateValues.push(id);
    updateValues.push(parseInt(tenantId));

    // Execute update (SECURITY: Only update if belongs to user's organization)
    await query(
      `UPDATE quotes SET ${updateFields.join(', ')} WHERE id = ? AND organization_id = ?`,
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

    // AUDIT: Log quotation update with changes
    const changes: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body.hasOwnProperty(field) && body[field] !== existingQuote[field]) {
        changes[field] = body[field];
      }
    }

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      id.toString(),
      changes,
      {
        quote_number: existingQuote.quote_number,
        fields_updated: Object.keys(changes),
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quotation_id: id,
      fields_updated: updateFields.length,
    });

    const response = NextResponse.json(updatedQuote);
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
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

    // Rate limiting (20 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_delete`,
      20,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Delete rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // Check if quote exists and belongs to user's organization
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingQuote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quotation not found',
        404,
        undefined,
        requestId
      );
    }

    // Delete the quote (cascading deletes will handle quote_days and quote_expenses)
    await query('UPDATE quotes SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?', [
      id,
      parseInt(tenantId),
    ]);

    // AUDIT: Log quotation deletion
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_DELETED,
      AuditResources.QUOTATION,
      id.toString(),
      {
        deletion_type: 'hard_delete',
      },
      {
        quote_number: existingQuote.quote_number,
        customer_name: existingQuote.customer_name,
      },
      request
    );

    logResponse(requestId, 204, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quotation_id: id,
      deleted_by: user.userId,
    });

    const response = new NextResponse(null, {
      status: 204,
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
      'Failed to delete quotation',
      500,
      undefined,
      requestId
    );
  }
}
