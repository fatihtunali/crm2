import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createBookingFromQuotation } from '@/lib/booking-lifecycle';
import {
  successResponse,
  errorResponse,
  badRequestProblem,
  notFoundProblem,
  internalServerErrorProblem,
} from '@/lib/response';

// PUT - Update quote status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      return errorResponse(
        badRequestProblem(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          `/api/quotations/${id}/status`
        )
      );
    }

    // Check if quote exists
    const [existingQuote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!existingQuote) {
      return errorResponse(
        notFoundProblem('Quote not found', `/api/quotations/${id}/status`)
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

        return successResponse({
          quote: updatedQuote,
          booking,
          message: 'Quote accepted and booking created successfully',
        });
      } catch (bookingError: any) {
        console.error('Error creating booking from quotation:', bookingError);

        // If booking creation fails, still update the quote status
        // but return an error indicating the booking creation failed
        await query(
          'UPDATE quotes SET status = ? WHERE id = ?',
          [status, id]
        );

        return errorResponse(
          internalServerErrorProblem(
            `Quote status updated but booking creation failed: ${bookingError.message}`,
            `/api/quotations/${id}/status`
          )
        );
      }
    } else {
      // For other status changes, just update the status
      await query(
        'UPDATE quotes SET status = ? WHERE id = ?',
        [status, id]
      );

      // Fetch updated quote
      const [updatedQuote] = await query(
        'SELECT * FROM quotes WHERE id = ?',
        [id]
      ) as any[];

      return successResponse({
        quote: updatedQuote,
        message: 'Quote status updated successfully',
      });
    }
  } catch (error) {
    console.error('Error updating quote status:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update status')
    );
  }
}
