import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { generateItineraryWithAI } from '@/lib/ai';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { requirePermission } from '@/middleware/permissions';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';

// Rate limiting for AI calls (in-memory, will be moved to MySQL later)
const aiRateLimits = new Map<string, { count: number; resetTime: number }>();
const AI_RATE_LIMIT = 5; // 5 calls per hour per user
const AI_RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkAIRateLimit(userId: number): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  const key = `ai_${userId}`;
  const userLimit = aiRateLimits.get(key);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    aiRateLimits.set(key, { count: 1, resetTime: now + AI_RATE_WINDOW });
    return { allowed: true };
  }

  if (userLimit.count >= AI_RATE_LIMIT) {
    const resetIn = Math.ceil((userLimit.resetTime - now) / 1000 / 60); // minutes
    return { allowed: false, resetIn };
  }

  userLimit.count++;
  return { allowed: true };
}

// POST - Auto-generate itinerary for a quote using Claude AI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // SECURITY: Require authentication
    const authResult = await requirePermission(request, 'quotations', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (50 requests per hour per user for create operations)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_create`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Creation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // SECURITY: Additional rate limiting for AI calls (expensive operation)
    const rateLimitCheck = checkAIRateLimit(user.userId);
    if (!rateLimitCheck.allowed) {
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `AI itinerary generation limit exceeded. Try again in ${rateLimitCheck.resetIn} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    const { id } = await params;

    // Get quote details - SECURITY: Verify it belongs to user's organization
    const [quote] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!quote) {
      return standardErrorResponse(
        ErrorCodes.NOT_FOUND,
        'Quote not found or you do not have access',
        404,
        undefined,
        requestId
      );
    }

    // Parse destination to get cities
    const cities = parseDestination(quote.destination);
    console.log(`🌍 Destination: ${quote.destination}`);
    console.log(`📍 Parsed cities:`, cities);

    // Fetch available hotels for all cities
    const availableHotels = await fetchAvailableHotels(cities, quote.start_date, quote.end_date);

    // Fetch available tours for all cities
    const availableTours = await fetchAvailableTours(cities, quote.start_date, quote.end_date);

    // Fetch available entrance fees for all cities
    const availableEntranceFees = await fetchAvailableEntranceFees(cities, quote.start_date, quote.end_date);

    // Fetch available transfers for all cities
    const availableTransfers = await fetchAvailableTransfers(cities);

    // SECURITY: Validate input before passing to AI (prevent prompt injection)
    const sanitizedDestination = quote.destination?.trim().substring(0, 200) || 'Unknown';
    const sanitizedTourType = quote.tour_type?.trim().substring(0, 50) || 'Private';

    // Generate itinerary using Claude AI
    console.log('🤖 Generating itinerary with AI...');
    const aiGeneratedDays = await generateItineraryWithAI({
      destination: sanitizedDestination,
      startDate: quote.start_date,
      endDate: quote.end_date,
      adults: quote.adults || 2,
      children: quote.children || 0,
      tourType: sanitizedTourType,
      availableHotels,
      availableTours,
      availableEntranceFees,
      availableTransfers
    });

    // DEBUG: Log what AI returned
    console.log('🤖 AI Response - Days:', aiGeneratedDays.length);
    aiGeneratedDays.forEach((day, idx) => {
      console.log(`Day ${day.dayNumber}:`);
      console.log(`  Hotels: ${day.hotels?.length || 0}`, day.hotels);
      console.log(`  Tours: ${day.tours?.length || 0}`, day.tours);
      console.log(`  Entrance Fees: ${day.entranceFees?.length || 0}`);
      console.log(`  Transfers: ${day.transfers?.length || 0}`);
    });

    // SECURITY: Wrap all database operations in a transaction
    // This ensures data consistency - if anything fails, all changes are rolled back
    const generatedDays = await transaction(async (conn) => {
      // Step 1: Delete existing days and expenses
      const existingDays = await conn.query(
        'SELECT id FROM quote_days WHERE quote_id = ?',
        [id]
      ) as any;

      for (const day of existingDays[0]) {
        // Delete associated expenses
        await conn.query('DELETE FROM quote_expenses WHERE quote_day_id = ?', [day.id]);
      }

      // Delete all days for this quote
      await conn.query('DELETE FROM quote_days WHERE quote_id = ?', [id]);

      // Step 2: Save the AI-generated itinerary to database
      const days = [];

      for (const aiDay of aiGeneratedDays) {
        // Create day record with AI-generated content
        const dayResult = await conn.query(
          'INSERT INTO quote_days (quote_id, day_number, date, title, narrative, meals) VALUES (?, ?, ?, ?, ?, ?)',
          [id, aiDay.dayNumber, aiDay.date, aiDay.title, aiDay.narrative, aiDay.meals]
        );
        const dayId = (dayResult as any)[0].insertId;

      const expenses = [];

        // Add hotels
        for (const hotel of aiDay.hotels || []) {
          const hotelData = availableHotels.find(h => h.id === hotel.id);
          if (hotelData) {
            await createExpense(dayId, {
              category: 'hotelAccommodation',
              hotel_category: hotelData.hotel_category,
              location: aiDay.city,
              description: hotelData.hotel_name,
              price: hotelData.price || 100,
              single_supplement: hotelData.single_supplement || 50,
              child_0to2: 0,
              child_3to5: hotelData.child_0to2 || 0,
              child_6to11: hotelData.child_6to11 || 40
            }, conn);
            expenses.push('Hotel');
          }
        }

        // Add tours
        for (const tour of aiDay.tours || []) {
          const tourData = availableTours.find(t => t.id === tour.id);
          if (tourData) {
            await createExpense(dayId, {
              category: 'sicTourCost',
              location: aiDay.city,
              description: tourData.tour_name,
              price: tourData.price || 75,
              child_0to2: 0,
              child_3to5: (tourData.price || 75) / 2,
              child_6to11: (tourData.price || 75) / 2
            }, conn);
            expenses.push('Tour');
          }
        }

        // Add entrance fees
        for (const fee of aiDay.entranceFees || []) {
          const feeData = availableEntranceFees.find(f => f.id === fee.id);
          if (feeData) {
            await createExpense(dayId, {
              category: 'entranceFees',
              location: aiDay.city,
              description: feeData.site_name,
              price: feeData.price || 15,
              child_0to2: 0,
              child_3to5: feeData.child_price || 10,
              child_6to11: feeData.child_price || 10
            }, conn);
            expenses.push('Entrance Fee');
          }
        }

        // Add transfers
        for (const transfer of aiDay.transfers || []) {
          const transferData = availableTransfers.find(t => t.id === transfer.id);
          if (transferData) {
            await createExpense(dayId, {
              category: 'transportation',
              location: aiDay.city,
              description: transfer.name || 'Transfer',
              price: transferData.price_oneway || 50,
              vehicle_count: 1,
              price_per_vehicle: transferData.price_oneway || 50
            }, conn);
            expenses.push('Transfer');
          }
        }

        days.push({
          day: aiDay.dayNumber,
          date: aiDay.date,
          city: aiDay.city,
          title: aiDay.title,
          narrative: aiDay.narrative,
          meals: aiDay.meals,
          expenses
        });
      }

      // Return the days array from the transaction
      return days;
    });

    // AUDIT: Log AI itinerary generation
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.QUOTATION_UPDATED,
      AuditResources.QUOTATION,
      id.toString(),
      {
        ai_itinerary_generated: true,
        days_created: generatedDays.length,
      },
      {
        quote_number: quote.quote_number,
        destination: quote.destination,
      },
      request
    );

    // Transaction successful - return success response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      quote_id: id,
      days_generated: generatedDays.length,
    });

    const response = NextResponse.json({
      success: true,
      message: 'AI-generated itinerary created successfully',
      days: generatedDays
    });
    addStandardHeaders(response, requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;

  } catch (error: any) {
    console.error('Error generating itinerary:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    // SECURITY: Don't expose internal error details in production
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to generate itinerary with AI',
      500,
      undefined,
      requestId
    );
  }
}

