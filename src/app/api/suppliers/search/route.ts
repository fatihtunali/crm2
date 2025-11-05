import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { successResponse, errorResponse, badRequestProblem, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

/**
 * Supplier type discriminator for federated search results
 */
type SupplierType =
  | 'hotel'
  | 'guide'
  | 'vehicle'
  | 'restaurant'
  | 'entrance_fee'
  | 'extra_expense'
  | 'transfer'
  | 'tour_package';

/**
 * Base supplier search result with discriminator
 */
interface SupplierSearchResult {
  id: number;
  name: string;
  location: string;
  supplier_type: SupplierType;
  price?: number;
  currency?: string;
  [key: string]: any; // Additional type-specific fields
}

// GET - Federated search across all supplier types
export async function GET(request: Request) {
  try {
    // Validate tenant
    const tenantCheck = await requireTenant(request as any);
    if ('error' in tenantCheck) {
      return errorResponse(tenantCheck.error);
    }
    const { tenantId } = tenantCheck;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Get search filters
    const typeFilter = searchParams.get('type') as SupplierType | null;
    const location = searchParams.get('location') || '';
    const searchTerm = searchParams.get('search') || '';
    const date = searchParams.get('date');

    // Get sorting
    const sortParam = searchParams.get('sort');
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['id', 'name', 'location', 'supplier_type', 'price', 'currency'];
    const sortClause = parseSortParams(sortParam || 'name', ALLOWED_COLUMNS);

    // Validate type filter if provided
    const validTypes: SupplierType[] = [
      'hotel', 'guide', 'vehicle', 'restaurant',
      'entrance_fee', 'extra_expense', 'transfer', 'tour_package'
    ];

    if (typeFilter && !validTypes.includes(typeFilter)) {
      return errorResponse(
        badRequestProblem(
          `Invalid type filter. Must be one of: ${validTypes.join(', ')}`,
          '/api/suppliers/search'
        )
      );
    }

    // Build federated search queries
    const queries: string[] = [];
    const params: any[] = [];

    // Helper to add tenant filtering
    const addTenantFilter = (tableName: string) => `${tableName}.tenant_id = ?`;

    // Hotel search
    if (!typeFilter || typeFilter === 'hotel') {
      let hotelQuery = `
        SELECT
          h.id,
          h.hotel_name as name,
          h.city as location,
          'hotel' as supplier_type,
          h.hotel_category,
          h.star_rating,
          hp.currency,
          hp.double_room_bb as price,
          hp.single_supplement_bb as single_supplement,
          hp.child_0_6_bb as child_0to2,
          hp.child_6_12_bb as child_6to11
        FROM hotels h
        LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
          AND hp.status = 'active'
          ${date ? 'AND ? BETWEEN hp.start_date AND hp.end_date' : ''}
        WHERE h.status = 'active' AND ${addTenantFilter('h')}
      `;
      if (date) params.push(date);
      params.push(tenantId);

      if (location) {
        hotelQuery += ' AND h.city LIKE ?';
        params.push(`%${location}%`);
      }
      if (searchTerm) {
        hotelQuery += ' AND h.hotel_name LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      queries.push(hotelQuery);
    }

    // Guide search
    if (!typeFilter || typeFilter === 'guide') {
      let guideQuery = `
        SELECT
          g.id,
          CONCAT(g.language, ' Guide - ', g.city) as name,
          g.city as location,
          'guide' as supplier_type,
          g.language,
          gp.currency,
          gp.full_day_price as price,
          gp.half_day_price
        FROM guides g
        LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
          AND gp.status = 'active'
          ${date ? 'AND ? BETWEEN gp.start_date AND gp.end_date' : ''}
        WHERE g.status = 'active' AND ${addTenantFilter('g')}
      `;
      if (date) params.push(date);
      params.push(tenantId);

      if (location) {
        guideQuery += ' AND g.city LIKE ?';
        params.push(`%${location}%`);
      }
      if (searchTerm) {
        guideQuery += ' AND g.language LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      queries.push(guideQuery);
    }

    // Vehicle/Transfer search
    if (!typeFilter || typeFilter === 'transfer') {
      let transferQuery = `
        SELECT
          t.id,
          CONCAT(t.from_city, ' to ', t.to_city) as name,
          t.from_city as location,
          'transfer' as supplier_type,
          t.price_oneway as price,
          t.price_roundtrip,
          v.vehicle_type,
          v.max_capacity
        FROM intercity_transfers t
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        WHERE t.status = 'active' AND ${addTenantFilter('t')}
      `;
      params.push(tenantId);

      if (location) {
        transferQuery += ' AND (t.from_city LIKE ? OR t.to_city LIKE ?)';
        params.push(`%${location}%`, `%${location}%`);
      }
      if (searchTerm) {
        transferQuery += ' AND (t.from_city LIKE ? OR t.to_city LIKE ?)';
        params.push(`%${searchTerm}%`, `%${searchTerm}%`);
      }

      queries.push(transferQuery);
    }

    // Restaurant search
    if (!typeFilter || typeFilter === 'restaurant') {
      let restaurantQuery = `
        SELECT
          id,
          restaurant_name as name,
          city as location,
          'restaurant' as supplier_type,
          meal_type,
          currency,
          adult_lunch_price as price,
          child_lunch_price,
          adult_dinner_price,
          child_dinner_price
        FROM meal_pricing
        WHERE status = 'active' AND ${addTenantFilter('meal_pricing')}
      `;
      params.push(tenantId);

      if (location) {
        restaurantQuery += ' AND city LIKE ?';
        params.push(`%${location}%`);
      }
      if (searchTerm) {
        restaurantQuery += ' AND restaurant_name LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      queries.push(restaurantQuery);
    }

    // Entrance fee search
    if (!typeFilter || typeFilter === 'entrance_fee') {
      let feeQuery = `
        SELECT
          e.id,
          e.site_name as name,
          e.city as location,
          'entrance_fee' as supplier_type,
          ep.currency,
          ep.adult_price as price,
          ep.child_price
        FROM entrance_fees e
        LEFT JOIN entrance_fee_pricing ep ON e.id = ep.entrance_fee_id
          AND ep.status = 'active'
          ${date ? 'AND ? BETWEEN ep.start_date AND ep.end_date' : ''}
        WHERE e.status = 'active' AND ${addTenantFilter('e')}
      `;
      if (date) params.push(date);
      params.push(tenantId);

      if (location) {
        feeQuery += ' AND e.city LIKE ?';
        params.push(`%${location}%`);
      }
      if (searchTerm) {
        feeQuery += ' AND e.site_name LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      queries.push(feeQuery);
    }

    // Extra expense search
    if (!typeFilter || typeFilter === 'extra_expense') {
      let expenseQuery = `
        SELECT
          id,
          expense_name as name,
          city as location,
          'extra_expense' as supplier_type,
          expense_category,
          currency,
          unit_price as price,
          unit_type
        FROM extra_expenses
        WHERE status = 'active' AND ${addTenantFilter('extra_expenses')}
      `;
      params.push(tenantId);

      if (location) {
        expenseQuery += ' AND city LIKE ?';
        params.push(`%${location}%`);
      }
      if (searchTerm) {
        expenseQuery += ' AND expense_name LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      queries.push(expenseQuery);
    }

    // Tour package search
    if (!typeFilter || typeFilter === 'tour_package') {
      let tourQuery = `
        SELECT
          t.id,
          t.tour_name as name,
          t.city as location,
          'tour_package' as supplier_type,
          t.description,
          tp.currency,
          tp.sic_price_2_pax as price,
          tp.sic_price_2_pax as adult_price
        FROM tours t
        LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
          AND tp.status = 'active'
          ${date ? 'AND ? BETWEEN tp.start_date AND tp.end_date' : ''}
        WHERE t.status = 'active' AND ${addTenantFilter('t')}
      `;
      if (date) params.push(date);
      params.push(tenantId);

      if (location) {
        tourQuery += ' AND t.city LIKE ?';
        params.push(`%${location}%`);
      }
      if (searchTerm) {
        tourQuery += ' AND t.tour_name LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      queries.push(tourQuery);
    }

    // Union all queries
    const unionQuery = queries.join(' UNION ALL ');

    // Wrap in subquery for sorting and pagination
    const finalQuery = `
      SELECT * FROM (${unionQuery}) as suppliers
      ${sortClause ? `ORDER BY ${sortClause}` : 'ORDER BY name ASC'}
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, offset);

    // Count query for total
    const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery}) as suppliers`;
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET

    // Execute queries in parallel
    const [results, countResult] = await Promise.all([
      query(finalQuery, params),
      query(countQuery, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Build paged response
    const pagedResponse = buildPagedResponse(
      results as SupplierSearchResult[],
      total,
      page,
      pageSize
    );

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Supplier search error:', error);
    return errorResponse(
      internalServerErrorProblem(
        'Failed to search suppliers',
        '/api/suppliers/search'
      )
    );
  }
}
