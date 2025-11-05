-- =====================================================
-- PERFORMANCE OPTIMIZATION: DATABASE INDEXES
-- =====================================================
-- Database: crm_db
-- Purpose: Add indexes on frequently queried columns
-- Impact: Improves query performance for filtering, sorting, searching
--
-- IMPORTANT: Run during off-peak hours as index creation locks tables
-- Estimated time: 5-10 minutes depending on data volume
-- =====================================================

-- Check current indexes before running
-- SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
-- FROM INFORMATION_SCHEMA.STATISTICS
-- WHERE TABLE_SCHEMA = 'crm_db'
-- ORDER BY TABLE_NAME, INDEX_NAME;

-- =====================================================
-- QUOTES TABLE
-- =====================================================
-- Every query filters by organization_id - CRITICAL for performance
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id
ON quotes(organization_id);

-- Status is heavily filtered (draft, sent, confirmed, etc.)
CREATE INDEX IF NOT EXISTS idx_quotes_status
ON quotes(status);

-- Composite index for common query pattern: org + status
CREATE INDEX IF NOT EXISTS idx_quotes_org_status
ON quotes(organization_id, status);

-- Created_at for sorting (most queries sort by date)
CREATE INDEX IF NOT EXISTS idx_quotes_created_at
ON quotes(created_at);

-- Customer email for lookups
CREATE INDEX IF NOT EXISTS idx_quotes_customer_email
ON quotes(customer_email);

-- Start date for date range queries
CREATE INDEX IF NOT EXISTS idx_quotes_start_date
ON quotes(start_date);

-- =====================================================
-- CLIENTS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_clients_organization_id
ON clients(organization_id);

CREATE INDEX IF NOT EXISTS idx_clients_status
ON clients(status);

