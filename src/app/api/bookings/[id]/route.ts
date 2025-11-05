/**
 * Booking By ID API Route
 * Handles fetching and updating individual bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import {
  getBookingById,
  updateBookingStatus,
} from '@/lib/booking-lifecycle';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import type { UpdateBookingRequest } from '@/types/api';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/bookings/[id]
 * Get booking details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;
    const authResult = await requirePermission(request, 'bookings', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    const bookingId = parseInt(id, 10);

    // Validate ID
    if (isNaN(bookingId) || bookingId <= 0) {
      return validationErrorResponse(
        'Invalid booking ID',
        [{ field: 'id', issue: 'invalid', message: 'Booking ID must be a positive number' }],
        requestId
      );
    }

    // Fetch booking
    const booking = await getBookingById(bookingId);

    if (!booking) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Booking with ID ${bookingId} not found`,
        404,
        undefined,
        requestId
      );
    }

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      booking_id: bookingId,
    });

    const response = NextResponse.json(booking);
    addStandardHeaders(response, requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch booking',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * PATCH /api/bookings/[id]
 * Update booking status
 * Only allows status updates (confirmed or cancelled)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;
    const authResult = await requirePermission(request, 'bookings', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

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

    const bookingId = parseInt(id, 10);

    // Validate ID
    if (isNaN(bookingId) || bookingId <= 0) {
      return validationErrorResponse(
        'Invalid booking ID',
        [{ field: 'id', issue: 'invalid', message: 'Booking ID must be a positive number' }],
        requestId
      );
    }

    // Parse request body
    const body: UpdateBookingRequest = await request.json();

    // Validate status field
    if (!body.status) {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'status', issue: 'required', message: 'status field is required' }],
        requestId
      );
    }

    // Validate status value
    if (body.status !== 'confirmed' && body.status !== 'cancelled') {
      return validationErrorResponse(
        'Invalid status value',
        [{ field: 'status', issue: 'invalid', message: 'status must be either "confirmed" or "cancelled"' }],
        requestId
      );
    }

    // Update booking status
    const updatedBooking = await updateBookingStatus(bookingId, body.status);

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      booking_id: bookingId,
      new_status: body.status,
    });

    const response = NextResponse.json(updatedBooking);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        error.message,
        404,
        undefined,
        requestId
      );
    }

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update booking',
      500,
      undefined,
      requestId
    );
  }
}