function parseDestination(destination: string): string[] {
  // Parse destination string to extract cities
  // Examples:
  //   "Istanbul & Cappadocia" -> ["Istanbul", "Cappadocia"]
  //   "Istanbul Cappadocia antalya" -> ["Istanbul", "Cappadocia", "Antalya"]

  // First try with common separators (&, -, /, ,)
  const separators = /[&,\-\/]+/g;
  let cities = destination
    .split(separators)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  // If no separators found and there are multiple words, split by spaces
  if (cities.length === 1 && destination.includes(' ')) {
    cities = destination
      .split(/\s+/)
      .map(c => c.trim())
      .filter(c => c.length > 2); // Filter out very short words like "to", "in", etc.
  }

  return cities.length > 0 ? cities : ['Istanbul'];
}

async function fetchAvailableHotels(cities: string[], startDate: string, endDate: string) {
  const citiesPattern = cities.map(c => `%${c}%`);
  const cityCondition = cities.map(() => 'LOWER(TRIM(h.city)) LIKE LOWER(?)').join(' OR ');

  const hotels = await query(`
    SELECT
      h.id,
      h.hotel_name,
      h.city,
      h.hotel_category,
      h.star_rating,
      hp.double_room_bb as price,
      hp.single_supplement_bb as single_supplement,
      hp.child_0_6_bb as child_0to2,
      hp.child_6_12_bb as child_6to11
    FROM hotels h
    LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
      AND hp.status = 'active'
      AND ? BETWEEN hp.start_date AND hp.end_date
    WHERE h.status = 'active'
      AND (${cityCondition})
    ORDER BY h.city, h.star_rating DESC, h.rating DESC
    LIMIT 50
  `, [startDate, ...citiesPattern]) as any[];

  console.log(`🏨 Fetched ${hotels.length} hotels for cities: ${cities.join(', ')}`);
  return hotels;
}

