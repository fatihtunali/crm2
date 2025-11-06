-- Migration: Add Favorite Priority to meal_pricing table
-- Date: 2025-11-06
-- Note: The "restaurants" endpoint actually uses the meal_pricing table

-- Add favorite_priority column
ALTER TABLE meal_pricing
ADD COLUMN favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
AFTER status;

-- Add index
CREATE INDEX idx_favorite_priority ON meal_pricing(favorite_priority, organization_id);

-- Add check constraint
ALTER TABLE meal_pricing
ADD CONSTRAINT chk_meal_pricing_favorite_priority CHECK (favorite_priority BETWEEN 0 AND 10);
