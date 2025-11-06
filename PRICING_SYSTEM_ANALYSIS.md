# Pricing System Analysis & Phase 4 Recommendations

## Executive Summary

Your CRM has a **solid seasonal pricing foundation** with 2,237 pricing records across 7 service types. The current system handles basic seasonal pricing well, but lacks advanced features needed for enterprise-level operations. Phase 4 will add sophisticated pricing rules, availability tracking, and a unified pricing engine.

---

## Current System Analysis

### ✅ What's Working Well

1. **Comprehensive Coverage**: 7 pricing tables covering all service types
   - Hotels (1,507 records)
   - Meals (241 records)
   - Guides (132 records)
   - Entrance Fees (142 records)
   - Tours (120 records)
   - Vehicles (85 records)
   - Flights (10 records)

2. **Consistent Architecture**: All pricing tables follow the same pattern
   ```sql
   {service}_pricing:
   - id, {service}_id
   - season_name, start_date, end_date
   - currency (VARCHAR(3))
   - price fields (DECIMAL(10,2))
   - status ENUM('active','inactive','archived')
   - effective_from, created_by, notes
   - created_at, updated_at
   ```

3. **Money Type Implementation**: All APIs use minor units pattern
   - `toMinorUnits()` / `fromMinorUnits()` for precise currency handling
   - Money type: `{ amount_minor: number, currency: string }`
   - Prevents floating-point rounding errors

4. **Idempotency Support**: All POST endpoints support Idempotency-Key headers (Phase 3 complete)

5. **Soft Deletes**: All pricing records use status='archived' instead of hard deletes

6. **Provider Tracking**: Tour pricing already has `sic_provider_id` and `pvt_provider_id` fields

7. **Rich Pricing Models**:
   - Hotels: BB/HB/FB/AI supplements, child pricing by age (0-6, 6-12)
   - Tours: SIC/PVT pricing by PAX count (2,4,6,8,10)
   - Guides: Full day, half day, night rates
   - Vehicles: Per day and half day rates

### ⚠️ Critical Gaps to Address

#### 1. **No Date-Based Season Selection**
**Problem**: APIs return ALL pricing records for a service. Frontend must manually:
- Filter by date to find which season applies
- Handle overlapping seasons
- Calculate which price to use

**Example**: Getting hotel pricing for Dec 25, 2025:
```
Current: GET /api/hotel-pricing?hotel_id=123&status=active
Returns: ALL active seasons for hotel 123
Frontend: Must filter by date to find correct season

Should be: GET /api/hotel-pricing?hotel_id=123&date=2025-12-25
Returns: Only the pricing for the season that covers Dec 25
```

**Impact**:
- Duplicated logic across frontend pages
- Risk of incorrect season selection
- Performance overhead (fetching all seasons when only need one)

#### 2. **No Overlap Prevention**
**Problem**: Database allows multiple seasons with overlapping dates for same service

**Example**: Hotel 123 can have:
- Winter Season: 2025-11-01 to 2026-03-31
- Christmas Special: 2025-12-20 to 2026-01-05 ← OVERLAPS!

**Current behavior**: No validation, both records can be active simultaneously

**Impact**:
- Ambiguous pricing (which season should apply on Dec 25?)
- Data integrity issues
- Requires manual cleanup

#### 3. **No Blackout Dates**
**Problem**: Can't mark specific dates as unavailable within a season

**Use case**:
- Hotel fully booked Dec 24-26
- Guide taking personal leave Jan 15-20
- Vehicle in maintenance Feb 1-3

**Current workaround**: Create multiple seasons with gaps (tedious and error-prone)

#### 4. **No Cancellation Policies**
**Problem**: Pricing records don't store cancellation terms

**Missing data**:
- Free cancellation until X days before
- Cancellation fees (flat/percentage)
- No-show penalties
- Refund processing time

**Impact**: Can't programmatically enforce cancellation rules

#### 5. **No Tax Codes**
**Problem**: Tax/VAT handling not integrated into pricing

