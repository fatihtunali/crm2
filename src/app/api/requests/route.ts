import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let sql = `
      SELECT
        id,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        adults,
        children,
        total_price,
        price_per_person,
        status,
        tour_type,
        hotel_category,
        source,
        created_at
      FROM customer_itineraries
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const requests = await query(sql, params);

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Generate UUID
    const uuid = crypto.randomUUID();

    // Calculate price per person
    const totalPax = body.adults + body.children;
    const pricePerPerson = totalPax > 0 ? body.total_price / totalPax : 0;

    const sql = `
      INSERT INTO customer_itineraries (
        uuid,
        organization_id,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        adults,
        children,
        hotel_category,
        tour_type,
        special_requests,
        total_price,
        price_per_person,
        status,
        source,
        city_nights
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'manual', '[]')
    `;

    const params = [
      uuid,
      body.customer_name,
      body.customer_email,
      body.customer_phone || null,
      body.destination,
      body.start_date,
      body.end_date,
      body.adults,
      body.children,
      body.hotel_category || null,
      body.tour_type || null,
      body.special_requests || null,
      body.total_price,
      pricePerPerson
    ];

    await query(sql, params);

    return NextResponse.json({ success: true, message: 'Request created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Create request error:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Calculate price per person
    const totalPax = body.adults + body.children;
    const pricePerPerson = totalPax > 0 ? body.total_price / totalPax : 0;

    const sql = `
      UPDATE customer_itineraries SET
        customer_name = ?,
        customer_email = ?,
        customer_phone = ?,
        destination = ?,
        start_date = ?,
        end_date = ?,
        adults = ?,
        children = ?,
        hotel_category = ?,
        tour_type = ?,
        special_requests = ?,
        total_price = ?,
        price_per_person = ?,
        status = ?
      WHERE id = ?
    `;

    const params = [
      body.customer_name,
      body.customer_email,
      body.customer_phone || null,
      body.destination,
      body.start_date,
      body.end_date,
      body.adults,
      body.children,
      body.hotel_category || null,
      body.tour_type || null,
      body.special_requests || null,
      body.total_price,
      pricePerPerson,
      body.status || 'pending',
      body.id
    ];

    await query(sql, params);

    return NextResponse.json({ success: true, message: 'Request updated successfully' });
  } catch (error) {
    console.error('Update request error:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // Soft delete - set status to cancelled
    const sql = `
      UPDATE customer_itineraries SET
        status = 'cancelled'
      WHERE id = ?
    `;

    await query(sql, [body.id]);

    return NextResponse.json({ success: true, message: 'Request archived successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    return NextResponse.json({ error: 'Failed to archive request' }, { status: 500 });
  }
}
