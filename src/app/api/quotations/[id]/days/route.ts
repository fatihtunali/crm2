import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all days for a quote
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const days = await query(
      'SELECT * FROM quote_days WHERE quote_id = ? ORDER BY day_number',
      [id]
    );

    return NextResponse.json(days);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch days' }, { status: 500 });
  }
}

// POST - Create a new day
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { day_number, date } = body;

    const result = await query(
      'INSERT INTO quote_days (quote_id, day_number, date) VALUES (?, ?, ?)',
      [id, day_number, date]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create day' }, { status: 500 });
  }
}

// DELETE - Delete a day and its expenses
export async function DELETE(request: Request) {
  try {
    const { dayId } = await request.json();

    await query('DELETE FROM quote_days WHERE id = ?', [dayId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete day' }, { status: 500 });
  }
}
