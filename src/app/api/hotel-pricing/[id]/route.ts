import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

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

interface HotelPricingPatchInput {
  season_name?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  double_room_bb?: Money;
  single_supplement_bb?: Money;
  triple_room_bb?: Money;
  child_0_6_bb?: Money;
  child_6_12_bb?: Money;
  hb_supplement?: Money;
  fb_supplement?: Money;
  ai_supplement?: Money;
  base_meal_plan?: string;
  notes?: string;
  status?: string;
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

// GET - Fetch single hotel pricing record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const records = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    const record = records[0];
    if (!record) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    const responseData = convertToResponse(record);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// PATCH - Update hotel pricing record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: HotelPricingPatchInput = await request.json();

    // Check if record exists
    const existing = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];

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

    if (body.currency !== undefined) {
      updates.push('currency = ?');
      values.push(body.currency);
    }

    if (body.double_room_bb !== undefined) {
      updates.push('double_room_bb = ?');
      values.push(fromMinorUnits(body.double_room_bb.amount_minor));
    }

    if (body.single_supplement_bb !== undefined) {
      updates.push('single_supplement_bb = ?');
      values.push(fromMinorUnits(body.single_supplement_bb.amount_minor));
    }

    if (body.triple_room_bb !== undefined) {
      updates.push('triple_room_bb = ?');
      values.push(fromMinorUnits(body.triple_room_bb.amount_minor));
    }

    if (body.child_0_6_bb !== undefined) {
      updates.push('child_0_6_bb = ?');
      values.push(fromMinorUnits(body.child_0_6_bb.amount_minor));
    }

    if (body.child_6_12_bb !== undefined) {
      updates.push('child_6_12_bb = ?');
      values.push(fromMinorUnits(body.child_6_12_bb.amount_minor));
    }

    if (body.hb_supplement !== undefined) {
      updates.push('hb_supplement = ?');
      values.push(fromMinorUnits(body.hb_supplement.amount_minor));
    }

    if (body.fb_supplement !== undefined) {
      updates.push('fb_supplement = ?');
      values.push(fromMinorUnits(body.fb_supplement.amount_minor));
    }

    if (body.ai_supplement !== undefined) {
      updates.push('ai_supplement = ?');
      values.push(fromMinorUnits(body.ai_supplement.amount_minor));
    }

    if (body.base_meal_plan !== undefined) {
      updates.push('base_meal_plan = ?');
      values.push(body.base_meal_plan);
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
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add id to values array
    values.push(id);

    await query(
      `UPDATE hotel_pricing SET ${updates.join(', ')} WHERE id = ?`,
      values
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

// DELETE - Soft delete hotel pricing record (set status to archived)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if record exists
    const existing = await query<HotelPricingRecord>(
      'SELECT * FROM hotel_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Soft delete by setting status to archived
    await query(
      'UPDATE hotel_pricing SET archived_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
