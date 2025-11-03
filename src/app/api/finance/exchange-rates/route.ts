import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, buildPagedResponse } from '@/lib/pagination';
import { ExchangeRate, ExchangeRateInput } from '@/types/api';

// GET - List exchange rates with pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Optional filters
    const fromCurrency = searchParams.get('from_currency');
    const toCurrency = searchParams.get('to_currency');
    const effectiveDate = searchParams.get('effective_date');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (fromCurrency) {
      conditions.push('from_currency = ?');
      params.push(fromCurrency);
    }

    if (toCurrency) {
      conditions.push('to_currency = ?');
      params.push(toCurrency);
    }

    if (effectiveDate) {
      conditions.push('effective_date = ?');
      params.push(effectiveDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM exchange_rates ${whereClause}`;
    const countResult = await query<{ total: number }>(countSql, params);
    const total = countResult[0]?.total || 0;

    // Get paginated data
    const dataSql = `
      SELECT * FROM exchange_rates
      ${whereClause}
      ORDER BY effective_date DESC, from_currency ASC, to_currency ASC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, pageSize, offset];
    const rates = await query<ExchangeRate>(dataSql, dataParams);

    return NextResponse.json(buildPagedResponse(rates, total, page, pageSize));
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

// POST - Upsert exchange rate with Idempotency-Key support
export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get('Idempotency-Key');
    const body: ExchangeRateInput = await request.json();

    const { from_currency, to_currency, rate, effective_date } = body;

    // Validate required fields
    if (!from_currency || !to_currency || rate === undefined || !effective_date) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['from_currency', 'to_currency', 'rate', 'effective_date']
        },
        { status: 400 }
      );
    }

    // Validate currency codes (3 characters)
    if (from_currency.length !== 3 || to_currency.length !== 3) {
      return NextResponse.json(
        { error: 'Currency codes must be 3 characters (ISO 4217 format)' },
        { status: 400 }
      );
    }

    // Validate rate is positive
    if (rate <= 0) {
      return NextResponse.json(
        { error: 'Rate must be a positive number' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(effective_date)) {
      return NextResponse.json(
        { error: 'effective_date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existing = await query<ExchangeRate>(
        `SELECT * FROM exchange_rates
         WHERE from_currency = ?
           AND to_currency = ?
           AND effective_date = ?`,
        [from_currency, to_currency, effective_date]
      );

      if (existing.length > 0) {
        // Return existing rate for idempotent requests
        return NextResponse.json(existing[0], { status: 200 });
      }
    }

    // Upsert the exchange rate
    await query(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rate = VALUES(rate),
         updated_at = CURRENT_TIMESTAMP`,
      [from_currency, to_currency, rate, effective_date]
    );

    // Fetch the created/updated record
    const result = await query<ExchangeRate>(
      `SELECT * FROM exchange_rates
       WHERE from_currency = ?
         AND to_currency = ?
         AND effective_date = ?`,
      [from_currency, to_currency, effective_date]
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error upserting exchange rate:', error);
    return NextResponse.json(
      { error: 'Failed to create/update exchange rate' },
      { status: 500 }
    );
  }
}
