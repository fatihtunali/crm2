import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireTenant } from '@/middleware/tenancy';
import { errorResponse, successResponse, internalServerErrorProblem } from '@/lib/response';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication and get tenant context
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { user } = tenantResult;

    // SECURITY: Only super_admin can view database schema
    if (user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only super_admin can view database schema',
        instance: request.url,
      });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') || 'providers';

    // Whitelist of allowed tables to prevent SQL injection
    const ALLOWED_TABLES = [
      'providers', 'clients', 'quotes', 'hotels', 'vehicles', 'guides',
      'daily_tours', 'entrance_fees', 'restaurants', 'transfers',
      'agents', 'bookings', 'extra_expenses', 'customer_itineraries',
      'invoices_receivable', 'invoices_payable', 'invoice_items'
    ];

    if (!ALLOWED_TABLES.includes(table)) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/invalid-parameter',
        title: 'Invalid Parameter',
        status: 400,
        detail: 'Invalid table name',
        instance: request.url,
      });
    }

    // Get table structure - safe now because table is validated
    const columns = await query(`DESCRIBE ${table}`) as any[];

    return successResponse({
      table,
      columns: columns.map((col: any) => ({
        Field: col.Field,
        Type: col.Type,
        Null: col.Null,
        Key: col.Key,
        Default: col.Default,
        Extra: col.Extra
      }))
    });

  } catch (error: any) {
    console.error('Schema check error:', error);
    return errorResponse(internalServerErrorProblem('Failed to check schema'));
  }
}
