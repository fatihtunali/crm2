/**
 * Unified Pricing Engine
 * Calculates pricing for all expense types using date-based pricing tables
 */

import { query } from '@/lib/db';
import { getLatestExchangeRate } from '@/lib/exchange';

interface PricingContext {
  date: string; // YYYY-MM-DD format
  currency: string;
  markup: number; // Percentage (e.g., 20 for 20%)
  tax: number; // Percentage (e.g., 18 for 18%)
  respectLocked?: boolean;
  lockedRates?: Record<string, number>;
}

interface PriceResult {
  unit_price: number;
  total_price: number;
  currency: string;
  pricing_source: string;
  season_name?: string;
  error?: string;
}

/**
 * Get hotel pricing for a specific date
 */
export async function getHotelPrice(
  hotelId: number,
  date: string,
  roomType: string,
  mealPlan: string,
  context: PricingContext
): Promise<PriceResult> {
  try {
    const [pricing] = await query<any>(
      `SELECT * FROM hotel_pricing
       WHERE hotel_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [hotelId, date]
    );

    if (!pricing) {
      return {
        unit_price: 0,
        total_price: 0,
        currency: context.currency,
        pricing_source: 'none',
        error: 'No pricing found for this date'
      };
    }

    // Map room type and meal plan to pricing columns
    let basePrice = 0;
    if (roomType === 'double') {
      basePrice = pricing.double_room_bb || 0;
    } else if (roomType === 'single') {
      basePrice = (pricing.double_room_bb || 0) + (pricing.single_supplement_bb || 0);
    } else if (roomType === 'triple') {
      basePrice = pricing.triple_room_bb || 0;
    }

    // Add meal plan supplement
    if (mealPlan === 'HB') {
      basePrice += pricing.hb_supplement || 0;
    } else if (mealPlan === 'FB') {
      basePrice += pricing.fb_supplement || 0;
    } else if (mealPlan === 'AI') {
      basePrice += pricing.ai_supplement || 0;
    }

    // Apply markup and tax
    const priceWithMarkup = basePrice * (1 + context.markup / 100);
    const finalPrice = priceWithMarkup * (1 + context.tax / 100);

    return {
      unit_price: finalPrice,
      total_price: finalPrice,
      currency: pricing.currency || context.currency,
      pricing_source: 'hotel_pricing',
      season_name: pricing.season_name
    };
  } catch (error) {
    console.error('Error fetching hotel price:', error);
    return {
      unit_price: 0,
      total_price: 0,
      currency: context.currency,
      pricing_source: 'error',
      error: 'Failed to fetch hotel pricing'
    };
  }
}

/**
 * Get guide pricing for a specific date
 */
export async function getGuidePrice(
  guideId: number,
  date: string,
  priceType: 'full_day' | 'half_day' | 'night',
  context: PricingContext
): Promise<PriceResult> {
  try {
    const [pricing] = await query<any>(
      `SELECT * FROM guide_pricing
       WHERE guide_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [guideId, date]
    );

    if (!pricing) {
      return {
        unit_price: 0,
        total_price: 0,
        currency: context.currency,
        pricing_source: 'none',
        error: 'No pricing found for this date'
      };
    }

    let basePrice = 0;
    if (priceType === 'full_day') {
      basePrice = pricing.full_day_price || 0;
    } else if (priceType === 'half_day') {
      basePrice = pricing.half_day_price || 0;
    } else if (priceType === 'night') {
      basePrice = pricing.night_price || 0;
    }

    // Apply markup and tax
    const priceWithMarkup = basePrice * (1 + context.markup / 100);
    const finalPrice = priceWithMarkup * (1 + context.tax / 100);

    return {
      unit_price: finalPrice,
      total_price: finalPrice,
      currency: pricing.currency || context.currency,
      pricing_source: 'guide_pricing',
      season_name: pricing.season_name
    };
  } catch (error) {
    console.error('Error fetching guide price:', error);
    return {
      unit_price: 0,
      total_price: 0,
      currency: context.currency,
      pricing_source: 'error',
      error: 'Failed to fetch guide pricing'
    };
  }
}

/**
 * Get vehicle pricing for a specific date
 */
