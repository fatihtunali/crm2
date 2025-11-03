import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  errorResponse,
  notFoundProblem,
  internalServerErrorProblem,
  successResponse,
  noContentResponse,
} from '@/lib/response';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET - Fetch a single entrance fee by ID
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const sql = `
      SELECT
        ef.*,
        p.provider_name,
        efp.id as pricing_id,
        efp.season_name,
        efp.start_date as season_start,
        efp.end_date as season_end,
        efp.currency,
        efp.adult_price,
        efp.child_price,
        efp.student_price
      FROM entrance_fees ef
      LEFT JOIN providers p ON ef.provider_id = p.id
      LEFT JOIN entrance_fee_pricing efp ON ef.id = efp.entrance_fee_id
        AND efp.status = 'active'
        AND CURDATE() BETWEEN efp.start_date AND efp.end_date
      WHERE ef.id = ?
    `;

    const rows = await query(sql, [id]);

    if (!rows || (rows as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Entrance fee with ID ${id} not found`,
          `/api/entrance-fees/${id}`
        )
      );
    }

    return successResponse((rows as any[])[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem(
        'Failed to fetch entrance fee',
        `/api/entrance-fees/${id}`
      )
    );
  }
}

// PATCH - Partially update an entrance fee
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    // First, check if the entrance fee exists
    const existing = await query('SELECT id FROM entrance_fees WHERE id = ?', [id]);
    if (!existing || (existing as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Entrance fee with ID ${id} not found`,
          `/api/entrance-fees/${id}`
        )
      );
    }

    const body = await request.json();

    // Build dynamic UPDATE query based on provided fields
    const allowedFields = [
      'provider_id',
      'google_place_id',
      'organization_id',
      'site_name',
      'city',
      'description',
      'latitude',
      'longitude',
      'google_maps_url',
      'photo_url_1',
      'photo_url_2',
      'photo_url_3',
      'rating',
      'user_ratings_total',
      'website',
      'status',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body.hasOwnProperty(field)) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // If no valid fields to update, return error
    if (updates.length === 0) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'No valid fields provided for update',
        instance: `/api/entrance-fees/${id}`,
      });
    }

    // Add ID to values for WHERE clause
    values.push(id);

    const updateSql = `UPDATE entrance_fees SET ${updates.join(', ')} WHERE id = ?`;
    await query(updateSql, values);

    // Fetch and return updated entrance fee
    const updated = await query(
      'SELECT * FROM entrance_fees WHERE id = ?',
      [id]
    );

    return successResponse((updated as any[])[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem(
        'Failed to update entrance fee',
        `/api/entrance-fees/${id}`
      )
    );
  }
}

// DELETE - Soft delete (archive) an entrance fee
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    // First, check if the entrance fee exists
    const existing = await query('SELECT id FROM entrance_fees WHERE id = ?', [id]);
    if (!existing || (existing as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Entrance fee with ID ${id} not found`,
          `/api/entrance-fees/${id}`
        )
      );
    }

    // Soft delete by setting status to 'inactive'
    await query('UPDATE entrance_fees SET status = ? WHERE id = ?', ['inactive', id]);

    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem(
        'Failed to delete entrance fee',
        `/api/entrance-fees/${id}`
      )
    );
  }
}
