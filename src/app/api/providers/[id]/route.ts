import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, noContentResponse, errorResponse, notFoundProblem, internalServerErrorProblem, badRequestProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET - Fetch single provider by ID
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    // Enforce tenant scoping
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;


    // Validate ID
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return errorResponse(badRequestProblem('Invalid provider ID'));
    }

    // Fetch provider with tenant scoping
    const [provider] = await query(
      `SELECT
        id,
        organization_id,
        provider_name,
        provider_type,
        city,
        address,
        contact_email,
        contact_phone,
        notes,
        status,
        created_at,
        updated_at
      FROM providers
      WHERE id = ? AND organization_id = ?`,
      [providerId, tenantId]
    ) as any[];

    if (!provider) {
      return errorResponse(
        notFoundProblem(
          `Provider with ID ${providerId} not found`,
          `/api/providers/${providerId}`
        )
      );
    }

    return successResponse(provider);
  } catch (error) {
    console.error('Error fetching provider:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch provider'));
  }
}

// PATCH - Update provider
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    // Enforce tenant scoping
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;


    // Validate ID
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return errorResponse(badRequestProblem('Invalid provider ID'));
    }

    // Check if provider exists and belongs to tenant
    const [existingProvider] = await query(
      'SELECT id FROM providers WHERE id = ? AND organization_id = ?',
      [providerId, tenantId]
    ) as any[];

    if (!existingProvider) {
      return errorResponse(
        notFoundProblem(
          `Provider with ID ${providerId} not found`,
          `/api/providers/${providerId}`
        )
      );
    }

    // Parse request body
    const body = await request.json();

    // Build dynamic UPDATE query
    const allowedFields = [
      'provider_name',
      'provider_type',
      'city',
      'address',
      'contact_email',
      'contact_phone',
      'notes',
      'status'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return errorResponse(badRequestProblem('No valid fields to update'));
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add ID to values
    values.push(providerId);
    values.push(tenantId);

    // Execute update
    await query(
      `UPDATE providers SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    // Fetch updated provider
    const [updatedProvider] = await query(
      'SELECT * FROM providers WHERE id = ? AND organization_id = ?',
      [providerId, tenantId]
    ) as any[];

    return successResponse(updatedProvider);
  } catch (error) {
    console.error('Error updating provider:', error);
    return errorResponse(internalServerErrorProblem('Failed to update provider'));
  }
}

// DELETE - Soft delete (archive) provider
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    // Enforce tenant scoping
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;


    // Validate ID
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return errorResponse(badRequestProblem('Invalid provider ID'));
    }

    // Check if provider exists and belongs to tenant
    const [existingProvider] = await query(
      'SELECT id FROM providers WHERE id = ? AND organization_id = ?',
      [providerId, tenantId]
    ) as any[];

    if (!existingProvider) {
      return errorResponse(
        notFoundProblem(
          `Provider with ID ${providerId} not found`,
          `/api/providers/${providerId}`
        )
      );
    }

    // Soft delete by setting status to 'inactive'
    await query(
      'UPDATE providers SET status = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      ['inactive', providerId, tenantId]
    );

    // Return 204 No Content
    return noContentResponse();
  } catch (error) {
    console.error('Error deleting provider:', error);
    return errorResponse(internalServerErrorProblem('Failed to delete provider'));
  }
}
