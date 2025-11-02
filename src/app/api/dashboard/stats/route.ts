import { NextResponse } from 'next/server';
import db, { query } from '@/lib/db';

export async function GET() {
  try {
    // Get counts from database
    const [
      activeRequestsCount,
      thisMonthBookingsCount,
      pendingQuotesCount,
      allItineraries,
      allQuotes
    ] = await Promise.all([
      db.getTableCount('customer_itineraries'),
      db.getTableCount('bookings'),
      query('SELECT COUNT(*) as count FROM quotes WHERE status IN ("draft", "sent")'),
      db.getAllItineraries(),
      db.getAllQuotes()
    ]);

    // Calculate total revenue from itineraries
    const totalRevenue = allItineraries.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.total_price || 0);
    }, 0);

    const stats = {
      activeRequests: activeRequestsCount,
      thisMonthBookings: thisMonthBookingsCount,
      revenue: totalRevenue,
      pendingQuotes: pendingQuotesCount[0]?.count || 0
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
