import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all meal pricing records
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const cityFilter = searchParams.get('city');
    const mealTypeFilter = searchParams.get('meal_type');

    let sql = `
      SELECT
        mp.*,
        p.provider_name
      FROM meal_pricing mp
      LEFT JOIN providers p ON mp.provider_id = p.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND status = ?';
      params.push(statusFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND city = ?';
      params.push(cityFilter);
    }

    if (mealTypeFilter && mealTypeFilter !== 'all') {
      sql += ' AND meal_type = ?';
      params.push(mealTypeFilter);
    }

    sql += ' ORDER BY restaurant_name ASC, season_name ASC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
  }
}

// POST - Create new meal pricing record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organization_id,
      restaurant_name,
      city,
      meal_type,
      season_name,
      start_date,
      end_date,
      currency,
      adult_lunch_price,
      child_lunch_price,
      adult_dinner_price,
      child_dinner_price,
      menu_description,
      effective_from,
      created_by,
      notes
    } = body;

    const result = await query(
      `INSERT INTO meal_pricing (
        organization_id, restaurant_name, city, meal_type, season_name,
        start_date, end_date, currency, adult_lunch_price, child_lunch_price,
        adult_dinner_price, child_dinner_price, menu_description, effective_from,
        created_by, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        organization_id || 1,
        restaurant_name,
        city,
        meal_type,
        season_name,
        start_date,
        end_date,
        currency,
        adult_lunch_price,
        child_lunch_price,
        adult_dinner_price,
        child_dinner_price,
        menu_description,
        effective_from,
        created_by,
        notes
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create restaurant pricing' }, { status: 500 });
  }
}

// PUT - Update meal pricing record
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      organization_id,
      provider_id,
      restaurant_name,
      city,
      meal_type,
      season_name,
      start_date,
      end_date,
      currency,
      adult_lunch_price,
      child_lunch_price,
      adult_dinner_price,
      child_dinner_price,
      menu_description,
      effective_from,
      created_by,
      notes,
      status
    } = body;

    await query(
      `UPDATE meal_pricing SET
        organization_id = ?, provider_id = ?, restaurant_name = ?, city = ?, meal_type = ?,
        season_name = ?, start_date = ?, end_date = ?, currency = ?,
        adult_lunch_price = ?, child_lunch_price = ?, adult_dinner_price = ?,
        child_dinner_price = ?, menu_description = ?, effective_from = ?,
        created_by = ?, notes = ?, status = ?
      WHERE id = ?`,
      [
        organization_id,
        provider_id,
        restaurant_name,
        city,
        meal_type,
        season_name,
        start_date,
        end_date,
        currency,
        adult_lunch_price,
        child_lunch_price,
        adult_dinner_price,
        child_dinner_price,
        menu_description,
        effective_from,
        created_by,
        notes,
        status,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update restaurant pricing' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) meal pricing record
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE meal_pricing SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive restaurant pricing' }, { status: 500 });
  }
}