async function fetchAvailableTours(cities: string[], startDate: string, endDate: string) {
  const citiesPattern = cities.map(c => `%${c}%`);
  const cityCondition = cities.map(() => 'LOWER(TRIM(t.city)) LIKE LOWER(?)').join(' OR ');

  const tours = await query(`
    SELECT
      t.id,
      t.tour_name,
      t.city,
      t.description,
      tp.sic_price_2_pax as price
    FROM tours t
    LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
      AND tp.status = 'active'
      AND ? BETWEEN tp.start_date AND tp.end_date
    WHERE t.status = 'active'
      AND (${cityCondition})
    ORDER BY t.city, t.tour_name
    LIMIT 100
  `, [startDate, ...citiesPattern]) as any[];

  console.log(`🎭 Fetched ${tours.length} tours for cities: ${cities.join(', ')}`);
  return tours;
}

async function fetchAvailableEntranceFees(cities: string[], startDate: string, endDate: string) {
  const citiesPattern = cities.map(c => `%${c}%`);
  const cityCondition = cities.map(() => 'LOWER(TRIM(e.city)) LIKE LOWER(?)').join(' OR ');

  const fees = await query(`
    SELECT
      e.id,
      e.site_name,
      e.city,
      ep.adult_price as price,
      ep.child_price
    FROM entrance_fees e
    LEFT JOIN entrance_fee_pricing ep ON e.id = ep.entrance_fee_id
      AND ep.status = 'active'
      AND ? BETWEEN ep.start_date AND ep.end_date
    WHERE e.status = 'active'
      AND (${cityCondition})
    ORDER BY e.city, e.user_ratings_total DESC
    LIMIT 50
  `, [startDate, ...citiesPattern]) as any[];

  console.log(`🎫 Fetched ${fees.length} entrance fees for cities: ${cities.join(', ')}`);
  return fees;
}

async function fetchAvailableTransfers(cities: string[]) {
  const citiesPattern = cities.map(c => `%${c}%`);
  const cityCondition = cities.map(() => 'LOWER(TRIM(v.city)) LIKE LOWER(?)').join(' OR ');

  const transfers = await query(`
    SELECT
      v.id,
      v.vehicle_type,
      v.max_capacity,
      v.city,
      50 as price_oneway
    FROM vehicles v
    WHERE v.status = 'active'
      AND (${cityCondition})
    LIMIT 20
  `, citiesPattern) as any[];

  console.log(`🚗 Fetched ${transfers.length} transfers for cities: ${cities.join(', ')}`);
  return transfers;
}

async function createExpense(dayId: number, expense: any, connection?: any) {
  const queryFn = connection || query;
  await queryFn(
    `INSERT INTO quote_expenses (
      quote_day_id, category, hotel_category, location, description,
      price, single_supplement, child_0to2, child_3to5, child_6to11,
      vehicle_count, price_per_vehicle
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dayId,
      expense.category,
      expense.hotel_category || null,
      expense.location,
      expense.description,
      expense.price || 0,
      expense.single_supplement || null,
      expense.child_0to2 || null,
      expense.child_3to5 || null,
      expense.child_6to11 || null,
      expense.vehicle_count || null,
      expense.price_per_vehicle || null
    ]
  );
}
