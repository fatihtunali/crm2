import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all vehicles with their pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const cityFilter = searchParams.get('city');

    let sql = `
      SELECT
        v.*,
        p.provider_name,
        vp.id as pricing_id,
        vp.season_name,
        vp.start_date as season_start,
        vp.end_date as season_end,
        vp.currency,
        vp.price_per_day,
        vp.price_half_day
      FROM vehicles v
      LEFT JOIN providers p ON v.provider_id = p.id
      LEFT JOIN vehicle_pricing vp ON v.id = vp.vehicle_id
        AND vp.status = 'active'
        AND CURDATE() BETWEEN vp.start_date AND vp.end_date
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND v.status = ?';
      params.push(statusFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND v.city = ?';
      params.push(cityFilter);
    }

    sql += ' ORDER BY v.id DESC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
  }
}

// POST - Create new vehicle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organization_id,
      vehicle_type,
      max_capacity,
      city,
      description
    } = body;

    const result = await query(
      `INSERT INTO vehicles (
        organization_id, vehicle_type, max_capacity, city, description, status
      ) VALUES (?, ?, ?, ?, ?, 'active')`,
      [
        organization_id || 1,
        vehicle_type,
        max_capacity,
        city,
        description
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 });
  }
}

// PUT - Update vehicle
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      provider_id,
      vehicle_type,
      max_capacity,
      city,
      description,
      status
    } = body;

    await query(
      `UPDATE vehicles SET
        provider_id = ?, vehicle_type = ?, max_capacity = ?, city = ?, description = ?, status = ?
      WHERE id = ?`,
      [
        provider_id,
        vehicle_type,
        max_capacity,
        city,
        description,
        status,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) vehicle
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE vehicles SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive vehicle' }, { status: 500 });
  }
}
