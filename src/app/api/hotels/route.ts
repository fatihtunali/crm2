import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all hotels with their pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const starRatingFilter = searchParams.get('star_rating');
    const hotelCategoryFilter = searchParams.get('hotel_category');
    const cityFilter = searchParams.get('city');
    const searchTerm = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let sql = `
      SELECT
        h.*,
        hp.id as pricing_id,
        hp.season_name,
        hp.start_date as season_start,
        hp.end_date as season_end,
        hp.currency,
        hp.double_room_bb,
        hp.single_supplement_bb,
        hp.triple_room_bb,
        hp.child_0_6_bb,
        hp.child_6_12_bb,
        hp.hb_supplement,
        hp.fb_supplement,
        hp.ai_supplement,
        hp.base_meal_plan
      FROM hotels h
      LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
        AND hp.status = 'active'
        AND CURDATE() BETWEEN hp.start_date AND hp.end_date
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND h.status = ?';
      params.push(statusFilter);
    }

    if (starRatingFilter && starRatingFilter !== 'all') {
      sql += ' AND h.star_rating = ?';
      params.push(parseInt(starRatingFilter));
    }

    if (hotelCategoryFilter && hotelCategoryFilter !== 'all') {
      sql += ' AND h.hotel_category = ?';
      params.push(hotelCategoryFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      sql += ' AND h.city = ?';
      params.push(cityFilter);
    }

    if (searchTerm) {
      sql += ' AND (h.hotel_name LIKE ? OR h.city LIKE ? OR h.address LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM hotels h WHERE 1=1`;
    const countParams: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      countSql += ' AND h.status = ?';
      countParams.push(statusFilter);
    }

    if (starRatingFilter && starRatingFilter !== 'all') {
      countSql += ' AND h.star_rating = ?';
      countParams.push(parseInt(starRatingFilter));
    }

    if (hotelCategoryFilter && hotelCategoryFilter !== 'all') {
      countSql += ' AND h.hotel_category = ?';
      countParams.push(hotelCategoryFilter);
    }

    if (cityFilter && cityFilter !== 'all') {
      countSql += ' AND h.city = ?';
      countParams.push(cityFilter);
    }

    if (searchTerm) {
      countSql += ' AND (h.hotel_name LIKE ? OR h.city LIKE ? OR h.address LIKE ?)';
      const searchPattern = `%${searchTerm}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY h.hotel_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch hotels' }, { status: 500 });
  }
}

// POST - Create new hotel
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      google_place_id,
      organization_id,
      hotel_name,
      city,
      star_rating,
      hotel_category,
      room_count,
      is_boutique,
      address,
      latitude,
      longitude,
      google_maps_url,
      contact_phone,
      contact_email,
      notes,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website,
      editorial_summary,
      place_types,
      price_level,
      business_status
    } = body;

    const result = await query(
      `INSERT INTO hotels (
        google_place_id, organization_id, hotel_name, city, star_rating, hotel_category,
        room_count, is_boutique, address, latitude, longitude, google_maps_url,
        contact_phone, contact_email, notes,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website,
        editorial_summary, place_types, price_level, business_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        google_place_id, organization_id, hotel_name, city, star_rating, hotel_category,
        room_count, is_boutique, address, latitude, longitude, google_maps_url,
        contact_phone, contact_email, notes,
        photo_url_1, photo_url_2, photo_url_3, rating, user_ratings_total, website,
        editorial_summary, place_types, price_level, business_status
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create hotel' }, { status: 500 });
  }
}

// PUT - Update hotel
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      google_place_id,
      organization_id,
      hotel_name,
      city,
      star_rating,
      hotel_category,
      room_count,
      is_boutique,
      address,
      latitude,
      longitude,
      google_maps_url,
      contact_phone,
      contact_email,
      notes,
      photo_url_1,
      photo_url_2,
      photo_url_3,
      rating,
      user_ratings_total,
      website,
      editorial_summary,
      place_types,
      price_level,
      business_status,
      status
    } = body;

    await query(
      `UPDATE hotels SET
        google_place_id = ?, organization_id = ?, hotel_name = ?, city = ?, star_rating = ?,
        hotel_category = ?, room_count = ?, is_boutique = ?, address = ?, latitude = ?,
        longitude = ?, google_maps_url = ?, contact_phone = ?, contact_email = ?, notes = ?,
        photo_url_1 = ?, photo_url_2 = ?, photo_url_3 = ?, rating = ?,
        user_ratings_total = ?, website = ?, editorial_summary = ?, place_types = ?,
        price_level = ?, business_status = ?, status = ?
      WHERE id = ?`,
      [
        google_place_id, organization_id, hotel_name, city, star_rating, hotel_category,
        room_count, is_boutique, address, latitude, longitude, google_maps_url,
        contact_phone, contact_email, notes, photo_url_1, photo_url_2, photo_url_3,
        rating, user_ratings_total, website, editorial_summary, place_types,
        price_level, business_status, status, id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update hotel' }, { status: 500 });
  }
}

// DELETE - Soft delete (archive) hotel
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE hotels SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to archive hotel' }, { status: 500 });
  }
}