**Current**: Prices are assumed to be final (tax-inclusive or exclusive unclear)

**Need**:
- Tax code library (VAT 18%, Tourism Tax 2%, etc.)
- Link pricing records to tax codes
- Calculate gross/net prices
- Support multi-jurisdiction tax rules

#### 6. **No Availability Tracking**
**Problem**: Just pricing data, no inventory/capacity management

**Missing**:
- Hotel room inventory by date
- Guide/vehicle bookings calendar
- Tour capacity (SIC max PAX)
- Real-time availability status

**Impact**: Can show prices for sold-out services

#### 7. **No Unified Pricing Engine**
**Problem**: Each service has separate pricing APIs

**Use case**: Quote a complete package (hotel + tours + guide + vehicle + meals)
```
Current:
- 5 separate API calls to different endpoints
- Frontend calculates total
- Currency conversions in frontend
- No bundled discounts

Need:
POST /api/pricing/quote
{
  "hotel": { "id": 123, "check_in": "2025-12-20", "nights": 5 },
  "tours": [ { "id": 45, "date": "2025-12-21", "pax": 4 } ],
  "guide": { "id": 67, "dates": ["2025-12-21", "2025-12-22"] }
}
Response: Unified quote with itemized pricing, taxes, discounts, total
```

#### 8. **No Contract Management**
**Problem**: Provider contracts not formalized

**Missing**:
- Contract validity periods
- Committed rates
- Payment terms
- Volume discounts
- SLA definitions

#### 9. **Limited FX Management**
**Problem**: Currency is just a 3-letter code, no rate storage

**Missing**:
- Exchange rate history
- Rate updates from external APIs
- FX locking on quote acceptance
- Multi-currency reporting
- Automatic conversions

#### 10. **No Min/Max PAX Rules**
**Problem**: Tour pricing has fixed PAX counts (2,4,6,8,10) only

**Missing**:
- What if client wants 3 PAX? 7 PAX? 15 PAX?
- Min PAX to operate tour
- Max capacity limits
- Price interpolation for odd PAX counts

---

## Phase 4 Implementation Plan

### Priority 1: Essential Fixes (Week 1) 🔥

#### 1.1 Add Date-Based Season Selection
**Add new API endpoint**: `/api/{service}-pricing/for-date`

```typescript
GET /api/hotel-pricing/for-date?hotel_id=123&date=2025-12-25

Query logic:
SELECT * FROM hotel_pricing
WHERE hotel_id = ?
  AND status = 'active'
  AND ? BETWEEN start_date AND end_date
ORDER BY effective_from DESC
LIMIT 1;
```

**Handles overlaps**: Most recent `effective_from` wins

#### 1.2 Add Season Overlap Validation
**Add database constraint or API validation**:

```javascript
// Before INSERT/UPDATE, check for overlaps
const overlaps = await query(`
  SELECT id, season_name, start_date, end_date
  FROM hotel_pricing
  WHERE hotel_id = ?
    AND status = 'active'
    AND id != ?
    AND (
      (? BETWEEN start_date AND end_date) OR
      (? BETWEEN start_date AND end_date) OR
      (start_date BETWEEN ? AND ?)
    )
`, [hotel_id, id, new_start_date, new_end_date, new_start_date, new_end_date]);

if (overlaps.length > 0) {
  return {
    error: 'Season overlaps with existing season: ' + overlaps[0].season_name,
    conflicting_seasons: overlaps
  };
}
```

#### 1.3 Add Missing Indexes
**Performance optimization**:

```sql
-- Speed up date-based queries
CREATE INDEX idx_hotel_pricing_dates ON hotel_pricing(hotel_id, status, start_date, end_date);
CREATE INDEX idx_tour_pricing_dates ON tour_pricing(tour_id, status, start_date, end_date);
CREATE INDEX idx_guide_pricing_dates ON guide_pricing(guide_id, status, start_date, end_date);
CREATE INDEX idx_vehicle_pricing_dates ON vehicle_pricing(vehicle_id, status, start_date, end_date);
```

