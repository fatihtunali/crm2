import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireTenant } from '@/middleware/tenancy';
import { errorResponse, successResponse, internalServerErrorProblem } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and get tenant context
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { user } = tenantResult;

    // SECURITY: Only super_admin can perform database migrations
    if (user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only super_admin can perform database migrations',
        instance: request.url,
      });
    }

    // Check if city column already exists
    const [columns] = await query(
      "SHOW COLUMNS FROM providers LIKE 'city'"
    ) as any[];

    if (columns && columns.length > 0) {
      return successResponse({
        success: true,
        message: 'City column already exists in providers table'
      });
    }

    // Add city column after provider_type
    await query(`
      ALTER TABLE providers
      ADD COLUMN city VARCHAR(100) NULL
      AFTER provider_type
    `);

    return successResponse({
      success: true,
      message: 'Successfully added city column to providers table'
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return errorResponse(internalServerErrorProblem('Failed to migrate providers table'));
  }
}
