import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Get recent itineraries (requests)
    const requests = await query(`
      SELECT
        id,
        customer_name as agent,
        destination as package,
        adults + children as pax,
        status,
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        CONCAT('€', FORMAT(total_price, 2)) as value
      FROM customer_itineraries
      ORDER BY created_at DESC
      LIMIT 4
    `);

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Recent requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch recent requests' }, { status: 500 });
  }
}
