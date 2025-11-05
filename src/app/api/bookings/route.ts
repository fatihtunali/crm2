/**
 * Bookings API Route
 * Handles listing and creating bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import {
  createBookingFromQuotation,
  getBookings,
  getBookingsCount,
} from '@/lib/booking-lifecycle';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB, markIdempotencyKeyProcessing } from '@/middleware/idempotency-db';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import type { CreateBookingRequest, Booking } from '@/types/api';

/**
 * GET /api/bookings
 * List all bookings with pagination
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'bookings', 'read');
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

    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // Fetch bookings and total count
    const [bookings, total] = await Promise.all([
      getBookings(pageSize, offset),
      getBookingsCount(),
    ]);

    // Build base URL for hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    const responseData = buildStandardListResponse(
      bookings,
      total,
      page,
      pageSize,
      baseUrl,
      {}
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: (bookings as any[]).length,
      total_results: total,
      page,
      page_size: pageSize,
    });

    const response = NextResponse.json(responseData);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch bookings',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * POST /api/bookings
 * Create a new booking from a quotation
 * Requires Idempotency-Key header
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'bookings', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting (50 creates per hour per user)
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

    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (!idempotencyKey) {
      return validationErrorResponse(
        'Idempotency-Key header is required for booking creation',
        [{ field: 'Idempotency-Key', issue: 'required', message: 'Idempotency-Key header is required' }],
        requestId
      );
    }

    // Check if this request was already processed
    const cachedResponse = await checkIdempotencyKeyDB(request, idempotencyKey, Number(tenantId));
    if (cachedResponse) {
      return cachedResponse;
    }

    // Parse request body
    const body: CreateBookingRequest = await request.json();

    // Validate request
    if (!body.quotation_id || typeof body.quotation_id !== 'number') {
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'quotation_id', issue: 'required', message: 'quotation_id is required and must be a number' }],
        requestId
      );
    }

    // Create booking from quotation
    const booking = await createBookingFromQuotation(body.quotation_id);

    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      booking_id: booking.id,
    });

    // Build response
    const response = NextResponse.json(booking, {
      status: 201,
      headers: {
        'Location': `/api/bookings/${booking.id}`,
      },
    });

    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // Store idempotency key
    await storeIdempotencyKeyDB(idempotencyKey, response, Number(tenantId), user.userId, request);

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

    if (error.message?.includes('already been accepted')) {
      return standardErrorResponse(
        ErrorCodes.CONFLICT,
        error.message,
        409,
        undefined,
        requestId
      );
    }

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create booking',
      500,
      undefined,
      requestId
    );
  }
}
