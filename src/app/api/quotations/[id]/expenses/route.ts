import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// POST - Create a new expense
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      quote_day_id,
      category,
      hotel_category,
      location,
      description,
      price,
      single_supplement,
      child_0to2,
      child_3to5,
      child_6to11,
      vehicle_count,
      price_per_vehicle
    } = body;

    // Validation
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!quote_day_id) {
      validationErrors.push({
        field: 'quote_day_id',
        issue: 'required',
        message: 'Quote day ID is required'
      });
    }

    if (!category) {
      validationErrors.push({
        field: 'category',
        issue: 'required',
        message: 'Category is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // SECURITY: Verify day belongs to a quote owned by user's organization
    const [day] = await query(
      `SELECT qd.id, qd.quote_id, q.quote_number, q.organization_id
       FROM quote_days qd
       JOIN quotes q ON qd.quote_id = q.id
       WHERE qd.id = ? AND q.organization_id = ?`,
      [quote_day_id, parseInt(tenantId)]
    ) as any[];

    if (!day) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quote day not found',
        404,
        undefined,
        requestId
      );
    }

    const result = await query(
      `INSERT INTO quote_expenses (
        quote_day_id, category, hotel_category, location, description,
        price, single_supplement, child_0to2, child_3to5, child_6to11,
        vehicle_count, price_per_vehicle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quote_day_id,
        category,
        hotel_category,
        location,
        description,
        price || 0,
        single_supplement,
        child_0to2,
        child_3to5,
        child_6to11,
        vehicle_count,
        price_per_vehicle
      ]
    );

    const insertId = (result as any).insertId;

    // AUDIT: Log expense creation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      day.quote_id.toString(),
      {
        expense_added: insertId,
        category,
        description,
        price,
      },
      {
        quote_number: day.quote_number,
      },
      request
    );

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      expense_id: insertId,
      quote_id: day.quote_id,
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
      'Failed to create expense',
      500,
      undefined,
      requestId
    );
  }
}

// PUT - Update an expense
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const {
      id,
      category,
      hotel_category,
      location,
      description,
      price,
      single_supplement,
      child_0to2,
      child_3to5,
      child_6to11,
      vehicle_count,
      price_per_vehicle
    } = body;

    // Validation
    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Expense ID is required' }],
        requestId
      );
    }

    // SECURITY: Verify expense belongs to a quote owned by user's organization
    const [expense] = await query(
      `SELECT qe.id, qe.quote_day_id, qd.quote_id, q.quote_number, q.organization_id
       FROM quote_expenses qe
       JOIN quote_days qd ON qe.quote_day_id = qd.id
       JOIN quotes q ON qd.quote_id = q.id
       WHERE qe.id = ? AND q.organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!expense) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Expense not found',
        404,
        undefined,
        requestId
      );
    }

    await query(
      `UPDATE quote_expenses SET
        category = ?, hotel_category = ?, location = ?, description = ?,
        price = ?, single_supplement = ?, child_0to2 = ?, child_3to5 = ?,
        child_6to11 = ?, vehicle_count = ?, price_per_vehicle = ?
      WHERE id = ?`,
      [
        category,
        hotel_category,
        location,
        description,
        price || 0,
        single_supplement,
        child_0to2,
        child_3to5,
        child_6to11,
        vehicle_count,
        price_per_vehicle,
        id
      ]
    );

    // AUDIT: Log expense update
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      expense.quote_id.toString(),
      {
        expense_updated: id,
        category,
        description,
        price,
      },
      {
        quote_number: expense.quote_number,
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      expense_id: id,
      quote_id: expense.quote_id,
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
      'Failed to update expense',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Delete an expense
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

    const { id } = await request.json();

    // Validation
    if (!id) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Expense ID is required' }],
        requestId
      );
    }

    // SECURITY: Verify expense belongs to a quote owned by user's organization
    const [expense] = await query(
      `SELECT qe.id, qe.quote_day_id, qe.category, qe.description, qd.quote_id, q.quote_number, q.organization_id
       FROM quote_expenses qe
       JOIN quote_days qd ON qe.quote_day_id = qd.id
       JOIN quotes q ON qd.quote_id = q.id
       WHERE qe.id = ? AND q.organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!expense) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Expense not found',
        404,
        undefined,
        requestId
      );
    }

    // Hard delete for now - archived_at column doesn't exist yet
    await query('DELETE FROM quote_expenses WHERE id = ?', [id]);

    // AUDIT: Log expense deletion
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      expense.quote_id.toString(),
      {
        expense_deleted: id,
        category: expense.category,
        description: expense.description,
      },
      {
        quote_number: expense.quote_number,
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      expense_id: id,
      quote_id: expense.quote_id,
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
      'Failed to delete expense',
      500,
      undefined,
      requestId
    );
  }
}
