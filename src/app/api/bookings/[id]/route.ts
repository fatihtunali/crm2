/**
 * Booking By ID API Route
 * Handles fetching and updating individual bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  badRequestProblem,
  notFoundProblem,
  internalServerErrorProblem,
} from '@/lib/response';
import {
  getBookingById,
  updateBookingStatus,
} from '@/lib/booking-lifecycle';
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
  const { id } = await params;
  try {
    const bookingId = parseInt(id, 10);

    // Validate ID
    if (isNaN(bookingId) || bookingId <= 0) {
      return errorResponse(
        badRequestProblem('Invalid booking ID', `/api/bookings/${id}`)
      );
    }

    // Fetch booking
    const booking = await getBookingById(bookingId);

    if (!booking) {
      return errorResponse(
        notFoundProblem(
          `Booking with ID ${bookingId} not found`,
          `/api/bookings/${id}`
        )
      );
    }

    // Return booking with locked exchange rate
    return successResponse(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    return errorResponse(
      internalServerErrorProblem(
        'Failed to fetch booking',
        `/api/bookings/${id}`
      )
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
  const { id } = await params;
  try {
    const bookingId = parseInt(id, 10);

    // Validate ID
    if (isNaN(bookingId) || bookingId <= 0) {
      return errorResponse(
        badRequestProblem('Invalid booking ID', `/api/bookings/${id}`)
      );
    }

    // Parse request body
    const body: UpdateBookingRequest = await request.json();

    // Validate status field
    if (!body.status) {
      return errorResponse(
        badRequestProblem(
          'status field is required',
          `/api/bookings/${id}`
        )
      );
    }

    // Validate status value
    if (body.status !== 'confirmed' && body.status !== 'cancelled') {
      return errorResponse(
        badRequestProblem(
          'status must be either "confirmed" or "cancelled"',
          `/api/bookings/${id}`
        )
      );
    }

    // Update booking status
    const updatedBooking = await updateBookingStatus(bookingId, body.status);

    return successResponse(updatedBooking);
  } catch (error: any) {
    console.error('Error updating booking:', error);

    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return errorResponse(
        notFoundProblem(error.message, `/api/bookings/${id}`)
      );
    }

    return errorResponse(
      internalServerErrorProblem(
        'Failed to update booking',
        `/api/bookings/${id}`
      )
    );
  }
}
