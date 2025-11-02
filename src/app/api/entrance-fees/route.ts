import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all entrance fees with their pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const cityFilter = searchParams.get('city');

    let sql = `
      SELECT
        ef.*,
        p.provider_name,
        efp.id as pricing_id,
        efp.season_name,
        efp.start_date as season_start,
        efp.end_date as season_end,
        efp.currency,
        efp.adult_price,
        efp.child_price,
        efp.student_price
      FROM entrance_fees ef
      LEFT JOIN providers p ON ef.provider_id = p.id
      LEFT JOIN entrance_fee_pricing efp ON ef.id = efp.entrance_fee_id
        AND efp.status = 'active'
        AND CURDATE() BETWEEN efp.start_date AND efp.end_date
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND ef.status = ?';
      params.push(statusFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND ef.city = ?';
      params.push(cityFilter);
    }

    sql += ' ORDER BY ef.city ASC, ef.site_name ASC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch entrance fees' }, { status: 500 });
  }
}

// POST - Create new entrance fee
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      google_place_id,
      organization_id,
      site_name,
      city,
      description,
      latitude,
      longitude,
      google_maps_url,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website
    } = body;

    const result = await query(
      `INSERT INTO entrance_fees (
        google_place_id, organization_id, site_name, city, description,
        latitude, longitude, google_maps_url,
        photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        google_place_id, organization_id, site_name, city, description,
        latitude, longitude, google_maps_url,
        photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create entrance fee' }, { status: 500 });
  }
}

// PUT - Update entrance fee
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      provider_id,
      google_place_id,
      organization_id,
      site_name,
      city,
      description,
      latitude,
      longitude,
      google_maps_url,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website,
      status
    } = body;

    await query(
      `UPDATE entrance_fees SET
        provider_id = ?, google_place_id = ?, organization_id = ?, site_name = ?, city = ?,
        description = ?, latitude = ?, longitude = ?, google_maps_url = ?,
        photo_url_1 = ?, photo_url_2 = ?, photo_url_3 = ?,
        rating = ?, user_ratings_total = ?, website = ?, status = ?
      WHERE id = ?`,
      [
        provider_id, google_place_id, organization_id, site_name, city,
        description, latitude, longitude, google_maps_url,
        photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website, status, id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update entrance fee' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) entrance fee
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE entrance_fees SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive entrance fee' }, { status: 500 });
  }
}
