import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface VehiclePricingRecord {
  id: number;
  vehicle_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  price_per_day: number;
  price_half_day: number;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface VehiclePricingResponse {
  id: number;
  vehicle_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  price_per_day: Money;
  price_half_day: Money;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

function convertToResponse(record: VehiclePricingRecord): VehiclePricingResponse {
  return {
    id: record.id,
    vehicle_id: record.vehicle_id,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    price_per_day: { amount_minor: toMinorUnits(record.price_per_day), currency: record.currency },
    price_half_day: { amount_minor: toMinorUnits(record.price_half_day), currency: record.currency },
    notes: record.notes,
    status: record.status,
    effective_from: record.effective_from,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * GET /api/vehicle-pricing/for-date
 *
 * Get vehicle pricing for a specific vehicle on a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const vehicleIdParam = searchParams.get('vehicle_id');
    const dateParam = searchParams.get('date');

    if (!vehicleIdParam) {
      return NextResponse.json(
        { error: 'vehicle_id parameter is required' },
        { status: 400 }
      );
    }

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const vehicleId = parseInt(vehicleIdParam, 10);
    if (isNaN(vehicleId)) {
      return NextResponse.json(
        { error: 'vehicle_id must be a valid number' },
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

    const records = await query<VehiclePricingRecord>(
      `SELECT * FROM vehicle_pricing
       WHERE vehicle_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [vehicleId, dateParam]
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active pricing found for vehicle ${vehicleId} on date ${dateParam}`
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
