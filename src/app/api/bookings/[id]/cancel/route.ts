/**
 * Booking Cancellation Endpoint
 * POST /api/bookings/{id}/cancel
 *
 * Cancels a booking and applies cancellation policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { calculateCancellationFee, DEFAULT_CANCELLATION_POLICY } from '@/lib/cancellation-policy';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { getRequestId, logResponse } from '@/middleware/correlation';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

interface CancelBookingRequest {
  cancellation_reason?: string;
  force_cancel?: boolean; // Skip validation checks if true (admin use)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'bookings', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (20 cancellations per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_cancel`,
      20,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Cancellation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId) || bookingId <= 0) {
      return validationErrorResponse(
        'Invalid booking ID',
        [{ field: 'id', issue: 'invalid', message: 'Booking ID must be a positive number' }],
        requestId
      );
    }

    // Parse request body
    const body: CancelBookingRequest = await request.json().catch(() => ({}));
    const { cancellation_reason, force_cancel } = body;

    // Fetch booking with related quotation
    const [booking] = await query<any>(
      `SELECT
        b.*,
        q.start_date,
        q.end_date,
        q.total_price,
        q.quote_number,
        q.customer_name,
        q.customer_email
      FROM bookings b
      JOIN quotes q ON b.quotation_id = q.id
      WHERE b.id = ?`,
      [bookingId]
    );

    if (!booking) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Booking with ID ${bookingId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return standardErrorResponse(
        ErrorCodes.CONFLICT,
        'Booking is already cancelled',
        409,
        undefined,
        requestId
      );
    }

    // Get current date for cancellation
    const cancellationDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if travel has already started (unless force_cancel)
    const travelStartDate = new Date(booking.start_date);
    const now = new Date();

    if (!force_cancel && now > travelStartDate) {
      return standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Cannot cancel booking after travel has started. Contact support for assistance.',
        400,
        undefined,
        requestId
      );
    }

    // Calculate cancellation fee
    const bookingTotal = parseFloat(booking.total_price || '0');
    const feeCalculation = calculateCancellationFee(
      booking.start_date,
      cancellationDate,
      bookingTotal,
      DEFAULT_CANCELLATION_POLICY
    );

    // Cancel booking in a transaction
    const cancellationResult = await transaction(async (conn) => {
      // Update booking status
      await conn.query(
        `UPDATE bookings SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancellation_reason = ?,
          cancellation_fee = ?,
          cancelled_by_user_id = ?,
          cancellation_policy_applied = ?
        WHERE id = ?`,
        [
          cancellation_reason || 'No reason provided',
          feeCalculation.cancellation_fee,
          user.userId,
          `${feeCalculation.policy_applied}: ${feeCalculation.policy_rule}`,
          bookingId
        ]
      );

      // Insert into booking_cancellations table for detailed history
      const [cancellationInsert] = await conn.query(
        `INSERT INTO booking_cancellations (
          booking_id,
          cancelled_by_user_id,
          cancellation_reason,
          cancellation_fee,
          days_before_travel,
          policy_applied,
          refund_amount,
          refund_status,
          cancelled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [
          bookingId,
          user.userId,
          cancellation_reason || 'No reason provided',
          feeCalculation.cancellation_fee,
          feeCalculation.days_before_travel,
          `${feeCalculation.policy_applied}: ${feeCalculation.policy_rule}`,
          feeCalculation.refund_amount
        ]
      );

      const cancellationRecordId = (cancellationInsert as any).insertId;

      // Fetch updated booking
      const [updatedBooking] = await conn.query(
        'SELECT * FROM bookings WHERE id = ?',
        [bookingId]
      ) as any[];

      return {
        booking: updatedBooking[0],
        cancellation_record_id: cancellationRecordId,
      };
    });

    // Audit log
    await auditLog(
      parseInt(tenantId),
      user.userId,
      'BOOKING_CANCELLED' as any,
      'BOOKING' as any,
      bookingId.toString(),
      {
        cancelled: true,
        cancellation_reason: cancellation_reason || 'No reason provided',
        cancellation_fee: feeCalculation.cancellation_fee,
        refund_amount: feeCalculation.refund_amount,
        days_before_travel: feeCalculation.days_before_travel,
        penalty_percent: feeCalculation.penalty_percent,
      },
      {
        booking_number: booking.booking_number,
        quote_number: booking.quote_number,
        customer_name: booking.customer_name,
        policy_applied: feeCalculation.policy_applied,
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      booking_id: bookingId,
      cancellation_fee: feeCalculation.cancellation_fee,
      refund_amount: feeCalculation.refund_amount,
    });

    const response = NextResponse.json({
      success: true,
      booking_id: bookingId,
      booking_number: booking.booking_number,
      status: 'cancelled',
      cancellation: {
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: user.userId,
        cancellation_reason: cancellation_reason || 'No reason provided',
        days_before_travel: feeCalculation.days_before_travel,
        policy_applied: feeCalculation.policy_applied,
        policy_rule: feeCalculation.policy_rule,
        penalty_percent: feeCalculation.penalty_percent,
        booking_total: bookingTotal,
        cancellation_fee: feeCalculation.cancellation_fee,
        refund_amount: feeCalculation.refund_amount,
        refund_status: 'pending',
        cancellation_record_id: cancellationResult.cancellation_record_id,
      },
      message: 'Booking cancelled successfully. Refund will be processed according to policy.'
    });
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to cancel booking',
      500,
      undefined,
      requestId
    );
  }
}
