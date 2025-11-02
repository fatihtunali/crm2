import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Search suppliers by category and location
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const location = searchParams.get('location') || '';
    const searchTerm = searchParams.get('search') || '';
    const date = searchParams.get('date');

    let results = [];

    switch (category) {
      case 'hotelAccommodation':
        // Search hotels with pricing
        let hotelSql = `
          SELECT
            h.id,
            h.hotel_name as name,
            h.city as location,
            h.hotel_category,
            h.star_rating,
            hp.currency,
            hp.double_room_bb as price,
            hp.single_supplement_bb as single_supplement,
            hp.child_0_6_bb as child_0to2,
            hp.child_6_12_bb as child_6to11
          FROM hotels h
          LEFT JOIN hotel_pricing hp ON h.id = hp.hotel_id
            AND hp.status = 'active'
            ${date ? 'AND ? BETWEEN hp.start_date AND hp.end_date' : ''}
          WHERE h.status = 'active'
        `;
        const hotelParams: any[] = [];
        if (date) hotelParams.push(date);

        if (location) {
          hotelSql += ' AND h.city LIKE ?';
          hotelParams.push(`%${location}%`);
        }
        if (searchTerm) {
          hotelSql += ' AND h.hotel_name LIKE ?';
          hotelParams.push(`%${searchTerm}%`);
        }
        hotelSql += ' ORDER BY h.hotel_name LIMIT 20';

        results = await query(hotelSql, hotelParams);
        break;

      case 'sicTourCost':
        // Search tours with pricing
        let tourSql = `
          SELECT
            t.id,
            t.tour_name as name,
            t.city as location,
            t.description,
            tp.currency,
            tp.sic_price_2_pax as price,
            tp.sic_price_2_pax as adult_price
          FROM tours t
          LEFT JOIN tour_pricing tp ON t.id = tp.tour_id
            AND tp.status = 'active'
            ${date ? 'AND ? BETWEEN tp.start_date AND tp.end_date' : ''}
          WHERE t.status = 'active'
        `;
        const tourParams: any[] = [];
        if (date) tourParams.push(date);

        if (location) {
          tourSql += ' AND t.city LIKE ?';
          tourParams.push(`%${location}%`);
        }
        if (searchTerm) {
          tourSql += ' AND t.tour_name LIKE ?';
          tourParams.push(`%${searchTerm}%`);
        }
        tourSql += ' ORDER BY t.tour_name LIMIT 20';

        results = await query(tourSql, tourParams);
        break;

      case 'transportation':
        // Search transfers
        let transferSql = `
          SELECT
            t.id,
            CONCAT(t.from_city, ' to ', t.to_city) as name,
            t.from_city as location,
            t.price_oneway as price,
            t.price_roundtrip,
            v.vehicle_type,
            v.max_capacity
          FROM intercity_transfers t
          LEFT JOIN vehicles v ON t.vehicle_id = v.id
          WHERE t.status = 'active'
        `;
        const transferParams: any[] = [];

        if (location) {
          transferSql += ' AND (t.from_city LIKE ? OR t.to_city LIKE ?)';
          transferParams.push(`%${location}%`, `%${location}%`);
        }
        if (searchTerm) {
          transferSql += ' AND (t.from_city LIKE ? OR t.to_city LIKE ?)';
          transferParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }
        transferSql += ' ORDER BY t.from_city LIMIT 20';

        results = await query(transferSql, transferParams);
        break;

      case 'entranceFees':
        // Search entrance fees with pricing
        let feeSql = `
          SELECT
            e.id,
            e.site_name as name,
            e.city as location,
            ep.currency,
            ep.adult_price as price,
            ep.child_price as child_price
          FROM entrance_fees e
          LEFT JOIN entrance_fee_pricing ep ON e.id = ep.entrance_fee_id
            AND ep.status = 'active'
            ${date ? 'AND ? BETWEEN ep.start_date AND ep.end_date' : ''}
          WHERE e.status = 'active'
        `;
        const feeParams: any[] = [];
        if (date) feeParams.push(date);

        if (location) {
          feeSql += ' AND e.city LIKE ?';
          feeParams.push(`%${location}%`);
        }
        if (searchTerm) {
          feeSql += ' AND e.site_name LIKE ?';
          feeParams.push(`%${searchTerm}%`);
        }
        feeSql += ' ORDER BY e.site_name LIMIT 20';

        results = await query(feeSql, feeParams);
        break;

      case 'guide':
        // Search guides with pricing
        let guideSql = `
          SELECT
            g.id,
            CONCAT(g.language, ' Guide - ', g.city) as name,
            g.city as location,
            g.language,
            gp.currency,
            gp.full_day_price as price,
            gp.half_day_price
          FROM guides g
          LEFT JOIN guide_pricing gp ON g.id = gp.guide_id
            AND gp.status = 'active'
            ${date ? 'AND ? BETWEEN gp.start_date AND gp.end_date' : ''}
          WHERE g.status = 'active'
        `;
        const guideParams: any[] = [];
        if (date) guideParams.push(date);

        if (location) {
          guideSql += ' AND g.city LIKE ?';
          guideParams.push(`%${location}%`);
        }
        if (searchTerm) {
          guideSql += ' AND g.language LIKE ?';
          guideParams.push(`%${searchTerm}%`);
        }
        guideSql += ' ORDER BY g.city, g.language LIMIT 20';

        results = await query(guideSql, guideParams);
        break;

      case 'meal':
        // Search meal pricing
        let mealSql = `
          SELECT
            id,
            restaurant_name as name,
            city as location,
            meal_type,
            currency,
            adult_lunch_price as price,
            child_lunch_price,
            adult_dinner_price,
            child_dinner_price
          FROM meal_pricing
          WHERE status = 'active'
        `;
        const mealParams: any[] = [];

        if (location) {
          mealSql += ' AND city LIKE ?';
          mealParams.push(`%${location}%`);
        }
        if (searchTerm) {
          mealSql += ' AND restaurant_name LIKE ?';
          mealParams.push(`%${searchTerm}%`);
        }
        mealSql += ' ORDER BY restaurant_name LIMIT 20';

        results = await query(mealSql, mealParams);
        break;

      case 'other':
        // Search extra expenses
        let expenseSql = `
          SELECT
            id,
            expense_name as name,
            city as location,
            expense_category,
            currency,
            unit_price as price,
            unit_type
          FROM extra_expenses
          WHERE status = 'active'
        `;
        const expenseParams: any[] = [];

        if (location) {
          expenseSql += ' AND city LIKE ?';
          expenseParams.push(`%${location}%`);
        }
        if (searchTerm) {
          expenseSql += ' AND expense_name LIKE ?';
          expenseParams.push(`%${searchTerm}%`);
        }
        expenseSql += ' ORDER BY expense_name LIMIT 20';

        results = await query(expenseSql, expenseParams);
        break;

      default:
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to search suppliers' }, { status: 500 });
  }
}
