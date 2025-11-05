import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// GET - Fetch all days for a quote
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

    // SECURITY: Verify quote belongs to user's organization
    const [quote] = await query(
      'SELECT id FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!quote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quote not found',
        404,
        undefined,
        requestId
      );
    }

    const days = await query(
      'SELECT * FROM quote_days WHERE quote_id = ? ORDER BY day_number',
      [id]
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quote_id: id,
      days_count: (days as any[]).length,
    });

    const response = NextResponse.json(days);
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    console.error('Database error:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch days',
      500,
      undefined,
      requestId
    );
  }
}

// POST - Create a new day
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'quotations', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting (50 requests per hour per user)
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

    // SECURITY: Verify quote belongs to user's organization
    const [quote] = await query(
      'SELECT id, quote_number FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!quote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quote not found',
        404,
        undefined,
        requestId
      );
    }

    const body = await request.json();
    const { day_number, date } = body;

    // Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!day_number) {
      validationErrors.push({
        field: 'day_number',
        issue: 'required',
        message: 'Day number is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    const result = await query(
      'INSERT INTO quote_days (quote_id, day_number, date) VALUES (?, ?, ?)',
      [id, day_number, date]
    );

    const insertId = (result as any).insertId;

    // AUDIT: Log day creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      id.toString(),
      {
        day_added: insertId,
        day_number,
        date,
      },
      {
        quote_number: quote.quote_number,
      },
      request
    );

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quote_id: id,
      day_id: insertId,
    });

    const response = NextResponse.json({ success: true, id: insertId }, { status: 201 });
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    console.error('Database error:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create day',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Delete a day and its expenses
// Uses transaction to ensure both expenses and day are deleted atomically
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
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

    const { dayId } = await request.json();

    // Validation
    if (!dayId) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'dayId', issue: 'required', message: 'Day ID is required' }],
        requestId
      );
    }

    // SECURITY: Verify day belongs to a quote owned by user's organization
    const [day] = await query(
      `SELECT qd.id, qd.quote_id, qd.day_number, q.quote_number, q.organization_id
       FROM quote_days qd
       JOIN quotes q ON qd.quote_id = q.id
       WHERE qd.id = ? AND q.organization_id = ?`,
      [dayId, parseInt(tenantId)]
    ) as any[];

    if (!day) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Day not found',
        404,
        undefined,
        requestId
      );
    }

    // Delete day and expenses in a transaction
    await transaction(async (conn) => {
      // First delete all expenses associated with this day
      await conn.query('DELETE FROM quote_expenses WHERE quote_day_id = ?', [dayId]);

      // Then delete the day itself
      await conn.query('DELETE FROM quote_days WHERE id = ?', [dayId]);
    });

    // AUDIT: Log day deletion
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      day.quote_id.toString(),
      {
        day_deleted: dayId,
        day_number: day.day_number,
      },
      {
        quote_number: day.quote_number,
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      day_id: dayId,
      quote_id: day.quote_id,
    });

    const response = NextResponse.json({ success: true });
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    console.error('Database error:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete day',
      500,
      undefined,
      requestId
    );
  }
}
