/**
 * Currency Validation Middleware
 *
 * Ensures currency consistency across all financial operations
 * Validates currency codes, payment/invoice currency matching, and exchange rates
 */

import { query } from '@/lib/db';

/**
 * Supported currency codes (ISO 4217)
 */
export const SUPPORTED_CURRENCIES = [
  'EUR', // Euro
  'USD', // US Dollar
  'GBP', // British Pound
  'TRY', // Turkish Lira
  'CHF', // Swiss Franc
  'CAD', // Canadian Dollar
  'AUD', // Australian Dollar
  'JPY', // Japanese Yen
  'CNY', // Chinese Yuan
  'INR', // Indian Rupee
  'BRL', // Brazilian Real
  'MXN', // Mexican Peso
  'ZAR', // South African Rand
  'SGD', // Singapore Dollar
  'HKD', // Hong Kong Dollar
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/**
 * Validation result type
 */
export interface CurrencyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate if a currency code is supported
 *
 * @param currency - Currency code to validate
 * @returns true if currency is supported
 *
 * @example
 * validateCurrencyCode('EUR') // Returns true
 * validateCurrencyCode('XXX') // Returns false
 */
export function validateCurrencyCode(currency: string): boolean {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
}

/**
 * Validate payment currency against invoice currency
 *
 * @param paymentCurrency - Currency of the payment
 * @param invoiceCurrency - Currency of the invoice
 * @returns Validation result with error message if invalid
 *
 * @example
 * validatePaymentCurrency('EUR', 'EUR') // Returns { valid: true }
 * validatePaymentCurrency('USD', 'EUR') // Returns { valid: false, error: "..." }
 */
export function validatePaymentCurrency(
  paymentCurrency: string,
  invoiceCurrency: string
): CurrencyValidationResult {
  // First, validate that both currencies are supported
  if (!validateCurrencyCode(paymentCurrency)) {
    return {
      valid: false,
      error: `Unsupported payment currency: ${paymentCurrency}. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`,
    };
  }

  if (!validateCurrencyCode(invoiceCurrency)) {
    return {
      valid: false,
      error: `Unsupported invoice currency: ${invoiceCurrency}. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`,
    };
  }

  // Check if currencies match
  if (paymentCurrency !== invoiceCurrency) {
    return {
      valid: false,
      error: `Payment currency (${paymentCurrency}) does not match invoice currency (${invoiceCurrency}). Payment must be in the same currency as the invoice.`,
    };
  }

  return { valid: true };
}

/**
 * Validate amount is positive and non-zero
 *
 * @param amount - Amount to validate (in minor units)
 * @param fieldName - Name of the field for error message
 * @returns Validation result with error message if invalid
 */
export function validateAmount(
  amount: number,
  fieldName: string = 'Amount'
): CurrencyValidationResult {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (amount <= 0) {
    return {
      valid: false,
      error: `${fieldName} must be greater than zero`,
    };
  }

  if (!Number.isInteger(amount)) {
    return {
      valid: false,
      error: `${fieldName} must be an integer (in minor units, e.g., cents)`,
    };
  }

  return { valid: true };
}

/**
 * Get exchange rate between two currencies
 *
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Exchange rate or null if not found
 *
 * @example
 * await getExchangeRate('USD', 'EUR') // Returns 0.92 (example)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  try {
    // Same currency = rate of 1
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const [rows] = await query<any>(
      `SELECT rate
       FROM exchange_rates
       WHERE from_currency = ? AND to_currency = ?
       AND is_active = TRUE
       ORDER BY updated_at DESC
       LIMIT 1`,
      [fromCurrency, toCurrency]
    );

    if (rows && rows.length > 0) {
      return parseFloat(rows[0].rate);
    }

    return null;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return null;
  }
}

/**
 * Convert amount from one currency to another using stored exchange rates
 *
 * @param amount - Amount in minor units (cents)
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Converted amount in minor units or null if exchange rate not found
 *
 * @example
 * await convertCurrency(10000, 'USD', 'EUR') // Returns 9200 (if rate is 0.92)
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);

  if (rate === null) {
    return null;
  }

  // Convert: amount * rate, rounded to nearest integer (minor units)
  return Math.round(amount * rate);
}

/**
 * Validate that sufficient exchange rate exists for currency conversion
 *
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Validation result with error message if rate not found
 */
export async function validateExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<CurrencyValidationResult> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);

  if (rate === null) {
    return {
      valid: false,
      error: `No exchange rate found for ${fromCurrency} to ${toCurrency}. Please contact support to add this currency pair.`,
    };
  }

  return { valid: true };
}

