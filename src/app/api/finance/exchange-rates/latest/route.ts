import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { LatestExchangeRateResponse } from '@/types/api';

// GET - Get latest exchange rate for a currency pair
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get('from');
    const toCurrency = searchParams.get('to');

    // Validate required parameters
    if (!fromCurrency || !toCurrency) {
      return NextResponse.json(
        {
          error: 'Missing required query parameters',
          required: ['from', 'to']
        },
        { status: 400 }
      );
    }

    // Validate currency codes (3 characters)
    if (fromCurrency.length !== 3 || toCurrency.length !== 3) {
      return NextResponse.json(
        { error: 'Currency codes must be 3 characters (ISO 4217 format)' },
        { status: 400 }
      );
    }

    // If currencies are the same, return rate of 1
    if (fromCurrency === toCurrency) {
      const response: LatestExchangeRateResponse = {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: 1,
        effective_date: new Date().toISOString().split('T')[0]
      };
      return NextResponse.json(response);
    }

    // Fetch the latest exchange rate
    const results = await query<{
      from_currency: string;
      to_currency: string;
      rate: string;
      effective_date: string;
    }>(
      `SELECT from_currency, to_currency, rate, effective_date
       FROM exchange_rates
       WHERE from_currency = ?
         AND to_currency = ?
       ORDER BY effective_date DESC
       LIMIT 1`,
      [fromCurrency, toCurrency]
    );

    if (results.length === 0) {
      return NextResponse.json(
        {
          error: 'Exchange rate not found',
          message: `No exchange rate available for ${fromCurrency} to ${toCurrency}`
        },
        { status: 404 }
      );
    }

    const result = results[0];
    const response: LatestExchangeRateResponse = {
      from_currency: result.from_currency,
      to_currency: result.to_currency,
      rate: parseFloat(result.rate),
      effective_date: result.effective_date
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching latest exchange rate:', error);
    return NextResponse.json(
      { error: 'Failed to fetch latest exchange rate' },
      { status: 500 }
    );
  }
}
