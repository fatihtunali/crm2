import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface ItineraryInput {
  destination: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  tourType: string;
  availableHotels: any[];
  availableTours: any[];
  availableEntranceFees: any[];
  availableTransfers: any[];
}

interface DayItinerary {
  dayNumber: number;
  date: string;
  city: string;
  title: string;
  narrative: string;
  meals: string;
  hotels: any[];
  tours: any[];
  entranceFees: any[];
  transfers: any[];
}

export async function generateItineraryWithAI(input: ItineraryInput): Promise<DayItinerary[]> {
  const {
    destination,
    startDate,
    endDate,
    adults,
    children,
    tourType,
    availableHotels,
    availableTours,
    availableEntranceFees,
    availableTransfers
  } = input;

  const totalDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const totalNights = totalDays - 1;

  const prompt = `You are an expert travel itinerary planner creating itineraries for a professional tour operator. Your itineraries will be presented to customers as official travel packages, so quality and professionalism are critical.

**YOUR MISSION:**
Create a perfect, balanced itinerary that customers will love and want to book immediately. Select the BEST combination of hotels, tours, and transfers from the available options.

**Customer Request:**
- Destination: ${destination}
- Duration: ${totalNights} nights / ${totalDays} days
- Start Date: ${startDate}
- Travelers: ${adults} adults${children > 0 ? `, ${children} children` : ''}
- Tour Type: ${tourType}

**Available Hotels:**
${JSON.stringify(availableHotels.map((h: any) => ({
  id: h.id,
  name: h.hotel_name,
  city: h.city,
  star_rating: h.star_rating,
  price_per_night: h.price || 100
})), null, 2)}

**Available Tours:**
${JSON.stringify(availableTours.map((t: any) => ({
  id: t.id,
  name: t.tour_name,
  city: t.city,
  duration_hours: t.duration_hours,
  description: t.description,
  price_per_person: t.price || 75
})), null, 2)}

**Available Entrance Fees:**
${JSON.stringify(availableEntranceFees.map((e: any) => ({
  id: e.id,
  site_name: e.site_name,
  city: e.city,
  adult_price: e.price || 15,
  child_price: e.child_price || 10
})), null, 2)}

**Available Transfers:**
${JSON.stringify(availableTransfers.map((t: any) => ({
  id: t.id,
  vehicle_type: t.vehicle_type,
  city: t.city,
  capacity: t.max_capacity,
  price: 50
})), null, 2)}

**CRITICAL INSTRUCTIONS:**
1. Create a logical day-by-day itinerary
2. 🚨 **MANDATORY - Select items by ID**:
   - Select at least 1 hotel per night (use hotel's id from availableHotels)
   - Select relevant tours (use tour id from availableTours)
   - Select entrance fees for attractions (use id from availableEntranceFees)
   - Select transfers (use vehicle id from availableTransfers)
3. 🚨 **MAXIMUM ONE TOUR PER DAY** - NEVER add multiple tours on the same day
4. 🚨 **MANDATORY AIRPORT TRANSFERS**:
   - Day 1: MUST include arrival transfer (from Airport to Hotel)
   - Last day: MUST include departure transfer (from Hotel to Airport)
5. Balance the itinerary - don't overload days
6. Consider logical flow and timing
7. Include engaging narratives for each day (2-3 paragraphs)
8. Provide a catchy title for each day (e.g., "Day 1 - Arrival in Istanbul & Turkish Night")
9. Specify meals included (e.g., "(B,L,D)" for Breakfast, Lunch, Dinner)

**IMPORTANT TRAINING EXAMPLE:**
"Day 1 - Arrive Istanbul - Bosphorus Cruise

Arrive to Istanbul Airport. Arrival transfer to the hotel and check-in. The rest of the day is yours. In the evening, enjoy the Bosphorus Cruise with dinner. Overnight in Istanbul."

**Output Format:**
Return ONLY valid JSON (no markdown) in this structure:

{
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "city": "City Name",
      "title": "Day 1 - Arrival in Istanbul",
      "narrative": "A beautifully written paragraph describing the entire day's experience. Write in professional travel itinerary style. Include details about transfers, activities, and overnight location. Write 2-3 sentences.",
      "meals": "(D)",
      "hotels": [{ "id": 5, "name": "Hotel Name", "nights": 1 }],
      "tours": [{ "id": 12, "name": "Tour Name" }],
      "entranceFees": [{ "id": 8, "name": "Site Name" }],
      "transfers": [{ "id": 3, "name": "Airport Transfer" }]
    }
  ]
}

**Critical Rules:**
- Hotels, tours, entranceFees, and transfers arrays MUST contain actual IDs from the provided data above
- DO NOT return empty arrays - always select items
- Day 1 MUST have a transfer item (arrival)
- Last day MUST have a transfer item (departure)
- Hotels MUST be selected for each night
- Use actual IDs, not made-up ones

Generate the complete itinerary now:`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (Claude might wrap it in markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(jsonText);
    return result.days || [];
  } catch (error) {
    console.error('Error generating itinerary with AI:', error);
    throw new Error('Failed to generate itinerary with AI');
  }
}
