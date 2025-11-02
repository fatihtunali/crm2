import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all tour packages with their pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const tourTypeFilter = searchParams.get('tour_type');
    const cityFilter = searchParams.get('city');

    let sql = `
      SELECT
        t.*,
        p.provider_name,
        tp.id as pricing_id,
        tp.season_name,
        tp.start_date as season_start,
        tp.end_date as season_end,
        tp.currency,
        tp.sic_price_2_pax,
        tp.sic_price_4_pax,
        tp.sic_price_6_pax,
        tp.sic_price_8_pax,
        tp.sic_price_10_pax,
        tp.pvt_price_2_pax,
        tp.pvt_price_4_pax,
        tp.pvt_price_6_pax,
        tp.pvt_price_8_pax,
        tp.pvt_price_10_pax
      FROM tours t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
        AND tp.status = 'active'
        AND CURDATE() BETWEEN tp.start_date AND tp.end_date
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND t.status = ?';
      params.push(statusFilter);
    }

    if (tourTypeFilter && tourTypeFilter !== 'all') {
      sql += ' AND t.tour_type = ?';
      params.push(tourTypeFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND t.city = ?';
      params.push(cityFilter);
    }

    sql += ' ORDER BY t.tour_name ASC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch tour packages' }, { status: 500 });
  }
}

// POST - Create new tour package
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tour_name,
      tour_code,
      city,
      duration_days,
      duration_hours,
      duration_type,
      description,
      tour_type,
      inclusions,
      exclusions,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website
    } = body;

    const result = await query(
      `INSERT INTO tours (
        tour_name, tour_code, city, duration_days, duration_hours, duration_type,
        description, tour_type, inclusions, exclusions,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        tour_name, tour_code, city, duration_days, duration_hours, duration_type,
        description, tour_type, inclusions, exclusions,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create tour package' }, { status: 500 });
  }
}

// PUT - Update tour package
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      provider_id,
      tour_name,
      tour_code,
      city,
      duration_days,
      duration_hours,
      duration_type,
      description,
      tour_type,
      inclusions,
      exclusions,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website,
      status
    } = body;

    await query(
      `UPDATE tours SET
        provider_id = ?, tour_name = ?, tour_code = ?, city = ?, duration_days = ?, duration_hours = ?,
        duration_type = ?, description = ?, tour_type = ?, inclusions = ?, exclusions = ?,
        photo_url_1 = ?, photo_url_2 = ?, photo_url_3 = ?, rating = ?,
        user_ratings_total = ?, website = ?, status = ?
      WHERE id = ?`,
      [
        provider_id, tour_name, tour_code, city, duration_days, duration_hours, duration_type,
        description, tour_type, inclusions, exclusions, photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website, status, id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update tour package' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) tour package
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE tours SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive tour package' }, { status: 500 });
  }
}