### Priority 2: Rate Plans & Availability (Week 2) 📊

#### 2.1 Create Rate Plans Table
**New table**: `rate_plans`

```sql
CREATE TABLE rate_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pricing_type ENUM('hotel','tour','guide','vehicle','entrance_fee','meal','flight'),
  pricing_id INT NOT NULL, -- FK to specific pricing table

  -- Rate plan details
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Advanced rules
  min_pax INT,
  max_pax INT,
  min_nights INT, -- for hotels
  max_nights INT,
  min_advance_booking_days INT, -- book at least X days ahead
  max_advance_booking_days INT, -- book no more than X days ahead

  -- Cancellation policy
  free_cancellation_days INT, -- free cancel until X days before
  cancellation_fee_percentage DECIMAL(5,2),
  cancellation_fee_flat DECIMAL(10,2),
  no_show_fee_percentage DECIMAL(5,2),

  -- Payment terms
  deposit_percentage DECIMAL(5,2),
  deposit_due_days INT,
  full_payment_due_days INT,

  -- Metadata
  status ENUM('active','inactive','archived') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Composite index for lookups
  INDEX idx_pricing_lookup (pricing_type, pricing_id, status)
);
```

#### 2.2 Create Blackout Dates Table
**New table**: `blackout_dates`

```sql
CREATE TABLE blackout_dates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pricing_type ENUM('hotel','tour','guide','vehicle','entrance_fee','meal','flight'),
  pricing_id INT NOT NULL,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255),

  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_blackout_lookup (pricing_type, pricing_id, start_date, end_date)
);
```

#### 2.3 Create Availability Table
**New table**: `availability`

```sql
CREATE TABLE availability (
  id INT PRIMARY KEY AUTO_INCREMENT,
  resource_type ENUM('hotel_room','tour_seat','guide','vehicle'),
  resource_id INT NOT NULL,

  date DATE NOT NULL,

  -- Capacity tracking
  total_capacity INT NOT NULL,
  available_capacity INT NOT NULL,
  reserved_capacity INT NOT NULL,

  -- Status
  status ENUM('available','limited','sold_out','closed') GENERATED ALWAYS AS (
    CASE
      WHEN available_capacity = 0 THEN 'sold_out'
      WHEN available_capacity <= total_capacity * 0.2 THEN 'limited'
      ELSE 'available'
    END
  ) STORED,

  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_resource_date (resource_type, resource_id, date),
  INDEX idx_date_status (date, status)
);
```

#### 2.4 Create APIs for Rate Plans
```typescript
POST   /api/rate-plans                    // Create rate plan
GET    /api/rate-plans                    // List all rate plans
GET    /api/rate-plans/{id}               // Get specific rate plan
PUT    /api/rate-plans/{id}               // Update rate plan
DELETE /api/rate-plans/{id}               // Archive rate plan

POST   /api/blackout-dates                // Add blackout date
GET    /api/blackout-dates                // List blackout dates
DELETE /api/blackout-dates/{id}           // Remove blackout date

GET    /api/availability                  // Check availability
POST   /api/availability/reserve          // Reserve capacity
POST   /api/availability/release          // Release reserved capacity
```

### Priority 3: Contracts & Tax Codes (Week 2-3) 📑

#### 3.1 Create Contracts Table
**New table**: `provider_contracts`

```sql
CREATE TABLE provider_contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider_id INT NOT NULL,
  provider_type ENUM('hotel','tour_operator','guide','transport','restaurant'),

  -- Contract details
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Validity
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT FALSE,

  -- Financial terms
  currency VARCHAR(3) NOT NULL,
  payment_terms_days INT, -- Net 30, Net 60, etc.
  credit_limit DECIMAL(12,2),

  -- Pricing
  rate_type ENUM('fixed','variable','volume_discount'),
  volume_discount_tiers JSON, -- [{"min_volume": 100, "discount_percent": 10}]

  -- SLA
  cancellation_notice_days INT,
  penalties JSON,

  -- Status
  status ENUM('draft','active','expired','terminated') DEFAULT 'draft',

  -- Documents
  contract_file_url VARCHAR(500),
  notes TEXT,

  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_provider (provider_type, provider_id, status),
  INDEX idx_validity (start_date, end_date, status)
);
```

