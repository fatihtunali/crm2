ALTER TABLE providers ADD COLUMN provider_types JSON NULL COMMENT 'Array of provider types for multi-type providers';

UPDATE providers SET provider_types = JSON_ARRAY(provider_type) WHERE provider_types IS NULL;
