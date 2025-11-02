import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all extra expenses with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('expense_category');
    const cityFilter = searchParams.get('city');
    const searchTerm = searchParams.get('search');

    let sql = `
      SELECT
        ee.id,
        ee.organization_id,
        ee.expense_name,
        ee.expense_category,
        ee.city,
        ee.currency,
        ee.unit_price,
        ee.unit_type,
        ee.description,
        ee.status,
        ee.created_at,
        ee.updated_at,
        p.provider_name
      FROM extra_expenses ee
      LEFT JOIN providers p ON ee.provider_id = p.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND status = ?';
      params.push(statusFilter);
    }

    if (categoryFilter && categoryFilter !== 'all') {
      sql += ' AND expense_category = ?';
      params.push(categoryFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND city = ?';
      params.push(cityFilter);
    }

    if (searchTerm) {
      sql += ' AND (expense_name LIKE ? OR description LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    sql += ' ORDER BY expense_name ASC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch extra expenses' }, { status: 500 });
  }
}

// POST - Create new extra expense
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organization_id,
      expense_name,
      expense_category,
      city,
      currency,
      unit_price,
      unit_type,
      description
    } = body;

    const result = await query(
      `INSERT INTO extra_expenses (
        organization_id, expense_name, expense_category, city, currency,
        unit_price, unit_type, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        organization_id || 1,
        expense_name,
        expense_category,
        city,
        currency,
        unit_price,
        unit_type,
        description || null
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create extra expense' }, { status: 500 });
  }
}

// PUT - Update extra expense
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      provider_id,
      expense_name,
      expense_category,
      city,
      currency,
      unit_price,
      unit_type,
      description,
      status
    } = body;

    await query(
      `UPDATE extra_expenses SET
        provider_id = ?, expense_name = ?, expense_category = ?, city = ?, currency = ?,
        unit_price = ?, unit_type = ?, description = ?, status = ?
      WHERE id = ?`,
      [
        provider_id,
        expense_name,
        expense_category,
        city,
        currency,
        unit_price,
        unit_type,
        description || null,
        status,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update extra expense' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) extra expense
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE extra_expenses SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive extra expense' }, { status: 500 });
  }
}
