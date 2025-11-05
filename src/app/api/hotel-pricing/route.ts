import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { Money, PagedResponse } from '@/types/api';

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

interface HotelPricingInput {
  hotel_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  double_room_bb: Money;
  single_supplement_bb: Money;
  triple_room_bb: Money;
  child_0_6_bb: Money;
  child_6_12_bb: Money;
  hb_supplement: Money;
  fb_supplement: Money;
  ai_supplement: Money;
  base_meal_plan: string;
  notes?: string;
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

// GET - Fetch hotel pricing with pagination, search, sort, and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse filters
    const hotelId = searchParams.get('hotel_id');
    const seasonName = searchParams.get('season_name');
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search');

    // Parse sort parameters
    const sortParam = searchParams.get('sort');
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'hotel_id', 'season_name', 'start_date', 'end_date', 'currency', 'base_meal_plan', 'status', 'created_at', 'updated_at'];
    const sortClause = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'start_date DESC';

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (hotelId) {
      conditions.push('hotel_id = ?');
      params.push(hotelId);
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
      `SELECT COUNT(*) as total FROM hotel_pricing ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const records = await query<HotelPricingRecord>(
      `SELECT * FROM hotel_pricing ${whereClause} ORDER BY ${sortClause} LIMIT ? OFFSET ?`,
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

    const body: HotelPricingInput = await request.json();
    const {
      hotel_id,
      season_name,
      start_date,
      end_date,
      currency,
      double_room_bb,
      single_supplement_bb,
      triple_room_bb,
      child_0_6_bb,
      child_6_12_bb,
      hb_supplement,
      fb_supplement,
      ai_supplement,
      base_meal_plan,
      notes
    } = body;

    const result = await query(
      `INSERT INTO hotel_pricing (
        hotel_id, season_name, start_date, end_date, currency,
        double_room_bb, single_supplement_bb, triple_room_bb,
        child_0_6_bb, child_6_12_bb, hb_supplement, fb_supplement, ai_supplement,
        base_meal_plan, notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), 3)`,
      [
        hotel_id, season_name, start_date, end_date, currency,
        fromMinorUnits(double_room_bb.amount_minor),
        fromMinorUnits(single_supplement_bb.amount_minor),
        fromMinorUnits(triple_room_bb.amount_minor),
        fromMinorUnits(child_0_6_bb.amount_minor),
        fromMinorUnits(child_6_12_bb.amount_minor),
        fromMinorUnits(hb_supplement.amount_minor),
        fromMinorUnits(fb_supplement.amount_minor),
        fromMinorUnits(ai_supplement.amount_minor),
        base_meal_plan, notes
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created record
    const created = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [insertId]
    );

    const createdRecord = created[0];
    if (!createdRecord) {
      return NextResponse.json({ error: 'Failed to fetch created record' }, { status: 500 });
    }

    const responseData = convertToResponse(createdRecord);

    // Build response with Location header
    const response = NextResponse.json(responseData, { status: 201 });
    response.headers.set('Location', `/api/hotel-pricing/${insertId}`);

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
