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
 * Generic paginated response wrapper (LEGACY - use StandardListResponse)
 * @deprecated Use StandardListResponse for new endpoints
 */
export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Standardized list response following JSON:API conventions
 * Supports pagination, filtering, and hypermedia links
 */
export interface StandardListResponse<T> {
  /** Array of data items for the current page */
  data: T[];
  /** Metadata about the response */
  meta: {
    /** Current page number (1-indexed) */
    page: number;
    /** Items per page */
    size: number;
    /** Total items across all pages */
    total: number;
    /** Total number of pages */
    total_pages: number;
    /** Applied filters (if any) */
    filters?: Record<string, any>;
  };
  /** Hypermedia links for pagination */
  links: {
    /** Link to current page */
    self: string;
    /** Link to first page */
    first: string;
    /** Link to previous page (null if on first page) */
    prev: string | null;
    /** Link to next page (null if on last page) */
    next: string | null;
    /** Link to last page */
    last: string;
  };
}

/**
 * Standardized error response following RFC 7807 with extensions
 */
export interface StandardErrorResponse {
  error: {
    /** Machine-readable error code (e.g., VALIDATION_ERROR, NOT_FOUND) */
    code: string;
    /** Human-readable error message */
    message: string;
    /** Additional error details (e.g., validation errors) */
    details?: Array<{
      field?: string;
      issue: string;
      message?: string;
    }>;
    /** Unique request ID for tracing */
    request_id?: string;
    /** RFC 7807 type URI */
    type?: string;
  };
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
