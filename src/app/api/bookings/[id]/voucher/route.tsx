/**
 * Booking Voucher Generation Endpoint
 * GET /api/bookings/{id}/voucher
 *
 * Generates a PDF voucher for a confirmed booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { renderToStream } from '@react-pdf/renderer';
import {
  VoucherDocument,
  prepareVoucherData,
  generateQRCodeDataURL,
} from '@/lib/pdf-voucher';
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
import React from 'react';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'bookings', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (50 voucher generations per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_voucher`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Voucher generation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
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

    // Fetch booking with related quotation
    const [booking] = await query<any>(
      `SELECT
        b.*,
        q.*,
        b.id as booking_id,
        b.booking_number,
        b.status as booking_status,
        b.created_at as booking_created_at
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

    // Check if booking is confirmed
    if (booking.booking_status === 'cancelled') {
      return standardErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Cannot generate voucher for cancelled booking',
        400,
        undefined,
        requestId
      );
    }

    // Fetch itinerary (days and expenses)
    const daysWithExpenses = await query<any>(
      `SELECT
        d.id as day_id,
        d.day_number,
        d.date,
        e.id as expense_id,
        e.expense_type,
        e.description,
        e.quantity,
        e.unit_price,
        e.total_price
      FROM quote_days d
      LEFT JOIN quote_expenses e ON d.id = e.quote_day_id
      WHERE d.quote_id = ?
      ORDER BY d.day_number, e.id`,
      [booking.quotation_id]
    );

    // Group expenses by day
    const daysMap = new Map();
    for (const row of daysWithExpenses) {
      if (!daysMap.has(row.day_id)) {
        daysMap.set(row.day_id, {
          day_number: row.day_number,
          date: row.date,
          expenses: []
        });
      }

      if (row.expense_id) {
        daysMap.get(row.day_id).expenses.push({
          expense_type: row.expense_type,
          description: row.description,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price,
        });
      }
    }

    const days = Array.from(daysMap.values());

    // Prepare voucher data
    const voucherData = prepareVoucherData(
      {
        booking_number: booking.booking_number,
        status: booking.booking_status,
        created_at: booking.booking_created_at,
        currency: booking.currency,
      },
      {
        quote_number: booking.quote_number,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        destination: booking.destination,
        start_date: booking.start_date,
        end_date: booking.end_date,
        adults: booking.adults,
        children: booking.children,
        total_price: booking.total_price,
        currency: booking.currency,
      },
      days
    );

    // Generate QR code with booking reference URL
    const bookingUrl = `${request.nextUrl.origin}/bookings/${bookingId}`;
    const qrCodeDataUrl = await generateQRCodeDataURL(bookingUrl);

    // Add QR code to voucher data
    const completeVoucherData = {
      ...voucherData,
      qr_code_data_url: qrCodeDataUrl,
    };

    // Generate PDF
    const pdfStream = await renderToStream(
      <VoucherDocument data={completeVoucherData} />
    );

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of pdfStream as any) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Update booking voucher tracking
    await query(
      'UPDATE bookings SET voucher_generated_at = NOW(), voucher_number = ? WHERE id = ?',
      [booking.booking_number, bookingId]
    );

    // Audit log
    await auditLog(
      parseInt(tenantId),
      user.userId,
      'BOOKING_VOUCHER_GENERATED' as any,
      'BOOKING' as any,
      bookingId.toString(),
      {
        voucher_generated: true,
        booking_number: booking.booking_number,
      },
      {
        quote_number: booking.quote_number,
        customer_name: booking.customer_name,
      },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      booking_id: bookingId,
      pdf_size_bytes: pdfBuffer.length,
    });

    // Return PDF with proper headers
    const response = new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="voucher-${booking.booking_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    });

    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);

    return response;
  } catch (error: any) {
    console.error('Error generating voucher:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
      stack: error.stack,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to generate voucher PDF',
      500,
      undefined,
      requestId
    );
  }
}
