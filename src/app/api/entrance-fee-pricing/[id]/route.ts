import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface EntranceFeePricingRecord {
  id: number;
  entrance_fee_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  adult_price: number;
  child_price: number;
  student_price: number;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface EntranceFeePricingResponse {
  id: number;
  entrance_fee_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  adult_price: Money;
  child_price: Money;
  student_price: Money;
  notes: string | null;
  status: string;
  effective_from: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

interface EntranceFeePricingPatchInput {
  season_name?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  adult_price?: Money;
  child_price?: Money;
  student_price?: Money;
  notes?: string;
  status?: string;
}

function convertToResponse(record: EntranceFeePricingRecord): EntranceFeePricingResponse {
  return {
    id: record.id,
    entrance_fee_id: record.entrance_fee_id,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    adult_price: { amount_minor: toMinorUnits(record.adult_price), currency: record.currency },
    child_price: { amount_minor: toMinorUnits(record.child_price), currency: record.currency },
    student_price: { amount_minor: toMinorUnits(record.student_price), currency: record.currency },
    notes: record.notes,
    status: record.status,
    effective_from: record.effective_from,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

// GET - Fetch single entrance fee pricing record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const records = await query<EntranceFeePricingRecord>(
      'SELECT * FROM entrance_fee_pricing WHERE id = ?',
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

// PATCH - Update entrance fee pricing record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: EntranceFeePricingPatchInput = await request.json();

    // Check if record exists
    const existing = await query<EntranceFeePricingRecord>(
      'SELECT * FROM entrance_fee_pricing WHERE id = ?',
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

    if (body.adult_price !== undefined) {
      updates.push('adult_price = ?');
      values.push(fromMinorUnits(body.adult_price.amount_minor));
    }

    if (body.child_price !== undefined) {
      updates.push('child_price = ?');
      values.push(fromMinorUnits(body.child_price.amount_minor));
    }

    if (body.student_price !== undefined) {
      updates.push('student_price = ?');
      values.push(fromMinorUnits(body.student_price.amount_minor));
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
      `UPDATE entrance_fee_pricing SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated record
    const updated = await query<EntranceFeePricingRecord>(
      'SELECT * FROM entrance_fee_pricing WHERE id = ?',
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

// DELETE - Soft delete entrance fee pricing record (set status to archived)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if record exists
    const existing = await query<EntranceFeePricingRecord>(
      'SELECT * FROM entrance_fee_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Soft delete by setting status to archived
    await query(
      'UPDATE entrance_fee_pricing SET status = ?, updated_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
