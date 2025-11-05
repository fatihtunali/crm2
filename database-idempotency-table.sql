-- =====================================================
-- IDEMPOTENCY SYSTEM: MySQL-Based Storage
-- =====================================================
-- Database: crm_db
-- Purpose: Replace in-memory idempotency storage with persistent MySQL table
-- Benefits:
--   - Survives server restarts
--   - Works across multiple server instances (horizontal scaling)
--   - Persistent audit trail
--   - Automatic cleanup with TTL
-- =====================================================

-- =====================================================
-- CREATE IDEMPOTENCY_KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- The idempotency key from the client (UUID or custom string)
  idempotency_key VARCHAR(255) NOT NULL,

  -- Organization ID for multi-tenant isolation
  organization_id INT UNSIGNED NOT NULL,

  -- User who made the request
  user_id INT UNSIGNED NOT NULL,

  -- HTTP method and endpoint path
  http_method ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE') NOT NULL,
  endpoint_path VARCHAR(500) NOT NULL,

  -- Request details (for audit/debugging)
  request_body JSON DEFAULT NULL,
  request_headers JSON DEFAULT NULL,

  -- Response details (stored to return same response)
  response_status_code SMALLINT UNSIGNED NOT NULL,
  response_body JSON DEFAULT NULL,
  response_headers JSON DEFAULT NULL,

  -- Processing state
  status ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',

  -- Error information (if failed)
  error_message TEXT DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,

  -- Indexes for fast lookups
  UNIQUE KEY idx_idempotency_key_org (idempotency_key, organization_id),
  KEY idx_organization_id (organization_id),
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  KEY idx_expires_at (expires_at),
  KEY idx_created_at (created_at),

  -- Foreign keys
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RATE LIMITING TABLE (Login Attempts)
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Identifier (email, IP address, or user ID)
  identifier VARCHAR(255) NOT NULL,

  -- Type of rate limit (login, api, ai_generation)
  limit_type ENUM('login', 'api_call', 'ai_generation', 'other') NOT NULL,

  -- Attempt tracking
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  window_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  window_end TIMESTAMP NOT NULL,

  -- Lockout tracking
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_until TIMESTAMP NULL DEFAULT NULL,

  -- Last attempt
  last_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Metadata
  metadata JSON DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  UNIQUE KEY idx_identifier_type (identifier, limit_type),
  KEY idx_locked_until (locked_until),
  KEY idx_window_end (window_end),
  KEY idx_is_locked (is_locked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CLEANUP EVENT (Automatic TTL)
-- =====================================================
-- This event runs every hour and deletes expired records
-- Enable event scheduler if not already enabled:
-- SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS cleanup_expired_idempotency_keys;

DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_expired_idempotency_keys
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Delete expired idempotency keys (older than 24 hours)
  DELETE FROM idempotency_keys
  WHERE expires_at < NOW();

  -- Log cleanup
  SET @deleted_count = ROW_COUNT();
  IF @deleted_count > 0 THEN
    INSERT INTO system_logs (log_level, category, message, created_at)
    VALUES ('INFO', 'CLEANUP', CONCAT('Deleted ', @deleted_count, ' expired idempotency keys'), NOW())
    ON DUPLICATE KEY UPDATE created_at = NOW();
  END IF;
END$$
DELIMITER ;

-- =====================================================
-- CLEANUP EVENT (Rate Limit Tracking)
-- =====================================================
DROP EVENT IF EXISTS cleanup_expired_rate_limits;

DELIMITER $$
CREATE EVENT IF NOT EXISTS cleanup_expired_rate_limits
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Delete expired rate limit entries (older than 24 hours)
  DELETE FROM rate_limit_tracking
  WHERE window_end < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    AND (locked_until IS NULL OR locked_until < NOW());

  -- Reset lockouts that have expired
  UPDATE rate_limit_tracking
  SET is_locked = FALSE,
      locked_until = NULL,
      attempt_count = 0,
      window_start = NOW(),
      window_end = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
  WHERE is_locked = TRUE
    AND locked_until < NOW();
END$$
DELIMITER ;

-- =====================================================
-- SYSTEM_LOGS TABLE (Optional - for event logging)
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  log_level ENUM('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL,
  category VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_log_level (log_level),
  KEY idx_category (category),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- Example 1: Store idempotency key for POST request
/*
INSERT INTO idempotency_keys (
  idempotency_key,
  organization_id,
  user_id,
  http_method,
  endpoint_path,
  request_body,
  response_status_code,
  response_body,
  status,
  expires_at
) VALUES (
  'uuid-12345-67890',
  1,
  5,
  'POST',
  '/api/quotations',
  '{"customer_name": "John Doe", ...}',
  201,
  '{"id": 123, "quote_number": "Q-2025-0001"}',
  'completed',
  DATE_ADD(NOW(), INTERVAL 24 HOUR)
);
*/

-- Example 2: Check if idempotency key exists
/*
SELECT
  response_status_code,
  response_body,
  status
FROM idempotency_keys
WHERE idempotency_key = 'uuid-12345-67890'
  AND organization_id = 1
  AND expires_at > NOW()
LIMIT 1;
*/

-- Example 3: Record login attempt
/*
INSERT INTO rate_limit_tracking (
  identifier,
  limit_type,
  attempt_count,
  window_start,
  window_end
) VALUES (
  'user@example.com',
  'login',
  1,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 15 MINUTE)
) ON DUPLICATE KEY UPDATE
  attempt_count = attempt_count + 1,
  last_attempt_at = NOW(),
  is_locked = IF(attempt_count + 1 >= 5, TRUE, is_locked),
  locked_until = IF(attempt_count + 1 >= 5, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until);
*/

-- Example 4: Check if user is rate limited
/*
SELECT
  is_locked,
  locked_until,
  attempt_count,
  TIMESTAMPDIFF(MINUTE, NOW(), locked_until) AS minutes_remaining
FROM rate_limit_tracking
WHERE identifier = 'user@example.com'
  AND limit_type = 'login'
LIMIT 1;
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if tables were created
SHOW TABLES LIKE '%idempotency%' OR LIKE '%rate_limit%';

-- Check if events are scheduled
SHOW EVENTS WHERE Name LIKE 'cleanup%';

-- Check event scheduler status
SHOW VARIABLES LIKE 'event_scheduler';

-- If event_scheduler is OFF, enable it:
-- SET GLOBAL event_scheduler = ON;

-- =====================================================
-- MIGRATION FROM IN-MEMORY TO MYSQL
-- =====================================================
-- After creating these tables, update the middleware to use MySQL instead of Map:
--
-- src/middleware/idempotency.ts:
-- - Replace: const idempotencyStore = new Map()
-- - With: MySQL queries to idempotency_keys table
--
-- src/app/api/auth/login/route.ts:
-- - Replace: const loginAttempts = new Map()
-- - With: MySQL queries to rate_limit_tracking table
--
-- src/app/api/quotations/[id]/generate-itinerary/route.ts:
-- - Replace: const aiRateLimits = new Map()
-- - With: MySQL queries to rate_limit_tracking table
-- =====================================================
