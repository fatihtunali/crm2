/**
 * Money utility functions for safe financial calculations
 * Uses minor units (e.g., cents) to avoid floating-point precision issues
 * @module lib/money
 */

import type { Money } from '@/types/api';

/**
 * Convert a decimal amount to minor units (cents)
 *
 * @param decimal - The decimal amount (e.g., 10.50)
 * @returns The amount in minor units (e.g., 1050)
 *
 * @example
 * toMinorUnits(10.50) // Returns 1050
 * toMinorUnits(99.99) // Returns 9999
 * toMinorUnits(100)   // Returns 10000
 */
export function toMinorUnits(decimal: number): number {
  return Math.round(decimal * 100);
}

/**
 * Convert minor units (cents) to a decimal amount
 *
 * @param minor - The amount in minor units (e.g., 1050)
 * @returns The decimal amount (e.g., 10.50)
 *
 * @example
 * fromMinorUnits(1050) // Returns 10.50
 * fromMinorUnits(9999) // Returns 99.99
 * fromMinorUnits(10000) // Returns 100
 */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/**
 * Currency symbol mapping for common currencies
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF',
  CAD: 'CA$',
  AUD: 'A$',
};

/**
 * Format a Money object as a human-readable string
 *
 * @param money - The Money object to format
 * @returns Formatted string with currency symbol or code
 *
 * @example
 * formatMoney({ amount_minor: 1050, currency: 'EUR' }) // Returns "€10.50"
 * formatMoney({ amount_minor: 9999, currency: 'USD' }) // Returns "$99.99"
 * formatMoney({ amount_minor: 5000, currency: 'XXX' }) // Returns "50.00 XXX"
 */
export function formatMoney(money: Money): string {
  const decimal = fromMinorUnits(money.amount_minor);
  const formatted = decimal.toFixed(2);
  const symbol = CURRENCY_SYMBOLS[money.currency];

  if (symbol) {
    // For currencies with symbols, prefix the amount
    return `${symbol}${formatted}`;
  }

  // For currencies without symbols, suffix the currency code
  return `${formatted} ${money.currency}`;
}

/**
 * Create a Money object from a decimal amount
 *
 * @param amount - The decimal amount (e.g., 10.50)
 * @param currency - ISO 4217 currency code (defaults to 'EUR')
 * @returns A Money object with amount in minor units
 *
 * @example
 * createMoney(10.50)         // Returns { amount_minor: 1050, currency: 'EUR' }
 * createMoney(99.99, 'USD')  // Returns { amount_minor: 9999, currency: 'USD' }
 * createMoney(100, 'GBP')    // Returns { amount_minor: 10000, currency: 'GBP' }
 */
export function createMoney(amount: number, currency: string = 'EUR'): Money {
  return {
    amount_minor: toMinorUnits(amount),
    currency,
  };
}
