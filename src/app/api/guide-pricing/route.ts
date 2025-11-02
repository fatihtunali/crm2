import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch pricing for a specific guide
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guideId = searchParams.get('guide_id');

    if (!guideId) {
      return NextResponse.json({ error: 'guide_id is required' }, { status: 400 });
    }

    const pricing = await query(
      `SELECT * FROM guide_pricing WHERE guide_id = ? ORDER BY start_date DESC`,
      [guideId]
    );

    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// POST - Create new pricing record
export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    const result = await query(
      `INSERT INTO guide_pricing (
        guide_id, season_name, start_date, end_date, currency,
        full_day_price, half_day_price, night_price,
        notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), 3)`,
      [
        guide_id,
        season_name,
        start_date,
        end_date,
        currency,
        full_day_price,
        half_day_price,
        night_price,
        notes
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create pricing' }, { status: 500 });
  }
}

// PUT - Update pricing record
export async function PUT(request: Request) {
  try {
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

    await query(
      `UPDATE guide_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        full_day_price = ?, half_day_price = ?, night_price = ?,
        notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name,
        start_date,
        end_date,
        currency,
        full_day_price,
        half_day_price,
        night_price,
        notes,
        status,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 });
  }
}

// DELETE - Delete pricing record
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query('UPDATE guide_pricing SET status = ? WHERE id = ?', ['archived', id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
