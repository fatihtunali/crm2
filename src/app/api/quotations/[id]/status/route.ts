import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// PUT - Update quote status
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await query(
      'UPDATE quotes SET status = ? WHERE id = ?',
      [status, id]
    );

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error updating quote status:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
