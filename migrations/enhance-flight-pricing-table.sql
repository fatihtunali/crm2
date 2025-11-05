-- Migration: Enhance flight_pricing table for comprehensive flight booking
-- Date: 2025-11-05
-- Description: Add provider_id, flight details, departure/arrival times, and booking class

-- Add new columns to flight_pricing table
ALTER TABLE flight_pricing
ADD COLUMN provider_id INT NULL COMMENT 'Provider/Supplier we are booking tickets from' AFTER organization_id,
ADD COLUMN flight_number VARCHAR(20) NULL COMMENT 'Flight number (e.g., TK123)' AFTER airline,
ADD COLUMN departure_time TIME NULL COMMENT 'Departure time' AFTER start_date,
ADD COLUMN arrival_time TIME NULL COMMENT 'Arrival time' AFTER departure_time,
ADD COLUMN booking_class ENUM('Economy', 'Business', 'First') DEFAULT 'Economy' COMMENT 'Booking class' AFTER price_roundtrip,
ADD COLUMN baggage_allowance VARCHAR(50) NULL COMMENT 'Baggage allowance (e.g., 20kg)' AFTER booking_class,
ADD COLUMN currency VARCHAR(3) DEFAULT 'EUR' COMMENT 'Currency for pricing' AFTER baggage_allowance,
ADD COLUMN archived_at TIMESTAMP NULL COMMENT 'Soft delete timestamp' AFTER status;

-- Add foreign key constraint for provider_id
ALTER TABLE flight_pricing
ADD CONSTRAINT fk_flight_pricing_provider
  FOREIGN KEY (provider_id) REFERENCES providers(id)
  ON DELETE SET NULL;

-- Add index for provider_id
CREATE INDEX idx_flight_pricing_provider ON flight_pricing(provider_id);

-- Add index for route search
CREATE INDEX idx_flight_pricing_route ON flight_pricing(from_airport, to_airport, status);

-- Add index for date range search
CREATE INDEX idx_flight_pricing_dates ON flight_pricing(start_date, end_date, status);
