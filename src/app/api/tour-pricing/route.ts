import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { checkIdempotencyKey, storeIdempotencyKey } from '@/middleware/idempotency';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import { checkSeasonOverlap, validatePricingData } from '@/lib/pricing-validation';
import { requirePermission } from '@/middleware/permissions';
import type { Money, PagedResponse } from '@/types/api';

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

interface TourPricingInput {
  tour_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
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
  sic_provider_id?: number | null;
  pvt_provider_id?: number | null;
  notes?: string;
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

// GET - Fetch tour pricing with pagination, search, sort, and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse filters
    const tourId = searchParams.get('tour_id');
    const seasonName = searchParams.get('season_name');
    const status = searchParams.get('status') || 'active';
    const search = searchParams.get('search');

    // Parse sort parameters
    const sortParam = searchParams.get('sort');
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'tour_id', 'season_name', 'start_date', 'end_date', 'currency', 'status', 'created_at', 'updated_at'];
    const sortClause = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'start_date DESC';

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (tourId) {
      conditions.push('tour_id = ?');
      params.push(tourId);
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
      `SELECT COUNT(*) as total FROM tour_pricing ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const records = await query<TourPricingRecord>(
      `SELECT * FROM tour_pricing ${whereClause} ORDER BY ${sortClause} LIMIT ? OFFSET ?`,
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

    const body: TourPricingInput = await request.json();
    const {
      tour_id,
      season_name,
      start_date,
      end_date,
      currency,
      sic_price_2_pax,
      sic_price_4_pax,
      sic_price_6_pax,
      sic_price_8_pax,
      sic_price_10_pax,
      pvt_price_2_pax,
      pvt_price_4_pax,
      pvt_price_6_pax,
      pvt_price_8_pax,
      pvt_price_10_pax,
      sic_provider_id,
      pvt_provider_id,
      notes
    } = body;

    // Validate pricing data format
    const validation = validatePricingData({ start_date, end_date, season_name });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check for season overlaps
    const overlapResult = await checkSeasonOverlap(
      'tour_pricing',
      'tour_id',
      tour_id,
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
      `INSERT INTO tour_pricing (
        tour_id, season_name, start_date, end_date, currency,
        sic_price_2_pax, sic_price_4_pax, sic_price_6_pax, sic_price_8_pax, sic_price_10_pax,
        pvt_price_2_pax, pvt_price_4_pax, pvt_price_6_pax, pvt_price_8_pax, pvt_price_10_pax,
        sic_provider_id, pvt_provider_id,
        notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), ?)`,
      [
        tour_id, season_name, start_date, end_date, currency,
        fromMinorUnits(sic_price_2_pax.amount_minor),
        fromMinorUnits(sic_price_4_pax.amount_minor),
        fromMinorUnits(sic_price_6_pax.amount_minor),
        fromMinorUnits(sic_price_8_pax.amount_minor),
        fromMinorUnits(sic_price_10_pax.amount_minor),
        fromMinorUnits(pvt_price_2_pax.amount_minor),
        fromMinorUnits(pvt_price_4_pax.amount_minor),
        fromMinorUnits(pvt_price_6_pax.amount_minor),
        fromMinorUnits(pvt_price_8_pax.amount_minor),
        fromMinorUnits(pvt_price_10_pax.amount_minor),
        sic_provider_id || null,
        pvt_provider_id || null,
        notes,
        user.userId
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created record
    const created = await query<TourPricingRecord>(
      'SELECT * FROM tour_pricing WHERE id = ?',
      [insertId]
    );

    const createdRecord = created[0];
    if (!createdRecord) {
      return NextResponse.json({ error: 'Failed to fetch created record' }, { status: 500 });
    }

    const responseData = convertToResponse(createdRecord);

    // Build response with Location header
    const response = NextResponse.json(responseData, { status: 201 });
    response.headers.set('Location', `/api/tour-pricing/${insertId}`);

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

// PUT - Update pricing record
export async function PUT(request: NextRequest) {
  try {
    const body: any = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // If dates are being updated, validate for overlaps
    if (updateData.start_date !== undefined || updateData.end_date !== undefined || updateData.tour_id !== undefined) {
      // Fetch existing record to get current values
      const existing = await query<TourPricingRecord>(
        'SELECT * FROM tour_pricing WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      const current = existing[0];
      const tourId = updateData.tour_id !== undefined ? updateData.tour_id : current.tour_id;
      const startDate = updateData.start_date !== undefined ? updateData.start_date : current.start_date;
      const endDate = updateData.end_date !== undefined ? updateData.end_date : current.end_date;
      const seasonName = updateData.season_name !== undefined ? updateData.season_name : current.season_name;

      // Validate pricing data format
      const validation = validatePricingData({ start_date: startDate, end_date: endDate, season_name: seasonName });
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Check for season overlaps (excluding current record)
      const overlapResult = await checkSeasonOverlap(
        'tour_pricing',
        'tour_id',
        tourId,
        startDate,
        endDate,
        id // Exclude this record from overlap check
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
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];

    if (updateData.season_name !== undefined) {
      updates.push('season_name = ?');
      values.push(updateData.season_name);
    }

    if (updateData.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(updateData.start_date);
    }

    if (updateData.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(updateData.end_date);
    }

    if (updateData.currency !== undefined) {
      updates.push('currency = ?');
      values.push(updateData.currency);
    }

    // Handle price fields (expecting raw numbers from frontend)
    if (updateData.sic_price_2_pax !== undefined) {
      updates.push('sic_price_2_pax = ?');
      values.push(updateData.sic_price_2_pax);
    }

    if (updateData.sic_price_4_pax !== undefined) {
      updates.push('sic_price_4_pax = ?');
      values.push(updateData.sic_price_4_pax);
    }

    if (updateData.sic_price_6_pax !== undefined) {
      updates.push('sic_price_6_pax = ?');
      values.push(updateData.sic_price_6_pax);
    }

    if (updateData.sic_price_8_pax !== undefined) {
      updates.push('sic_price_8_pax = ?');
      values.push(updateData.sic_price_8_pax);
    }

    if (updateData.sic_price_10_pax !== undefined) {
      updates.push('sic_price_10_pax = ?');
      values.push(updateData.sic_price_10_pax);
    }

    if (updateData.pvt_price_2_pax !== undefined) {
      updates.push('pvt_price_2_pax = ?');
      values.push(updateData.pvt_price_2_pax);
    }

    if (updateData.pvt_price_4_pax !== undefined) {
      updates.push('pvt_price_4_pax = ?');
      values.push(updateData.pvt_price_4_pax);
    }

    if (updateData.pvt_price_6_pax !== undefined) {
      updates.push('pvt_price_6_pax = ?');
      values.push(updateData.pvt_price_6_pax);
    }

    if (updateData.pvt_price_8_pax !== undefined) {
      updates.push('pvt_price_8_pax = ?');
      values.push(updateData.pvt_price_8_pax);
    }

    if (updateData.pvt_price_10_pax !== undefined) {
      updates.push('pvt_price_10_pax = ?');
      values.push(updateData.pvt_price_10_pax);
    }

    if (updateData.sic_provider_id !== undefined) {
      updates.push('sic_provider_id = ?');
      values.push(updateData.sic_provider_id || null);
    }

    if (updateData.pvt_provider_id !== undefined) {
      updates.push('pvt_provider_id = ?');
      values.push(updateData.pvt_provider_id || null);
    }

    if (updateData.notes !== undefined) {
      updates.push('notes = ?');
      values.push(updateData.notes);
    }

    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add id to values array
    values.push(id);

    await query(
      `UPDATE tour_pricing SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated record
    const updated = await query<TourPricingRecord>(
      'SELECT * FROM tour_pricing WHERE id = ?',
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

// DELETE - Soft delete pricing record
export async function DELETE(request: NextRequest) {
  try {
    const body: any = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Soft delete by setting status to archived
    await query(
      'UPDATE tour_pricing SET status = ?, updated_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
