import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  errorResponse,
  notFoundProblem,
  internalServerErrorProblem,
  noContentResponse,
  successResponse,
} from '@/lib/response';

// GET - Fetch a single meal pricing record by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse organization_id for tenancy filtering
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organization_id');

    let sql = `
      SELECT
        mp.*,
        p.provider_name
      FROM meal_pricing mp
      LEFT JOIN providers p ON mp.provider_id = p.id
      WHERE mp.id = ?
    `;

    const queryParams: any[] = [id];

    // Add tenancy filter if provided
    if (orgId) {
      sql += ' AND mp.organization_id = ?';
      queryParams.push(parseInt(orgId));
    }

    const rows = await query(sql, queryParams);

    if ((rows as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Restaurant pricing with ID ${id} not found`,
          `/api/restaurants/${id}`
        )
      );
    }

    return successResponse((rows as any[])[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch restaurant pricing')
    );
  }
}

// PATCH - Partially update meal pricing record
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Parse organization_id for tenancy filtering
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organization_id');

    // First, check if the record exists (with tenancy check)
    let checkSql = 'SELECT id FROM meal_pricing WHERE id = ?';
    const checkParams: any[] = [id];

    if (orgId) {
      checkSql += ' AND organization_id = ?';
      checkParams.push(parseInt(orgId));
    }

    const existingRows = await query(checkSql, checkParams);

    if ((existingRows as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Restaurant pricing with ID ${id} not found`,
          `/api/restaurants/${id}`
        )
      );
    }

    // Build dynamic UPDATE query based on provided fields
    const allowedFields = [
      'organization_id',
      'provider_id',
      'restaurant_name',
      'city',
      'meal_type',
      'season_name',
      'start_date',
      'end_date',
      'currency',
      'adult_lunch_price',
      'child_lunch_price',
      'adult_dinner_price',
      'child_dinner_price',
      'menu_description',
      'effective_from',
      'created_by',
      'notes',
      'status',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body.hasOwnProperty(field) && body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // If no valid fields to update, return error
    if (updates.length === 0) {
      return errorResponse(
        notFoundProblem('No valid fields provided for update')
      );
    }

    // Add ID to the end of values array
    values.push(id);

    // Add tenancy check to WHERE clause
    let whereClauses = 'id = ?';
    if (orgId) {
      whereClauses += ' AND organization_id = ?';
      values.push(parseInt(orgId));
    }

    const updateSql = `UPDATE meal_pricing SET ${updates.join(', ')} WHERE ${whereClauses}`;

    await query(updateSql, values);

    // Fetch and return updated record
    const updatedRows = await query(
      `SELECT mp.*, p.provider_name
       FROM meal_pricing mp
       LEFT JOIN providers p ON mp.provider_id = p.id
       WHERE mp.id = ?`,
      [id]
    );

    return successResponse((updatedRows as any[])[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update restaurant pricing')
    );
  }
}

// DELETE - Soft delete (archive) meal pricing record
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse organization_id for tenancy filtering
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organization_id');

    // First, check if the record exists (with tenancy check)
    let checkSql = 'SELECT id FROM meal_pricing WHERE id = ?';
    const checkParams: any[] = [id];

    if (orgId) {
      checkSql += ' AND organization_id = ?';
      checkParams.push(parseInt(orgId));
    }

    const existingRows = await query(checkSql, checkParams);

    if ((existingRows as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Restaurant pricing with ID ${id} not found`,
          `/api/restaurants/${id}`
        )
      );
    }

    // Soft delete by setting status to 'inactive'
    let deleteSql = 'UPDATE meal_pricing SET status = ? WHERE id = ?';
    const deleteParams: any[] = ['inactive', id];

    if (orgId) {
      deleteSql += ' AND organization_id = ?';
      deleteParams.push(parseInt(orgId));
    }

    await query(deleteSql, deleteParams);

    // Return 204 No Content
    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to delete restaurant pricing')
    );
  }
}
