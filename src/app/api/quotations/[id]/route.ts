import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch single quotation with days and expenses
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get quote
    const [quote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Get days
    const days = await query(
      'SELECT * FROM quote_days WHERE quote_id = ? ORDER BY day_number',
      [id]
    ) as any[];

    // Get expenses for each day
    for (const day of days) {
      day.expenses = await query(
        'SELECT * FROM quote_expenses WHERE quote_day_id = ? ORDER BY id',
        [day.id]
      );
    }

    return NextResponse.json({
      ...quote,
      days
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotation' }, { status: 500 });
  }
}
