import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface HotelPricingRecord {
  id: number;
  hotel_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  double_room_bb: number;
  single_supplement_bb: number;
  triple_room_bb: number;
  child_0_6_bb: number;
  child_6_12_bb: number;
  hb_supplement: number;
  fb_supplement: number;
  ai_supplement: number;
  base_meal_plan: string;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface HotelPricingResponse {
  id: number;
  hotel_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  double_room_bb: Money;
  single_supplement_bb: Money;
  triple_room_bb: Money;
  child_0_6_bb: Money;
  child_6_12_bb: Money;
  hb_supplement: Money;
  fb_supplement: Money;
  ai_supplement: Money;
  base_meal_plan: string;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

function convertToResponse(record: HotelPricingRecord): HotelPricingResponse {
  return {
    id: record.id,
    hotel_id: record.hotel_id,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    double_room_bb: { amount_minor: toMinorUnits(record.double_room_bb), currency: record.currency },
    single_supplement_bb: { amount_minor: toMinorUnits(record.single_supplement_bb), currency: record.currency },
    triple_room_bb: { amount_minor: toMinorUnits(record.triple_room_bb), currency: record.currency },
    child_0_6_bb: { amount_minor: toMinorUnits(record.child_0_6_bb), currency: record.currency },
    child_6_12_bb: { amount_minor: toMinorUnits(record.child_6_12_bb), currency: record.currency },
    hb_supplement: { amount_minor: toMinorUnits(record.hb_supplement), currency: record.currency },
    fb_supplement: { amount_minor: toMinorUnits(record.fb_supplement), currency: record.currency },
    ai_supplement: { amount_minor: toMinorUnits(record.ai_supplement), currency: record.currency },
    base_meal_plan: record.base_meal_plan,
    notes: record.notes,
    status: record.status,
    effective_from: record.effective_from,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * GET /api/hotel-pricing/for-date
 *
 * Get hotel pricing for a specific hotel on a specific date
 *
 * Query parameters:
 * - hotel_id (required): The hotel ID
 * - date (required): The date in YYYY-MM-DD format
 *
 * Returns the pricing record for the season that covers the specified date.
 * If multiple seasons overlap (which should be prevented), returns the most recent (by effective_from).
 *
 * @example
 * GET /api/hotel-pricing/for-date?hotel_id=123&date=2025-12-25
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse required parameters
    const hotelIdParam = searchParams.get('hotel_id');
    const dateParam = searchParams.get('date');

    // Validate parameters
    if (!hotelIdParam) {
      return NextResponse.json(
        { error: 'hotel_id parameter is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const hotelId = parseInt(hotelIdParam, 10);
    if (isNaN(hotelId)) {
      return NextResponse.json(
        { error: 'hotel_id must be a valid number' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Query for pricing that covers the specified date
    // If multiple records match (overlapping seasons), prefer the most recent effective_from
    const records = await query<HotelPricingRecord>(
      `SELECT * FROM hotel_pricing
       WHERE hotel_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [hotelId, dateParam]
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active pricing found for hotel ${hotelId} on date ${dateParam}`
        },
        { status: 404 }
      );
    }

    const responseData = convertToResponse(records[0]);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing for date' },
      { status: 500 }
    );
  }
}
