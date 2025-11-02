import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch pricing for a specific tour
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tourId = searchParams.get('tour_id');

    if (!tourId) {
      return NextResponse.json({ error: 'tour_id is required' }, { status: 400 });
    }

    const pricing = await query(
      `SELECT * FROM tour_pricing WHERE tour_id = ? ORDER BY start_date DESC`,
      [tourId]
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
      notes
    } = body;

    const result = await query(
      `INSERT INTO tour_pricing (
        tour_id, season_name, start_date, end_date, currency,
        sic_price_2_pax, sic_price_4_pax, sic_price_6_pax, sic_price_8_pax, sic_price_10_pax,
        pvt_price_2_pax, pvt_price_4_pax, pvt_price_6_pax, pvt_price_8_pax, pvt_price_10_pax,
        notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), 3)`,
      [
        tour_id, season_name, start_date, end_date, currency,
        sic_price_2_pax, sic_price_4_pax, sic_price_6_pax, sic_price_8_pax, sic_price_10_pax,
        pvt_price_2_pax, pvt_price_4_pax, pvt_price_6_pax, pvt_price_8_pax, pvt_price_10_pax,
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
      notes,
      status
    } = body;

    await query(
      `UPDATE tour_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        sic_price_2_pax = ?, sic_price_4_pax = ?, sic_price_6_pax = ?, sic_price_8_pax = ?, sic_price_10_pax = ?,
        pvt_price_2_pax = ?, pvt_price_4_pax = ?, pvt_price_6_pax = ?, pvt_price_8_pax = ?, pvt_price_10_pax = ?,
        notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name, start_date, end_date, currency,
        sic_price_2_pax, sic_price_4_pax, sic_price_6_pax, sic_price_8_pax, sic_price_10_pax,
        pvt_price_2_pax, pvt_price_4_pax, pvt_price_6_pax, pvt_price_8_pax, pvt_price_10_pax,
        notes, status, id
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

    await query('UPDATE tour_pricing SET status = ? WHERE id = ?', ['archived', id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
