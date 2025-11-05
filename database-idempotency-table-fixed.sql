-- =====================================================
-- IDEMPOTENCY SYSTEM: MySQL-Based Storage (Fixed Version)
-- =====================================================
-- Removed foreign key constraints to avoid data type mismatches
-- Foreign keys are not critical for idempotency functionality
-- =====================================================

-- =====================================================
-- CREATE IDEMPOTENCY_KEYS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- The idempotency key from the client (UUID or custom string)
  idempotency_key VARCHAR(255) NOT NULL,

  -- Organization ID for multi-tenant isolation
  organization_id INT NOT NULL,

  -- User who made the request
  user_id INT NOT NULL,

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
  KEY idx_created_at (created_at)
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
-- SYSTEM_LOGS TABLE (For event logging)
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
-- CLEANUP EVENT (Automatic TTL)
-- =====================================================
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
