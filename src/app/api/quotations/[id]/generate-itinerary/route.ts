import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateItineraryWithAI } from '@/lib/ai';

// POST - Auto-generate itinerary for a quote using Claude AI
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get quote details
    const [quote] = await query(
      'SELECT * FROM quotes WHERE id = ?',
      [id]
    ) as any[];

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
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

    // Delete existing days and expenses to prevent duplicates
    const existingDays = await query(
      'SELECT id FROM quote_days WHERE quote_id = ?',
      [id]
    ) as any[];

    for (const day of existingDays) {
      // Delete associated expenses
      await query('DELETE FROM quote_expenses WHERE quote_day_id = ?', [day.id]);
    }

    // Delete all days for this quote
    await query('DELETE FROM quote_days WHERE quote_id = ?', [id]);

    // Generate itinerary using Claude AI
    const aiGeneratedDays = await generateItineraryWithAI({
      destination: quote.destination,
      startDate: quote.start_date,
      endDate: quote.end_date,
      adults: quote.adults || 2,
      children: quote.children || 0,
      tourType: quote.tour_type || 'Private',
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

    // Save the AI-generated itinerary to database
    const generatedDays = [];

    for (const aiDay of aiGeneratedDays) {
      // Create day record with AI-generated content
      const dayResult = await query(
        'INSERT INTO quote_days (quote_id, day_number, date, title, narrative, meals) VALUES (?, ?, ?, ?, ?, ?)',
        [id, aiDay.dayNumber, aiDay.date, aiDay.title, aiDay.narrative, aiDay.meals]
      );
      const dayId = (dayResult as any).insertId;

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
          });
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
          });
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
          });
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
          });
          expenses.push('Transfer');
        }
      }

      generatedDays.push({
        day: aiDay.dayNumber,
        date: aiDay.date,
        city: aiDay.city,
        title: aiDay.title,
        narrative: aiDay.narrative,
        meals: aiDay.meals,
        expenses
      });
    }

    return NextResponse.json({
      success: true,
      message: 'AI-generated itinerary created successfully',
      days: generatedDays
    });

  } catch (error) {
    console.error('Error generating itinerary:', error);
    return NextResponse.json({
      error: 'Failed to generate itinerary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

async function createExpense(dayId: number, expense: any) {
  await query(
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
