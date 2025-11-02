import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all intercity transfers with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const fromCityFilter = searchParams.get('from_city');
    const toCityFilter = searchParams.get('to_city');
    const searchTerm = searchParams.get('search');

    let sql = `
      SELECT
        t.*,
        p.provider_name,
        v.vehicle_type,
        v.max_capacity
      FROM intercity_transfers t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND t.status = ?';
      params.push(statusFilter);
    }

    if (fromCityFilter && fromCityFilter !== 'all') {
      sql += ' AND t.from_city = ?';
      params.push(fromCityFilter);
    }

    if (toCityFilter && toCityFilter !== 'all') {
      sql += ' AND t.to_city = ?';
      params.push(toCityFilter);
    }

    if (searchTerm) {
      sql += ' AND (t.from_city LIKE ? OR t.to_city LIKE ? OR t.season_name LIKE ? OR v.vehicle_type LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY t.from_city, t.to_city, t.start_date';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }
}

// POST - Create new intercity transfer
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organization_id,
      vehicle_id,
      from_city,
      to_city,
      season_name,
      start_date,
      end_date,
      price_oneway,
      price_roundtrip,
      estimated_duration_hours,
      notes
    } = body;

    const result = await query(
      `INSERT INTO intercity_transfers (
        organization_id, vehicle_id, from_city, to_city, season_name,
        start_date, end_date, price_oneway, price_roundtrip,
        estimated_duration_hours, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [
        organization_id || 1,
        vehicle_id,
        from_city,
        to_city,
        season_name,
        start_date,
        end_date,
        price_oneway,
        price_roundtrip,
        estimated_duration_hours,
        notes
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
  }
}

// PUT - Update intercity transfer
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      provider_id,
      vehicle_id,
      from_city,
      to_city,
      season_name,
      start_date,
      end_date,
      price_oneway,
      price_roundtrip,
      estimated_duration_hours,
      notes,
      status
    } = body;

    await query(
      `UPDATE intercity_transfers SET
        provider_id = ?, vehicle_id = ?, from_city = ?, to_city = ?, season_name = ?,
        start_date = ?, end_date = ?, price_oneway = ?, price_roundtrip = ?,
        estimated_duration_hours = ?, notes = ?, status = ?
      WHERE id = ?`,
      [
        provider_id,
        vehicle_id,
        from_city,
        to_city,
        season_name,
        start_date,
        end_date,
        price_oneway,
        price_roundtrip,
        estimated_duration_hours,
        notes,
        status,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) intercity transfer
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE intercity_transfers SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive transfer' }, { status: 500 });
  }
}
