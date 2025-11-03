import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: 'X-Tenant-Id header is required'
      }, { status: 400 });
    }

    // Count inactive tours first
    const [countResult] = await query(
      'SELECT COUNT(*) as total FROM tours WHERE status = ? AND organization_id = ?',
      ['inactive', parseInt(tenantId)]
    ) as any[];

    const inactiveCount = countResult.total;

    if (inactiveCount === 0) {
      return NextResponse.json({
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

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${inactiveCount} inactive tours`,
      deleted: inactiveCount
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
