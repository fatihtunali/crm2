/**
 * SQL Query Builder Utilities
 * Provides safe, parameterized query building for filters and search
 * @module lib/query-builder
 */

/**
 * Result of building a WHERE clause with parameterized values
 */
export interface WhereClauseResult {
  /** SQL WHERE clause (without "WHERE" keyword) */
  whereSQL: string;
  /** Parameterized values for the SQL query */
  params: any[];
}

/**
 * Result of building a search clause with parameterized values
 */
export interface SearchClauseResult {
  /** SQL search clause using OR and LIKE */
  searchSQL: string;
  /** Parameterized values for the SQL query */
  params: any[];
}

/**
 * Builds a parameterized WHERE clause from a filter object
 *
 * @param filters - Object containing filter field names and values
 * @returns Object with SQL WHERE clause and parameterized values
 *
 * @example
 * ```ts
 * // Simple equality filter
 * buildWhereClause({ status: 'active', city: 'Istanbul' })
 * // Returns: {
 * //   whereSQL: "status = ? AND city = ?",
 * //   params: ['active', 'Istanbul']
 * // }
 *
 * // Null value filter
 * buildWhereClause({ phone: null })
 * // Returns: {
 * //   whereSQL: "phone IS NULL",
 * //   params: []
 * // }
 *
 * // Array (IN clause) filter
 * buildWhereClause({ status: ['active', 'pending'] })
 * // Returns: {
 * //   whereSQL: "status IN (?, ?)",
 * //   params: ['active', 'pending']
 * // }
 *
 * // Range filter (using special keys)
 * buildWhereClause({ price_min: 100, price_max: 500 })
 * // Returns: {
 * //   whereSQL: "price >= ? AND price <= ?",
 * //   params: [100, 500]
 * // }
 * ```
 *
 * @remarks
 * - Handles null values with IS NULL / IS NOT NULL
 * - Handles arrays with IN clause
 * - Supports range filters with _min and _max suffixes
 * - Sanitizes field names to prevent SQL injection
 * - Returns empty strings and arrays if no valid filters
 */
export function buildWhereClause(
  filters: Record<string, any>
): WhereClauseResult {
  const conditions: string[] = [];
  const params: any[] = [];

  // Track processed range fields to avoid duplicates
  const processedRangeFields = new Set<string>();

  for (const [key, value] of Object.entries(filters)) {
    // Skip undefined or empty string values
    if (value === undefined || value === '') {
      continue;
    }

    // Sanitize field name - allow alphanumeric, underscores, and dots for table-qualified names (e.g., h.hotel_name)
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(key)) {
      console.warn(`Invalid filter field name: ${key}`);
      continue;
    }

    // Handle range filters (_min and _max suffixes)
    if (key.endsWith('_min')) {
      const baseField = key.slice(0, -4); // Remove '_min'
      if (!processedRangeFields.has(baseField)) {
        // Sanitize base field name - allow table-qualified names
        if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(baseField)) {
          console.warn(`Invalid base field name: ${baseField}`);
          continue;
        }

        const minValue = value;
        const maxValue = filters[`${baseField}_max`];

        if (minValue !== undefined && minValue !== '') {
          conditions.push(`${baseField} >= ?`);
          params.push(minValue);
        }

        if (maxValue !== undefined && maxValue !== '') {
          conditions.push(`${baseField} <= ?`);
          params.push(maxValue);
        }

        processedRangeFields.add(baseField);
      }
      continue;
    }

    // Skip _max fields as they're handled with _min
    if (key.endsWith('_max')) {
      continue;
    }

    // Handle null values
    if (value === null) {
      conditions.push(`${key} IS NULL`);
      continue;
    }

    // Handle arrays (IN clause)
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue; // Skip empty arrays
      }

      // Check for null in array
      const hasNull = value.includes(null);
      const nonNullValues = value.filter(v => v !== null);

      if (hasNull && nonNullValues.length > 0) {
        // Handle both null and non-null values
        const placeholders = nonNullValues.map(() => '?').join(', ');
        conditions.push(`(${key} IN (${placeholders}) OR ${key} IS NULL)`);
        params.push(...nonNullValues);
      } else if (hasNull) {
        // Only null values
        conditions.push(`${key} IS NULL`);
      } else {
        // Only non-null values
        const placeholders = nonNullValues.map(() => '?').join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...nonNullValues);
      }
      continue;
    }

    // Handle special NOT NULL case (using special value)
    if (value === '__NOT_NULL__') {
      conditions.push(`${key} IS NOT NULL`);
      continue;
    }

    // Default: equality comparison
    conditions.push(`${key} = ?`);
    params.push(value);
  }

  return {
    whereSQL: conditions.join(' AND '),
    params,
  };
}