#### 3.2 Create Tax Codes Table
**New table**: `tax_codes`

```sql
CREATE TABLE tax_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) UNIQUE NOT NULL, -- VAT18, TOURISM_TAX, GST
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Tax calculation
  rate_percentage DECIMAL(5,2) NOT NULL,
  calculation_type ENUM('percentage','flat','tiered') DEFAULT 'percentage',

  -- Applicability
  applicable_countries JSON, -- ["TR","EU"]
  applicable_services JSON, -- ["hotel","tour","guide"]

  -- Accounting
  tax_authority VARCHAR(100),
  gl_account VARCHAR(50),

  -- Validity
  valid_from DATE NOT NULL,
  valid_until DATE,

  status ENUM('active','inactive') DEFAULT 'active',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_code_status (code, status),
  INDEX idx_validity (valid_from, valid_until, status)
);
```

#### 3.3 Link Tax Codes to Pricing
**Alter existing pricing tables**:

```sql
ALTER TABLE hotel_pricing ADD COLUMN tax_code_id INT AFTER currency;
ALTER TABLE tour_pricing ADD COLUMN tax_code_id INT AFTER currency;
ALTER TABLE guide_pricing ADD COLUMN tax_code_id INT AFTER currency;
ALTER TABLE vehicle_pricing ADD COLUMN tax_code_id INT AFTER currency;
ALTER TABLE entrance_fee_pricing ADD COLUMN tax_code_id INT AFTER currency;
ALTER TABLE meal_pricing ADD COLUMN tax_code_id INT AFTER currency;
```

#### 3.4 Create APIs
```typescript
POST   /api/contracts                     // Create contract
GET    /api/contracts                     // List contracts
GET    /api/contracts/{id}                // Get contract
PUT    /api/contracts/{id}                // Update contract
DELETE /api/contracts/{id}                // Terminate contract

POST   /api/tax-codes                     // Create tax code
GET    /api/tax-codes                     // List tax codes
GET    /api/tax-codes/{code}              // Get tax code
PUT    /api/tax-codes/{id}                // Update tax code
```

### Priority 4: Unified Pricing Engine (Week 3) 🚀

#### 4.1 Create Unified Quote API
**New endpoint**: `POST /api/pricing/quote`

```typescript
interface QuoteRequest {
  organization_id: number;
  quote_date: string; // YYYY-MM-DD
  currency_preference?: string; // Desired output currency

  items: QuoteItem[];
}

interface QuoteItem {
  type: 'hotel' | 'tour' | 'guide' | 'vehicle' | 'entrance_fee' | 'meal' | 'flight';
  item_id: number;

  // Dates
  start_date: string;
  end_date?: string;

  // Quantities
  pax?: number;
  rooms?: number;
  nights?: number;

  // Options
  meal_plan?: 'BB' | 'HB' | 'FB' | 'AI';
  room_type?: 'single' | 'double' | 'triple';
  tour_type?: 'SIC' | 'PVT';
}

interface QuoteResponse {
  quote_id: string; // For locking rates
  valid_until: string; // Quote expiry
  currency: string;

  items: QuoteItemResponse[];

  subtotal: Money;
  taxes: TaxBreakdown[];
  total_tax: Money;
  discounts: DiscountBreakdown[];
  total_discount: Money;
  grand_total: Money;

  fx_rates_used: FXRate[];
  locked: boolean;
}
```

**Logic**:
1. For each item, call the appropriate pricing API with `/for-date` endpoint
2. Check rate plans and blackout dates
3. Check availability
4. Apply min/max PAX rules
5. Calculate taxes based on tax codes
6. Apply contract-based volume discounts
7. Convert currencies if needed
8. Store quote in database for locking

