import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    // Check if city column already exists
    const [columns] = await query(
      "SHOW COLUMNS FROM providers LIKE 'city'"
    ) as any[];

    if (columns && columns.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'City column already exists in providers table'
      });
    }

    // Add city column after provider_type
    await query(`
      ALTER TABLE providers
      ADD COLUMN city VARCHAR(100) NULL
      AFTER provider_type
    `);

    return NextResponse.json({
      success: true,
      message: 'Successfully added city column to providers table'
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
