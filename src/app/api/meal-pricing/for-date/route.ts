import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { toMinorUnits } from '@/lib/money';
import type { Money } from '@/types/api';

interface MealPricingRecord {
  id: number;
  organization_id: number;
  restaurant_name: string;
  city: string;
  meal_type: string;
  season_name: string | null;
  start_date: string;
  end_date: string;
  currency: string;
  adult_lunch_price: number;
  child_lunch_price: number;
  adult_dinner_price: number;
  child_dinner_price: number;
  menu_description: string | null;
  effective_from: string;
  created_by: number;
  notes: string | null;
  status: string;
  favorite_priority: number;
  created_at: string;
  provider_id: number | null;
  archived_at: string | null;
}

interface MealPricingResponse {
  id: number;
  organization_id: number;
  restaurant_name: string;
  city: string;
  meal_type: string;
  season_name: string | null;
  start_date: string;
  end_date: string;
  adult_lunch_price: Money;
  child_lunch_price: Money;
  adult_dinner_price: Money;
  child_dinner_price: Money;
  menu_description: string | null;
  effective_from: string;
  created_by: number;
  notes: string | null;
  status: string;
  favorite_priority: number;
  created_at: string;
  provider_id: number | null;
  archived_at: string | null;
}

function convertToResponse(record: MealPricingRecord): MealPricingResponse {
  return {
    id: record.id,
    organization_id: record.organization_id,
    restaurant_name: record.restaurant_name,
    city: record.city,
    meal_type: record.meal_type,
    season_name: record.season_name,
    start_date: record.start_date,
    end_date: record.end_date,
    adult_lunch_price: { amount_minor: toMinorUnits(record.adult_lunch_price || 0), currency: record.currency },
    child_lunch_price: { amount_minor: toMinorUnits(record.child_lunch_price || 0), currency: record.currency },
    adult_dinner_price: { amount_minor: toMinorUnits(record.adult_dinner_price || 0), currency: record.currency },
    child_dinner_price: { amount_minor: toMinorUnits(record.child_dinner_price || 0), currency: record.currency },
    menu_description: record.menu_description,
    effective_from: record.effective_from,
    created_by: record.created_by,
    notes: record.notes,
    status: record.status,
    favorite_priority: record.favorite_priority,
    created_at: record.created_at,
    provider_id: record.provider_id,
    archived_at: record.archived_at,
  };
}

/**
 * GET /api/meal-pricing/for-date
 *
 * Get meal pricing for a specific restaurant/city on a specific date
 *
 * Query parameters:
 * - restaurant_name (optional): Restaurant name
 * - city (optional): City filter
 * - date (required): The date in YYYY-MM-DD format
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const restaurantName = searchParams.get('restaurant_name');
    const city = searchParams.get('city');
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const conditions = ['status = ?', '? BETWEEN start_date AND end_date'];
    const params: any[] = ['active', dateParam];

    if (restaurantName) {
      conditions.push('restaurant_name = ?');
      params.push(restaurantName);
    }

    if (city) {
      conditions.push('city = ?');
      params.push(city);
    }

    const records = await query<MealPricingRecord>(
      `SELECT * FROM meal_pricing
       WHERE ${conditions.join(' AND ')}
       ORDER BY effective_from DESC
       LIMIT 1`,
      params
    );

    if (records.length === 0) {
      return NextResponse.json(
        {
          error: 'No pricing found',
          details: `No active meal pricing found on date ${dateParam}`
        },
        { status: 404 }
      );
    }

    const responseData = convertToResponse(records[0]);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing for date' },
      { status: 500 }
    );
  }
}
