import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST - Create a new expense
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      quote_day_id,
      category,
      hotel_category,
      location,
      description,
      price,
      single_supplement,
      child_0to2,
      child_3to5,
      child_6to11,
      vehicle_count,
      price_per_vehicle
    } = body;

    const result = await query(
      `INSERT INTO quote_expenses (
        quote_day_id, category, hotel_category, location, description,
        price, single_supplement, child_0to2, child_3to5, child_6to11,
        vehicle_count, price_per_vehicle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quote_day_id,
        category,
        hotel_category,
        location,
        description,
        price || 0,
        single_supplement,
        child_0to2,
        child_3to5,
        child_6to11,
        vehicle_count,
        price_per_vehicle
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

// PUT - Update an expense
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      category,
      hotel_category,
      location,
      description,
      price,
      single_supplement,
      child_0to2,
      child_3to5,
      child_6to11,
      vehicle_count,
      price_per_vehicle
    } = body;

    await query(
      `UPDATE quote_expenses SET
        category = ?, hotel_category = ?, location = ?, description = ?,
        price = ?, single_supplement = ?, child_0to2 = ?, child_3to5 = ?,
        child_6to11 = ?, vehicle_count = ?, price_per_vehicle = ?
      WHERE id = ?`,
      [
        category,
        hotel_category,
        location,
        description,
        price || 0,
        single_supplement,
        child_0to2,
        child_3to5,
        child_6to11,
        vehicle_count,
        price_per_vehicle,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE - Delete an expense
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query('DELETE FROM quote_expenses WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
