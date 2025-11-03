import { query } from '@/lib/db';

/**
 * Get exchange rate at a specific date
 * Uses the most recent rate on or before the specified date
 */
export async function getExchangeRateAt(
  fromCurrency: string,
  toCurrency: string,
  date: Date
): Promise<number | null> {
  try {
    // If currencies are the same, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];

    const results = await query<{ rate: string }>(
      `SELECT rate FROM exchange_rates
       WHERE from_currency = ?
         AND to_currency = ?
         AND effective_date <= ?
       ORDER BY effective_date DESC
       LIMIT 1`,
      [fromCurrency, toCurrency, dateStr]
    );

    if (results.length === 0) {
      return null;
    }

    return parseFloat(results[0].rate);
  } catch (error) {
    console.error('Error fetching exchange rate at date:', error);
    throw error;
  }
}

/**
 * Get the most recent exchange rate for a currency pair
 */
export async function getLatestExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  try {
    // If currencies are the same, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const results = await query<{ rate: string }>(
      `SELECT rate FROM exchange_rates
       WHERE from_currency = ?
         AND to_currency = ?
       ORDER BY effective_date DESC
       LIMIT 1`,
      [fromCurrency, toCurrency]
    );

    if (results.length === 0) {
      return null;
    }

    return parseFloat(results[0].rate);
  } catch (error) {
    console.error('Error fetching latest exchange rate:', error);
    throw error;
  }
}

/**
 * Convert an amount from one currency to another at a specific date
 * @throws Error if exchange rate is not available
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date: Date
): Promise<number> {
  try {
    const rate = await getExchangeRateAt(fromCurrency, toCurrency, date);

    if (rate === null) {
      throw new Error(
        `Exchange rate not available for ${fromCurrency} to ${toCurrency} on ${date.toISOString().split('T')[0]}`
      );
    }

    return amount * rate;
  } catch (error) {
    console.error('Error converting amount:', error);
    throw error;
  }
}
