import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { Money, PagedResponse } from '@/types/api';

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

interface VehiclePricingInput {
  vehicle_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  price_per_day: Money;
  price_half_day: Money;
  notes?: string;
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

// GET - Fetch vehicle pricing with pagination, search, sort, and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse filters
    const vehicleId = searchParams.get('vehicle_id');
    const seasonName = searchParams.get('season_name');
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search');

    // Parse sort parameters
    const sortParam = searchParams.get('sort');
    const sortClause = parseSortParams(sortParam) || 'start_date DESC';

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (vehicleId) {
      conditions.push('vehicle_id = ?');
      params.push(vehicleId);
    }

    if (seasonName) {
      conditions.push('season_name = ?');
      params.push(seasonName);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(season_name LIKE ? OR notes LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM vehicle_pricing ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const records = await query<VehiclePricingRecord>(
      `SELECT * FROM vehicle_pricing ${whereClause} ORDER BY ${sortClause} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    // Convert to response format with Money types
    const data = records.map(convertToResponse);

    // Build paged response
    const response = buildPagedResponse(data, total, page, pageSize);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// POST - Create new pricing record
export async function POST(request: NextRequest) {
  try {
    // Check for idempotency key
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (idempotencyKey) {
      const cachedResponse = await checkIdempotencyKey(request, idempotencyKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const body: VehiclePricingInput = await request.json();
    const {
      vehicle_id,
      season_name,
      start_date,
      end_date,
      currency,
      price_per_day,
      price_half_day,
      notes
    } = body;

    const result = await query(
      `INSERT INTO vehicle_pricing (
        vehicle_id, season_name, start_date, end_date, currency,
        price_per_day, price_half_day, notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), 3)`,
      [
        vehicle_id,
        season_name,
        start_date,
        end_date,
        currency,
        fromMinorUnits(price_per_day.amount_minor),
        fromMinorUnits(price_half_day.amount_minor),
        notes
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created record
    const created = await query<VehiclePricingRecord>(
      'SELECT * FROM vehicle_pricing WHERE id = ?',
      [insertId]
    );

    const createdRecord = created[0];
    if (!createdRecord) {
      return NextResponse.json({ error: 'Failed to fetch created record' }, { status: 500 });
    }

    const responseData = convertToResponse(createdRecord);

    // Build response with Location header
    const response = NextResponse.json(responseData, { status: 201 });
    response.headers.set('Location', `/api/vehicle-pricing/${insertId}`);

    // Store idempotency key if provided
    if (idempotencyKey) {
      storeIdempotencyKey(idempotencyKey, response);
    }

    return response;
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create pricing' }, { status: 500 });
  }
}
