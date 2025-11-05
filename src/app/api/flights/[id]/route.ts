import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { errorResponse, internalServerErrorProblem } from '@/lib/response';

interface FlightRecord {
  id: number;
  organization_id: number;
  provider_id: number | null;
  from_airport: string;
  to_airport: string;
  from_city: string | null;
  to_city: string | null;
  season_name: string | null;
  start_date: string;
  end_date: string;
  departure_time: string | null;
  arrival_time: string | null;
  price_oneway: number;
  price_roundtrip: number;
  airline: string | null;
  flight_number: string | null;
  booking_class: string;
  baggage_allowance: string | null;
  currency: string;
  notes: string | null;
  status: string;
  created_at: string;
  created_by: number | null;
  archived_at: string | null;
  provider_name?: string;
}

// GET - Fetch single flight by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const records = await query<FlightRecord>(
      'SELECT f.*, p.provider_name FROM flight_pricing f LEFT JOIN providers p ON f.provider_id = p.id WHERE f.id = ?',
      [id]
    );

    if (records.length === 0) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Flight not found'
      });
    }

    return NextResponse.json(records[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch flight'));
  }
}

// PATCH - Update flight
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if record exists
    const existing = await query<FlightRecord>(
      'SELECT * FROM flight_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Flight not found'
      });
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];

    if (body.provider_id !== undefined) {
      updates.push('provider_id = ?');
      values.push(body.provider_id || null);
    }

    if (body.from_airport !== undefined) {
      updates.push('from_airport = ?');
      values.push(body.from_airport);
    }

    if (body.to_airport !== undefined) {
      updates.push('to_airport = ?');
      values.push(body.to_airport);
    }

    if (body.from_city !== undefined) {
      updates.push('from_city = ?');
      values.push(body.from_city);
    }

    if (body.to_city !== undefined) {
      updates.push('to_city = ?');
      values.push(body.to_city);
    }

    if (body.season_name !== undefined) {
      updates.push('season_name = ?');
      values.push(body.season_name);
    }

    if (body.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(body.start_date);
    }

    if (body.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(body.end_date);
    }

    if (body.departure_time !== undefined) {
      updates.push('departure_time = ?');
      values.push(body.departure_time);
    }

    if (body.arrival_time !== undefined) {
      updates.push('arrival_time = ?');
      values.push(body.arrival_time);
    }

    if (body.price_oneway !== undefined) {
      updates.push('price_oneway = ?');
      values.push(body.price_oneway);
    }

    if (body.price_roundtrip !== undefined) {
      updates.push('price_roundtrip = ?');
      values.push(body.price_roundtrip);
    }

    if (body.airline !== undefined) {
      updates.push('airline = ?');
      values.push(body.airline);
    }

    if (body.flight_number !== undefined) {
      updates.push('flight_number = ?');
      values.push(body.flight_number);
    }

    if (body.booking_class !== undefined) {
      updates.push('booking_class = ?');
      values.push(body.booking_class);
    }

    if (body.baggage_allowance !== undefined) {
      updates.push('baggage_allowance = ?');
      values.push(body.baggage_allowance);
    }

    if (body.currency !== undefined) {
      updates.push('currency = ?');
      values.push(body.currency);
    }

    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes);
    }

    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }

    if (updates.length === 0) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'No fields to update'
      });
    }

    // Add id to values array
    values.push(id);

    await query(
      `UPDATE flight_pricing SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated record
    const updated = await query<FlightRecord>(
      'SELECT f.*, p.provider_name FROM flight_pricing f LEFT JOIN providers p ON f.provider_id = p.id WHERE f.id = ?',
      [id]
    );

    if (updated.length === 0) {
      return errorResponse(internalServerErrorProblem('Failed to fetch updated flight'));
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update flight'));
  }
}

// DELETE - Soft delete flight (set status to archived)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if record exists
    const existing = await query<FlightRecord>(
      'SELECT * FROM flight_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return errorResponse({
        type: 'https://httpstatuses.com/404',
        title: 'Not Found',
        status: 404,
        detail: 'Flight not found'
      });
    }

    // Soft delete by setting status to archived and archived_at timestamp
    await query(
      'UPDATE flight_pricing SET status = ?, archived_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to delete flight'));
  }
}
