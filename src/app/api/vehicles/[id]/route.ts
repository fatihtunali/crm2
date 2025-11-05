import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

interface Vehicle {
  id: number;
  organization_id: number;
  provider_id: number | null;
  vehicle_type: string;
  max_capacity: number;
  city: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/vehicles/[id]
 * Fetch a single vehicle by ID
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 *
 * Path parameters:
 * - id: Vehicle ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 300, 3600);
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

    const vehicleId = parseInt(id, 10);

    if (isNaN(vehicleId) || vehicleId <= 0) {
      return validationErrorResponse(
        'Invalid input',
        [{ field: 'id', issue: 'invalid', message: 'Invalid vehicle ID: must be a positive integer' }],
        requestId
      );
    }

    // Fetch vehicle with pricing
    const sql = `
      SELECT
        v.*,
        p.provider_name,
        vp.id as pricing_id,
        vp.season_name,
        vp.start_date as season_start,
        vp.end_date as season_end,
        vp.currency,
        vp.price_per_day,
        vp.price_half_day
      FROM vehicles v
      LEFT JOIN providers p ON v.provider_id = p.id
      LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
        AND vp.status = 'active'
        AND CURDATE() BETWEEN vp.start_date AND vp.end_date
      WHERE v.id = ? AND v.organization_id = ?
    `;

    const rows = await query(sql, [vehicleId, tenantId]) as Vehicle[];

    if (!rows || rows.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Vehicle with ID ${vehicleId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const response = NextResponse.json(rows[0]);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      vehicle_id: vehicleId
    });

    return response;
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * PATCH /api/vehicles/[id]
 * Update a vehicle
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 *
 * Path parameters:
 * - id: Vehicle ID
 *
 * Body (all fields optional):
 * - vehicle_type: string
 * - max_capacity: number
 * - city: string
 * - description: string
 * - provider_id: number
 * - status: string
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 50, 3600);
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

    const vehicleId = parseInt(id, 10);

    if (isNaN(vehicleId) || vehicleId <= 0) {
      return validationErrorResponse(
        'Invalid input',
        [{ field: 'id', issue: 'invalid', message: 'Invalid vehicle ID: must be a positive integer' }],
        requestId
      );
    }

    // Check if vehicle exists and belongs to tenant
    const existingVehicles = await query(
      `SELECT id FROM vehicles WHERE id = ? AND organization_id = ?`,
      [vehicleId, tenantId]
    ) as Vehicle[];

    if (!existingVehicles || existingVehicles.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Vehicle with ID ${vehicleId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      vehicle_type,
      max_capacity,
      city,
      description,
      provider_id,
      status,
    } = body;

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];

    if (vehicle_type !== undefined) {
      updates.push('vehicle_type = ?');
      values.push(vehicle_type);
    }

    if (max_capacity !== undefined) {
      if (typeof max_capacity !== 'number' || max_capacity <= 0) {
        return validationErrorResponse(
          'Invalid input',
          [{ field: 'max_capacity', issue: 'invalid', message: 'max_capacity must be a positive number' }],
          requestId
        );
      }
      updates.push('max_capacity = ?');
      values.push(max_capacity);
    }

    if (city !== undefined) {
      updates.push('city = ?');
      values.push(city);
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
        'Invalid input',
        [{ field: 'body', issue: 'invalid', message: 'No valid fields provided for update' }],
        requestId
      );
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add WHERE clause parameters
    values.push(vehicleId, tenantId);

    // Execute update
    await query(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    // Fetch updated vehicle
    const [updatedVehicle] = await query(
      `SELECT * FROM vehicles WHERE id = ?`,
      [vehicleId]
    ) as Vehicle[];

    const response = NextResponse.json(updatedVehicle);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      vehicle_id: vehicleId
    });

    return response;
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * DELETE /api/vehicles/[id]
 * Delete a vehicle (soft delete by setting status to 'inactive')
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 *
 * Path parameters:
 * - id: Vehicle ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 20, 3600);
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

    const vehicleId = parseInt(id, 10);

    if (isNaN(vehicleId) || vehicleId <= 0) {
      return validationErrorResponse(
        'Invalid input',
        [{ field: 'id', issue: 'invalid', message: 'Invalid vehicle ID: must be a positive integer' }],
        requestId
      );
    }

    // Check if vehicle exists and belongs to tenant
    const existingVehicles = await query(
      `SELECT id FROM vehicles WHERE id = ? AND organization_id = ?`,
      [vehicleId, tenantId]
    ) as Vehicle[];

    if (!existingVehicles || existingVehicles.length === 0) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Vehicle with ID ${vehicleId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Soft delete: set status to inactive
    await query(
      `UPDATE vehicles SET status = 'inactive', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [vehicleId, tenantId]
    );

    const response = new NextResponse(null, { status: 204 });
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 204, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      vehicle_id: vehicleId
    });

    return response;
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}
