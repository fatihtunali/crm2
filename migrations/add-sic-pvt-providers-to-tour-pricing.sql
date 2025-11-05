-- Add separate provider fields for SIC and PVT tour pricing
-- This allows different providers to operate SIC vs PVT tours

ALTER TABLE tour_pricing
ADD COLUMN sic_provider_id INT NULL COMMENT 'Provider for SIC (Seat-in-Coach) tours' AFTER provider_id,
ADD COLUMN pvt_provider_id INT NULL COMMENT 'Provider for PVT (Private) tours' AFTER sic_provider_id;

-- Add foreign key constraints
ALTER TABLE tour_pricing
ADD CONSTRAINT fk_tour_pricing_sic_provider
  FOREIGN KEY (sic_provider_id) REFERENCES providers(id)
  ON DELETE SET NULL,
ADD CONSTRAINT fk_tour_pricing_pvt_provider
  FOREIGN KEY (pvt_provider_id) REFERENCES providers(id)
  ON DELETE SET NULL;

-- Migrate existing data: if tour_pricing has a provider_id, copy it to both sic and pvt
-- This maintains backward compatibility with existing data
UPDATE tour_pricing
SET
  sic_provider_id = provider_id,
  pvt_provider_id = provider_id
WHERE provider_id IS NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_tour_pricing_sic_provider ON tour_pricing(sic_provider_id);
CREATE INDEX idx_tour_pricing_pvt_provider ON tour_pricing(pvt_provider_id);
