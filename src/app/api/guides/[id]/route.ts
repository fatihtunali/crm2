import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { errorResponse, notFoundProblem, badRequestProblem, noContentResponse } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { handleError, NotFoundError } from '@/middleware/errorHandler';

interface Guide {
  id: number;
  organization_id: number;
  provider_id: number | null;
  city: string;
  language: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/guides/[id]
 * Fetch a single guide by ID
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;


    // Validate ID
    const guideId = parseInt(id, 10);
    if (isNaN(guideId) || guideId <= 0) {
      return errorResponse(
        badRequestProblem(
          `Invalid guide ID: ${id}`,
          request.url
        )
      );
    }

    // Fetch guide with pricing information
    const sql = `
      SELECT
        g.*,
        p.provider_name,
        p.id as provider_id,
        gp.id as pricing_id,
        gp.season_name,
        gp.start_date as season_start,
        gp.end_date as season_end,
        gp.currency,
        gp.full_day_price,
        gp.half_day_price,
        gp.night_price
      FROM guides g
      LEFT JOIN providers p ON g.provider_id = p.id
      LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
        AND gp.status = 'active'
        AND CURDATE() BETWEEN gp.start_date AND gp.end_date
      WHERE g.id = ? AND g.organization_id = ?
    `;

    const rows = await query(sql, [guideId, tenantId]) as Guide[];

    if (rows.length === 0) {
      throw new NotFoundError('Guide', guideId);
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    return handleError(error, request.url);
  }
}

/**
 * PATCH /api/guides/[id]
 * Update a guide by ID (partial update)
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 *
 * Body (all fields optional):
 * - city: string
 * - language: string
 * - description: string
 * - provider_id: number
 * - status: string
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;


    // Validate ID
    const guideId = parseInt(id, 10);
    if (isNaN(guideId) || guideId <= 0) {
      return errorResponse(
        badRequestProblem(
          `Invalid guide ID: ${id}`,
          request.url
        )
      );
    }

    // Check if guide exists and belongs to tenant
    const existingGuides = await query(
      'SELECT id FROM guides WHERE id = ? AND organization_id = ?',
      [guideId, tenantId]
    ) as Guide[];

    if (existingGuides.length === 0) {
      throw new NotFoundError('Guide', guideId);
    }

    // Parse request body
    const body = await request.json();
    const {
      city,
      language,
      description,
      provider_id,
      status,
    } = body;

    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (city !== undefined) {
      updates.push('city = ?');
      values.push(city);
    }

    if (language !== undefined) {
      updates.push('language = ?');
      values.push(language);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (provider_id !== undefined) {
      updates.push('provider_id = ?');
      values.push(provider_id);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    // If no fields to update, return error
    if (updates.length === 0) {
      return errorResponse(
        badRequestProblem(
          'No fields to update',
          request.url
        )
      );
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add ID and tenant ID to values
    values.push(guideId, tenantId);

    // Execute update
    const updateSql = `
      UPDATE guides
      SET ${updates.join(', ')}
      WHERE id = ? AND organization_id = ?
    `;

    await query(updateSql, values);

    // Fetch and return updated guide
    const [updatedGuide] = await query(
      'SELECT * FROM guides WHERE id = ?',
      [guideId]
    ) as Guide[];

    return NextResponse.json(updatedGuide);
  } catch (error) {
    return handleError(error, request.url);
  }
}

/**
 * DELETE /api/guides/[id]
 * Soft delete (archive) a guide by ID
 *
 * Headers:
 * - X-Tenant-Id: Required tenant identifier
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;


    // Validate ID
    const guideId = parseInt(id, 10);
    if (isNaN(guideId) || guideId <= 0) {
      return errorResponse(
        badRequestProblem(
          `Invalid guide ID: ${id}`,
          request.url
        )
      );
    }

    // Check if guide exists and belongs to tenant
    const existingGuides = await query(
      'SELECT id FROM guides WHERE id = ? AND organization_id = ?',
      [guideId, tenantId]
    ) as Guide[];

    if (existingGuides.length === 0) {
      throw new NotFoundError('Guide', guideId);
    }

    // Soft delete (set status to inactive)
    await query(
      'UPDATE guides SET status = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      ['inactive', guideId, tenantId]
    );

    // Return 204 No Content
    return noContentResponse();
  } catch (error) {
    return handleError(error, request.url);
  }
}