export async function getVehiclePrice(
  vehicleId: number,
  date: string,
  priceType: 'full_day' | 'half_day',
  context: PricingContext
): Promise<PriceResult> {
  try {
    const [pricing] = await query<any>(
      `SELECT * FROM vehicle_pricing
       WHERE vehicle_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [vehicleId, date]
    );

    if (!pricing) {
      return {
        unit_price: 0,
        total_price: 0,
        currency: context.currency,
        pricing_source: 'none',
        error: 'No pricing found for this date'
      };
    }

    const basePrice = priceType === 'full_day'
      ? (pricing.price_per_day || 0)
      : (pricing.price_half_day || 0);

    // Apply markup and tax
    const priceWithMarkup = basePrice * (1 + context.markup / 100);
    const finalPrice = priceWithMarkup * (1 + context.tax / 100);

    return {
      unit_price: finalPrice,
      total_price: finalPrice,
      currency: pricing.currency || context.currency,
      pricing_source: 'vehicle_pricing',
      season_name: pricing.season_name
    };
  } catch (error) {
    console.error('Error fetching vehicle price:', error);
    return {
      unit_price: 0,
      total_price: 0,
      currency: context.currency,
      pricing_source: 'error',
      error: 'Failed to fetch vehicle pricing'
    };
  }
}

/**
 * Get entrance fee pricing for a specific date
 */
export async function getEntranceFeePrice(
  entranceFeeId: number,
  date: string,
  ticketType: 'adult' | 'child' | 'student',
  quantity: number,
  context: PricingContext
): Promise<PriceResult> {
  try {
    const [pricing] = await query<any>(
      `SELECT * FROM entrance_fee_pricing
       WHERE entrance_fee_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [entranceFeeId, date]
    );

    if (!pricing) {
      return {
        unit_price: 0,
        total_price: 0,
        currency: context.currency,
        pricing_source: 'none',
        error: 'No pricing found for this date'
      };
    }

    let basePrice = 0;
    if (ticketType === 'adult') {
      basePrice = pricing.adult_price || 0;
    } else if (ticketType === 'child') {
      basePrice = pricing.child_price || 0;
    } else if (ticketType === 'student') {
      basePrice = pricing.student_price || 0;
    }

    // Apply markup and tax
    const priceWithMarkup = basePrice * (1 + context.markup / 100);
    const unitPrice = priceWithMarkup * (1 + context.tax / 100);
    const totalPrice = unitPrice * quantity;

    return {
      unit_price: unitPrice,
      total_price: totalPrice,
      currency: pricing.currency || context.currency,
      pricing_source: 'entrance_fee_pricing',
      season_name: pricing.season_name
    };
  } catch (error) {
    console.error('Error fetching entrance fee price:', error);
    return {
      unit_price: 0,
      total_price: 0,
      currency: context.currency,
      pricing_source: 'error',
      error: 'Failed to fetch entrance fee pricing'
    };
  }
}

/**
 * Get tour pricing for a specific date
 */
export async function getTourPrice(
  tourId: number,
  date: string,
  priceType: 'adult' | 'child',
  quantity: number,
  context: PricingContext
): Promise<PriceResult> {
  try {
    const [pricing] = await query<any>(
      `SELECT * FROM tour_pricing
       WHERE tour_id = ?
         AND status = 'active'
         AND ? BETWEEN start_date AND end_date
       ORDER BY effective_from DESC
       LIMIT 1`,
      [tourId, date]
    );

    if (!pricing) {
      return {
        unit_price: 0,
        total_price: 0,
        currency: context.currency,
        pricing_source: 'none',
        error: 'No pricing found for this date'
      };
    }

    const basePrice = priceType === 'adult'
      ? (pricing.adult_price || 0)
      : (pricing.child_price || 0);

    // Apply markup and tax
    const priceWithMarkup = basePrice * (1 + context.markup / 100);
    const unitPrice = priceWithMarkup * (1 + context.tax / 100);
    const totalPrice = unitPrice * quantity;

    return {
      unit_price: unitPrice,
      total_price: totalPrice,
      currency: pricing.currency || context.currency,
      pricing_source: 'tour_pricing',
      season_name: pricing.season_name
    };
  } catch (error) {
    console.error('Error fetching tour price:', error);
    return {
      unit_price: 0,
      total_price: 0,
      currency: context.currency,
      pricing_source: 'error',
      error: 'Failed to fetch tour pricing'
    };
  }
}

/**
 * Generic expense repricing (for expenses without specific pricing tables)
 * Uses the original price with updated markup and tax
 */
export function repriceGenericExpense(
  originalPrice: number,
  quantity: number,
  context: PricingContext
): PriceResult {
  // Remove old markup/tax and apply new ones
  // Assuming original price had 20% markup and 18% tax (adjust as needed)
  const basePrice = originalPrice / (1.18 * 1.20);

  const priceWithMarkup = basePrice * (1 + context.markup / 100);
  const unitPrice = priceWithMarkup * (1 + context.tax / 100);
  const totalPrice = unitPrice * quantity;

  return {
    unit_price: unitPrice,
    total_price: totalPrice,
    currency: context.currency,
    pricing_source: 'generic_reprice'
  };
}
