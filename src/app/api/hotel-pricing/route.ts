import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import { checkSeasonOverlap, validatePricingData } from '@/lib/pricing-validation';
import { requirePermission } from '@/middleware/permissions';
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
    // 1. Authenticate and get user
    const authResult = await requirePermission(request, 'pricing', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user } = authResult;

    // 2. Check for idempotency key
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

    // Validate pricing data format
    const validation = validatePricingData({ start_date, end_date, season_name });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check for season overlaps
    const overlapResult = await checkSeasonOverlap(
      'hotel_pricing',
      'hotel_id',
      hotel_id,
      start_date,
      end_date
    );

    if (overlapResult.hasOverlap) {
      return NextResponse.json(
        {
          error: overlapResult.message,
          conflicting_seasons: overlapResult.conflictingSeasons
        },
        { status: 409 } // 409 Conflict
      );
    }

    const result = await query(
      `INSERT INTO hotel_pricing (
        hotel_id, season_name, start_date, end_date, currency,
        double_room_bb, single_supplement_bb, triple_room_bb,
        child_0_6_bb, child_6_12_bb, hb_supplement, fb_supplement, ai_supplement,
        base_meal_plan, notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?)`,
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
        base_meal_plan, notes, user.userId
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

// PUT - Update existing pricing record
export async function PUT(request: NextRequest) {
  try {
    // 1. Authenticate and get user
    const authResult = await requirePermission(request, 'pricing', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user } = authResult;

    const body = await request.json();
    const {
      id,
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
      notes,
      status
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Pricing ID is required' }, { status: 400 });
    }

    // Validate pricing data format
    const validation = validatePricingData({ start_date, end_date, season_name });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Get current record to check hotel_id
    const currentRecord = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [id]
    );

    if (!currentRecord || currentRecord.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    const hotelId = currentRecord[0].hotel_id;

    // Check for season overlaps (excluding current record)
    const overlapResult = await checkSeasonOverlap(
      'hotel_pricing',
      'hotel_id',
      hotelId,
      start_date,
      end_date,
      id // Exclude current record from overlap check
    );

    if (overlapResult.hasOverlap) {
      return NextResponse.json(
        {
          error: overlapResult.message,
          conflicting_seasons: overlapResult.conflictingSeasons
        },
        { status: 409 } // 409 Conflict
      );
    }

    await query(
      `UPDATE hotel_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        double_room_bb = ?, single_supplement_bb = ?, triple_room_bb = ?,
        child_0_6_bb = ?, child_6_12_bb = ?, hb_supplement = ?, fb_supplement = ?, ai_supplement = ?,
        base_meal_plan = ?, notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name, start_date, end_date, currency,
        fromMinorUnits(double_room_bb.amount_minor),
        fromMinorUnits(single_supplement_bb.amount_minor),
        fromMinorUnits(triple_room_bb.amount_minor),
        fromMinorUnits(child_0_6_bb.amount_minor),
        fromMinorUnits(child_6_12_bb.amount_minor),
        fromMinorUnits(hb_supplement.amount_minor),
        fromMinorUnits(fb_supplement.amount_minor),
        fromMinorUnits(ai_supplement.amount_minor),
        base_meal_plan, notes, status || 'active', id
      ]
    );

    // Fetch updated record
    const updated = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [id]
    );

    const updatedRecord = updated[0];
    if (!updatedRecord) {
      return NextResponse.json({ error: 'Failed to fetch updated record' }, { status: 500 });
    }

    const responseData = convertToResponse(updatedRecord);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 });
  }
}

// DELETE - Delete pricing record (soft delete by setting status to 'inactive')
export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate and get user
    const authResult = await requirePermission(request, 'pricing', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Pricing ID is required' }, { status: 400 });
    }

    // Check if record exists
    const existing = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Soft delete by setting status to 'inactive'
    await query(
      'UPDATE hotel_pricing SET status = ?, updated_at = NOW() WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true, message: 'Pricing record deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
