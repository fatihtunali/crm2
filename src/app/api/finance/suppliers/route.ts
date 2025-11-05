import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { buildWhereClause } from '@/lib/query-builder';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

// GET - Fetch aggregated supplier financial data
export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Parse sort parameters (default: -outstanding DESC, -total_invoiced DESC)
    const sortParam = searchParams.get('sort') || '-outstanding';
    // SECURITY: Whitelist allowed columns to prevent SQL injection
    const ALLOWED_COLUMNS = ['provider_id', 'provider_name', 'provider_type', 'contact_email', 'contact_phone', 'invoice_count', 'total_invoiced', 'total_paid', 'outstanding', 'last_payment_date', 'overdue_count', 'pending_count', 'paid_count'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS);

    // Build filters
    const filters: Record<string, any> = {};

    const providerTypeFilter = searchParams.get('provider_type');
    if (providerTypeFilter && providerTypeFilter !== 'all') {
      filters.provider_type = providerTypeFilter;
    }

    // Build where clause
    const whereClause = buildWhereClause(filters);

    // Build search clause (search in provider_name, contact_email)
    const searchTerm = searchParams.get('search');
    const searchClause = buildSearchTerm(searchTerm || '');

    // Build main query with tenant filtering
    let sql = `
      SELECT
        p.id as provider_id,
        p.provider_name,
        p.provider_type,
        p.contact_email,
        p.contact_phone,
        COUNT(DISTINCT ip.id) as invoice_count,
        SUM(ip.total_amount) as total_invoiced,
        SUM(ip.paid_amount) as total_paid,
        SUM(ip.total_amount - ip.paid_amount) as outstanding,
        MAX(ip.payment_date) as last_payment_date,
        COUNT(CASE WHEN ip.status = 'overdue' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN ip.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN ip.status = 'paid' THEN 1 END) as paid_count
      FROM providers p
      LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
      LEFT JOIN quotes q ON ip.booking_id = q.id
      WHERE q.organization_id = ?
    `;

    const params: any[] = [parseInt(tenantId)];

    // Add where clause for filters
    if (whereClause.whereSQL) {
      sql += ` AND ${whereClause.whereSQL}`;
      params.push(...whereClause.params);
    }

    // Add search clause
    if (searchClause.searchSQL) {
      sql += ` AND ${searchClause.searchSQL}`;
      params.push(...searchClause.params);
    }

    sql += `
      GROUP BY p.id, p.provider_name, p.provider_type, p.contact_email, p.contact_phone
      HAVING invoice_count > 0
    `;

    // Add ORDER BY clause
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    } else {
      sql += ` ORDER BY outstanding DESC, total_invoiced DESC`;
    }

    // Add pagination
    sql += ` LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    // Build count query
    let countSql = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM providers p
      LEFT JOIN invoices_payable ip ON p.id = ip.provider_id
      LEFT JOIN quotes q ON ip.booking_id = q.id
      WHERE q.organization_id = ?
        AND ip.id IS NOT NULL
    `;
    const countParams: any[] = [parseInt(tenantId)];

    if (whereClause.whereSQL) {
      countSql += ` AND ${whereClause.whereSQL}`;
      countParams.push(...whereClause.params);
    }

    if (searchClause.searchSQL) {
      countSql += ` AND ${searchClause.searchSQL}`;
      countParams.push(...searchClause.params);
    }

    // Execute queries
    const [rows, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    const total = (countResult as any)[0].total;

    // Transform to use Money types
    const transformedSuppliers = (rows as any[]).map(supplier => ({
      provider_id: supplier.provider_id,
      provider_name: supplier.provider_name,
      provider_type: supplier.provider_type,
      contact_email: supplier.contact_email,
      contact_phone: supplier.contact_phone,
      invoice_count: supplier.invoice_count,
      total_invoiced: createMoney(parseFloat(supplier.total_invoiced || 0), 'EUR'),
      total_paid: createMoney(parseFloat(supplier.total_paid || 0), 'EUR'),
      outstanding: createMoney(parseFloat(supplier.outstanding || 0), 'EUR'),
      last_payment_date: supplier.last_payment_date,
      overdue_count: supplier.overdue_count,
      pending_count: supplier.pending_count,
      paid_count: supplier.paid_count
    }));

    // Build paged response
    const pagedResponse = buildPagedResponse(transformedSuppliers, total, page, pageSize);

    return successResponse(pagedResponse);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch supplier financial data', '/api/finance/suppliers')
    );
  }
}

// Helper function to build search clause for supplier data
function buildSearchTerm(searchTerm: string) {
  if (!searchTerm || searchTerm.trim() === '') {
    return { searchSQL: '', params: [] };
  }

  const searchValue = `%${searchTerm}%`;
  return {
    searchSQL: '(p.provider_name LIKE ? OR p.contact_email LIKE ?)',
    params: [searchValue, searchValue]
  };
}
