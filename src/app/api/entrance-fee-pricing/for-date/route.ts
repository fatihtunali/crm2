import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface EntranceFeePricingRecord {
  id: number;
  entrance_fee_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  adult_price: number;
  child_price: number;
  student_price: number;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface EntranceFeePricingResponse {
  id: number;
  entrance_fee_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  adult_price: Money;
  child_price: Money;
  student_price: Money;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

function convertToResponse(record: EntranceFeePricingRecord): EntranceFeePricingResponse {
  return {
    id: record.id,
    entrance_fee_id: record.entrance_fee_id,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    adult_price: { amount_minor: toMinorUnits(record.adult_price), currency: record.currency },
    child_price: { amount_minor: toMinorUnits(record.child_price), currency: record.currency },
    student_price: { amount_minor: toMinorUnits(record.student_price), currency: record.currency },
    notes: record.notes,
    status: record.status,
    effective_from: record.effective_from,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * GET /api/entrance-fee-pricing/for-date
 *
 * Get entrance fee pricing for a specific site on a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const entranceFeeIdParam = searchParams.get('entrance_fee_id');
    const dateParam = searchParams.get('date');

    if (!entranceFeeIdParam) {
      return NextResponse.json(
        { error: 'entrance_fee_id parameter is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const entranceFeeId = parseInt(entranceFeeIdParam, 10);
    if (isNaN(entranceFeeId)) {
      return NextResponse.json(
        { error: 'entrance_fee_id must be a valid number' },
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

    const records = await query<EntranceFeePricingRecord>(
      `SELECT * FROM entrance_fee_pricing
       WHERE entrance_fee_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [entranceFeeId, dateParam]
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active pricing found for entrance fee ${entranceFeeId} on date ${dateParam}`
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
