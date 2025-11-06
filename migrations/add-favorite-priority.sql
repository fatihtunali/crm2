-- Migration: Add Favorite Priority System
-- Description: Adds favorite_priority column to all service provider tables for AI-driven prioritization
-- Date: 2025-11-06
--
-- Purpose: Enable users to mark and rank their favorite providers (hotels, guides, vehicles, etc.)
--          so the AI quotation system can prioritize these when generating itineraries.
--
-- Priority Scale:
--   0 = Not a favorite (default)
--   1-10 = Priority ranking (10 = highest priority favorite)

-- ============================================================
-- STEP 1: Add favorite_priority column to all service tables
-- ============================================================

-- Hotels
ALTER TABLE hotels
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Guides
ALTER TABLE guides
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Vehicles
ALTER TABLE vehicles
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Restaurants
ALTER TABLE restaurants
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Transfers (if different from vehicles)
ALTER TABLE transfers
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Daily Tours
ALTER TABLE tours
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Entrance Fees
ALTER TABLE entrance_fees
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- ============================================================
-- STEP 2: Add indexes for performance (favorites will be queried frequently)
-- ============================================================

CREATE INDEX idx_favorite_priority ON hotels(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON guides(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON vehicles(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON restaurants(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON transfers(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON tours(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON entrance_fees(favorite_priority, organization_id);

-- ============================================================
-- STEP 3: Add check constraints to enforce 0-10 range
-- ============================================================
-- Note: MySQL 8.0.16+ supports CHECK constraints

ALTER TABLE hotels
ADD CONSTRAINT chk_hotels_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE guides
ADD CONSTRAINT chk_guides_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE vehicles
ADD CONSTRAINT chk_vehicles_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE restaurants
ADD CONSTRAINT chk_restaurants_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE transfers
ADD CONSTRAINT chk_transfers_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE tours
ADD CONSTRAINT chk_tours_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE entrance_fees
ADD CONSTRAINT chk_entrance_fees_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

-- ============================================================
-- EXAMPLE USAGE:
-- ============================================================
--
-- 1. Mark a hotel as a top favorite (priority 10):
-- UPDATE hotels SET favorite_priority = 10 WHERE id = 123;
--
-- 2. Mark a guide as a medium favorite (priority 5):
-- UPDATE guides SET favorite_priority = 5 WHERE id = 456;
--
-- 3. Remove favorite status:
-- UPDATE tours SET favorite_priority = 0 WHERE id = 789;
--
-- 4. Query all favorites (priority > 0), ordered by priority:
-- SELECT * FROM hotels WHERE favorite_priority > 0 ORDER BY favorite_priority DESC;
--
-- 5. Query top favorites (priority >= 8):
-- SELECT * FROM guides WHERE favorite_priority >= 8 ORDER BY favorite_priority DESC;
--
-- 6. Query with AI prioritization (favorites first, then by other criteria):
-- SELECT * FROM hotels
-- WHERE organization_id = 5 AND city = 'Istanbul'
-- ORDER BY favorite_priority DESC, star_rating DESC, rating DESC;
--
-- ============================================================

-- ============================================================
-- ROLLBACK INSTRUCTIONS:
-- ============================================================
-- To rollback this migration, run the following:
--
-- -- Drop check constraints
-- ALTER TABLE hotels DROP CONSTRAINT chk_hotels_favorite_priority;
-- ALTER TABLE guides DROP CONSTRAINT chk_guides_favorite_priority;
-- ALTER TABLE vehicles DROP CONSTRAINT chk_vehicles_favorite_priority;
-- ALTER TABLE restaurants DROP CONSTRAINT chk_restaurants_favorite_priority;
-- ALTER TABLE transfers DROP CONSTRAINT chk_transfers_favorite_priority;
-- ALTER TABLE tours DROP CONSTRAINT chk_tours_favorite_priority;
-- ALTER TABLE entrance_fees DROP CONSTRAINT chk_entrance_fees_favorite_priority;
--
-- -- Drop indexes
-- DROP INDEX idx_favorite_priority ON hotels;
-- DROP INDEX idx_favorite_priority ON guides;
-- DROP INDEX idx_favorite_priority ON vehicles;
-- DROP INDEX idx_favorite_priority ON restaurants;
-- DROP INDEX idx_favorite_priority ON transfers;
-- DROP INDEX idx_favorite_priority ON tours;
-- DROP INDEX idx_favorite_priority ON entrance_fees;
--
-- -- Drop columns
-- ALTER TABLE hotels DROP COLUMN favorite_priority;
-- ALTER TABLE guides DROP COLUMN favorite_priority;
-- ALTER TABLE vehicles DROP COLUMN favorite_priority;
-- ALTER TABLE restaurants DROP COLUMN favorite_priority;
-- ALTER TABLE transfers DROP COLUMN favorite_priority;
-- ALTER TABLE tours DROP COLUMN favorite_priority;
-- ALTER TABLE entrance_fees DROP COLUMN favorite_priority;
-- ============================================================
