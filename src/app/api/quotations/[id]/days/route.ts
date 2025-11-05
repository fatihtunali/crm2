import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';

// GET - Fetch all days for a quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(request, 'quotations', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(request, 'quotations', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

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
// Uses transaction to ensure both expenses and day are deleted atomically
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'quotations', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    const { dayId } = await request.json();

    // Delete day and expenses in a transaction
    await transaction(async (conn) => {
      // First delete all expenses associated with this day
      await conn.query('DELETE FROM quote_expenses WHERE quote_day_id = ?', [dayId]);

      // Then delete the day itself
      await conn.query('DELETE FROM quote_days WHERE id = ?', [dayId]);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete day' }, { status: 500 });
  }
}
