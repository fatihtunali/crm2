/**
 * Request by ID API Endpoint - Phase 1 Standards Applied
 * - Request correlation IDs (X-Request-Id)
 * - Rate limiting with headers
 * - Standardized error responses with error codes
 * - Request/response logging
 * - RBAC enforcement
 * - Audit logging
 *
 * GET    /api/requests/[id] - Get single request
 * PATCH  /api/requests/[id] - Update request
 * DELETE /api/requests/[id] - Soft delete request
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';
import { createMoney } from '@/lib/money';

// GET - Fetch single request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'requests', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (300 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      300,
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

    // 3. Fetch request
    const [row] = await query(
      `SELECT * FROM customer_itineraries WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!row) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Request with ID ${id} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 4. Transform to include Money types
    const transformedRequest = {
      ...row,
      total_price: createMoney(parseFloat(row.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(row.price_per_person || 0), 'EUR')
    };

    // 5. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      request_id: id,
    });

    // 6. Return response with headers
    const response = NextResponse.json(transformedRequest);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch request',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH - Update request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'requests', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (100 updates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_update`,
      100,
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

    // 3. Check if request exists and belongs to tenant
    const [existing] = await query(
      `SELECT * FROM customer_itineraries WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existing) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Request with ID ${id} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 4. Parse request body
    const body = await request.json();

    // 5. Calculate price per person if adults/children/total_price are provided
    let pricePerPerson;
    if (body.adults !== undefined || body.children !== undefined || body.total_price !== undefined) {
      const adults = body.adults ?? existing.adults;
      const children = body.children ?? existing.children;
      const totalPrice = body.total_price ?? existing.total_price;
      const totalPax = adults + children;
      pricePerPerson = totalPax > 0 ? totalPrice / totalPax : 0;
    }

    // 6. Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    const changes: Record<string, any> = {};

    if (body.customer_name !== undefined) {
      updates.push('customer_name = ?');
      values.push(body.customer_name);
      if (body.customer_name !== existing.customer_name) {
        changes.customer_name = body.customer_name;
      }
    }
    if (body.customer_email !== undefined) {
      updates.push('customer_email = ?');
      values.push(body.customer_email);
      if (body.customer_email !== existing.customer_email) {
        changes.customer_email = body.customer_email;
      }
    }
    if (body.customer_phone !== undefined) {
      updates.push('customer_phone = ?');
      values.push(body.customer_phone || null);
    }
    if (body.destination !== undefined) {
      updates.push('destination = ?');
      values.push(body.destination);
      if (body.destination !== existing.destination) {
        changes.destination = body.destination;
      }
    }
    if (body.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(body.start_date);
    }
    if (body.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(body.end_date);
    }
    if (body.adults !== undefined) {
      updates.push('adults = ?');
      values.push(body.adults);
    }
    if (body.children !== undefined) {
      updates.push('children = ?');
      values.push(body.children);
    }
    if (body.hotel_category !== undefined) {
      updates.push('hotel_category = ?');
      values.push(body.hotel_category || null);
    }
    if (body.tour_type !== undefined) {
      updates.push('tour_type = ?');
      values.push(body.tour_type || null);
    }
    if (body.special_requests !== undefined) {
      updates.push('special_requests = ?');
      values.push(body.special_requests || null);
    }
    if (body.total_price !== undefined) {
      updates.push('total_price = ?');
      values.push(body.total_price);
    }
    if (pricePerPerson !== undefined) {
      updates.push('price_per_person = ?');
      values.push(pricePerPerson);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
      if (body.status !== existing.status) {
        changes.status = body.status;
      }
    }

    if (updates.length === 0) {
      // No fields to update, return current state
      const transformedRequest = {
        ...existing,
        total_price: createMoney(parseFloat(existing.total_price || 0), 'EUR'),
        price_per_person: createMoney(parseFloat(existing.price_per_person || 0), 'EUR')
      };

      const response = NextResponse.json(transformedRequest);
      response.headers.set('X-Request-Id', requestId);
      addRateLimitHeaders(response, rateLimit);
      return response;
    }

    // 7. Execute update
    updates.push('updated_at = NOW()');
    const sql = `UPDATE customer_itineraries SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    await query(sql, values);

    // 8. Fetch updated request
    const [updated] = await query(
      'SELECT * FROM customer_itineraries WHERE id = ?',
      [id]
    ) as any[];

    const transformedRequest = {
      ...updated,
      total_price: createMoney(parseFloat(updated.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(updated.price_per_person || 0), 'EUR')
    };

    // 9. AUDIT: Log request update
    if (Object.keys(changes).length > 0) {
      await auditLog(
        parseInt(tenantId),
        user.userId,
        AuditActions.REQUEST_UPDATED,
        AuditResources.REQUEST,
        id,
        changes,
        {
          uuid: existing.uuid,
          fields_updated: Object.keys(changes),
        },
        request
      );
    }

    // 10. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      request_id: id,
      fields_updated: Object.keys(changes),
    });

    // 11. Return response with headers
    const response = NextResponse.json(transformedRequest);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update request',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Delete request (soft delete - set status to cancelled)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'requests', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (50 deletes per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_delete`,
      50,
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

    // 3. Check if request exists and belongs to tenant
    const [existing] = await query(
      `SELECT id, uuid, status FROM customer_itineraries WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existing) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Request with ID ${id} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 4. Soft delete - set status to cancelled
    await query(
      `UPDATE customer_itineraries SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    // 5. AUDIT: Log request deletion (soft delete)
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.REQUEST_DELETED,
      AuditResources.REQUEST,
      id,
      {
        status: 'cancelled',
        previous_status: existing.status,
      },
      {
        uuid: existing.uuid,
        deletion_type: 'soft_delete',
      },
      request
    );

    // 6. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      request_id: id,
    });

    // 7. Return response with headers
    const response = NextResponse.json({ success: true });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete request',
      500,
      undefined,
      requestId
    );
  }
}
