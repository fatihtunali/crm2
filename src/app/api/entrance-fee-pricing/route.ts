import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch pricing for a specific entrance fee
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entranceFeeId = searchParams.get('entrance_fee_id');

    if (!entranceFeeId) {
      return NextResponse.json({ error: 'entrance_fee_id is required' }, { status: 400 });
    }

    const pricing = await query(
      `SELECT * FROM entrance_fee_pricing WHERE entrance_fee_id = ? ORDER BY start_date DESC`,
      [entranceFeeId]
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
      entrance_fee_id,
      season_name,
      start_date,
      end_date,
      currency,
      adult_price,
      child_price,
      student_price,
      notes
    } = body;

    const result = await query(
      `INSERT INTO entrance_fee_pricing (
        entrance_fee_id, season_name, start_date, end_date, currency,
        adult_price, child_price, student_price,
        notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), 3)`,
      [
        entrance_fee_id, season_name, start_date, end_date, currency,
        adult_price, child_price, student_price,
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
      adult_price,
      child_price,
      student_price,
      notes,
      status
    } = body;

    await query(
      `UPDATE entrance_fee_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        adult_price = ?, child_price = ?, student_price = ?,
        notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name, start_date, end_date, currency,
        adult_price, child_price, student_price,
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

    await query('UPDATE entrance_fee_pricing SET status = ? WHERE id = ?', ['archived', id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
