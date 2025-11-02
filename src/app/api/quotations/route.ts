import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all quotations
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let sql = `
      SELECT
        q.*,
        (SELECT COUNT(*) FROM quote_days WHERE quote_id = q.id) as total_days
      FROM quotes q
      WHERE 1=1
    `;

    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      sql += ' AND q.status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY q.created_at DESC';

    const rows = await query(sql, params);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

// POST - Create new quotation
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      quote_name,
      category,
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup,
      tax,
      transport_pricing_mode,
      season_name,
      valid_from,
      valid_to
    } = body;

    // Generate quote number
    const [lastQuote] = await query(
      'SELECT quote_number FROM quotes ORDER BY id DESC LIMIT 1'
    ) as any[];

    let nextNumber = 1;
    if (lastQuote && lastQuote.quote_number) {
      const match = lastQuote.quote_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const quote_number = `Q-${new Date().getFullYear()}-${String(nextNumber).padStart(4, '0')}`;

    const result = await query(
      `INSERT INTO quotes (
        organization_id, created_by_user_id, quote_number, category,
        customer_name, customer_email, customer_phone, destination,
        start_date, end_date, tour_type, pax, adults, children,
        markup, tax, transport_pricing_mode, season_name,
        valid_from, valid_to, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        1, // TODO: Get from session
        1, // TODO: Get from session
        quote_number,
        category || 'B2C',
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        tour_type,
        pax,
        adults,
        children,
        markup || 0,
        tax || 0,
        transport_pricing_mode || 'total',
        season_name,
        valid_from || null,
        valid_to || null
      ]
    );

    return NextResponse.json({ success: true, id: (result as any).insertId, quote_number });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to create quotation' }, { status: 500 });
  }
}

// PUT - Update quotation
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      quote_name,
      category,
      customer_name,
      customer_email,
      customer_phone,
      destination,
      start_date,
      end_date,
      tour_type,
      pax,
      adults,
      children,
      markup,
      tax,
      transport_pricing_mode,
      season_name,
      valid_from,
      valid_to,
      status,
      total_price,
      pricing_table
    } = body;

    await query(
      `UPDATE quotes SET
        quote_name = ?, category = ?, customer_name = ?, customer_email = ?,
        customer_phone = ?, destination = ?, start_date = ?, end_date = ?,
        tour_type = ?, pax = ?, adults = ?, children = ?, markup = ?, tax = ?,
        transport_pricing_mode = ?, season_name = ?, valid_from = ?, valid_to = ?,
        status = ?, total_price = ?, pricing_table = ?
      WHERE id = ?`,
      [
        quote_name,
        category,
        customer_name,
        customer_email,
        customer_phone,
        destination,
        start_date,
        end_date,
        tour_type,
        pax,
        adults,
        children,
        markup,
        tax,
        transport_pricing_mode,
        season_name,
        valid_from || null,
        valid_to || null,
        status,
        total_price,
        pricing_table ? JSON.stringify(pricing_table) : null,
        id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
  }
}

// DELETE - Soft delete quotation
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    await query(
      'UPDATE quotes SET status = ? WHERE id = ?',
      ['expired', id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to delete quotation' }, { status: 500 });
  }
}
