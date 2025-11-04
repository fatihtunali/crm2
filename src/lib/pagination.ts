/**
 * Pagination utilities for API endpoints
 * Provides helpers for parsing pagination parameters and building paged responses
 * @module lib/pagination
 */

import { PagedResponse } from '@/types/api';

/**
 * Default number of items per page
 */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Maximum allowed items per page to prevent excessive database loads
 */
export const MAX_PAGE_SIZE = 10000;

/**
 * Pagination parameters parsed from request
 */
export interface PaginationParams {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Database offset (0-indexed) */
  offset: number;
}

/**
 * Parses and validates pagination parameters from URL search params
 *
 * @param searchParams - URLSearchParams from the request
 * @returns Validated pagination parameters with calculated offset
 *
 * @example
 * ```ts
 * const { searchParams } = new URL(request.url);
 * const { page, pageSize, offset } = parsePaginationParams(searchParams);
 * const sql = `SELECT * FROM users LIMIT ${pageSize} OFFSET ${offset}`;
 * ```
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  // Parse page number, default to 1
  let page = parseInt(searchParams.get('page') || '1', 10);

  // Validate page >= 1
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  // Parse page size, default to DEFAULT_PAGE_SIZE
  let pageSize = parseInt(
    searchParams.get('pageSize') || searchParams.get('page_size') || searchParams.get('limit') || String(DEFAULT_PAGE_SIZE),
    10
  );

  // Validate and clamp pageSize between 1 and MAX_PAGE_SIZE
  if (isNaN(pageSize) || pageSize < 1) {
    pageSize = DEFAULT_PAGE_SIZE;
  } else if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  // Calculate offset for database query
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    offset,
  };
}

/**
 * Parses sort parameters and generates a SQL ORDER BY clause
 *
 * @param sortString - Sort string in format "field1,-field2" where - prefix means DESC
 * @param allowedColumns - Optional whitelist of allowed column names for additional security
 * @returns SQL ORDER BY clause (without the "ORDER BY" keywords)
 *
 * @example
 * ```ts
 * parseSortParams("-created_at,name")
 * // Returns: "created_at DESC, name ASC"
 *
 * parseSortParams("price,-rating", ['price', 'rating', 'name'])
 * // Returns: "price ASC, rating DESC" (validated against whitelist)
 *
 * parseSortParams("malicious_column", ['price', 'name'])
 * // Returns: "" (column not in whitelist)
 *
 * parseSortParams(undefined)
 * // Returns: ""
 * ```
 *
 * @remarks
 * - Field names are sanitized to prevent SQL injection
 * - Only alphanumeric characters and underscores are allowed
 * - If allowedColumns is provided, only whitelisted columns are accepted
 * - Invalid field names are filtered out
 * - Returns empty string if no valid sort fields
 */
export function parseSortParams(sortString?: string | null, allowedColumns?: string[]): string {
  if (!sortString || sortString.trim() === '') {
    return '';
  }

  // Split by comma and process each field
  const sortFields = sortString.split(',').map(field => field.trim());
  const validSortClauses: string[] = [];

  for (const field of sortFields) {
    if (!field) continue;

    // Check if descending (starts with -)
    const isDescending = field.startsWith('-');
    const fieldName = isDescending ? field.substring(1) : field;

    // Sanitize field name - only allow alphanumeric and underscores
    // This prevents SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName)) {
      console.warn(`Invalid sort field name: ${fieldName}`);
      continue;
    }

    // If whitelist is provided, validate against it
    if (allowedColumns && !allowedColumns.includes(fieldName)) {
      console.warn(`Sort field not in whitelist: ${fieldName}. Allowed: ${allowedColumns.join(', ')}`);
      continue;
    }

    const direction = isDescending ? 'DESC' : 'ASC';
    validSortClauses.push(`${fieldName} ${direction}`);
  }

  return validSortClauses.join(', ');
}

/**
 * Builds a standardized paged response with pagination metadata
 *
 * @template T - The type of data items in the response
 * @param data - Array of data items for the current page
 * @param total - Total number of items across all pages
 * @param page - Current page number (1-indexed)
 * @param pageSize - Number of items per page
 * @returns PagedResponse object with data and pagination metadata
 *
 * @example
 * ```ts
 * const users = await query('SELECT * FROM users LIMIT ? OFFSET ?', [pageSize, offset]);
 * const total = await query('SELECT COUNT(*) as count FROM users');
 *
 * return buildPagedResponse(users, total[0].count, page, pageSize);
 * // Returns:
 * // {
 * //   data: [...users],
 * //   total: 100,
 * //   page: 1,
 * //   limit: 25,
 * //   totalPages: 4
 * // }
 * ```
 */
export function buildPagedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PagedResponse<T> {
  const totalPages = calculateTotalPages(total, pageSize);

  return {
    data,
    total,
    page,
    limit: pageSize,
    totalPages,
  };
}

/**
 * Calculates the total number of pages given total items and page size
 *
 * @param total - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages
 *
 * @example
 * ```ts
 * calculateTotalPages(100, 25) // Returns: 4
 * calculateTotalPages(101, 25) // Returns: 5
 * calculateTotalPages(0, 25)   // Returns: 0
 * ```
 */
export function calculateTotalPages(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) {
    return 0;
  }
  return Math.ceil(total / pageSize);
}

/**
 * Checks if there is a next page available
 *
 * @param page - Current page number (1-indexed)
 * @param total - Total number of items
 * @param pageSize - Number of items per page
 * @returns True if there is a next page
 *
 * @example
 * ```ts
 * hasNextPage(1, 100, 25) // Returns: true (pages 2, 3, 4 exist)
 * hasNextPage(4, 100, 25) // Returns: false (page 4 is the last)
 * ```
 */
export function hasNextPage(page: number, total: number, pageSize: number): boolean {
  const totalPages = calculateTotalPages(total, pageSize);
  return page < totalPages;
}

/**
 * Checks if there is a previous page available
 *
 * @param page - Current page number (1-indexed)
 * @returns True if there is a previous page
 *
 * @example
 * ```ts
 * hasPreviousPage(1) // Returns: false
 * hasPreviousPage(2) // Returns: true
 * ```
 */
export function hasPreviousPage(page: number): boolean {
  return page > 1;
}
