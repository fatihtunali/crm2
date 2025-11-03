import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { errorResponse, notFoundProblem, internalServerErrorProblem, noContentResponse } from '@/lib/response';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET - Fetch single tour package by ID with pricing
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    const sql = `
      SELECT
        t.*,
        p.provider_name,
        tp.id as pricing_id,
        tp.season_name,
        tp.start_date as season_start,
        tp.end_date as season_end,
        tp.currency,
        tp.sic_price_2_pax,
        tp.sic_price_4_pax,
        tp.sic_price_6_pax,
        tp.sic_price_8_pax,
        tp.sic_price_10_pax,
        tp.pvt_price_2_pax,
        tp.pvt_price_4_pax,
        tp.pvt_price_6_pax,
        tp.pvt_price_8_pax,
        tp.pvt_price_10_pax
      FROM tours t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
        AND tp.status = 'active'
        AND CURDATE() BETWEEN tp.start_date AND tp.end_date
      WHERE t.id = ? AND t.organization_id = ?
    `;

    const rows = await query(sql, [id, parseInt(tenantId)]) as any[];

    if (!rows || rows.length === 0) {
      return errorResponse(notFoundProblem(
        `Tour package with ID ${id} not found`,
        `/api/daily-tours/${id}`
      ));
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch tour package'));
  }
}

// PATCH - Partially update tour package
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    // First, check if the tour exists and belongs to this tenant
    const existing = await query(
      'SELECT id FROM tours WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existing || existing.length === 0) {
      return errorResponse(notFoundProblem(
        `Tour package with ID ${id} not found`,
        `/api/daily-tours/${id}`
      ));
    }

    // Build dynamic update query based on provided fields
    const allowedFields = [
      'provider_id',
      'tour_name',
      'tour_code',
      'city',
      'duration_days',
      'duration_hours',
      'duration_type',
      'description',
      'tour_type',
      'inclusions',
      'exclusions',
      'photo_url_1',
      'photo_url_2',
      'photo_url_3',
      'rating',
      'user_ratings_total',
      'website',
      'status'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body.hasOwnProperty(field)) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'No valid fields provided for update'
      });
    }

    // Add the ID to the values array for the WHERE clause
    values.push(id);

    await query(
      `UPDATE tours SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch and return the updated tour
    const [updatedTour] = await query(
      'SELECT * FROM tours WHERE id = ?',
      [id]
    ) as any[];

    return NextResponse.json(updatedTour);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update tour package'));
  }
}

// DELETE - Soft delete (archive) tour package
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    // Check if the tour exists and belongs to this tenant
    const existing = await query(
      'SELECT id FROM tours WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existing || existing.length === 0) {
      return errorResponse(notFoundProblem(
        `Tour package with ID ${id} not found`,
        `/api/daily-tours/${id}`
      ));
    }

    // Soft delete by setting status to inactive
    await query(
      'UPDATE tours SET status = ? WHERE id = ? AND organization_id = ?',
      ['inactive', id, parseInt(tenantId)]
    );

    // Return 204 No Content
    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to delete tour package'));
  }
}
