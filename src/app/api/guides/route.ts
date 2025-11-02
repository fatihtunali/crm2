import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all guides with their pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const cityFilter = searchParams.get('city');
    const languageFilter = searchParams.get('language');

    let sql = `
      SELECT
        g.*,
        p.provider_name,
        p.id as provider_id,
        gp.id as pricing_id,
        gp.season_name,
        gp.start_date as season_start,
        gp.end_date as season_end,
        gp.currency,
        gp.full_day_price,
        gp.half_day_price,
        gp.night_price
      FROM guides g
      LEFT JOIN providers p ON g.provider_id = p.id
      LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
        AND gp.status = 'active'
        AND CURDATE() BETWEEN gp.start_date AND gp.end_date
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND g.status = ?';
      params.push(statusFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND g.city = ?';
      params.push(cityFilter);
    }

    if (languageFilter && languageFilter !== 'all') {
      sql += ' AND g.language = ?';
      params.push(languageFilter);
    }

    sql += ' ORDER BY g.city ASC, g.language ASC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch guides' }, { status: 500 });
  }
}

// POST - Create new guide
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organization_id,
      city,
      language,
      description
    } = body;

    const result = await query(
      `INSERT INTO guides (
        organization_id, city, language, description, status
      ) VALUES (?, ?, ?, ?, 'active')`,
      [
        organization_id || 1,
        city,
        language,
        description
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 });
  }
}

// PUT - Update guide
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      organization_id,
      provider_id,
      city,
      language,
      description,
      status
    } = body;

    await query(
      `UPDATE guides SET
        organization_id = ?, provider_id = ?, city = ?, language = ?, description = ?, status = ?
      WHERE id = ?`,
      [
        organization_id,
        provider_id,
        city,
        language,
        description,
        status,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update guide' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) guide
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE guides SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive guide' }, { status: 500 });
  }
}