#### 4.2 Create Currency Exchange Table
**New table**: `currency_rates`

```sql
CREATE TABLE currency_rates (
  id INT PRIMARY KEY AUTO_INCREMENT,

  base_currency VARCHAR(3) NOT NULL,
  quote_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(12,6) NOT NULL,

  effective_date DATE NOT NULL,
  source VARCHAR(50), -- 'manual', 'ecb', 'fixer.io'

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_rate (base_currency, quote_currency, effective_date),
  INDEX idx_currencies (base_currency, quote_currency, effective_date)
);
```

#### 4.3 Create Quote Storage Table
**New table**: `quotes`

```sql
CREATE TABLE quotes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  organization_id INT NOT NULL,

  -- Quote data
  quote_data JSON NOT NULL, -- Full QuoteResponse

  -- Currency locking
  base_currency VARCHAR(3) NOT NULL,
  fx_locked BOOLEAN DEFAULT FALSE,
  fx_lock_expires_at TIMESTAMP,

  -- Status
  status ENUM('draft','issued','accepted','expired','cancelled') DEFAULT 'draft',
  valid_until TIMESTAMP NOT NULL,

  -- Conversion tracking
  accepted_at TIMESTAMP,
  booking_id INT, -- If converted to booking

  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_organization (organization_id, status),
  INDEX idx_status (status, valid_until)
);
```

#### 4.4 Create APIs
```typescript
POST   /api/pricing/quote                 // Generate quote
GET    /api/pricing/quotes                // List quotes
GET    /api/pricing/quotes/{quote_number} // Get specific quote
POST   /api/pricing/quotes/{quote_number}/lock  // Lock FX rates
POST   /api/pricing/quotes/{quote_number}/accept // Accept quote
DELETE /api/pricing/quotes/{quote_number} // Cancel quote

GET    /api/currencies/rates              // List FX rates
POST   /api/currencies/rates              // Add/update rate
GET    /api/currencies/convert            // Convert amount
```

---

## Database Migration Strategy

### Step 1: Add New Tables (Non-Breaking)
```bash
npm run db:migrate -- create_rate_plans
npm run db:migrate -- create_blackout_dates
npm run db:migrate -- create_availability
npm run db:migrate -- create_contracts
npm run db:migrate -- create_tax_codes
npm run db:migrate -- create_currency_rates
npm run db:migrate -- create_quotes
```

### Step 2: Add Columns to Existing Tables (Non-Breaking)
```bash
npm run db:migrate -- add_tax_code_to_pricing_tables
npm run db:migrate -- add_rate_plan_references
```

### Step 3: Create Indexes
```bash
npm run db:migrate -- add_pricing_date_indexes
```

### Step 4: Backfill Data
```bash
# Seed default tax codes
npm run db:seed -- tax_codes

# Seed currency rates
npm run db:seed -- currency_rates
```

---

## API Implementation Priority

### Week 1: Core Fixes ✅
- [ ] Add `/api/{service}-pricing/for-date` endpoints (all 7 services)
- [ ] Add season overlap validation to all pricing POST/PUT endpoints
- [ ] Create database indexes for date queries
- [ ] Update API documentation

### Week 2: Rate Plans & Availability 📊
- [ ] Create rate_plans, blackout_dates, availability tables
- [ ] Implement `/api/rate-plans` CRUD
- [ ] Implement `/api/blackout-dates` CRUD
- [ ] Implement `/api/availability` endpoints
- [ ] Update frontend to support rate plans

### Week 3: Contracts & Pricing Engine 🚀
- [ ] Create provider_contracts, tax_codes, currency_rates, quotes tables
- [ ] Implement `/api/contracts` CRUD
- [ ] Implement `/api/tax-codes` CRUD
- [ ] Implement `/api/currencies/*` endpoints
- [ ] Implement `/api/pricing/quote` endpoint
- [ ] Add quote management UI

