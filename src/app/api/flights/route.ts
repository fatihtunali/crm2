import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { parsePaginationParams, parseSortParams, buildPagedResponse } from '@/lib/pagination';
import { errorResponse, internalServerErrorProblem } from '@/lib/response';

interface FlightRecord {
  id: number;
  organization_id: number;
  provider_id: number | null;
  from_airport: string;
  to_airport: string;
  from_city: string | null;
  to_city: string | null;
  season_name: string | null;
  start_date: string;
  end_date: string;
  departure_time: string | null;
  arrival_time: string | null;
  price_oneway: number;
  price_roundtrip: number;
  airline: string | null;
  flight_number: string | null;
  booking_class: string;
  baggage_allowance: string | null;
  currency: string;
  notes: string | null;
  status: string;
  created_at: string;
  created_by: number | null;
  archived_at: string | null;
  provider_name?: string;
}

// GET - Fetch all flights with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationParams(searchParams);

    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    // Search parameters
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // Sort parameters
    const sortParam = searchParams.get('sort') || '-created_at';
    const ALLOWED_COLUMNS = ['id', 'from_airport', 'to_airport', 'airline', 'flight_number', 'price_oneway', 'start_date', 'created_at'];
    const orderByClause = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'f.created_at DESC';

    // Filter parameters
    const statusFilter = searchParams.get('status') || 'active';
    const fromAirport = searchParams.get('from_airport');
    const toAirport = searchParams.get('to_airport');
    const providerId = searchParams.get('provider_id');
    const bookingClass = searchParams.get('booking_class');

    // Build WHERE conditions
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Add tenancy filter
    whereConditions.push('f.organization_id = ?');
    params.push(parseInt(tenantId));

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push('f.status = ?');
      params.push(statusFilter);
    }

    // Airport filters
    if (fromAirport && fromAirport !== 'all') {
      whereConditions.push('f.from_airport = ?');
      params.push(fromAirport);
    }

    if (toAirport && toAirport !== 'all') {
      whereConditions.push('f.to_airport = ?');
      params.push(toAirport);
    }

    // Provider filter
    if (providerId && providerId !== 'all') {
      whereConditions.push('f.provider_id = ?');
      params.push(parseInt(providerId));
    }

    // Booking class filter
    if (bookingClass && bookingClass !== 'all') {
      whereConditions.push('f.booking_class = ?');
      params.push(bookingClass);
    }

    // Search filter
    if (searchTerm) {
      whereConditions.push('(f.from_airport LIKE ? OR f.to_airport LIKE ? OR f.from_city LIKE ? OR f.to_city LIKE ? OR f.airline LIKE ? OR f.flight_number LIKE ?)');
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '';

    // Build base query with provider join
    const baseSelect = `
      SELECT
        f.*,
        p.provider_name
      FROM flight_pricing f
      LEFT JOIN providers p ON f.provider_id = p.id
    `;

    const baseCount = `
      SELECT COUNT(DISTINCT f.id) as total
      FROM flight_pricing f
      LEFT JOIN providers p ON f.provider_id = p.id
    `;

    // Build complete SQL queries
    let dataSql = baseSelect;
    let countSql = baseCount;

    if (whereClause) {
      dataSql += ` WHERE ${whereClause}`;
      countSql += ` WHERE ${whereClause}`;
    }

    dataSql += ` ORDER BY ${orderByClause} LIMIT ? OFFSET ?`;
    const dataParams = [...params, pageSize, offset];

    // Execute queries in parallel
    const [rows, countResult] = await Promise.all([
      query(dataSql, dataParams),
      query(countSql, params)
    ]);

    const total = (countResult as any)[0].total;

    return NextResponse.json(buildPagedResponse(rows, total, page, pageSize));
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch flights'));
  }
}

// POST - Create new flight
export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from header
    const tenantId = request.headers.get('X-Tenant-Id');
    if (!tenantId) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'X-Tenant-Id header is required'
      });
    }

    const body = await request.json();
    const {
      provider_id,
      from_airport,
      to_airport,
      from_city,
      to_city,
      season_name,
      start_date,
      end_date,
      departure_time,
      arrival_time,
      price_oneway,
      price_roundtrip,
      airline,
      flight_number,
      booking_class,
      baggage_allowance,
      currency,
      notes
    } = body;

    // Validate required fields
    if (!from_airport || !to_airport || !start_date || !end_date) {
      return errorResponse({
        type: 'https://httpstatuses.com/400',
        title: 'Bad Request',
        status: 400,
        detail: 'from_airport, to_airport, start_date, and end_date are required'
      });
    }

    const result = await query(
      `INSERT INTO flight_pricing (
        organization_id, provider_id, from_airport, to_airport, from_city, to_city,
        season_name, start_date, end_date, departure_time, arrival_time,
        price_oneway, price_roundtrip, airline, flight_number, booking_class,
        baggage_allowance, currency, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        parseInt(tenantId), provider_id || null, from_airport, to_airport, from_city, to_city,
        season_name, start_date, end_date, departure_time, arrival_time,
        price_oneway || 0, price_roundtrip || 0, airline, flight_number, booking_class || 'Economy',
        baggage_allowance, currency || 'EUR', notes
      ]
    );

    const insertId = (result as any).insertId;

    // Fetch the created record
    const [createdFlight] = await query(
      'SELECT f.*, p.provider_name FROM flight_pricing f LEFT JOIN providers p ON f.provider_id = p.id WHERE f.id = ?',
      [insertId]
    ) as any[];

    // Return 201 Created with Location header
    return NextResponse.json(
      createdFlight,
      {
        status: 201,
        headers: {
          Location: `/api/flights/${insertId}`
        }
      }
    );
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to create flight'));
  }
}
