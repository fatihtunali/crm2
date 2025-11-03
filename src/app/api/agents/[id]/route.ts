import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, noContentResponse, notFoundProblem, internalServerErrorProblem } from '@/lib/response';

// GET - Fetch single agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [row] = await query(
      `SELECT * FROM organizations WHERE id = ?`,
      [id]
    ) as any[];

    if (!row) {
      return errorResponse(
        notFoundProblem(`Agent with ID ${id} not found`, `/api/agents/${id}`)
      );
    }

    return successResponse(row);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch agent', `/api/agents/${id}`)
    );
  }
}

// PATCH - Update agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Check if agent exists
    const [existing] = await query(
      `SELECT id, name FROM organizations WHERE id = ?`,
      [id]
    ) as any[];

    if (!existing) {
      return errorResponse(
        notFoundProblem(`Agent with ID ${id} not found`, `/api/agents/${id}`)
      );
    }

    const body = await request.json();

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
      // Update slug if name changed
      const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      updates.push('slug = ?');
      values.push(slug);
    }
    if (body.email !== undefined) {
      updates.push('email = ?');
      values.push(body.email);
    }
    if (body.phone !== undefined) {
      updates.push('phone = ?');
      values.push(body.phone || null);
    }
    if (body.country !== undefined) {
      updates.push('country = ?');
      values.push(body.country || null);
    }
    if (body.website !== undefined) {
      updates.push('website = ?');
      values.push(body.website || null);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    if (body.primary_color !== undefined) {
      updates.push('primary_color = ?');
      values.push(body.primary_color);
    }
    if (body.secondary_color !== undefined) {
      updates.push('secondary_color = ?');
      values.push(body.secondary_color);
    }

    if (updates.length === 0) {
      // No fields to update, return current state
      const [current] = await query(
        'SELECT * FROM organizations WHERE id = ?',
        [id]
      ) as any[];

      return successResponse(current);
    }

    // Execute update
    const sql = `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    await query(sql, values);

    // Fetch updated agent
    const [updated] = await query(
      'SELECT * FROM organizations WHERE id = ?',
      [id]
    ) as any[];

    return successResponse(updated);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update agent', `/api/agents/${id}`)
    );
  }
}

// DELETE - Delete agent (soft delete - set status to suspended)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Check if agent exists
    const [existing] = await query(
      `SELECT id FROM organizations WHERE id = ?`,
      [id]
    ) as any[];

    if (!existing) {
      return errorResponse(
        notFoundProblem(`Agent with ID ${id} not found`, `/api/agents/${id}`)
      );
    }

    // Soft delete - set status to suspended
    await query(
      `UPDATE organizations SET status = 'suspended' WHERE id = ?`,
      [id]
    );

    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to delete agent', `/api/agents/${id}`)
    );
  }
}
