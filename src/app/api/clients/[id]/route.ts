import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/clients/[id]
 * Get a single client by ID
 */
export async function GET(request: NextRequest, context: RouteParams) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'clients', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const { id: clientId } = await context.params;

    // Fetch client
    const [client] = await query(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    ) as any[];

    if (!client) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Client ${clientId} not found`,
        404,
        undefined,
        requestId
      );
    }

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      client_id: clientId,
    });

    const response = NextResponse.json(client);
    addStandardHeaders(response, requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to fetch client',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * PUT /api/clients/[id]
 * Update a client
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'clients', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (50 updates per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_update`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Update rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    const { id: clientId } = await context.params;
    const body = await request.json();

    // Check if client exists
    const [existingClient] = await query(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    ) as any[];

    if (!existingClient) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Client ${clientId} not found`,
        404,
        undefined,
        requestId
      );
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      client_type,
      tour_operator_id,
      nationality,
      language_preference,
      date_of_birth,
      passport_number,
      preferences,
      dietary_requirements,
      special_needs,
      notes,
      marketing_consent,
      newsletter_subscribed,
      status
    } = body;

    // Update client
    await query(
      `UPDATE clients SET
        first_name = ?,
        last_name = ?,
        email = ?,
        phone = ?,
        client_type = ?,
        tour_operator_id = ?,
        nationality = ?,
        language_preference = ?,
        date_of_birth = ?,
        passport_number = ?,
        preferences = ?,
        dietary_requirements = ?,
        special_needs = ?,
        notes = ?,
        marketing_consent = ?,
        newsletter_subscribed = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ? AND organization_id = ?`,
      [
        first_name,
        last_name,
        email,
        phone,
        client_type,
        tour_operator_id,
        nationality,
        language_preference,
        date_of_birth,
        passport_number,
        preferences,
        dietary_requirements,
        special_needs,
        notes,
        marketing_consent,
        newsletter_subscribed,
        status,
        clientId,
        parseInt(tenantId)
      ]
    );

    // Fetch updated client
    const [updatedClient] = await query(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    ) as any[];

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      client_id: clientId,
    });

    const response = NextResponse.json(updatedClient);
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, error.code === 'ER_DUP_ENTRY' ? 409 : 500, Date.now() - startTime, {
      error: error.message,
    });

    // Handle duplicate email
    if (error.code === 'ER_DUP_ENTRY') {
      return standardErrorResponse(
        ErrorCodes.CONFLICT,
        'A client with this email already exists',
        409,
        undefined,
        requestId
      );
    }

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update client',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete a client
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // Require tenant
    const authResult = await requirePermission(request, 'clients', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (20 deletes per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_delete`,
      20,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Delete rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    const { id: clientId } = await context.params;

    // Check if client exists
    const [existingClient] = await query(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    ) as any[];

    if (!existingClient) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        `Client ${clientId} not found`,
        404,
        undefined,
        requestId
      );
    }

    // Delete client
    await query(
      'UPDATE clients SET archived_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    );

    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      client_id: clientId,
    });

    const response = NextResponse.json({ success: true, message: 'Client deleted successfully' });
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);
    return response;
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete client',
      500,
      undefined,
      requestId
    );
  }
}
