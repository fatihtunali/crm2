import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface FlightPricingRecord {
  id: number;
  organization_id: number;
  provider_id: number | null;
  from_airport: string;
  to_airport: string;
  from_city: string | null;
  to_city: string | null;
  season_name: string | null;
  start_date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  end_date: string | null;
  price_oneway: number;
  price_roundtrip: number;
  booking_class: string;
  baggage_allowance: string | null;
  currency: string;
  airline: string | null;
  flight_number: string | null;
  notes: string | null;
  status: string;
  archived_at: string | null;
  created_at: string;
  created_by: number | null;
}

interface FlightPricingResponse {
  id: number;
  organization_id: number;
  provider_id: number | null;
  from_airport: string;
  to_airport: string;
  from_city: string | null;
  to_city: string | null;
  season_name: string | null;
  start_date: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  end_date: string | null;
  price_oneway: Money;
  price_roundtrip: Money;
  booking_class: string;
  baggage_allowance: string | null;
  airline: string | null;
  flight_number: string | null;
  notes: string | null;
  status: string;
  archived_at: string | null;
  created_at: string;
  created_by: number | null;
}

function convertToResponse(record: FlightPricingRecord): FlightPricingResponse {
  return {
    id: record.id,
    organization_id: record.organization_id,
    provider_id: record.provider_id,
    from_airport: record.from_airport,
    to_airport: record.to_airport,
    from_city: record.from_city,
    to_city: record.to_city,
    season_name: record.season_name,
    start_date: record.start_date,
    departure_time: record.departure_time,
    arrival_time: record.arrival_time,
    end_date: record.end_date,
    price_oneway: { amount_minor: toMinorUnits(record.price_oneway || 0), currency: record.currency },
    price_roundtrip: { amount_minor: toMinorUnits(record.price_roundtrip || 0), currency: record.currency },
    booking_class: record.booking_class,
    baggage_allowance: record.baggage_allowance,
    airline: record.airline,
    flight_number: record.flight_number,
    notes: record.notes,
    status: record.status,
    archived_at: record.archived_at,
    created_at: record.created_at,
    created_by: record.created_by,
  };
}

/**
 * GET /api/flight-pricing/for-date
 *
 * Get flight pricing for a specific route on a specific date
 *
 * Query parameters:
 * - from_airport (optional): Departure airport code
 * - to_airport (optional): Arrival airport code
 * - date (required): The date in YYYY-MM-DD format
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const fromAirport = searchParams.get('from_airport');
    const toAirport = searchParams.get('to_airport');
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
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

    const conditions = ['status = ?', '(? BETWEEN start_date AND end_date OR start_date IS NULL)'];
    const params: any[] = ['active', dateParam];

    if (fromAirport) {
      conditions.push('from_airport = ?');
      params.push(fromAirport);
    }

    if (toAirport) {
      conditions.push('to_airport = ?');
      params.push(toAirport);
    }

    const records = await query<FlightPricingRecord>(
      `SELECT * FROM flight_pricing
       WHERE ${conditions.join(' AND ')}
       ORDER BY start_date DESC
       LIMIT 1`,
      params
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active flight pricing found on date ${dateParam}`
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
