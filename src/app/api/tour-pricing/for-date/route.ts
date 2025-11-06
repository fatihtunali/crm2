import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface TourPricingRecord {
  id: number;
  tour_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  sic_price_2_pax: number;
  sic_price_4_pax: number;
  sic_price_6_pax: number;
  sic_price_8_pax: number;
  sic_price_10_pax: number;
  pvt_price_2_pax: number;
  pvt_price_4_pax: number;
  pvt_price_6_pax: number;
  pvt_price_8_pax: number;
  pvt_price_10_pax: number;
  sic_provider_id: number | null;
  pvt_provider_id: number | null;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface TourPricingResponse {
  id: number;
  tour_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  sic_price_2_pax: Money;
  sic_price_4_pax: Money;
  sic_price_6_pax: Money;
  sic_price_8_pax: Money;
  sic_price_10_pax: Money;
  pvt_price_2_pax: Money;
  pvt_price_4_pax: Money;
  pvt_price_6_pax: Money;
  pvt_price_8_pax: Money;
  pvt_price_10_pax: Money;
  sic_provider_id: number | null;
  pvt_provider_id: number | null;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

function convertToResponse(record: TourPricingRecord): TourPricingResponse {
  return {
    id: record.id,
    tour_id: record.tour_id,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    sic_price_2_pax: { amount_minor: toMinorUnits(record.sic_price_2_pax), currency: record.currency },
    sic_price_4_pax: { amount_minor: toMinorUnits(record.sic_price_4_pax), currency: record.currency },
    sic_price_6_pax: { amount_minor: toMinorUnits(record.sic_price_6_pax), currency: record.currency },
    sic_price_8_pax: { amount_minor: toMinorUnits(record.sic_price_8_pax), currency: record.currency },
    sic_price_10_pax: { amount_minor: toMinorUnits(record.sic_price_10_pax), currency: record.currency },
    pvt_price_2_pax: { amount_minor: toMinorUnits(record.pvt_price_2_pax), currency: record.currency },
    pvt_price_4_pax: { amount_minor: toMinorUnits(record.pvt_price_4_pax), currency: record.currency },
    pvt_price_6_pax: { amount_minor: toMinorUnits(record.pvt_price_6_pax), currency: record.currency },
    pvt_price_8_pax: { amount_minor: toMinorUnits(record.pvt_price_8_pax), currency: record.currency },
    pvt_price_10_pax: { amount_minor: toMinorUnits(record.pvt_price_10_pax), currency: record.currency },
    sic_provider_id: record.sic_provider_id,
    pvt_provider_id: record.pvt_provider_id,
    notes: record.notes,
    status: record.status,
    effective_from: record.effective_from,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * GET /api/tour-pricing/for-date
 *
 * Get tour pricing for a specific tour on a specific date
 *
 * Query parameters:
 * - tour_id (required): The tour ID
 * - date (required): The date in YYYY-MM-DD format
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tourIdParam = searchParams.get('tour_id');
    const dateParam = searchParams.get('date');

    if (!tourIdParam) {
      return NextResponse.json(
        { error: 'tour_id parameter is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const tourId = parseInt(tourIdParam, 10);
    if (isNaN(tourId)) {
      return NextResponse.json(
        { error: 'tour_id must be a valid number' },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const records = await query<TourPricingRecord>(
      `SELECT * FROM tour_pricing
       WHERE tour_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [tourId, dateParam]
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active pricing found for tour ${tourId} on date ${dateParam}`
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
