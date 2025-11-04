/**
 * ORDER BY Clause Sanitization
 * Prevents SQL injection in ORDER BY clauses by validating against whitelists
 */

/**
 * Sanitizes and validates an ORDER BY expression against a whitelist of allowed columns
 *
 * @param orderBy - The order by expression (e.g., "created_at DESC", "name")
 * @param allowedColumns - Array of allowed column names
 * @param defaultOrderBy - Default order by to use if validation fails
 * @returns Sanitized ORDER BY expression or default
 *
 * @example
 * ```ts
 * sanitizeOrderBy('name ASC', ['name', 'created_at'], 'created_at DESC')
 * // Returns: "name ASC"
 *
 * sanitizeOrderBy('malicious; DROP TABLE', ['name'], 'created_at DESC')
 * // Returns: "created_at DESC" (falls back to default)
 *
 * sanitizeOrderBy('name', ['name', 'created_at'], 'created_at DESC')
 * // Returns: "name DESC" (adds default direction)
 * ```
 */
export function sanitizeOrderBy(
  orderBy: string | null | undefined,
  allowedColumns: string[],
  defaultOrderBy: string = 'created_at DESC'
): string {
  if (!orderBy) {
    return defaultOrderBy;
  }

  // Parse the ORDER BY expression
  const parts = orderBy.trim().split(/\s+/);
  const column = parts[0];
  const direction = parts[1]?.toUpperCase() || 'DESC';

  // Validate column name is in whitelist
  if (!allowedColumns.includes(column)) {
    console.warn(`Invalid ORDER BY column: ${column}. Falling back to: ${defaultOrderBy}`);
    return defaultOrderBy;
  }

  // Validate direction is either ASC or DESC
  if (direction !== 'ASC' && direction !== 'DESC') {
    console.warn(`Invalid ORDER BY direction: ${direction}. Falling back to: ${defaultOrderBy}`);
    return defaultOrderBy;
  }

  return `${column} ${direction}`;
}

/**
 * Common column whitelists for standard entities
 */
export const COMMON_ORDER_COLUMNS = {
  /** Standard columns for most entities */
  standard: ['id', 'created_at', 'updated_at', 'status'],

  /** Columns for entities with names */
  named: ['id', 'name', 'created_at', 'updated_at', 'status'],

  /** Columns for hotels */
  hotels: ['id', 'hotel_name', 'city', 'star_rating', 'created_at', 'updated_at', 'status'],

  /** Columns for guides */
  guides: ['id', 'first_name', 'last_name', 'city', 'language', 'created_at', 'updated_at', 'status'],

  /** Columns for vehicles */
  vehicles: ['id', 'vehicle_type', 'brand', 'model', 'capacity', 'created_at', 'updated_at', 'status'],

  /** Columns for tours */
  tours: ['id', 'tour_name', 'city', 'duration_hours', 'created_at', 'updated_at', 'status'],

  /** Columns for transfers */
  transfers: ['id', 'from_city', 'to_city', 'price_oneway', 'created_at', 'updated_at', 'status'],

  /** Columns for clients */
  clients: ['id', 'first_name', 'last_name', 'email', 'country', 'created_at', 'updated_at', 'status'],

  /** Columns for quotations */
  quotations: ['id', 'quote_number', 'start_date', 'end_date', 'total_amount', 'status', 'created_at', 'updated_at'],

  /** Columns for bookings */
  bookings: ['id', 'booking_number', 'booking_date', 'total_amount', 'status', 'created_at', 'updated_at'],

  /** Columns for organizations */
  organizations: ['id', 'name', 'email', 'country', 'status', 'created_at', 'updated_at'],
};

/**
 * Get ORDER BY whitelist for a specific entity type
 * @param entityType - The type of entity
 * @returns Array of allowed column names
 */
export function getOrderByWhitelist(entityType: keyof typeof COMMON_ORDER_COLUMNS): string[] {
  return COMMON_ORDER_COLUMNS[entityType] || COMMON_ORDER_COLUMNS.standard;
}
