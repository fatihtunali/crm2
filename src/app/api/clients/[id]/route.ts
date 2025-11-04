import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, notFoundProblem, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

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
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { id: clientId } = await context.params;

    // Fetch client
    const [client] = await query(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    ) as any[];

    if (!client) {
      return errorResponse(notFoundProblem(`Client ${clientId} not found`, request.url));
    }

    return successResponse(client);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}

/**
 * PUT /api/clients/[id]
 * Update a client
 */
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { id: clientId } = await context.params;
    const body = await request.json();

    // Check if client exists
    const [existingClient] = await query(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    ) as any[];

    if (!existingClient) {
      return errorResponse(notFoundProblem(`Client ${clientId} not found`, request.url));
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

    return successResponse(updatedClient);
  } catch (error: any) {
    console.error('Database error:', error);

    // Handle duplicate email
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/duplicate-email',
        title: 'Duplicate Email',
        status: 409,
        detail: 'A client with this email already exists',
        instance: request.url,
      });
    }

    return errorResponse(internalServerErrorProblem(request.url));
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete a client
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { id: clientId } = await context.params;

    // Check if client exists
    const [existingClient] = await query(
      'SELECT * FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    ) as any[];

    if (!existingClient) {
      return errorResponse(notFoundProblem(`Client ${clientId} not found`, request.url));
    }

    // Delete client
    await query(
      'DELETE FROM clients WHERE id = ? AND organization_id = ?',
      [clientId, parseInt(tenantId)]
    );

    return successResponse({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}
