import mysql from 'mysql2/promise';

// Database connection singleton
let connection: mysql.Connection | null = null;

export async function getConnection() {
  if (connection) {
    return connection;
  }

  if (!process.env.DATABASE_HOST || !process.env.DATABASE_USER || !process.env.DATABASE_PASSWORD || !process.env.DATABASE_NAME) {
    throw new Error('Database configuration is missing. Please check your .env file.');
  }

  connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  return connection;
}

// Generic query function
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const conn = await getConnection();
  const [rows] = await conn.query(sql, params);
  return rows as T[];
}

// Table-specific helpers
export const db = {
  // Quotes
  async getAllQuotes() {
    return query('SELECT * FROM quotes ORDER BY created_at DESC');
  },

  async getQuoteById(id: number) {
    const results = await query('SELECT * FROM quotes WHERE id = ?', [id]);
    return results[0] || null;
  },

  async getQuotesByStatus(status: string) {
    return query('SELECT * FROM quotes WHERE status = ? ORDER BY created_at DESC', [status]);
  },

  // Customer Itineraries (Requests)
  async getAllItineraries() {
    return query('SELECT * FROM customer_itineraries ORDER BY created_at DESC');
  },

  async getItineraryById(id: number) {
    const results = await query('SELECT * FROM customer_itineraries WHERE id = ?', [id]);
    return results[0] || null;
  },

  async getItinerariesByStatus(status: string) {
    return query('SELECT * FROM customer_itineraries WHERE status = ? ORDER BY created_at DESC', [status]);
  },

  // Hotels
  async getAllHotels() {
    return query('SELECT * FROM hotels WHERE status = "active" ORDER BY hotel_name');
  },

  async getHotelsByCity(city: string) {
    return query('SELECT * FROM hotels WHERE city = ? AND status = "active" ORDER BY hotel_name', [city]);
  },

  async getHotelById(id: number) {
    const results = await query('SELECT * FROM hotels WHERE id = ?', [id]);
    return results[0] || null;
  },

  // Hotel Pricing
  async getHotelPricing(hotelId: number) {
    return query('SELECT * FROM hotel_pricing WHERE hotel_id = ? AND status = "active" ORDER BY start_date', [hotelId]);
  },

  // Tours
  async getAllTours() {
    return query('SELECT * FROM tours WHERE status = "active" ORDER BY tour_name');
  },

  async getToursByCity(city: string) {
    return query('SELECT * FROM tours WHERE city = ? AND status = "active" ORDER BY tour_name', [city]);
  },

  async getTourById(id: number) {
    const results = await query('SELECT * FROM tours WHERE id = ?', [id]);
    return results[0] || null;
  },

  // Tour Pricing
  async getTourPricing(tourId: number) {
    return query('SELECT * FROM tour_pricing WHERE tour_id = ? AND status = "active" ORDER BY start_date', [tourId]);
  },

  // Vehicles
  async getAllVehicles() {
    return query('SELECT * FROM vehicles WHERE status = "active" ORDER BY vehicle_type');
  },

  async getVehicleById(id: number) {
    const results = await query('SELECT * FROM vehicles WHERE id = ?', [id]);
    return results[0] || null;
  },

  // Vehicle Pricing
  async getVehiclePricing(vehicleId: number) {
    return query('SELECT * FROM vehicle_pricing WHERE vehicle_id = ? AND status = "active" ORDER BY start_date', [vehicleId]);
  },

  // Guides
  async getAllGuides() {
    return query('SELECT * FROM guides WHERE status = "active" ORDER BY city, language');
  },

  async getGuidesByCity(city: string) {
    return query('SELECT * FROM guides WHERE city = ? AND status = "active" ORDER BY language', [city]);
  },

  // Guide Pricing
  async getGuidePricing(guideId: number) {
    return query('SELECT * FROM guide_pricing WHERE guide_id = ? AND status = "active" ORDER BY start_date', [guideId]);
  },

  // Entrance Fees
  async getAllEntranceFees() {
    return query('SELECT * FROM entrance_fees WHERE status = "active" ORDER BY city, site_name');
  },

  async getEntranceFeesByCity(city: string) {
    return query('SELECT * FROM entrance_fees WHERE city = ? AND status = "active" ORDER BY site_name', [city]);
  },

  // Entrance Fee Pricing
  async getEntranceFeePricing(feeId: number) {
    return query('SELECT * FROM entrance_fee_pricing WHERE entrance_fee_id = ? AND status = "active" ORDER BY start_date', [feeId]);
  },

  // Meal Pricing
  async getMealPricingByCity(city: string) {
    return query('SELECT * FROM meal_pricing WHERE city = ? AND status = "active" ORDER BY restaurant_name', [city]);
  },

  // Extra Expenses
  async getExtraExpensesByCity(city: string) {
    return query('SELECT * FROM extra_expenses WHERE city = ? AND status = "active" ORDER BY expense_name', [city]);
  },

  // Intercity Transfers
  async getIntercityTransfers(fromCity: string, toCity: string) {
    return query('SELECT * FROM intercity_transfers WHERE from_city = ? AND to_city = ? AND status = "active"', [fromCity, toCity]);
  },

  // Organizations
  async getAllOrganizations() {
    return query('SELECT * FROM organizations WHERE status = "active"');
  },

  // Users
  async getUserById(id: number) {
    const results = await query('SELECT * FROM users WHERE id = ?', [id]);
    return results[0] || null;
  },

  async getUserByEmail(email: string) {
    const results = await query('SELECT * FROM users WHERE email = ?', [email]);
    return results[0] || null;
  },

  // Bookings
  async getAllBookings() {
    return query('SELECT * FROM bookings ORDER BY booking_date DESC');
  },

  async getBookingById(id: number) {
    const results = await query('SELECT * FROM bookings WHERE id = ?', [id]);
    return results[0] || null;
  },

  // Generic table query
  async getTableData(tableName: string, limit: number = 100) {
    return query(`SELECT * FROM ${tableName} LIMIT ?`, [limit]);
  },

  async getTableCount(tableName: string) {
    const results = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return results[0]?.count || 0;
  },
};

export default db;
