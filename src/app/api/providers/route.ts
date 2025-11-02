import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all providers
export async function GET() {
  try {
    const providers = await query(`
      SELECT
        id,
        provider_name,
        provider_type,
        contact_email,
        contact_phone,
        status
      FROM providers
      WHERE status = 'active'
      ORDER BY provider_name ASC
    `);

    return NextResponse.json(providers);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}
