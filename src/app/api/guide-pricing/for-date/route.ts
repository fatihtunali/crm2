import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface GuidePricingRecord {
  id: number;
  guide_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  full_day_price: number;
  half_day_price: number;
  night_price: number;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface GuidePricingResponse {
  id: number;
  guide_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  full_day_price: Money;
  half_day_price: Money;
  night_price: Money;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

function convertToResponse(record: GuidePricingRecord): GuidePricingResponse {
  return {
    id: record.id,
    guide_id: record.guide_id,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    full_day_price: { amount_minor: toMinorUnits(record.full_day_price), currency: record.currency },
    half_day_price: { amount_minor: toMinorUnits(record.half_day_price), currency: record.currency },
    night_price: { amount_minor: toMinorUnits(record.night_price), currency: record.currency },
    notes: record.notes,
    status: record.status,
    effective_from: record.effective_from,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * GET /api/guide-pricing/for-date
 *
 * Get guide pricing for a specific guide on a specific date
 *
 * Query parameters:
 * - guide_id (required): The guide ID
 * - date (required): The date in YYYY-MM-DD format
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const guideIdParam = searchParams.get('guide_id');
    const dateParam = searchParams.get('date');

    if (!guideIdParam) {
      return NextResponse.json(
        { error: 'guide_id parameter is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const guideId = parseInt(guideIdParam, 10);
    if (isNaN(guideId)) {
      return NextResponse.json(
        { error: 'guide_id must be a valid number' },
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

    const records = await query<GuidePricingRecord>(
      `SELECT * FROM guide_pricing
       WHERE guide_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [guideId, dateParam]
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active pricing found for guide ${guideId} on date ${dateParam}`
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
