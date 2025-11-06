/**
 * Pricing validation utilities
 * Functions for validating pricing data, including season overlap detection
 * @module lib/pricing-validation
 */

import { query } from './db';

export interface SeasonOverlapResult {
  hasOverlap: boolean;
  conflictingSeasons: Array<{
    id: number;
    season_name: string;
    start_date: string;
    end_date: string;
  }>;
  message?: string;
}

/**
 * Check if a pricing season overlaps with any existing active seasons
 *
 * @param table - The pricing table name (e.g., 'hotel_pricing', 'tour_pricing')
 * @param serviceIdColumn - The service ID column name (e.g., 'hotel_id', 'tour_id')
 * @param serviceId - The service ID value
 * @param startDate - Start date of the season (YYYY-MM-DD)
 * @param endDate - End date of the season (YYYY-MM-DD)
 * @param excludeId - Optional ID to exclude from overlap check (for updates)
 * @returns Promise resolving to overlap result
 *
 * @example
 * ```ts
 * const result = await checkSeasonOverlap(
 *   'hotel_pricing',
 *   'hotel_id',
 *   123,
 *   '2025-12-20',
 *   '2026-01-05',
 *   456 // exclude this ID (for updates)
 * );
 *
 * if (result.hasOverlap) {
 *   console.error('Overlap detected:', result.message);
 *   console.log('Conflicting seasons:', result.conflictingSeasons);
 * }
 * ```
 */
export async function checkSeasonOverlap(
  table: string,
  serviceIdColumn: string,
  serviceId: number,
  startDate: string,
  endDate: string,
  excludeId?: number
): Promise<SeasonOverlapResult> {
  // Validate table name to prevent SQL injection
  const allowedTables = [
    'hotel_pricing',
    'tour_pricing',
    'guide_pricing',
    'vehicle_pricing',
    'entrance_fee_pricing',
    'meal_pricing',
    'flight_pricing',
  ];

  if (!allowedTables.includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  // Build query to find overlapping seasons
  // Two date ranges overlap if:
  // 1. New start date falls within an existing season OR
  // 2. New end date falls within an existing season OR
  // 3. New season completely encompasses an existing season
  const params: any[] = [serviceId, startDate, endDate, startDate, endDate, startDate, endDate];

  let sql = `
    SELECT id, season_name, start_date, end_date
    FROM ${table}
    WHERE ${serviceIdColumn} = ?
      AND status = 'active'
      AND (
        (? BETWEEN start_date AND end_date) OR
        (? BETWEEN start_date AND end_date) OR
        (start_date BETWEEN ? AND ?)
      )
  `;

  if (excludeId !== undefined) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  const overlaps = await query<{
    id: number;
    season_name: string;
    start_date: string;
    end_date: string;
  }>(sql, params);

  if (overlaps.length > 0) {
    const seasonNames = overlaps.map(s => s.season_name).join(', ');
    return {
      hasOverlap: true,
      conflictingSeasons: overlaps,
      message: `Season dates overlap with existing season(s): ${seasonNames}. Please adjust the date range.`,
    };
  }

  return {
    hasOverlap: false,
    conflictingSeasons: [],
  };
}

/**
 * Validate that a date string is in valid YYYY-MM-DD format
 *
 * @param dateString - Date string to validate
 * @returns True if valid, false otherwise
 */
export function isValidDateFormat(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validate that start date is before or equal to end date
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns True if valid, false otherwise
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return start <= end;
}

/**
 * Validate pricing data before insert/update
 *
 * @param data - Pricing data to validate
 * @returns Validation result with error message if invalid
 */
export function validatePricingData(data: {
  start_date: string;
  end_date: string;
  season_name: string;
}): { valid: boolean; error?: string } {
  // Check date formats
  if (!isValidDateFormat(data.start_date)) {
    return { valid: false, error: 'Invalid start_date format. Use YYYY-MM-DD.' };
  }

  if (!isValidDateFormat(data.end_date)) {
    return { valid: false, error: 'Invalid end_date format. Use YYYY-MM-DD.' };
  }

  // Check date range
  if (!isValidDateRange(data.start_date, data.end_date)) {
    return { valid: false, error: 'start_date must be before or equal to end_date.' };
  }

  // Check season name
  if (!data.season_name || data.season_name.trim() === '') {
    return { valid: false, error: 'season_name is required.' };
  }

  return { valid: true };
}
