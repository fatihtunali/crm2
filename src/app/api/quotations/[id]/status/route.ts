import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createBookingFromQuotation } from '@/lib/booking-lifecycle';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// PUT - Update quote status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      return validationErrorResponse(
        'Invalid request data',
        [{
          field: 'status',
          issue: 'invalid',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }],
        requestId
      );
    }

    // Check if quote exists and belongs to user's organization
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingQuote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quote not found',
        404,
        undefined,
        requestId
      );
    }

    // If status is changing to 'accepted', trigger booking creation
    if (status === 'accepted' && existingQuote.status !== 'accepted') {
      try {
        // Create booking from quotation
        // This function will also update the quote status to 'accepted'
        const booking = await createBookingFromQuotation(parseInt(id));

        // Fetch updated quote
        const [updatedQuote] = await query(
          'SELECT * FROM quotes WHERE id = ?',
          [id]
        ) as any[];

        // AUDIT: Log status change and booking creation
        await auditLog(
          parseInt(tenantId),
          user.userId,
          AuditActions.QUOTATION_UPDATED,
          AuditResources.QUOTATION,
          id.toString(),
          {
            status: 'accepted',
            previous_status: existingQuote.status,
            booking_created: booking.id,
          },
          {
            quote_number: existingQuote.quote_number,
            booking_id: booking.id,
          },
          request
        );

        logResponse(requestId, 200, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          quote_id: id,
          status: 'accepted',
          booking_created: booking.id,
        });

        const response = NextResponse.json({
          quote: updatedQuote,
          booking,
          message: 'Quote accepted and booking created successfully',
        });
        addStandardHeaders(response, requestId);
        addRateLimitHeaders(response, rateLimit);
        return response;
      } catch (bookingError: any) {
        console.error('Error creating booking from quotation:', bookingError);

        // If booking creation fails, still update the quote status
        // but return an error indicating the booking creation failed
        await query(
          'UPDATE quotes SET status = ? WHERE id = ? AND organization_id = ?',
          [status, id, parseInt(tenantId)]
        );

        logResponse(requestId, 500, Date.now() - startTime, {
          error: bookingError.message,
          quote_id: id,
          booking_creation_failed: true,
        });

        return standardErrorResponse(
          ErrorCodes.INTERNAL_ERROR,
          `Quote status updated but booking creation failed: ${bookingError.message}`,
          500,
          undefined,
          requestId
        );
      }
    } else {
      // For other status changes, just update the status
      await query(
        'UPDATE quotes SET status = ? WHERE id = ? AND organization_id = ?',
        [status, id, parseInt(tenantId)]
      );

      // Fetch updated quote
      const [updatedQuote] = await query(
        'SELECT * FROM quotes WHERE id = ?',
        [id]
      ) as any[];

      // AUDIT: Log status change
      await auditLog(
        parseInt(tenantId),
        user.userId,
        AuditActions.QUOTATION_UPDATED,
        AuditResources.QUOTATION,
        id.toString(),
        {
          status,
          previous_status: existingQuote.status,
        },
        {
          quote_number: existingQuote.quote_number,
        },
        request
      );

      logResponse(requestId, 200, Date.now() - startTime, {
        user_id: user.userId,
        tenant_id: tenantId,
        quote_id: id,
        status,
      });

      const response = NextResponse.json({
        quote: updatedQuote,
        message: 'Quote status updated successfully',
      });
      addStandardHeaders(response, requestId);
      addRateLimitHeaders(response, rateLimit);
      return response;
    }
  } catch (error: any) {
    console.error('Error updating quote status:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update status',
      500,
      undefined,
      requestId
    );
  }
}