/**
 * Builds a parameterized search clause for text searching across multiple fields
 *
 * @param searchTerm - The search term to look for
 * @param fields - Array of field names to search in
 * @returns Object with SQL search clause and parameterized values
 *
 * @example
 * ```ts
 * buildSearchClause('Grand Hotel', ['name', 'city', 'description'])
 * // Returns: {
 * //   searchSQL: "(name LIKE ? OR city LIKE ? OR description LIKE ?)",
 * //   params: ['%Grand Hotel%', '%Grand Hotel%', '%Grand Hotel%']
 * // }
 *
 * buildSearchClause('', ['name'])
 * // Returns: {
 * //   searchSQL: "",
 * //   params: []
 * // }
 * ```
 *
 * @remarks
 * - Uses LIKE with wildcards for partial matching
 * - Sanitizes field names to prevent SQL injection
 * - Returns empty strings and arrays if search term is empty
 * - Wraps multiple fields in OR clause with parentheses
 */
export function buildSearchClause(
  searchTerm: string,
  fields: string[]
): SearchClauseResult {
  // Return empty if no search term
  if (!searchTerm || searchTerm.trim() === '') {
    return {
      searchSQL: '',
      params: [],
    };
  }

  // Return empty if no fields
  if (!fields || fields.length === 0) {
    return {
      searchSQL: '',
      params: [],
    };
  }

  const conditions: string[] = [];
  const params: any[] = [];
  const searchValue = `%${searchTerm}%`;

  for (const field of fields) {
    // Sanitize field name - allow alphanumeric, underscores, and dots for table-qualified names (e.g., h.hotel_name)
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(field)) {
      console.warn(`Invalid search field name: ${field}`);
      continue;
    }

    conditions.push(`${field} LIKE ?`);
    params.push(searchValue);
  }

  // Return empty if no valid fields after sanitization
  if (conditions.length === 0) {
    return {
      searchSQL: '',
      params: [],
    };
  }

  return {
    searchSQL: `(${conditions.join(' OR ')})`,
    params,
  };
}

/**
 * Combines WHERE clause and search clause into a single WHERE condition
 *
 * @param whereClause - Result from buildWhereClause
 * @param searchClause - Result from buildSearchClause
 * @returns Combined SQL WHERE clause (without "WHERE" keyword) and merged params
 *
 * @example
 * ```ts
 * const filters = buildWhereClause({ status: 'active' });
 * const search = buildSearchClause('hotel', ['name', 'city']);
 * const combined = combineWhereAndSearch(filters, search);
 * // Returns: {
 * //   whereSQL: "status = ? AND (name LIKE ? OR city LIKE ?)",
 * //   params: ['active', '%hotel%', '%hotel%']
 * // }
 * ```
 */
export function combineWhereAndSearch(
  whereClause: WhereClauseResult,
  searchClause: SearchClauseResult
): WhereClauseResult {
  const conditions: string[] = [];
  const params: any[] = [];

  if (whereClause.whereSQL) {
    conditions.push(whereClause.whereSQL);
    params.push(...whereClause.params);
  }

  if (searchClause.searchSQL) {
    conditions.push(searchClause.searchSQL);
    params.push(...searchClause.params);
  }

  return {
    whereSQL: conditions.join(' AND '),
    params,
  };
}

/**
 * Builds a complete SQL query with WHERE, ORDER BY, LIMIT, and OFFSET clauses
 *
 * @param baseQuery - Base SELECT query (e.g., "SELECT * FROM users")
 * @param options - Query building options
 * @returns Complete SQL query and parameters
 *
 * @example
 * ```ts
 * const { sql, params } = buildQuery('SELECT * FROM hotels', {
 *   where: buildWhereClause({ status: 'active' }),
 *   search: buildSearchClause('grand', ['name']),
 *   orderBy: 'created_at DESC',
 *   limit: 25,
 *   offset: 0
 * });
 * // Returns: {
 * //   sql: "SELECT * FROM hotels WHERE status = ? AND (name LIKE ?) ORDER BY created_at DESC LIMIT 25 OFFSET 0",
 * //   params: ['active', '%grand%']
 * // }
 * ```
 */
export function buildQuery(
  baseQuery: string,
  options: {
    where?: WhereClauseResult;
    search?: SearchClauseResult;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }
): { sql: string; params: any[] } {
  let sql = baseQuery;
  const params: any[] = [];

  // Combine WHERE and search clauses
  const combined = combineWhereAndSearch(
    options.where || { whereSQL: '', params: [] },
    options.search || { searchSQL: '', params: [] }
  );

  // Add WHERE clause
  if (combined.whereSQL) {
    sql += ` WHERE ${combined.whereSQL}`;
    params.push(...combined.params);
  }

  // Add ORDER BY clause
  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy}`;
  }

  // Add LIMIT clause
  if (options.limit !== undefined && options.limit > 0) {
    sql += ` LIMIT ${options.limit}`;
  }

  // Add OFFSET clause
  if (options.offset !== undefined && options.offset > 0) {
    sql += ` OFFSET ${options.offset}`;
  }

  return { sql, params };
}
