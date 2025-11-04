import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') || 'providers';

    // Whitelist of allowed tables to prevent SQL injection
    const ALLOWED_TABLES = [
      'providers', 'clients', 'quotes', 'hotels', 'vehicles', 'guides',
      'daily_tours', 'entrance_fees', 'restaurants', 'transfers',
      'agents', 'bookings', 'extra_expenses', 'customer_itineraries',
      'invoices_receivable', 'invoices_payable', 'invoice_items'
    ];

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({
        error: 'Invalid table name'
      }, { status: 400 });
    }

    // Get table structure - safe now because table is validated
    const columns = await query(`DESCRIBE ${table}`) as any[];

    return NextResponse.json({
      table,
      columns: columns.map((col: any) => ({
        Field: col.Field,
        Type: col.Type,
        Null: col.Null,
        Key: col.Key,
        Default: col.Default,
        Extra: col.Extra
      }))
    });

  } catch (error: any) {
    console.error('Schema check error:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
