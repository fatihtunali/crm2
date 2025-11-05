import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

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

interface TourPricingPatchInput {
  season_name?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  sic_price_2_pax?: Money;
  sic_price_4_pax?: Money;
  sic_price_6_pax?: Money;
  sic_price_8_pax?: Money;
  sic_price_10_pax?: Money;
  pvt_price_2_pax?: Money;
  pvt_price_4_pax?: Money;
  pvt_price_6_pax?: Money;
  pvt_price_8_pax?: Money;
  pvt_price_10_pax?: Money;
  sic_provider_id?: number | null;
  pvt_provider_id?: number | null;
  notes?: string;
  status?: string;
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

// GET - Fetch single tour pricing record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const records = await query<TourPricingRecord>(
      'SELECT * FROM tour_pricing WHERE id = ?',
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

// PATCH - Update tour pricing record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: TourPricingPatchInput = await request.json();

    // Check if record exists
    const existing = await query<TourPricingRecord>(
      'SELECT * FROM tour_pricing WHERE id = ?',
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

    if (body.sic_price_2_pax !== undefined) {
      updates.push('sic_price_2_pax = ?');
      values.push(fromMinorUnits(body.sic_price_2_pax.amount_minor));
    }

    if (body.sic_price_4_pax !== undefined) {
      updates.push('sic_price_4_pax = ?');
      values.push(fromMinorUnits(body.sic_price_4_pax.amount_minor));
    }

    if (body.sic_price_6_pax !== undefined) {
      updates.push('sic_price_6_pax = ?');
      values.push(fromMinorUnits(body.sic_price_6_pax.amount_minor));
    }

    if (body.sic_price_8_pax !== undefined) {
      updates.push('sic_price_8_pax = ?');
      values.push(fromMinorUnits(body.sic_price_8_pax.amount_minor));
    }

    if (body.sic_price_10_pax !== undefined) {
      updates.push('sic_price_10_pax = ?');
      values.push(fromMinorUnits(body.sic_price_10_pax.amount_minor));
    }

    if (body.pvt_price_2_pax !== undefined) {
      updates.push('pvt_price_2_pax = ?');
      values.push(fromMinorUnits(body.pvt_price_2_pax.amount_minor));
    }

    if (body.pvt_price_4_pax !== undefined) {
      updates.push('pvt_price_4_pax = ?');
      values.push(fromMinorUnits(body.pvt_price_4_pax.amount_minor));
    }

    if (body.pvt_price_6_pax !== undefined) {
      updates.push('pvt_price_6_pax = ?');
      values.push(fromMinorUnits(body.pvt_price_6_pax.amount_minor));
    }

    if (body.pvt_price_8_pax !== undefined) {
      updates.push('pvt_price_8_pax = ?');
      values.push(fromMinorUnits(body.pvt_price_8_pax.amount_minor));
    }

    if (body.pvt_price_10_pax !== undefined) {
      updates.push('pvt_price_10_pax = ?');
      values.push(fromMinorUnits(body.pvt_price_10_pax.amount_minor));
    }

    if (body.sic_provider_id !== undefined) {
      updates.push('sic_provider_id = ?');
      values.push(body.sic_provider_id);
    }

    if (body.pvt_provider_id !== undefined) {
      updates.push('pvt_provider_id = ?');
      values.push(body.pvt_provider_id);
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

// DELETE - Soft delete tour pricing record (set status to archived)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if record exists
    const existing = await query<TourPricingRecord>(
      'SELECT * FROM tour_pricing WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    // Soft delete by setting status to archived
    await query(
      'UPDATE tour_pricing SET archived_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['archived', id]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
