import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import { checkSeasonOverlap, validatePricingData } from '@/lib/pricing-validation';
import { requirePermission } from '@/middleware/permissions';
import type { Money, PagedResponse } from '@/types/api';

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

interface GuidePricingInput {
  guide_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  full_day_price: Money;
  half_day_price: Money;
  night_price: Money;
  notes?: string;
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

// GET - Fetch guide pricing with pagination, search, sort, and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse filters
    const guideId = searchParams.get('guide_id');
    const seasonName = searchParams.get('season_name');
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search');

    // Parse sort parameters
    const sortParam = searchParams.get('sort');
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'guide_id', 'season_name', 'start_date', 'end_date', 'full_day_price', 'half_day_price', 'night_price', 'currency', 'status', 'created_at', 'updated_at'];
    const sortClause = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'start_date DESC';

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (guideId) {
      conditions.push('guide_id = ?');
      params.push(guideId);
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
      `SELECT COUNT(*) as total FROM guide_pricing ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const records = await query<GuidePricingRecord>(
      `SELECT * FROM guide_pricing ${whereClause} ORDER BY ${sortClause} LIMIT ? OFFSET ?`,
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

    const body: GuidePricingInput = await request.json();
    const {
      guide_id,
      season_name,
      start_date,
      end_date,
      currency,
      full_day_price,
      half_day_price,
      night_price,
      notes
    } = body;

    // Validate pricing data format
    const validation = validatePricingData({ start_date, end_date, season_name });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check for season overlaps
    const overlapResult = await checkSeasonOverlap(
      'guide_pricing',
      'guide_id',
      guide_id,
      start_date,
      end_date
    );

    if (overlapResult.hasOverlap) {
      return NextResponse.json(
        {
          error: overlapResult.message,
          conflicting_seasons: overlapResult.conflictingSeasons
        },
        { status: 409 }
      );
    }

    const result = await query(
      `INSERT INTO guide_pricing (
        guide_id, season_name, start_date, end_date, currency,
        full_day_price, half_day_price, night_price,
        notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?)`,
      [
        guide_id,
        season_name,
        start_date,
        end_date,
        currency,
        fromMinorUnits(full_day_price.amount_minor),
        fromMinorUnits(half_day_price.amount_minor),
        fromMinorUnits(night_price.amount_minor),
        notes,
        user.userId
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created record
    const created = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
      [insertId]
    );

    const createdRecord = created[0];
    if (!createdRecord) {
      return NextResponse.json({ error: 'Failed to fetch created record' }, { status: 500 });
    }

    const responseData = convertToResponse(createdRecord);

    // Build response with Location header
    const response = NextResponse.json(responseData, { status: 201 });
    response.headers.set('Location', `/api/guide-pricing/${insertId}`);

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

// PUT - Update existing guide pricing record
export async function PUT(request: NextRequest) {
  try {
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
      full_day_price,
      half_day_price,
      night_price,
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

    // Get current record to check guide_id
    const currentRecord = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
      [id]
    );

    if (!currentRecord || currentRecord.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    const guideId = currentRecord[0].guide_id;

    // Check for season overlaps (excluding current record)
    const overlapResult = await checkSeasonOverlap(
      'guide_pricing',
      'guide_id',
      guideId,
      start_date,
      end_date,
      id
    );

    if (overlapResult.hasOverlap) {
      return NextResponse.json(
        {
          error: overlapResult.message,
          conflicting_seasons: overlapResult.conflictingSeasons
        },
        { status: 409 }
      );
    }

    await query(
      `UPDATE guide_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        full_day_price = ?, half_day_price = ?, night_price = ?,
        notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name, start_date, end_date, currency,
        fromMinorUnits(full_day_price.amount_minor),
        fromMinorUnits(half_day_price.amount_minor),
        fromMinorUnits(night_price.amount_minor),
        notes, status || 'active', id
      ]
    );

    // Fetch updated record
    const updated = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
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

// DELETE - Delete guide pricing record (soft delete)
export async function DELETE(request: NextRequest) {
  try {
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
    const existing = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Soft delete by setting status to 'archived'
    await query(
      'UPDATE guide_pricing SET status = ?, updated_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true, message: 'Pricing record deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
