import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// GET - Fetch hotel by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const hotelId = id;

    // 3. Validate ID
    if (!hotelId || isNaN(parseInt(hotelId))) {
      return validationErrorResponse(
        'Invalid hotel ID',
        [{ field: 'id', issue: 'invalid', message: 'Hotel ID must be a valid number' }],
        requestId
      );
    }

    // 4. Fetch hotel with current pricing
    const [hotel] = await query(
      `SELECT
        h.*,
        hp.id as pricing_id,
        hp.season_name,
        hp.start_date as season_start,
        hp.end_date as season_end,
        hp.currency,
        hp.double_room_bb,
        hp.single_supplement_bb,
        hp.triple_room_bb,
        hp.child_0_6_bb,
        hp.child_6_12_bb,
        hp.hb_supplement,
        hp.fb_supplement,
        hp.ai_supplement,
        hp.base_meal_plan
      FROM hotels h
      LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
        AND hp.status = 'active'
        AND CURDATE() BETWEEN hp.start_date AND hp.end_date
      WHERE h.id = ? AND h.organization_id = ?
      LIMIT 1`,
      [hotelId, parseInt(tenantId)]
    ) as any[];

    if (!hotel) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Hotel with ID ${hotelId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 5. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      hotel_id: hotelId,
    });

    // 6. Create response with headers
    const response = NextResponse.json(hotel);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch hotel',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH - Update hotel (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const hotelId = id;

    // 3. Validate ID
    if (!hotelId || isNaN(parseInt(hotelId))) {
      return validationErrorResponse(
        'Invalid hotel ID',
        [{ field: 'id', issue: 'invalid', message: 'Hotel ID must be a valid number' }],
        requestId
      );
    }

    // 4. Check if hotel exists
    const [existingHotel] = await query(
      'SELECT * FROM hotels WHERE id = ? AND organization_id = ?',
      [hotelId, parseInt(tenantId)]
    ) as any[];

    if (!existingHotel) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Hotel with ID ${hotelId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const body = await request.json();

    // 5. Build dynamic update query for partial updates
    const allowedFields = [
      'google_place_id',
      'organization_id',
      'hotel_name',
      'city',
      'star_rating',
      'hotel_category',
      'room_count',
      'is_boutique',
      'address',
      'latitude',
      'longitude',
      'google_maps_url',
      'contact_phone',
      'contact_email',
      'notes',
      'photo_url_1',
      'photo_url_2',
      'photo_url_3',
      'rating',
      'user_ratings_total',
      'website',
      'editorial_summary',
      'place_types',
      'price_level',
      'business_status',
      'region',
      'status',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return validationErrorResponse(
        'No valid fields to update',
        [{ field: 'body', issue: 'empty', message: 'At least one field must be provided for update' }],
        requestId
      );
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add hotel ID to values for WHERE clause
    values.push(hotelId);
    values.push(parseInt(tenantId));

    await query(
      `UPDATE hotels SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    // 6. Fetch and return the updated hotel
    const [updatedHotel] = await query(
      'SELECT * FROM hotels WHERE id = ?',
      [hotelId]
    ) as any[];

    // 7. AUDIT: Log hotel update
    const changes: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== existingHotel[field]) {
        changes[field] = body[field];
      }
    }

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_UPDATED,
      AuditResources.PROVIDER,
      hotelId.toString(),
      changes,
      {
        provider_type: 'hotel',
        fields_updated: Object.keys(changes),
      },
      request
    );

    // 8. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      hotel_id: hotelId,
    });

    const response = NextResponse.json(updatedHotel);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update hotel',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Soft delete (set status='inactive') or hard delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const hotelId = id;

    // 3. Validate ID
    if (!hotelId || isNaN(parseInt(hotelId))) {
      return validationErrorResponse(
        'Invalid hotel ID',
        [{ field: 'id', issue: 'invalid', message: 'Hotel ID must be a valid number' }],
        requestId
      );
    }

    // 4. Check if hotel exists
    const [existingHotel] = await query(
      'SELECT * FROM hotels WHERE id = ? AND organization_id = ?',
      [hotelId, parseInt(tenantId)]
    ) as any[];

    if (!existingHotel) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Hotel with ID ${hotelId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // 5. Check if hard delete is requested via query parameter
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete - permanently remove from database
      await query('UPDATE hotels SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?', [hotelId, parseInt(tenantId)]);
    } else {
      // Soft delete - set status to inactive
      await query(
        'UPDATE hotels SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?',
        ['inactive', hotelId, parseInt(tenantId)]
      );
    }

    // 6. AUDIT: Log hotel deletion
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_DELETED,
      AuditResources.PROVIDER,
      hotelId.toString(),
      {
        status: hardDelete ? 'deleted' : 'inactive',
        previous_status: existingHotel.status,
      },
      {
        provider_type: 'hotel',
        hotel_name: existingHotel.hotel_name,
        deletion_type: hardDelete ? 'hard_delete' : 'soft_delete',
      },
      request
    );

    // 7. Log response
    logResponse(requestId, 204, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      hotel_id: hotelId,
    });

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
      'Failed to delete hotel',
      500,
      undefined,
      requestId
    );
  }
}
