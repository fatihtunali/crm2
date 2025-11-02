import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch pricing for a specific vehicle
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicle_id');

    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });
    }

    const pricing = await query(
      `SELECT * FROM vehicle_pricing WHERE vehicle_id = ? ORDER BY start_date DESC`,
      [vehicleId]
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
      vehicle_id,
      season_name,
      start_date,
      end_date,
      currency,
      price_per_day,
      price_half_day,
      notes
    } = body;

    const result = await query(
      `INSERT INTO vehicle_pricing (
        vehicle_id, season_name, start_date, end_date, currency,
        price_per_day, price_half_day, notes, status, effective_from, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), 3)`,
      [
        vehicle_id,
        season_name,
        start_date,
        end_date,
        currency,
        price_per_day,
        price_half_day,
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
      price_per_day,
      price_half_day,
      notes,
      status
    } = body;

    await query(
      `UPDATE vehicle_pricing SET
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        price_per_day = ?, price_half_day = ?, notes = ?, status = ?
      WHERE id = ?`,
      [
        season_name,
        start_date,
        end_date,
        currency,
        price_per_day,
        price_half_day,
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

    await query('UPDATE vehicle_pricing SET status = ? WHERE id = ?', ['archived', id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing' }, { status: 500 });
  }
}
