import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

interface Guide {
  id: number;
  organization_id: number;
  provider_id: number | null;
  city: string;
  language: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/guides/[id] - Fetch a single guide by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (300 requests per hour per user for detail endpoints)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_detail`,
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

    const { id } = await params;

    // 3. Validate ID
    const guideId = parseInt(id, 10);
    if (isNaN(guideId) || guideId <= 0) {
      return validationErrorResponse(
        'Invalid guide ID',
        [{ field: 'id', issue: 'invalid', message: 'Guide ID must be a positive integer' }],
        requestId
      );
    }

    // 4. Fetch guide with pricing information
    const sql = `
      SELECT
        g.*,
        p.provider_name,
        p.id as provider_id,
        gp.id as pricing_id,
        gp.season_name,
        gp.start_date as season_start,
        gp.end_date as season_end,
        gp.currency,
        gp.full_day_price,
        gp.half_day_price,
        gp.night_price
      FROM guides g
      LEFT JOIN providers p ON g.provider_id = p.id
      LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
        AND gp.status = 'active'
        AND CURDATE() BETWEEN gp.start_date AND gp.end_date
      WHERE g.id = ? AND g.organization_id = ?
    `;

    const rows = await query(sql, [guideId, tenantId]) as Guide[];

    if (rows.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Guide with ID ${guideId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 5. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      guide_id: guideId,
    });

    // 6. Create response with headers
    const response = NextResponse.json(rows[0]);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch guide',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH /api/guides/[id] - Update a guide by ID (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (50 updates per hour per user)
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

    // 3. Validate ID
    const guideId = parseInt(id, 10);
    if (isNaN(guideId) || guideId <= 0) {
      return validationErrorResponse(
        'Invalid guide ID',
        [{ field: 'id', issue: 'invalid', message: 'Guide ID must be a positive integer' }],
        requestId
      );
    }

    // 4. Check if guide exists and belongs to tenant
    const existingGuides = await query(
      'SELECT * FROM guides WHERE id = ? AND organization_id = ?',
      [guideId, tenantId]
    ) as Guide[];

    if (existingGuides.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Guide with ID ${guideId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const existingGuide = existingGuides[0];

    // 5. Parse request body
    const body = await request.json();
    const {
      city,
      language,
      description,
      provider_id,
      status,
    } = body;

    // 6. Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (city !== undefined) {
      updates.push('city = ?');
      values.push(city);
    }

    if (language !== undefined) {
      updates.push('language = ?');
      values.push(language);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (provider_id !== undefined) {
      updates.push('provider_id = ?');
      values.push(provider_id);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    // If no fields to update, return error
    if (updates.length === 0) {
      return validationErrorResponse(
        'No valid fields to update',
        [{ field: 'body', issue: 'empty', message: 'At least one field must be provided for update' }],
        requestId
      );
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add ID and tenant ID to values
    values.push(guideId, tenantId);

    // 7. Execute update
    const updateSql = `
      UPDATE guides
      SET ${updates.join(', ')}
      WHERE id = ? AND organization_id = ?
    `;

    await query(updateSql, values);

    // 8. Fetch and return updated guide
    const [updatedGuide] = await query(
      'SELECT * FROM guides WHERE id = ?',
      [guideId]
    ) as Guide[];

    // 9. AUDIT: Log guide update
    const changes: Record<string, any> = {};
    if (city !== undefined && city !== existingGuide.city) changes.city = city;
    if (language !== undefined && language !== existingGuide.language) changes.language = language;
    if (status !== undefined && status !== existingGuide.status) changes.status = status;

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_UPDATED,
      AuditResources.PROVIDER,
      guideId.toString(),
      changes,
      {
        provider_type: 'guide',
        fields_updated: Object.keys(changes),
      },
      request
    );

    // 10. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      guide_id: guideId,
    });

    const response = NextResponse.json(updatedGuide);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update guide',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE /api/guides/[id] - Soft delete (archive) a guide by ID
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (20 deletes per hour per user)
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

    const { id } = await params;

    // 3. Validate ID
    const guideId = parseInt(id, 10);
    if (isNaN(guideId) || guideId <= 0) {
      return validationErrorResponse(
        'Invalid guide ID',
        [{ field: 'id', issue: 'invalid', message: 'Guide ID must be a positive integer' }],
        requestId
      );
    }

    // 4. Check if guide exists and belongs to tenant
    const existingGuides = await query(
      'SELECT * FROM guides WHERE id = ? AND organization_id = ?',
      [guideId, tenantId]
    ) as Guide[];

    if (existingGuides.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Guide with ID ${guideId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const existingGuide = existingGuides[0];

    // 5. Soft delete (set status to inactive)
    await query(
      'UPDATE guides SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [guideId, tenantId]
    );

    // 6. AUDIT: Log guide deletion
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_DELETED,
      AuditResources.PROVIDER,
      guideId.toString(),
      {
        status: 'inactive',
        previous_status: existingGuide.status,
      },
      {
        provider_type: 'guide',
        city: existingGuide.city,
        language: existingGuide.language,
        deletion_type: 'soft_delete',
      },
      request
    );

    // 7. Log response
    logResponse(requestId, 204, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      guide_id: guideId,
    });

    // Return 204 No Content
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete guide',
      500,
      undefined,
      requestId
    );
  }
}
