/**
 * Booking Lifecycle Management
 * Handles booking creation, status updates, and related operations
 * @module lib/booking-lifecycle
 */

import { query, transaction } from '@/lib/db';
import { getLatestExchangeRate } from '@/lib/exchange';
import type { Booking } from '@/types/api';

/**
 * Generate a unique booking number
 * Format: BK-YYYYMMDD-XXXXX
 * @returns Generated booking number
 */
export function generateBookingNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Generate random 5-digit number
  const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');

  return `BK-${year}${month}${day}-${random}`;
}

/**
 * Create a booking from an accepted quotation
 * This function:
 * 1. Validates the quotation exists and is in draft/sent status
 * 2. Locks the current exchange rate
 * 3. Generates a unique booking number
 * 4. Creates the booking record
 * 5. Updates the quotation status to 'accepted'
 *
 * @param quotationId - The ID of the quotation to convert to a booking
 * @returns The created booking record
 * @throws Error if quotation not found or already accepted
 */
export async function createBookingFromQuotation(
  quotationId: number
): Promise<Booking> {
  try {
    // Get quotation details
    const quotations = await query<any>(
      'SELECT * FROM quotes WHERE id = ?',
      [quotationId]
    );

    if (quotations.length === 0) {
      throw new Error(`Quotation with ID ${quotationId} not found`);
    }

    const quotation = quotations[0];

    // Check if quotation is already accepted or converted to booking
    if (quotation.status === 'accepted') {
      throw new Error(`Quotation ${quotationId} has already been accepted`);
    }

    // Lock current exchange rate (assuming EUR to TRY conversion)
    // You may need to adjust this based on the quotation's currency
    const fromCurrency = quotation.currency || 'EUR';
    const toCurrency = 'TRY'; // Assuming TRY is the base currency for operations

    let lockedRate: number | null = null;
    if (fromCurrency !== toCurrency) {
      lockedRate = await getLatestExchangeRate(fromCurrency, toCurrency);
    } else {
      lockedRate = 1;
    }

    // Generate unique booking number
    let bookingNumber: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      bookingNumber = generateBookingNumber();

      // Check if booking number already exists
      const existing = await query<any>(
        'SELECT id FROM bookings WHERE booking_number = ?',
        [bookingNumber]
      );

      if (existing.length === 0) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique booking number after multiple attempts');
    }

    // Create booking and update quotation in a single transaction
    // This ensures data consistency - if any operation fails, all changes are rolled back
    const booking = await transaction(async (conn) => {
      // Insert booking record
      const [insertResult] = await conn.query(
        `INSERT INTO bookings (
          quotation_id,
          booking_number,
          locked_exchange_rate,
          currency,
          status
        ) VALUES (?, ?, ?, ?, 'confirmed')`,
        [quotationId, bookingNumber!, lockedRate, fromCurrency]
      );

      const insertId = (insertResult as any).insertId;

      // Update quotation status to 'accepted'
      await conn.query(
        'UPDATE quotes SET status = ? WHERE id = ?',
        ['accepted', quotationId]
      );

      // Fetch the created booking within the transaction
      const [createdBookings] = await conn.query<any[]>(
        'SELECT * FROM bookings WHERE id = ?',
        [insertId]
      );

      if (createdBookings.length === 0) {
        throw new Error('Failed to retrieve created booking');
      }

      return createdBookings[0] as Booking;
    });

    // TODO: Generate draft receivable and payable invoices
    // This will be implemented when invoice functionality is available
    // await generateDraftInvoicesForBooking(booking.id);

    return booking;
  } catch (error) {
    console.error('Error creating booking from quotation:', error);
    throw error;
  }
}

/**
 * Get booking by ID
 * @param bookingId - The booking ID
 * @returns The booking record or null if not found
 */
export async function getBookingById(bookingId: number): Promise<Booking | null> {
  try {
    const bookings = await query<Booking>(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );

    return bookings[0] || null;
  } catch (error) {
    console.error('Error fetching booking by ID:', error);
    throw error;
  }
}

/**
 * Update booking status
 * @param bookingId - The booking ID
 * @param status - The new status
 * @returns The updated booking record
 * @throws Error if booking not found
 */
export async function updateBookingStatus(
  bookingId: number,
  status: 'confirmed' | 'cancelled'
): Promise<Booking> {
  try {
    // Check if booking exists
    const booking = await getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking with ID ${bookingId} not found`);
    }

    // Update the status
    await query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, bookingId]
    );

    // Fetch updated booking
    const updatedBooking = await getBookingById(bookingId);
    if (!updatedBooking) {
      throw new Error('Failed to retrieve updated booking');
    }

    return updatedBooking;
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

/**
 * Get paginated list of bookings
 * @param limit - Number of records to fetch
 * @param offset - Number of records to skip
 * @returns Array of bookings
 */
export async function getBookings(limit: number, offset: number): Promise<Booking[]> {
  try {
    const bookings = await query<Booking>(
      'SELECT * FROM bookings ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    return bookings;
  } catch (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }
}

/**
 * Get total count of bookings
 * @returns Total number of bookings
 */
export async function getBookingsCount(): Promise<number> {
  try {
    const result = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM bookings'
    );

    return result[0]?.count || 0;
  } catch (error) {
    console.error('Error counting bookings:', error);
    throw error;
  }
}
