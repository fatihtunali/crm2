import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import { errorResponse, successResponse, internalServerErrorProblem } from '@/lib/response';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication and get tenant context
    const authResult = await requirePermission(request, 'admin', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // SECURITY: Only super_admin can cleanup tours
    if (user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only super_admin can perform cleanup operations',
        instance: request.url,
      });
    }

    // Count inactive tours first
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM tours WHERE status = ? AND organization_id = ?',
      ['inactive', parseInt(tenantId)]
    ) as any[];

    const inactiveCount = countResult.total;

    if (inactiveCount === 0) {
      return successResponse({
        success: true,
        message: 'No inactive tours found',
        deleted: 0
      });
    }

    // Delete inactive tours
    const result = await query(
      'DELETE FROM tours WHERE status = ? AND organization_id = ?',
      ['inactive', parseInt(tenantId)]
    );

    return successResponse({
      success: true,
      message: `Successfully deleted ${inactiveCount} inactive tours`,
      deleted: inactiveCount
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return errorResponse(internalServerErrorProblem('Failed to cleanup tours'));
  }
}
