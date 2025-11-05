import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  successResponse,
  noContentResponse,
  errorResponse,
  notFoundProblem,
  internalServerErrorProblem
} from '@/lib/response';
import { toMinorUnits, fromMinorUnits } from '@/lib/money';

interface Transfer {
  id: number;
  organization_id: number;
  provider_id?: number;
  vehicle_id?: number;
  from_city: string;
  to_city: string;
  season_name?: string;
  start_date: string;
  end_date: string;
  price_oneway: number;
  price_roundtrip: number;
  estimated_duration_hours?: number;
  notes?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  provider_name?: string;
  vehicle_type?: string;
  max_capacity?: number;
}

interface TransferResponse extends Omit<Transfer, 'price_oneway' | 'price_roundtrip'> {
  price_oneway: {
    amount_minor: number;
    currency: string;
  };
  price_roundtrip: {
    amount_minor: number;
    currency: string;
  };
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET - Fetch a single intercity transfer by ID
export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const sql = `
      SELECT
        t.*,
        p.provider_name,
        v.vehicle_type,
        v.max_capacity
      FROM intercity_transfers t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      WHERE t.id = ?
    `;

    const rows = await query(sql, [id]);

    if ((rows as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(`Transfer with ID ${id} not found`, `/api/transfers/${id}`)
      );
    }

    const transfer = (rows as Transfer[])[0];

    // Transform price fields to Money type
    const transformedTransfer: TransferResponse = {
      ...transfer,
      price_oneway: {
        amount_minor: toMinorUnits(transfer.price_oneway),
        currency: 'EUR'
      },
      price_roundtrip: {
        amount_minor: toMinorUnits(transfer.price_roundtrip),
        currency: 'EUR'
      }
    };

    return successResponse(transformedTransfer);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch transfer'));
  }
}

// PATCH - Partially update an intercity transfer
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // First, check if the transfer exists
    const existing = await query(
      'SELECT id FROM intercity_transfers WHERE id = ?',
      [id]
    );

    if ((existing as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(`Transfer with ID ${id} not found`, `/api/transfers/${id}`)
      );
    }

    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: any[] = [];

    // Handle all possible update fields
    if (body.provider_id !== undefined) {
      updateFields.push('provider_id = ?');
      values.push(body.provider_id);
    }

    if (body.vehicle_id !== undefined) {
      updateFields.push('vehicle_id = ?');
      values.push(body.vehicle_id);
    }

    if (body.from_city !== undefined) {
      updateFields.push('from_city = ?');
      values.push(body.from_city);
    }

    if (body.to_city !== undefined) {
      updateFields.push('to_city = ?');
      values.push(body.to_city);
    }

    if (body.season_name !== undefined) {
      updateFields.push('season_name = ?');
      values.push(body.season_name);
    }

    if (body.start_date !== undefined) {
      updateFields.push('start_date = ?');
      values.push(body.start_date);
    }

    if (body.end_date !== undefined) {
      updateFields.push('end_date = ?');
      values.push(body.end_date);
    }

    // Handle price_oneway with Money type conversion
    if (body.price_oneway !== undefined) {
      updateFields.push('price_oneway = ?');
      if (typeof body.price_oneway === 'object' && 'amount_minor' in body.price_oneway) {
        values.push(fromMinorUnits(body.price_oneway.amount_minor));
      } else {
        values.push(body.price_oneway);
      }
    }

    // Handle price_roundtrip with Money type conversion
    if (body.price_roundtrip !== undefined) {
      updateFields.push('price_roundtrip = ?');
      if (typeof body.price_roundtrip === 'object' && 'amount_minor' in body.price_roundtrip) {
        values.push(fromMinorUnits(body.price_roundtrip.amount_minor));
      } else {
        values.push(body.price_roundtrip);
      }
    }

    if (body.estimated_duration_hours !== undefined) {
      updateFields.push('estimated_duration_hours = ?');
      values.push(body.estimated_duration_hours);
    }

    if (body.notes !== undefined) {
      updateFields.push('notes = ?');
      values.push(body.notes);
    }

    if (body.status !== undefined) {
      updateFields.push('status = ?');
      values.push(body.status);
    }

    // If no fields to update, return success
    if (updateFields.length === 0) {
      return successResponse({ message: 'No fields to update' });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = NOW()');

    // Build and execute update query
    const sql = `UPDATE intercity_transfers SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(id);

    await query(sql, values);

    // Fetch and return updated transfer
    const updatedRows = await query(
      `SELECT
        t.*,
        p.provider_name,
        v.vehicle_type,
        v.max_capacity
      FROM intercity_transfers t
      LEFT JOIN providers p ON t.provider_id = p.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      WHERE t.id = ?`,
      [id]
    );

    const transfer = (updatedRows as Transfer[])[0];

    // Transform price fields to Money type
    const transformedTransfer: TransferResponse = {
      ...transfer,
      price_oneway: {
        amount_minor: toMinorUnits(transfer.price_oneway),
        currency: 'EUR'
      },
      price_roundtrip: {
        amount_minor: toMinorUnits(transfer.price_roundtrip),
        currency: 'EUR'
      }
    };

    return successResponse(transformedTransfer);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update transfer'));
  }
}

// DELETE - Soft delete (archive) an intercity transfer
export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    // First, check if the transfer exists
    const existing = await query(
      'SELECT id FROM intercity_transfers WHERE id = ?',
      [id]
    );

    if ((existing as any[]).length === 0) {
      return errorResponse(
        notFoundProblem(`Transfer with ID ${id} not found`, `/api/transfers/${id}`)
      );
    }

    // Soft delete by setting status to inactive
    await query(
      'UPDATE intercity_transfers SET archived_at = NOW(), updated_at = NOW() WHERE id = ?',
      [id]
    );

    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to delete transfer'));
  }
}
