import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') || 'providers';

    // Get table structure
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
