import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, noContentResponse, notFoundProblem, internalServerErrorProblem } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { createMoney } from '@/lib/money';

// GET - Fetch single request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'requests', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const [row] = await query(
      `SELECT * FROM customer_itineraries WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!row) {
      return errorResponse(
        notFoundProblem(`Request with ID ${id} not found`, `/api/requests/${id}`)
      );
    }

    // Transform to include Money types
    const transformedRequest = {
      ...row,
      total_price: createMoney(parseFloat(row.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(row.price_per_person || 0), 'EUR')
    };

    return successResponse(transformedRequest);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch request', `/api/requests/${id}`)
    );
  }
}

// PATCH - Update request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'requests', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    // Check if request exists and belongs to tenant
    const [existing] = await query(
      `SELECT id FROM customer_itineraries WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existing) {
      return errorResponse(
        notFoundProblem(`Request with ID ${id} not found`, `/api/requests/${id}`)
      );
    }

    const body = await request.json();

    // Calculate price per person if adults/children/total_price are provided
    let pricePerPerson;
    if (body.adults !== undefined || body.children !== undefined || body.total_price !== undefined) {
      const adults = body.adults ?? existing.adults;
      const children = body.children ?? existing.children;
      const totalPrice = body.total_price ?? existing.total_price;
      const totalPax = adults + children;
      pricePerPerson = totalPax > 0 ? totalPrice / totalPax : 0;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (body.customer_name !== undefined) {
      updates.push('customer_name = ?');
      values.push(body.customer_name);
    }
    if (body.customer_email !== undefined) {
      updates.push('customer_email = ?');
      values.push(body.customer_email);
    }
    if (body.customer_phone !== undefined) {
      updates.push('customer_phone = ?');
      values.push(body.customer_phone || null);
    }
    if (body.destination !== undefined) {
      updates.push('destination = ?');
      values.push(body.destination);
    }
    if (body.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(body.start_date);
    }
    if (body.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(body.end_date);
    }
    if (body.adults !== undefined) {
      updates.push('adults = ?');
      values.push(body.adults);
    }
    if (body.children !== undefined) {
      updates.push('children = ?');
      values.push(body.children);
    }
    if (body.hotel_category !== undefined) {
      updates.push('hotel_category = ?');
      values.push(body.hotel_category || null);
    }
    if (body.tour_type !== undefined) {
      updates.push('tour_type = ?');
      values.push(body.tour_type || null);
    }
    if (body.special_requests !== undefined) {
      updates.push('special_requests = ?');
      values.push(body.special_requests || null);
    }
    if (body.total_price !== undefined) {
      updates.push('total_price = ?');
      values.push(body.total_price);
    }
    if (pricePerPerson !== undefined) {
      updates.push('price_per_person = ?');
      values.push(pricePerPerson);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }

    if (updates.length === 0) {
      // No fields to update, return current state
      const [current] = await query(
        'SELECT * FROM customer_itineraries WHERE id = ?',
        [id]
      ) as any[];

      const transformedRequest = {
        ...current,
        total_price: createMoney(parseFloat(current.total_price || 0), 'EUR'),
        price_per_person: createMoney(parseFloat(current.price_per_person || 0), 'EUR')
      };

      return successResponse(transformedRequest);
    }

    // Execute update
    const sql = `UPDATE customer_itineraries SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    await query(sql, values);

    // Fetch updated request
    const [updated] = await query(
      'SELECT * FROM customer_itineraries WHERE id = ?',
      [id]
    ) as any[];

    const transformedRequest = {
      ...updated,
      total_price: createMoney(parseFloat(updated.total_price || 0), 'EUR'),
      price_per_person: createMoney(parseFloat(updated.price_per_person || 0), 'EUR')
    };

    return successResponse(transformedRequest);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update request', `/api/requests/${id}`)
    );
  }
}

// DELETE - Delete request (soft delete - set status to cancelled)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'requests', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    // Check if request exists and belongs to tenant
    const [existing] = await query(
      `SELECT id FROM customer_itineraries WHERE id = ? AND organization_id = ?`,
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existing) {
      return errorResponse(
        notFoundProblem(`Request with ID ${id} not found`, `/api/requests/${id}`)
      );
    }

    // Soft delete - set status to cancelled
    await query(
      `UPDATE customer_itineraries SET status = 'cancelled' WHERE id = ?`,
      [id]
    );

    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to delete request', `/api/requests/${id}`)
    );
  }
}
