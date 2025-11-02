import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Get upcoming itineraries that are confirmed
    const tours = await query(`
      SELECT
        id,
        destination as package,
        customer_name as agent,
        DATE_FORMAT(start_date, '%Y-%m-%d') as date,
        adults + children as pax,
        'Pending Assignment' as guide,
        status
      FROM customer_itineraries
      WHERE start_date >= CURDATE()
        AND status IN ('confirmed', 'booked', 'pending')
      ORDER BY start_date ASC
      LIMIT 3
    `);

    return NextResponse.json(tours);
  } catch (error) {
    console.error('Upcoming tours error:', error);
    return NextResponse.json({ error: 'Failed to fetch upcoming tours' }, { status: 500 });
  }
}
