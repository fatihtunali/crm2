-- Migration: Add Favorite Priority to Remaining Tables
-- Date: 2025-11-06
--
-- This adds favorite_priority to tables that don't have it yet:
-- - tours
-- - entrance_fees
-- - providers
-- - intercity_transfers
-- - extra_expenses

-- ============================================================
-- STEP 1: Add favorite_priority column
-- ============================================================

-- Tours (Daily Tours)
ALTER TABLE tours
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Entrance Fees
ALTER TABLE entrance_fees
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Providers
ALTER TABLE providers
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Intercity Transfers
ALTER TABLE intercity_transfers
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Extra Expenses
ALTER TABLE extra_expenses
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- ============================================================
-- STEP 2: Add indexes for performance
-- ============================================================

CREATE INDEX idx_favorite_priority ON tours(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON entrance_fees(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON providers(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON intercity_transfers(favorite_priority, organization_id);
CREATE INDEX idx_favorite_priority ON extra_expenses(favorite_priority, organization_id);

-- ============================================================
-- STEP 3: Add check constraints to enforce 0-10 range
-- ============================================================

ALTER TABLE tours
ADD CONSTRAINT chk_tours_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE entrance_fees
ADD CONSTRAINT chk_entrance_fees_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE providers
ADD CONSTRAINT chk_providers_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE intercity_transfers
ADD CONSTRAINT chk_intercity_transfers_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);

ALTER TABLE extra_expenses
ADD CONSTRAINT chk_extra_expenses_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);
