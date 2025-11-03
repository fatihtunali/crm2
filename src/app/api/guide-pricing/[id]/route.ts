import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

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

interface GuidePricingPatchInput {
  season_name?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  full_day_price?: Money;
  half_day_price?: Money;
  night_price?: Money;
  notes?: string;
  status?: string;
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

// GET - Fetch single guide pricing record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const records = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
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

// PATCH - Update guide pricing record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: GuidePricingPatchInput = await request.json();

    // Check if record exists
    const existing = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
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

    if (body.full_day_price !== undefined) {
      updates.push('full_day_price = ?');
      values.push(fromMinorUnits(body.full_day_price.amount_minor));
    }

    if (body.half_day_price !== undefined) {
      updates.push('half_day_price = ?');
      values.push(fromMinorUnits(body.half_day_price.amount_minor));
    }

    if (body.night_price !== undefined) {
      updates.push('night_price = ?');
      values.push(fromMinorUnits(body.night_price.amount_minor));
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
      `UPDATE guide_pricing SET ${updates.join(', ')} WHERE id = ?`,
      values
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

// DELETE - Soft delete guide pricing record (set status to archived)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if record exists
    const existing = await query<GuidePricingRecord>(
      'SELECT * FROM guide_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Soft delete by setting status to archived
    await query(
      'UPDATE guide_pricing SET status = ?, updated_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
