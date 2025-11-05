-- Phase 2: Enhanced Auth & Audit - Database Schema
-- Run this script to create all Phase 2 tables

-- ============================================
-- 1. REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON NOT NULL,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_org_name (organization_id, name),
  INDEX idx_organization_id (organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. USER ROLES TABLE (Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  assigned_by_user_id INT UNSIGNED,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_role (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. INVITATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  organization_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED,
  invited_by_user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_token (token),
  INDEX idx_organization_id (organization_id),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  changes JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_organization_id (organization_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at),
  INDEX idx_request_id (request_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SEED DEFAULT SYSTEM ROLES
-- ============================================
-- Note: Adjust organization_id as needed for each organization

INSERT INTO roles (organization_id, name, description, permissions, is_system_role) VALUES
(1, 'super_admin', 'Full system access', '{"*": {"read": true, "create": true, "update": true, "delete": true}}', TRUE),
(1, 'admin', 'Organization administrator', '{"quotations": {"read": true, "create": true, "update": true, "delete": true}, "clients": {"read": true, "create": true, "update": true, "delete": true}, "invoices": {"read": true, "create": true, "update": true, "delete": true}, "reports": {"read": true}, "users": {"read": true, "create": true, "update": true}}', TRUE),
(1, 'agent', 'Sales agent', '{"quotations": {"read": true, "create": true, "update": true, "delete": false}, "clients": {"read": true, "create": true, "update": true, "delete": false}, "reports": {"read": true}}', TRUE),
(1, 'user', 'Basic user', '{"quotations": {"read": true}, "clients": {"read": true}, "reports": {"read": true}}', TRUE)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  permissions = VALUES(permissions);

-- ============================================
-- CLEANUP JOBS (Optional)
-- ============================================

-- Event to clean up expired refresh tokens (run daily at 2 AM)
CREATE EVENT IF NOT EXISTS cleanup_expired_refresh_tokens
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 2 HOUR)
DO
  DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL;

-- Event to clean up expired invitations (run daily at 2 AM)
CREATE EVENT IF NOT EXISTS cleanup_expired_invitations
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 2 HOUR)
DO
  DELETE FROM invitations WHERE expires_at < NOW() AND accepted_at IS NULL;

-- Event to archive old audit logs (run monthly, keep last 12 months)
-- Uncomment if you want to automatically archive logs
-- CREATE EVENT IF NOT EXISTS archive_old_audit_logs
-- ON SCHEDULE EVERY 1 MONTH
-- STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 MONTH)
-- DO
--   DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 12 MONTH);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if all tables were created
SELECT 'Tables Created:' as Status;
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('refresh_tokens', 'roles', 'user_roles', 'invitations', 'audit_logs');

-- Check if default roles were seeded
SELECT 'Default Roles:' as Status;
SELECT id, name, is_system_role FROM roles WHERE is_system_role = TRUE;

-- Check if events are enabled
SELECT 'Event Scheduler Status:' as Status;
SHOW VARIABLES LIKE 'event_scheduler';

-- ============================================
-- NOTES
-- ============================================

/*
DEPLOYMENT INSTRUCTIONS:

1. Make sure you have a backup before running this script:
   mysqldump -u root -p crm_db > backup_before_phase2.sql

2. Run this script:
   mysql -u root -p crm_db < database-phase-2-schema.sql

3. Enable the event scheduler if not already enabled:
   SET GLOBAL event_scheduler = ON;

4. Verify all tables and roles were created using the verification queries above.

5. For multiple organizations, run the INSERT INTO roles statement for each organization_id.

PERMISSIONS STRUCTURE:

The permissions JSON follows this format:
{
  "resource_type": {
    "action": boolean
  }
}

Examples:
- "*" means all resources
- "quotations" is a specific resource type
- "read", "create", "update", "delete" are actions

Special wildcard: {"*": {"read": true, ...}} grants access to all current and future resources.

SECURITY NOTES:

- System roles (is_system_role = TRUE) cannot be deleted
- Refresh tokens expire after 30 days by default (set in application)
- Invitations expire after 7 days by default (set in application)
- Audit logs should be retained for at least 12 months for compliance
- Foreign keys ensure referential integrity and cascade deletes appropriately

*/
