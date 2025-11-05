import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  noContentResponse,
  notFoundProblem,
  badRequestProblem,
  internalServerErrorProblem,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';

// GET - Fetch hotel by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const hotelId = id;

    // Validate ID
    if (!hotelId || isNaN(parseInt(hotelId))) {
      return errorResponse(
        badRequestProblem('Invalid hotel ID', `/api/hotels/${hotelId}`)
      );
    }

    // Fetch hotel with current pricing
    const [hotel] = await query(
      `SELECT
        h.*,
        hp.id as pricing_id,
        hp.season_name,
        hp.start_date as season_start,
        hp.end_date as season_end,
        hp.currency,
        hp.double_room_bb,
        hp.single_supplement_bb,
        hp.triple_room_bb,
        hp.child_0_6_bb,
        hp.child_6_12_bb,
        hp.hb_supplement,
        hp.fb_supplement,
        hp.ai_supplement,
        hp.base_meal_plan
      FROM hotels h
      LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
        AND hp.status = 'active'
        AND CURDATE() BETWEEN hp.start_date AND hp.end_date
      WHERE h.id = ?
      LIMIT 1`,
      [hotelId]
    ) as any[];

    if (!hotel) {
      return errorResponse(
        notFoundProblem(`Hotel with ID ${hotelId} not found`, `/api/hotels/${hotelId}`)
      );
    }

    return successResponse(hotel);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to fetch hotel', `/api/hotels/${id}`)
    );
  }
}

// PATCH - Update hotel (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const hotelId = id;

    // Validate ID
    if (!hotelId || isNaN(parseInt(hotelId))) {
      return errorResponse(
        badRequestProblem('Invalid hotel ID', `/api/hotels/${hotelId}`)
      );
    }

    // Check if hotel exists
    const [existingHotel] = await query(
      'SELECT id FROM hotels WHERE id = ?',
      [hotelId]
    ) as any[];

    if (!existingHotel) {
      return errorResponse(
        notFoundProblem(`Hotel with ID ${hotelId} not found`, `/api/hotels/${hotelId}`)
      );
    }

    const body = await request.json();

    // Build dynamic update query for partial updates
    const allowedFields = [
      'google_place_id',
      'organization_id',
      'hotel_name',
      'city',
      'star_rating',
      'hotel_category',
      'room_count',
      'is_boutique',
      'address',
      'latitude',
      'longitude',
      'google_maps_url',
      'contact_phone',
      'contact_email',
      'notes',
      'photo_url_1',
      'photo_url_2',
      'photo_url_3',
      'rating',
      'user_ratings_total',
      'website',
      'editorial_summary',
      'place_types',
      'price_level',
      'business_status',
      'region',
      'status',
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
      return errorResponse(
        badRequestProblem('No valid fields to update', `/api/hotels/${hotelId}`)
      );
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = NOW()');

    // Add hotel ID to values for WHERE clause
    values.push(hotelId);

    await query(
      `UPDATE hotels SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch and return the updated hotel
    const [updatedHotel] = await query(
      'SELECT * FROM hotels WHERE id = ?',
      [hotelId]
    ) as any[];

    return successResponse(updatedHotel);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to update hotel', `/api/hotels/${id}`)
    );
  }
}

// DELETE - Soft delete (set status='inactive') or hard delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Require tenant
    const authResult = await requirePermission(request, 'providers', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId } = authResult;

    const hotelId = id;

    // Validate ID
    if (!hotelId || isNaN(parseInt(hotelId))) {
      return errorResponse(
        badRequestProblem('Invalid hotel ID', `/api/hotels/${hotelId}`)
      );
    }

    // Check if hotel exists
    const [existingHotel] = await query(
      'SELECT id FROM hotels WHERE id = ?',
      [hotelId]
    ) as any[];

    if (!existingHotel) {
      return errorResponse(
        notFoundProblem(`Hotel with ID ${hotelId} not found`, `/api/hotels/${hotelId}`)
      );
    }

    // Check if hard delete is requested via query parameter
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete - permanently remove from database
      await query('DELETE FROM hotels WHERE id = ?', [hotelId]);
    } else {
      // Soft delete - set status to inactive
      await query(
        'UPDATE hotels SET status = ?, updated_at = NOW() WHERE id = ?',
        ['inactive', hotelId]
      );
    }

    return noContentResponse();
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(
      internalServerErrorProblem('Failed to delete hotel', `/api/hotels/${id}`)
    );
  }
}
