// RFC 7807 Problem Details for HTTP APIs
// https://tools.ietf.org/html/rfc7807

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: any; // Allow additional properties
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationProblem extends Problem {
  errors: ValidationError[];
}

/**
 * Money type for representing amounts with currency
 * Uses minor units (e.g., cents) to avoid floating-point precision issues
 */
export interface Money {
  amount_minor: number;
  currency: string;
}

/**
 * Generic paginated response wrapper
 */
export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Exchange rate database record
 */
export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request body for creating/updating exchange rate
 */
export interface ExchangeRateInput {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string; // YYYY-MM-DD format
}

/**
 * Response for latest exchange rate query
 */
export interface LatestExchangeRateResponse {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

/**
 * Booking database record
 */
export interface Booking {
  id: number;
  quotation_id: number;
  booking_number: string;
  locked_exchange_rate: string | null;
  currency: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/**
 * Request body for creating a booking
 */
export interface CreateBookingRequest {
  quotation_id: number;
}

/**
 * Request body for updating a booking
 */
export interface UpdateBookingRequest {
  status?: 'confirmed' | 'cancelled';
}
