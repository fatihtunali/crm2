// Database Types - matching actual database schema

export interface CustomerItinerary {
  id: number;
  uuid: string;
  organization_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  destination: string;
  city_nights: any; // JSON
  start_date: Date;
  end_date: Date;
  adults: number;
  children: number;
  hotel_category: string | null;
  tour_type: 'SIC' | 'PRIVATE' | null;
  special_requests: string | null;
  itinerary_data: any; // JSON
  total_price: string;
  price_per_person: string;
  status: 'pending' | 'confirmed' | 'booked' | 'completed' | 'cancelled';
  booking_requested_at: Date | null;
  source: 'online' | 'manual';
  created_at: Date;
  updated_at: Date;
}

export interface Quote {
  id: number;
  organization_id: number;
  created_by_user_id: number | null;
  quote_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  destination: string | null;
  start_date: Date | null;
  end_date: Date | null;
  adults: number | null;
  children: number | null;
  total_price: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  sent_at: Date | null;
  viewed_at: Date | null;
  last_follow_up_at: Date | null;
  follow_up_notes: string | null;
  itinerary: any; // JSON
  city_nights: any; // JSON
  ai_generated_description: string | null;
  created_at: Date;
  updated_at: Date;
  quote_preferences: any; // JSON
}

export interface Booking {
  id: number;
  organization_id: number;
  quote_id: number;
  booking_number: string;
  customer_name: string | null;
  customer_email: string | null;
  destination: string | null;
  start_date: Date | null;
  end_date: Date | null;
  adults: number | null;
  children: number | null;
  total_amount: string | null;
  payment_status: 'pending' | 'partial' | 'paid' | null;
  payment_amount: string | null;
  booking_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Hotel {
  id: number;
  google_place_id: string | null;
  organization_id: number;
  hotel_name: string;
  city: string;
  star_rating: number | null;
  hotel_category: 'budget' | 'standard_3star' | 'standard_4star' | 'standard_5star' | 'special_class' | 'luxury' | null;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface Tour {
  id: number;
  organization_id: number;
  tour_name: string;
  city: string;
  tour_type: 'SIC' | 'PRIVATE';
  status: 'active' | 'inactive';
  created_at: Date;
}

export interface Vehicle {
  id: number;
  organization_id: number;
  vehicle_type: string;
  capacity: number;
  status: 'active' | 'inactive';
  created_at: Date;
}
