import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

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
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await context.params;
    // Enforce tenant scoping
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 300, 3600);
    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // Validate ID
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return validationErrorResponse(
        'Invalid provider ID',
        [{ field: 'id', issue: 'invalid_format', message: 'Provider ID must be a valid number' }],
        requestId
      );
    }

    // Fetch provider with tenant scoping including parent/child fields
    const [provider] = await query(
      `SELECT
        p.id,
        p.organization_id,
        p.provider_name,
        p.provider_type,
        p.provider_types,
        p.city,
        p.address,
        p.contact_email,
        p.contact_phone,
        p.notes,
        p.status,
        p.created_at,
        p.updated_at,
        p.parent_provider_id,
        p.is_parent,
        p.company_tax_id,
        p.company_legal_name,
        parent.provider_name as parent_company_name,
        parent.company_legal_name as parent_legal_name
      FROM providers p
      LEFT JOIN providers parent ON p.parent_provider_id = parent.id
      WHERE p.id = ? AND p.organization_id = ?`,
      [providerId, tenantId]
    ) as any[];

    if (!provider) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Provider with ID ${providerId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const response = NextResponse.json(provider);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      provider_id: providerId
    });

    return response;
  } catch (error) {
    console.error('Error fetching provider:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// PATCH - Update provider
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await context.params;
    // Enforce tenant scoping
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 50, 3600);
    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // Validate ID
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return validationErrorResponse(
        'Invalid provider ID',
        [{ field: 'id', issue: 'invalid_format', message: 'Provider ID must be a valid number' }],
        requestId
      );
    }

    // Check if provider exists and belongs to tenant
    const [existingProvider] = await query(
      'SELECT id FROM providers WHERE id = ? AND organization_id = ?',
      [providerId, tenantId]
    ) as any[];

    if (!existingProvider) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Provider with ID ${providerId} not found`,
        404,
        undefined,
        requestId
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
      'status',
      'is_parent',
      'parent_provider_id',
      'company_tax_id',
      'company_legal_name'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Handle provider_types separately (JSON field)
    if (body.provider_types !== undefined) {
      updates.push('provider_types = ?');
      values.push(JSON.stringify(body.provider_types));
    }

    if (updates.length === 0) {
      return validationErrorResponse(
        'No valid fields to update',
        [{ field: 'body', issue: 'no_updates', message: 'At least one field must be provided for update' }],
        requestId
      );
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

    const response = NextResponse.json(updatedProvider);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      provider_id: providerId
    });

    return response;
  } catch (error) {
    console.error('Error updating provider:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}

// DELETE - Soft delete (archive) provider
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await context.params;
    // Enforce tenant scoping
    const authResult = await requirePermission(request, 'providers', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { user, tenantId } = authResult;

    // Rate limiting
    const rateLimit = globalRateLimitTracker.trackRequest(`user_${user.userId}`, 20, 3600);
    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // Validate ID
    const providerId = parseInt(id, 10);
    if (isNaN(providerId)) {
      return validationErrorResponse(
        'Invalid provider ID',
        [{ field: 'id', issue: 'invalid_format', message: 'Provider ID must be a valid number' }],
        requestId
      );
    }

    // Check if provider exists and belongs to tenant
    const [existingProvider] = await query(
      'SELECT id FROM providers WHERE id = ? AND organization_id = ?',
      [providerId, tenantId]
    ) as any[];

    if (!existingProvider) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Provider with ID ${providerId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Soft delete by setting archived_at timestamp
    await query(
      'UPDATE providers SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [providerId, tenantId]
    );

    // Return 204 No Content
    const response = new NextResponse(null, { status: 204 });
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    logResponse(requestId, 204, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      provider_id: providerId
    });

    return response;
  } catch (error) {
    console.error('Error deleting provider:', error);
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    );
  }
}
