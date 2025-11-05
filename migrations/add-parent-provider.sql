-- Migration: Add Parent Provider System
-- Description: Allows linking multiple provider types to a single parent company
-- Date: 2025-11-05

-- Step 1: Add parent provider columns
ALTER TABLE providers
ADD COLUMN parent_provider_id INT NULL COMMENT 'References parent provider (for multi-division companies)' AFTER provider_type,
ADD COLUMN is_parent TINYINT(1) DEFAULT 0 COMMENT 'Is this a parent company (1) or division (0)' AFTER parent_provider_id,
ADD COLUMN company_tax_id VARCHAR(50) NULL COMMENT 'Tax ID for invoicing (parent companies)' AFTER is_parent,
ADD COLUMN company_legal_name VARCHAR(255) NULL COMMENT 'Legal company name for contracts' AFTER company_tax_id;

-- Step 2: Add index for better query performance
CREATE INDEX idx_parent_provider ON providers(parent_provider_id);

-- Step 3: Add index on is_parent
CREATE INDEX idx_is_parent ON providers(is_parent);

-- Step 4: Add foreign key constraint
ALTER TABLE providers
ADD CONSTRAINT fk_parent_provider
  FOREIGN KEY (parent_provider_id)
  REFERENCES providers(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Step 4: Add comments for clarity
ALTER TABLE providers MODIFY COLUMN parent_provider_id INT NULL
  COMMENT 'ID of parent provider (NULL if no parent or if this IS the parent)';

-- ============================================================
-- EXAMPLE USAGE:
-- ============================================================
--
-- 1. Create a parent company:
-- INSERT INTO providers (provider_name, provider_type, is_parent, company_tax_id, company_legal_name, organization_id, status)
-- VALUES ('Litore Sun Group', 'other', 1, '1234567890', 'Litore Sun Tourism Ltd.', 5, 'active');
--
-- 2. Link existing providers to parent (ID 28 is the parent):
-- UPDATE providers SET parent_provider_id = 28 WHERE id IN (26, 27);
--
-- 3. Query all divisions of a parent:
-- SELECT * FROM providers WHERE parent_provider_id = 28;
--
-- 4. Query with parent info:
-- SELECT
--   p.id,
--   p.provider_name,
--   p.provider_type,
--   parent.provider_name as parent_company,
--   parent.company_tax_id,
--   parent.company_legal_name
-- FROM providers p
-- LEFT JOIN providers parent ON p.parent_provider_id = parent.id;
-- ============================================================

-- To rollback this migration:
-- ALTER TABLE providers DROP FOREIGN KEY fk_parent_provider;
-- DROP INDEX idx_parent_provider ON providers;
-- DROP INDEX idx_is_parent ON providers;
-- ALTER TABLE providers DROP COLUMN parent_provider_id;
-- ALTER TABLE providers DROP COLUMN is_parent;
-- ALTER TABLE providers DROP COLUMN company_tax_id;
-- ALTER TABLE providers DROP COLUMN company_legal_name;
