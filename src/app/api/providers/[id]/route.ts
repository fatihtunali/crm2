import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
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
