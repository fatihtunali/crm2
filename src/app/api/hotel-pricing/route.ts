import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch pricing for a specific hotel
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get('hotel_id');

    if (!hotelId) {
      return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 });
    }

    const pricing = await query(
      `SELECT * FROM hotel_pricing WHERE hotel_id = ? ORDER BY start_date DESC`,
      [hotelId]
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
        double_room_bb, single_supplement_bb, triple_room_bb,
        child_0_6_bb, child_6_12_bb, hb_supplement, fb_supplement, ai_supplement,
        base_meal_plan, notes
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

    await query(
      `UPDATE hotel_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        double_room_bb = ?, single_supplement_bb = ?, triple_room_bb = ?,
        child_0_6_bb = ?, child_6_12_bb = ?, hb_supplement = ?,
        fb_supplement = ?, ai_supplement = ?, base_meal_plan = ?,
        notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name, start_date, end_date, currency,
        double_room_bb, single_supplement_bb, triple_room_bb,
        child_0_6_bb, child_6_12_bb, hb_supplement,
        fb_supplement, ai_supplement, base_meal_plan,
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

    await query('UPDATE hotel_pricing SET status = ? WHERE id = ?', ['archived', id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