CREATE INDEX IF NOT EXISTS idx_clients_org_status
ON clients(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_clients_email
ON clients(email);

CREATE INDEX IF NOT EXISTS idx_clients_created_at
ON clients(created_at);

-- =====================================================
-- USERS TABLE
-- =====================================================
-- Email is used for login - already unique key but add index for performance
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_organization_id
ON users(organization_id);

CREATE INDEX IF NOT EXISTS idx_users_status
ON users(status);

-- =====================================================
-- CUSTOMER_ITINERARIES (REQUESTS) TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_itineraries_organization_id
ON customer_itineraries(organization_id);

CREATE INDEX IF NOT EXISTS idx_itineraries_status
ON customer_itineraries(status);

CREATE INDEX IF NOT EXISTS idx_itineraries_org_status
ON customer_itineraries(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_itineraries_created_at
ON customer_itineraries(created_at);

CREATE INDEX IF NOT EXISTS idx_itineraries_email
ON customer_itineraries(customer_email);

-- =====================================================
-- HOTELS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_hotels_organization_id
ON hotels(organization_id);

CREATE INDEX IF NOT EXISTS idx_hotels_city
ON hotels(city);

CREATE INDEX IF NOT EXISTS idx_hotels_status
ON hotels(status);

CREATE INDEX IF NOT EXISTS idx_hotels_org_city_status
ON hotels(organization_id, city, status);

-- =====================================================
-- TOURS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tours_organization_id
ON tours(organization_id);

CREATE INDEX IF NOT EXISTS idx_tours_city
ON tours(city);

CREATE INDEX IF NOT EXISTS idx_tours_status
ON tours(status);

-- =====================================================
-- VEHICLES TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_organization_id
ON vehicles(organization_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_status
ON vehicles(status);

-- =====================================================
-- GUIDES TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_guides_organization_id
ON guides(organization_id);

CREATE INDEX IF NOT EXISTS idx_guides_city
ON guides(city);

CREATE INDEX IF NOT EXISTS idx_guides_status
ON guides(status);

-- =====================================================
-- ENTRANCE_FEES TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_entrance_fees_organization_id
ON entrance_fees(organization_id);

CREATE INDEX IF NOT EXISTS idx_entrance_fees_city
ON entrance_fees(city);

CREATE INDEX IF NOT EXISTS idx_entrance_fees_status
ON entrance_fees(status);

-- =====================================================
-- RESTAURANTS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_restaurants_organization_id
ON restaurants(organization_id);

CREATE INDEX IF NOT EXISTS idx_restaurants_city
ON restaurants(city);

CREATE INDEX IF NOT EXISTS idx_restaurants_status
ON restaurants(status);

-- =====================================================
-- TRANSFERS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transfers_organization_id
ON transfers(organization_id);

CREATE INDEX IF NOT EXISTS idx_transfers_city
ON transfers(city);

CREATE INDEX IF NOT EXISTS idx_transfers_status
ON transfers(status);

-- =====================================================
-- PROVIDERS/SUPPLIERS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_providers_organization_id
ON providers(organization_id);

CREATE INDEX IF NOT EXISTS idx_providers_type
ON providers(provider_type);

CREATE INDEX IF NOT EXISTS idx_providers_status
ON providers(status);

CREATE INDEX IF NOT EXISTS idx_providers_city
ON providers(city);

-- =====================================================
-- INVOICES RECEIVABLE TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_invoices_receivable_organization_id
ON invoices_receivable(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoices_receivable_status
ON invoices_receivable(status);

CREATE INDEX IF NOT EXISTS idx_invoices_receivable_invoice_date
ON invoices_receivable(invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoices_receivable_due_date
ON invoices_receivable(due_date);

-- =====================================================
-- INVOICES PAYABLE TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_invoices_payable_organization_id
ON invoices_payable(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoices_payable_status
ON invoices_payable(status);

CREATE INDEX IF NOT EXISTS idx_invoices_payable_invoice_date
ON invoices_payable(invoice_date);

CREATE INDEX IF NOT EXISTS idx_invoices_payable_due_date
ON invoices_payable(due_date);

-- =====================================================
-- BOOKINGS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_organization_id
ON bookings(organization_id);

CREATE INDEX IF NOT EXISTS idx_bookings_quote_id
ON bookings(quote_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status
ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_booking_date
ON bookings(booking_date);

-- =====================================================
-- AGENTS TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_agents_organization_id
ON agents(organization_id);

CREATE INDEX IF NOT EXISTS idx_agents_status
ON agents(status);

CREATE INDEX IF NOT EXISTS idx_agents_email
ON agents(email);

-- =====================================================
-- EXTRA_EXPENSES TABLE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_extra_expenses_organization_id
ON extra_expenses(organization_id);

CREATE INDEX IF NOT EXISTS idx_extra_expenses_city
ON extra_expenses(city);

CREATE INDEX IF NOT EXISTS idx_extra_expenses_status
ON extra_expenses(status);

-- =====================================================
-- QUOTE_DAYS TABLE (Foreign Key Optimization)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quote_days_quote_id
ON quote_days(quote_id);

-- =====================================================
-- QUOTE_EXPENSES TABLE (Foreign Key Optimization)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_quote_expenses_day_id
ON quote_expenses(quote_day_id);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After running, verify indexes were created:
-- SELECT
--   TABLE_NAME,
--   INDEX_NAME,
--   GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS,
--   NON_UNIQUE,
--   INDEX_TYPE
-- FROM INFORMATION_SCHEMA.STATISTICS
-- WHERE TABLE_SCHEMA = 'crm_db'
--   AND INDEX_NAME LIKE 'idx_%'
-- GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
-- ORDER BY TABLE_NAME, INDEX_NAME;

-- =====================================================
-- EXPECTED PERFORMANCE IMPROVEMENTS
-- =====================================================
-- Before: Full table scans on every filtered query
-- After: Index seeks - 10-100x faster queries
--
-- Example query that will benefit:
-- SELECT * FROM quotes
-- WHERE organization_id = 1 AND status = 'draft'
-- ORDER BY created_at DESC;
--
-- Before: Scans ALL quotes in database
-- After: Uses idx_quotes_org_status + idx_quotes_created_at
-- =====================================================
