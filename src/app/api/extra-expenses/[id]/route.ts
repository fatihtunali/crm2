import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundProblem,
  internalServerErrorProblem,
  noContentResponse
} from '@/lib/response';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET - Fetch a single extra expense by ID
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const rows = await query(
      `SELECT
        ee.id,
        ee.organization_id,
        ee.provider_id,
        ee.expense_name,
        ee.expense_category,
        ee.city,
        ee.currency,
        ee.unit_price,
        ee.unit_type,
        ee.description,
        ee.status,
        ee.created_at,
        ee.updated_at,
        p.provider_name
      FROM extra_expenses ee
      LEFT JOIN providers p ON ee.provider_id = p.id
      WHERE ee.id = ?`,
      [id]
    );

    if ((rows as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Extra expense with ID ${id} not found`,
          `/api/extra-expenses/${id}`
        )
      );
    }

    return successResponse((rows as any[])[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch extra expense')
    );
  }
}

// PATCH - Partially update an extra expense
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // First check if the expense exists
    const existing = await query(
      'SELECT id FROM extra_expenses WHERE id = ?',
      [id]
    );

    if ((existing as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Extra expense with ID ${id} not found`,
          `/api/extra-expenses/${id}`
        )
      );
    }

    // Build dynamic UPDATE query based on provided fields
    const allowedFields = [
      'organization_id',
      'provider_id',
      'expense_name',
      'expense_category',
      'city',
      'currency',
      'unit_price',
      'unit_type',
      'description',
      'status'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);

        // Handle unit_price with Money type conversion
        if (field === 'unit_price') {
          const unitPriceValue = typeof body[field] === 'number'
            ? body[field]
            : parseFloat(body[field]);
          values.push(unitPriceValue);
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return successResponse({ message: 'No fields to update' });
    }

    // Add updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await query(
      `UPDATE extra_expenses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch and return updated expense
    const updated = await query(
      `SELECT
        ee.id,
        ee.organization_id,
        ee.provider_id,
        ee.expense_name,
        ee.expense_category,
        ee.city,
        ee.currency,
        ee.unit_price,
        ee.unit_type,
        ee.description,
        ee.status,
        ee.created_at,
        ee.updated_at,
        p.provider_name
      FROM extra_expenses ee
      LEFT JOIN providers p ON ee.provider_id = p.id
      WHERE ee.id = ?`,
      [id]
    );

    return successResponse((updated as any[])[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update extra expense')
    );
  }
}

// DELETE - Soft delete (archive) an extra expense
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if the expense exists
    const existing = await query(
      'SELECT id, status FROM extra_expenses WHERE id = ?',
      [id]
    );

    if ((existing as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(
          `Extra expense with ID ${id} not found`,
          `/api/extra-expenses/${id}`
        )
      );
    }

    // Soft delete by setting status to inactive
    await query(
      'UPDATE extra_expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['inactive', id]
    );

    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to delete extra expense')
    );
  }
}
