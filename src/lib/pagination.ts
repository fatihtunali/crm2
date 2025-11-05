/**
 * Pagination utilities for API endpoints
 * Provides helpers for parsing pagination parameters and building paged responses
 * @module lib/pagination
 */

import { PagedResponse, StandardListResponse } from '@/types/api';

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

/**
 * Parses standardized pagination parameters (page[size] and page[number])
 *
 * Supports multiple formats for backward compatibility:
 * - page[size]=25&page[number]=2 (new standardized format)
 * - page=2&pageSize=25 (legacy format)
 * - page=2&page_size=25 (legacy format)
 *
 * @param searchParams - URLSearchParams from the request
 * @returns Validated pagination parameters with calculated offset
 *
 * @example
 * ```ts
 * // New format
 * const url = new URL('http://example.com/api/items?page[size]=25&page[number]=2');
 * const { page, pageSize, offset } = parseStandardPaginationParams(url.searchParams);
 * // Returns: { page: 2, pageSize: 25, offset: 25 }
 *
 * // Legacy format (still supported)
 * const url2 = new URL('http://example.com/api/items?page=2&pageSize=25');
 * const { page, pageSize, offset } = parseStandardPaginationParams(url2.searchParams);
 * // Returns: { page: 2, pageSize: 25, offset: 25 }
 * ```
 */
export function parseStandardPaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  // Try new format first: page[number] and page[size]
  const pageNumber = searchParams.get('page[number]');
  const pageSize = searchParams.get('page[size]');

  // If new format is present, use it
  if (pageNumber !== null || pageSize !== null) {
    let page = parseInt(pageNumber || '1', 10);
    let size = parseInt(pageSize || String(DEFAULT_PAGE_SIZE), 10);

    // Validate page >= 1
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    // Validate and clamp pageSize
    if (isNaN(size) || size < 1) {
      size = DEFAULT_PAGE_SIZE;
    } else if (size > MAX_PAGE_SIZE) {
      size = MAX_PAGE_SIZE;
    }

    return {
      page,
      pageSize: size,
      offset: (page - 1) * size,
    };
  }

  // Fallback to legacy format
  return parsePaginationParams(searchParams);
}

/**
 * Builds a standardized list response with metadata and hypermedia links
 *
 * @template T - The type of data items in the response
 * @param data - Array of data items for the current page
 * @param total - Total number of items across all pages
 * @param page - Current page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param baseUrl - Base URL for generating pagination links
 * @param filters - Optional filters applied to the query
 * @returns StandardListResponse object with data, metadata, and links
 *
 * @example
 * ```ts
 * const users = await query('SELECT * FROM users LIMIT ? OFFSET ?', [pageSize, offset]);
 * const total = await query('SELECT COUNT(*) as count FROM users');
 * const baseUrl = 'https://api.example.com/api/users';
 *
 * return buildStandardListResponse(
 *   users,
 *   total[0].count,
 *   page,
 *   pageSize,
 *   baseUrl,
 *   { status: 'active', city: 'Istanbul' }
 * );
 * ```
 */
export function buildStandardListResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  baseUrl: string,
  filters?: Record<string, any>
): StandardListResponse<T> {
  const totalPages = calculateTotalPages(total, pageSize);

  // Build filter query string
  const filterParams = filters
    ? Object.entries(filters)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';
  const filterString = filterParams ? `&${filterParams}` : '';

  // Helper to build pagination URL
  const buildUrl = (pageNum: number): string => {
    return `${baseUrl}?page[size]=${pageSize}&page[number]=${pageNum}${filterString}`;
  };

  return {
    data,
    meta: {
      page,
      size: pageSize,
      total,
      total_pages: totalPages,
      ...(filters && { filters }),
    },
    links: {
      self: buildUrl(page),
      first: buildUrl(1),
      prev: page > 1 ? buildUrl(page - 1) : null,
      next: page < totalPages ? buildUrl(page + 1) : null,
      last: buildUrl(totalPages || 1),
    },
  };
}