---

## Testing Strategy

### Unit Tests
```bash
npm run test -- pricing-for-date.test.ts
npm run test -- season-overlap-validation.test.ts
npm run test -- rate-plans.test.ts
npm run test -- availability-tracking.test.ts
npm run test -- unified-quote-engine.test.ts
npm run test -- currency-conversion.test.ts
```

### Integration Tests
```bash
npm run test:e2e -- quote-workflow.test.ts
npm run test:e2e -- availability-booking.test.ts
npm run test:e2e -- contract-pricing.test.ts
```

---

## Performance Considerations

### Caching Strategy
```typescript
// Cache currency rates (TTL: 1 hour)
GET /api/currencies/rates -> Redis cache

// Cache availability (TTL: 5 minutes)
GET /api/availability?date=X&resource=Y -> Redis cache

// Cache compiled quotes (TTL: valid_until)
GET /api/pricing/quotes/{quote_number} -> Redis cache
```

### Query Optimization
- All date range queries use indexes
- Availability queries use composite indexes
- Quote generation uses prepared statements
- Currency conversions cached in memory

---

## Security Considerations

1. **Rate Plan Permissions**: Only admins can create/modify rate plans
2. **Contract Access**: Restrict contract viewing by organization
3. **FX Rate Integrity**: Audit log all FX rate changes
4. **Quote Locking**: Prevent manipulation after acceptance
5. **Availability Race Conditions**: Use database transactions for reservations

---

## Breaking Changes

**None!** All Phase 4 additions are backwards-compatible:
- Existing pricing APIs continue to work
- New endpoints are additive
- Optional tax_code_id columns (nullable)
- Rate plans are optional enhancements

---

## Estimated Effort

| Component | Effort | Priority |
|-----------|--------|----------|
| Date-based pricing endpoints | 2 days | P1 - Week 1 |
| Overlap validation | 1 day | P1 - Week 1 |
| Rate plans & blackout dates | 3 days | P2 - Week 2 |
| Availability tracking | 2 days | P2 - Week 2 |
| Contracts management | 2 days | P2 - Week 2 |
| Tax codes | 2 days | P2 - Week 2-3 |
| Currency management | 2 days | P3 - Week 3 |
| Unified quote engine | 4 days | P3 - Week 3 |
| Testing & documentation | 2 days | All weeks |
| **Total** | **20 days** | **3 weeks** |

---

## Success Metrics

After Phase 4 completion:
- ✅ All pricing queries use date-based selection (no manual frontend filtering)
- ✅ Zero season overlaps in production database
- ✅ 100% of services have rate plans defined
- ✅ Real-time availability tracking for all resources
- ✅ Unified quote API generates 95%+ of quotes
- ✅ FX rates update automatically from external source
- ✅ Quote acceptance locks rates for 48 hours
- ✅ All tax codes properly configured per jurisdiction

---

## Next Steps

1. **Review this document** with stakeholders
2. **Prioritize features** - Do we need all of Phase 4 or start with P1+P2?
3. **Create implementation tickets** in your project management tool
4. **Set up development environment** for Phase 4
5. **Start with Week 1 priorities** (date-based pricing + overlap validation)

---

## Questions for Discussion

1. **Currency Management**: Do you want automatic FX rate updates from external API (ECB, Fixer.io) or manual entry?
2. **Availability Tracking**: Should we implement full inventory management or just capacity tracking?
3. **Tax Codes**: Which jurisdictions/tax rules need to be supported initially?
4. **Quote Validity**: Default quote expiry period (24h, 48h, 7 days)?
5. **FX Lock Duration**: How long should currency rates be locked after quote acceptance?
6. **Volume Discounts**: Do you have existing contract-based discount structures to migrate?
7. **Blackout Dates**: Should blackout dates override all bookings or just block new bookings?

---

**Ready to proceed?** Let me know which priorities you'd like to tackle first, or if you want me to start implementing Week 1 essentials immediately.
