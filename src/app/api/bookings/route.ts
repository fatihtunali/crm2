/**
 * Bookings API Route
 * Handles listing and creating bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { parsePaginationParams } from '@/lib/pagination';
import {
  successResponse,
  createdResponse,
  errorResponse,
  badRequestProblem,
  internalServerErrorProblem,
} from '@/lib/response';
import {
  createBookingFromQuotation,
  getBookings,
  getBookingsCount,
} from '@/lib/booking-lifecycle';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import type { CreateBookingRequest, Booking } from '@/types/api';

/**
 * GET /api/bookings
 * List all bookings with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Fetch bookings and total count
    const [bookings, total] = await Promise.all([
      getBookings(pageSize, offset),
      getBookingsCount(),
    ]);

    // Build paginated response following the PagedResponse format
    const response = {
      data: bookings,
      meta: {
        page,
        page_size: pageSize,
        total,
      },
    };

    return successResponse(response);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch bookings', '/api/bookings')
    );
  }
}

/**
 * POST /api/bookings
 * Create a new booking from a quotation
 * Requires Idempotency-Key header
 */
export async function POST(request: NextRequest) {
  try {
    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (!idempotencyKey) {
      return errorResponse(
        badRequestProblem(
          'Idempotency-Key header is required for booking creation',
          '/api/bookings'
        )
      );
    }

    // Check if this request was already processed
    const cachedResponse = await checkIdempotencyKey(request, idempotencyKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Parse request body
    const body: CreateBookingRequest = await request.json();

    // Validate request
    if (!body.quotation_id || typeof body.quotation_id !== 'number') {
      return errorResponse(
        badRequestProblem(
          'quotation_id is required and must be a number',
          '/api/bookings'
        )
      );
    }

    // Create booking from quotation
    const booking = await createBookingFromQuotation(body.quotation_id);

    // Build response
    const response = createdResponse(
      booking,
      `/api/bookings/${booking.id}`
    );

    // Store idempotency key
    storeIdempotencyKey(idempotencyKey, response);

    return response;
  } catch (error: any) {
    console.error('Error creating booking:', error);

    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return errorResponse(
        badRequestProblem(error.message, '/api/bookings')
      );
    }

    if (error.message?.includes('already been accepted')) {
      return errorResponse(
        badRequestProblem(error.message, '/api/bookings')
      );
    }

    return errorResponse(
      internalServerErrorProblem('Failed to create booking', '/api/bookings')
    );
  }
}