/**
 * Validate payment amount doesn't exceed invoice outstanding amount
 *
 * @param paymentAmount - Amount of the payment (in minor units)
 * @param invoiceTotalAmount - Total invoice amount (in minor units)
 * @param invoicePaidAmount - Already paid amount (in minor units)
 * @returns Validation result with error message if overpayment
 */
export function validatePaymentAmount(
  paymentAmount: number,
  invoiceTotalAmount: number,
  invoicePaidAmount: number
): CurrencyValidationResult {
  const outstandingAmount = invoiceTotalAmount - invoicePaidAmount;

  if (paymentAmount > outstandingAmount) {
    return {
      valid: false,
      error: `Payment amount (${paymentAmount}) exceeds outstanding invoice amount (${outstandingAmount}). Total: ${invoiceTotalAmount}, Paid: ${invoicePaidAmount}`,
    };
  }

  return { valid: true };
}

/**
 * Validate refund amount doesn't exceed paid amount
 *
 * @param refundAmount - Amount to refund (in minor units)
 * @param invoicePaidAmount - Total paid amount (in minor units)
 * @param alreadyRefundedAmount - Amount already refunded (in minor units)
 * @returns Validation result with error message if over-refund
 */
export function validateRefundAmount(
  refundAmount: number,
  invoicePaidAmount: number,
  alreadyRefundedAmount: number = 0
): CurrencyValidationResult {
  const availableForRefund = invoicePaidAmount - alreadyRefundedAmount;

  if (refundAmount > availableForRefund) {
    return {
      valid: false,
      error: `Refund amount (${refundAmount}) exceeds available refund amount (${availableForRefund}). Paid: ${invoicePaidAmount}, Already refunded: ${alreadyRefundedAmount}`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive validation for payment operations
 *
 * @param params - Payment validation parameters
 * @returns Validation result with error message if any validation fails
 */
export interface PaymentValidationParams {
  paymentAmount: number;
  paymentCurrency: string;
  invoiceTotalAmount: number;
  invoicePaidAmount: number;
  invoiceCurrency: string;
}

export function validatePaymentOperation(
  params: PaymentValidationParams
): CurrencyValidationResult {
  // Validate amount is positive
  const amountValidation = validateAmount(params.paymentAmount, 'Payment amount');
  if (!amountValidation.valid) {
    return amountValidation;
  }

  // Validate currencies match
  const currencyValidation = validatePaymentCurrency(
    params.paymentCurrency,
    params.invoiceCurrency
  );
  if (!currencyValidation.valid) {
    return currencyValidation;
  }

  // Validate payment doesn't exceed outstanding amount
  const paymentAmountValidation = validatePaymentAmount(
    params.paymentAmount,
    params.invoiceTotalAmount,
    params.invoicePaidAmount
  );
  if (!paymentAmountValidation.valid) {
    return paymentAmountValidation;
  }

  return { valid: true };
}

/**
 * Comprehensive validation for refund operations
 *
 * @param params - Refund validation parameters
 * @returns Validation result with error message if any validation fails
 */
export interface RefundValidationParams {
  refundAmount: number;
  refundCurrency: string;
  invoicePaidAmount: number;
  invoiceCurrency: string;
  alreadyRefundedAmount?: number;
}

export function validateRefundOperation(
  params: RefundValidationParams
): CurrencyValidationResult {
  // Validate amount is positive
  const amountValidation = validateAmount(params.refundAmount, 'Refund amount');
  if (!amountValidation.valid) {
    return amountValidation;
  }

  // Validate currencies match
  const currencyValidation = validatePaymentCurrency(
    params.refundCurrency,
    params.invoiceCurrency
  );
  if (!currencyValidation.valid) {
    return currencyValidation;
  }

  // Validate refund doesn't exceed paid amount
  const refundAmountValidation = validateRefundAmount(
    params.refundAmount,
    params.invoicePaidAmount,
    params.alreadyRefundedAmount || 0
  );
  if (!refundAmountValidation.valid) {
    return refundAmountValidation;
  }

  return { valid: true };
}
