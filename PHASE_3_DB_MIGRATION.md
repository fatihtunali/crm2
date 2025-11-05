# Phase 3: Database Migration Guide

**Step 1 of Phase 3 Implementation**

This guide will help you apply the idempotency and soft delete database schema changes.

---

## Prerequisites

- Access to MySQL database (`crm_db` on `134.209.137.11`)
- MySQL client or database management tool
- Database credentials (user: `crm`, password: from `.env`)

---

## Step 1: Apply Idempotency Tables

### Option A: Using MySQL Command Line

```bash
# Connect to database
mysql -h 134.209.137.11 -u crm -p crm_db

# Or apply file directly
mysql -h 134.209.137.11 -u crm -p crm_db < database-idempotency-table.sql
```

### Option B: Using Database GUI Tool

1. Open your database tool (MySQL Workbench, phpMyAdmin, DBeaver, etc.)
2. Connect to: `134.209.137.11:3306`
3. Select database: `crm_db`
4. Copy and paste the contents of `database-idempotency-table.sql`
5. Execute the SQL

### What This Creates:

1. **idempotency_keys** table (for preventing duplicate requests)
2. **rate_limit_tracking** table (for rate limiting)
3. **system_logs** table (for event logging)
4. **MySQL Events** (for automatic cleanup)

---

## Step 2: Enable MySQL Event Scheduler

**Important:** The automatic cleanup requires MySQL's event scheduler to be enabled.

```sql
-- Check if event scheduler is enabled
SHOW VARIABLES LIKE 'event_scheduler';

-- If it shows 'OFF', enable it:
SET GLOBAL event_scheduler = ON;

-- Verify events were created
SHOW EVENTS WHERE Name LIKE 'cleanup%';
```

**Expected Output:**
```
cleanup_expired_idempotency_keys | ENABLED | RECURRING | EVERY 1 HOUR
cleanup_expired_rate_limits       | ENABLED | RECURRING | EVERY 1 HOUR
```

---

## Step 3: Add Soft Delete Columns

Now we'll add `archived_at` column to all resource tables for soft delete support.

```sql
-- Quotations
ALTER TABLE quotes
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Bookings
ALTER TABLE bookings
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Users
ALTER TABLE users
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Clients
ALTER TABLE clients
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Agents
ALTER TABLE agents
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Providers
ALTER TABLE providers
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Hotels
ALTER TABLE hotels
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Guides
ALTER TABLE guides
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Vehicles
ALTER TABLE vehicles
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Daily Tours
ALTER TABLE tours
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Restaurants
ALTER TABLE meal_pricing
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Transfers
ALTER TABLE intercity_transfers
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Entrance Fees
ALTER TABLE entrance_fees
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Extra Expenses
ALTER TABLE extra_expenses
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Roles (for custom roles)
ALTER TABLE roles
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Invoices Receivable
ALTER TABLE invoices_receivable
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Invoices Payable
ALTER TABLE invoices_payable
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);

-- Requests
ALTER TABLE quote_requests
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD INDEX idx_archived_at (archived_at);
```

**Note:** Some tables may already have `archived_at` or equivalent columns. Check first:

```sql
-- Check if column already exists
DESCRIBE quotes;
DESCRIBE users;
-- etc.
```

---

## Step 4: Verification Queries

After applying all changes, verify everything is set up correctly:

### Check New Tables
```sql
-- Should show idempotency_keys, rate_limit_tracking, system_logs
SHOW TABLES LIKE '%idempotency%';
SHOW TABLES LIKE '%rate_limit%';
SHOW TABLES LIKE '%system_logs%';

-- Check table structure
DESCRIBE idempotency_keys;
```

### Check Events
```sql
-- Should show 2 cleanup events
SHOW EVENTS WHERE Name LIKE 'cleanup%';

-- Check event scheduler status
SHOW VARIABLES LIKE 'event_scheduler';
```

### Check archived_at Columns
```sql
-- Check a few key tables
SHOW COLUMNS FROM quotes LIKE 'archived_at';
SHOW COLUMNS FROM users LIKE 'archived_at';
SHOW COLUMNS FROM providers LIKE 'archived_at';
```

### Check Indexes
```sql
-- Should show idx_archived_at index
SHOW INDEXES FROM quotes WHERE Key_name = 'idx_archived_at';
```

---

## Step 5: Test Queries

### Test Idempotency Table
```sql
-- Insert test idempotency key
INSERT INTO idempotency_keys (
  idempotency_key,
  organization_id,
  user_id,
  http_method,
  endpoint_path,
  response_status_code,
  response_body,
  status,
  expires_at
) VALUES (
  'test-key-123',
  1,
  5,
  'POST',
  '/api/quotations',
  201,
  '{"id": 999, "test": true}',
  'completed',
  DATE_ADD(NOW(), INTERVAL 24 HOUR)
);

-- Verify it was inserted
SELECT * FROM idempotency_keys WHERE idempotency_key = 'test-key-123';

-- Clean up test data
DELETE FROM idempotency_keys WHERE idempotency_key = 'test-key-123';
```

### Test Soft Delete
```sql
-- Find a test record (replace with actual ID)
SELECT id, archived_at FROM quotes WHERE id = 1 LIMIT 1;

-- Soft delete it
UPDATE quotes SET archived_at = NOW() WHERE id = 1;

-- Verify it's archived
SELECT id, archived_at FROM quotes WHERE id = 1;

-- Restore it
UPDATE quotes SET archived_at = NULL WHERE id = 1;

-- Verify it's restored
SELECT id, archived_at FROM quotes WHERE id = 1;
```

---

## Troubleshooting

### Error: "Table already exists"
**Solution:** Some tables may already exist from previous migrations. Check if they have the correct structure:
```sql
DESCRIBE idempotency_keys;
```

### Error: "Duplicate column name 'archived_at'"
**Solution:** The column already exists. Skip that ALTER TABLE command.

### Error: "Event scheduler is disabled"
**Solution:** Enable it with:
```sql
SET GLOBAL event_scheduler = ON;
```

You may need elevated privileges. Contact your database administrator if you get permission errors.

### Events not showing up
**Solution:** Make sure you have the EVENT privilege:
```sql
SHOW GRANTS FOR CURRENT_USER;
```

---

## Rollback (If Needed)

If something goes wrong, here's how to roll back:

```sql
-- Drop tables
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS rate_limit_tracking;
DROP TABLE IF EXISTS system_logs;

-- Drop events
DROP EVENT IF EXISTS cleanup_expired_idempotency_keys;
DROP EVENT IF EXISTS cleanup_expired_rate_limits;

-- Remove archived_at columns (for each table)
ALTER TABLE quotes DROP COLUMN archived_at;
ALTER TABLE users DROP COLUMN archived_at;
-- etc.
```

---

## Next Steps

After completing this database migration:

1. **Notify me** by saying "Database migration complete" or "DB schema applied"
2. I will then proceed with:
   - Updating idempotency middleware to use MySQL
   - Updating DELETE endpoints to use soft delete
   - Adding `?include_archived=true` support
   - Testing all changes
   - Building and committing Phase 3

---

## Estimated Time

- **Applying SQL Scripts:** 5-10 minutes
- **Verification:** 5 minutes
- **Total:** 10-15 minutes

---

## Support

If you encounter any issues during migration:
1. Check the error message carefully
2. Review the troubleshooting section above
3. Let me know the specific error, and I'll help resolve it

---

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>

**Phase 3 Step 1:** Database Migration (Ready to Apply)
