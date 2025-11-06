# Phase 5: Booking Lifecycle - Preparation Analysis

**Analysis Date**: November 6, 2025
**Current Phase**: Phase 4 Complete (4/8 phases)
**Next Phase**: Phase 5 - Booking Lifecycle

---

## Executive Summary

**Overall Readiness**: 🟢 **70% Ready** - Strong foundation with booking creation already working

Phase 5 (Booking Lifecycle) is **well-prepared** with significant foundational work already complete:
- ✅ Core booking creation from quotations (with FX locking and transactions)
- ✅ Booking management APIs (list, get, update status)
- ✅ AI-powered itinerary generation (needs restructuring)
- ✅ Database schema for bookings and quotations
- ✅ Idempotency support for booking creation
- ✅ Audit logging infrastructure

**Estimated Time to Complete**: 1.5-2 weeks (vs. original estimate of 2 weeks)

---

## What We Already Have ✅

### 1. Booking Creation Infrastructure (COMPLETE)

**File**: `src/lib/booking-lifecycle.ts`

✅ **`createBookingFromQuotation(quotationId)`** - Fully functional with:
- Quotation validation (checks status, prevents double-booking)
- Exchange rate locking (FX rate captured at booking time)
- Unique booking number generation (format: `BK-YYYYMMDD-XXXXX`)
- Database transaction support (ensures data consistency)
- Quote status update to 'accepted'
- Error handling with descriptive messages

**Code Quality**: Production-ready, well-documented, transaction-safe

---

### 2. Booking APIs (COMPLETE)

**Files**:
- `src/app/api/bookings/route.ts` (list + create)
- `src/app/api/bookings/[id]/route.ts` (get + update)

✅ **GET `/api/bookings`** - List all bookings
- Pagination support (standardized format)
- Rate limiting (100 requests/hour)
- Authentication and multi-tenancy
- Hypermedia links (HATEOAS)

✅ **POST `/api/bookings`** - Create booking from quotation
- **Idempotency-Key header required** (prevents duplicate bookings)
- Authentication and RBAC ('bookings:create' permission)
- Rate limiting (50 creates/hour)
- Comprehensive error handling (404 for missing quote, 409 for already accepted)
- Location header with `/api/bookings/{id}` URL

✅ **GET `/api/bookings/{id}`** - Get booking details
- Authentication and authorization
- Returns full booking record

✅ **PATCH `/api/bookings/{id}`** - Update booking status
- Status validation (only 'confirmed' or 'cancelled')
- Rate limiting (50 updates/hour)
- Authentication and authorization

**Code Quality**: Follows Phase 1 standards (standardized errors, correlation IDs, rate limits)

---

### 3. Quotation Status Management (PARTIAL)

**File**: `src/app/api/quotations/[id]/status/route.ts`

✅ **PUT `/api/quotations/{id}/status`** - Update quote status
- Status validation: draft, sent, accepted, rejected, expired
- **When status changes to 'accepted', automatically creates booking**
- Audit logging for status changes
- Returns both quote and booking when booking is created

**Note**: This effectively implements `/api/quotations/{id}/book` functionality

---

### 4. AI Itinerary Generation (EXISTS, NEEDS REFACTORING)

**File**: `src/app/api/quotations/[id]/generate-itinerary/route.ts`

✅ **POST `/api/quotations/{id}/generate-itinerary`** - AI-powered itinerary
- Uses Anthropic Claude AI for generation
- AI rate limiting (5 calls/hour per user)
- Idempotency support
- Authentication and authorization
- Creates quote_days and quote_expenses records
- Comprehensive audit logging

**Gap**: Phase 5 wants itinerary as a **sub-resource** (GET/PUT), not just generation (POST)

---

### 5. Database Schema (COMPLETE)

**Tables**:

✅ **`bookings` table** with:
- `id` (primary key)
- `quotation_id` (foreign key to quotes)
- `booking_number` (unique, format: BK-YYYYMMDD-XXXXX)
- `locked_exchange_rate` (decimal, FX rate at booking time)
- `currency` (VARCHAR, e.g., 'EUR', 'USD')
- `status` ('confirmed' or 'cancelled')
- `created_at`, `updated_at` (timestamps)

✅ **`quotes` table** with:
- Full quotation data (customer, destination, dates, pricing)
- `status` field (draft, sent, accepted, rejected, expired)
- `organization_id` for multi-tenancy
- `created_by_user_id` for audit trail
- `idempotency_key` for safe retries
- `archived_at` for soft deletes
- `pricing_table` (JSON) for pricing breakdown

✅ **`quote_days` table** with:
- Day-by-day itinerary breakdown
- Links to quotation

✅ **`quote_expenses` table** with:
- Expense items per day
- Links to quote_days

**Code Quality**: Schema is well-designed with proper foreign keys, indexes, and constraints

---

### 6. Supporting Infrastructure (COMPLETE)

✅ **Authentication & Authorization**
- `requirePermission` middleware working
- Permission checks: 'quotations:read/create/update/delete', 'bookings:read/create/update'

✅ **Idempotency**
- Database-backed idempotency (MySQL `idempotency_keys` table)
- Required for booking creation (prevents accidental duplicates)

✅ **Audit Logging**
- All quotation and booking operations logged
- Captures: user, action, changes, metadata

✅ **Rate Limiting**
- Global rate limiter with headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Different limits for read (100/hour), create (50/hour), delete (20/hour)

✅ **Standardized Responses**
- RFC 7807 error format
- Correlation IDs (`X-Request-Id`)
- Hypermedia links (HATEOAS)

✅ **Exchange Rate Management**
- `src/lib/exchange.ts` with `getLatestExchangeRate()` function
- Currency rates seeded in Phase 4 (22 pairs)

---

## What We Need to Build ❌

### Priority 1: Missing API Endpoints (1 week)

#### 1.1 `/api/quotations/{id}/duplicate` - Clone Quotation

**Status**: ❌ Not implemented

**Requirements**:
- POST endpoint to create a copy of an existing quotation
- Reset status to 'draft'
- Generate new quote_number
- Copy all quote_days and quote_expenses
- Allow optional modifications (dates, customer info)

**Complexity**: Low (2-3 hours)

**Dependencies**: None - uses existing quotations infrastructure

**Suggested Implementation**:
```typescript
// File: src/app/api/quotations/[id]/duplicate/route.ts
export async function POST(request, { params }) {
  // 1. Fetch original quotation with days and expenses
  // 2. Create new quotation with modified data
  // 3. Copy all quote_days
  // 4. Copy all quote_expenses
  // 5. Return new quotation
}
```

---

#### 1.2 `/api/quotations/{id}/reprice` - Reprice Quotation

**Status**: ❌ Not implemented

**Requirements**:
- POST endpoint to recalculate pricing for a quotation
- Query param: `?respect_locked=true/false`
- If `respect_locked=false`, fetch current rates from pricing tables
- If `respect_locked=true`, use locked FX rates from quotation
- Update `total_price` and `pricing_table` JSON
- Trigger pricing engine for each expense item

**Complexity**: Medium (1-2 days)

**Dependencies**:
- Needs pricing engine logic (may already exist in frontend)
- Requires access to all 7 pricing tables (hotel, tour, guide, vehicle, entrance, meal, flight)
- May need to create unified pricing service

**Suggested Implementation**:
```typescript
// File: src/app/api/quotations/[id]/reprice/route.ts
export async function POST(request, { params }) {
  // 1. Fetch quotation with all expenses
  // 2. Check respect_locked param
  // 3. For each expense:
  //    - Fetch current price from pricing table (or use locked rate)
  //    - Apply markup and tax
  //    - Calculate new total
  // 4. Update quotation.total_price and pricing_table
  // 5. Audit log the repricing
  // 6. Return updated quotation
}
```

**Note**: This may require building a pricing engine utility if one doesn't exist.

---

#### 1.3 `/api/quotations/{id}/itinerary` - Itinerary Sub-Resource

**Status**: ⚠️ Partial (POST generation exists, need GET/PUT)

**Current**: `POST /api/quotations/{id}/generate-itinerary` (AI generation)

**Requirements**:
- **GET** `/api/quotations/{id}/itinerary` - Retrieve existing itinerary
  - Returns quote_days and quote_expenses
  - Formatted for display/editing

- **PUT** `/api/quotations/{id}/itinerary` - Update itinerary
  - Update existing days/expenses
  - Add/remove days or expenses
  - Validate date ranges
  - Recalculate totals

**Complexity**: Low (4-6 hours)

**Dependencies**: None - uses existing quote_days and quote_expenses tables

**Suggested Implementation**:
```typescript
// File: src/app/api/quotations/[id]/itinerary/route.ts

export async function GET(request, { params }) {
  // 1. Fetch all quote_days with expenses
  // 2. Format and return as nested structure
}

export async function PUT(request, { params }) {
  // 1. Parse request body with updated itinerary
  // 2. Transaction: delete existing days/expenses
  // 3. Insert new days/expenses
  // 4. Update quotation total
  // 5. Return updated itinerary
}
```

---

#### 1.4 `/api/bookings/{id}/voucher` - PDF Voucher Generation

**Status**: ❌ Not implemented

**Requirements**:
- GET endpoint to generate PDF voucher for a booking
- Include: booking number, customer details, itinerary, pricing, QR code
- Return PDF file with proper headers (`Content-Type: application/pdf`)
- Cache generated PDFs (optional)

**Complexity**: Medium-High (2-3 days)

**Dependencies**:
- Need PDF generation library (e.g., `pdfkit`, `puppeteer`, or `@react-pdf/renderer`)
- May need to create PDF template
- Consider async generation for large bookings (Phase 7)

**Suggested Implementation**:
```typescript
// File: src/app/api/bookings/[id]/voucher/route.ts
import { generateVoucherPDF } from '@/lib/pdf-generator';

export async function GET(request, { params }) {
  // 1. Fetch booking with quotation and itinerary
  // 2. Generate PDF using template
  // 3. Return PDF with proper headers
  // 4. (Optional) Cache PDF for future requests
}
```

**Library Recommendation**: `@react-pdf/renderer` (React-based, good for server-side rendering)

---

#### 1.5 `/api/bookings/{id}/cancel` - Cancellation with Policies

**Status**: ⚠️ Partial (status update exists, no policy enforcement)

**Current**: `PATCH /api/bookings/{id}` with `status: 'cancelled'`

**Requirements**:
- POST endpoint for proper cancellation flow
- Check cancellation policy (from rate_plans or provider_contracts)
- Calculate cancellation fee based on days before travel
- Update booking status to 'cancelled'
- Record cancellation reason and fee
- Audit log the cancellation
- (Future) Trigger refund process

**Complexity**: Medium (1-2 days)

**Dependencies**:
- May need `cancellation_policies` table (or use existing `rate_plans.cancellation_policy_json`)
- May need `booking_cancellations` table to track cancellation details

**Suggested Implementation**:
```typescript
// File: src/app/api/bookings/[id]/cancel/route.ts
export async function POST(request, { params }) {
  // 1. Fetch booking with quotation
  // 2. Check if already cancelled
  // 3. Calculate days until travel start
  // 4. Fetch cancellation policy
  // 5. Calculate cancellation fee
  // 6. Update booking status
  // 7. Record cancellation details
  // 8. Audit log
  // 9. Return cancellation confirmation with fee
}
```

**Database Changes Needed**:
```sql
-- Option 1: Add columns to bookings table
ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT NULL;
ALTER TABLE bookings ADD COLUMN cancellation_fee DECIMAL(10,2) NULL;

-- Option 2: Create separate table (better for audit trail)
CREATE TABLE booking_cancellations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  cancelled_by_user_id INT NOT NULL,
  cancellation_reason TEXT,
  cancellation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  days_before_travel INT,
  policy_applied TEXT,
  cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id)
);
```

---

### Priority 2: Documentation (3-4 days)

#### 2.1 State Machine Documentation

**Status**: ❌ Not documented

**Requirements**:
- Document quotation state machine:
  - `draft` → `sent` → `accepted` → (creates booking)
  - `draft` → `expired` (if valid_to date passes)
  - `sent` → `rejected` (if customer declines)
  - Any → `expired` (soft delete)

- Document booking state machine:
  - `confirmed` (initial state after creation)
  - `confirmed` → `cancelled` (with cancellation policy)

- Diagram the flows
- Document allowed transitions
- Document side effects (e.g., 'accepted' creates booking)

**Complexity**: Low (4-6 hours)

**Suggested Format**: Mermaid diagrams + markdown documentation

---

#### 2.2 API Documentation Updates

**Status**: ⚠️ Partial (some endpoints documented, Phase 5 endpoints missing)

**Requirements**:
- Update OpenAPI/Swagger spec with all Phase 5 endpoints
- Add examples for each endpoint
- Document error cases
- Update Postman collection (if exists)

**Complexity**: Low (2-3 hours)

---

### Priority 3: Database Enhancements (Optional, 2-3 days)

#### 3.1 Booking Enhancements

**Suggested Changes**:
```sql
-- Add cancellation tracking
ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT NULL;
ALTER TABLE bookings ADD COLUMN cancellation_fee DECIMAL(10,2) NULL;

-- Add voucher tracking
ALTER TABLE bookings ADD COLUMN voucher_generated_at TIMESTAMP NULL;
ALTER TABLE bookings ADD COLUMN voucher_url VARCHAR(500) NULL;

-- Add supplier confirmation tracking
ALTER TABLE bookings ADD COLUMN supplier_confirmation_status ENUM('pending', 'confirmed', 'failed') DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN supplier_pnr VARCHAR(100) NULL;
ALTER TABLE bookings ADD COLUMN supplier_notes TEXT NULL;
```

---

#### 3.2 Cancellation Policies Table

**If not using rate_plans.cancellation_policy_json**:
```sql
CREATE TABLE cancellation_policies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rules JSON NOT NULL, -- [{days_before: 30, penalty_percent: 10}, {days_before: 7, penalty_percent: 50}]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Link to rate plans
ALTER TABLE rate_plans ADD COLUMN cancellation_policy_id INT NULL;
ALTER TABLE rate_plans ADD FOREIGN KEY (cancellation_policy_id) REFERENCES cancellation_policies(id);
```

---

## Implementation Roadmap

### Week 1: Core Endpoints (5 days)

**Day 1-2**:
- ✅ Implement `/api/quotations/{id}/duplicate`
- ✅ Write tests
- ✅ Update documentation

**Day 3-4**:
- ✅ Implement `/api/quotations/{id}/itinerary` (GET/PUT)
- ✅ Refactor existing generate-itinerary to work with new sub-resource
- ✅ Write tests

**Day 5**:
- ✅ Implement `/api/bookings/{id}/cancel` (with basic policy enforcement)
- ✅ Add database columns for cancellation tracking
- ✅ Write tests

---

### Week 2: Advanced Features (5 days)

**Day 1-3**:
- ✅ Implement `/api/quotations/{id}/reprice`
- ✅ Build pricing engine utility if needed
- ✅ Test with all 7 pricing tables
- ✅ Write tests

**Day 4-5**:
- ✅ Implement `/api/bookings/{id}/voucher`
- ✅ Set up PDF generation library
- ✅ Create voucher template
- ✅ Test PDF generation
- ✅ Write tests

---

### Week 2 (Parallel): Documentation (2-3 days)

**Day 1**:
- ✅ Document state machines (quotation + booking)
- ✅ Create Mermaid diagrams
- ✅ Document allowed transitions

**Day 2**:
- ✅ Update OpenAPI spec
- ✅ Add examples for all Phase 5 endpoints
- ✅ Document error cases

**Day 3**:
- ✅ Create Phase 5 completion document
- ✅ Update ROADMAP_ANALYSIS.md
- ✅ Write deployment guide

---

## Risk Assessment

### Low Risk ✅
- Duplicate quotation (simple data copy)
- Itinerary sub-resource (existing tables)
- State machine documentation (just docs)

### Medium Risk ⚠️
- Repricing logic (complexity depends on existing pricing engine)
- Cancellation policies (need to define policy rules)
- PDF voucher generation (new library dependency)

### High Risk 🔴
- **None identified** - All requirements are well within capabilities

---

## Dependencies & Prerequisites

### External Libraries Needed
1. **PDF Generation**:
   - Recommendation: `@react-pdf/renderer` (version ^3.4.0)
   - Alternative: `pdfkit` (lighter weight)

2. **QR Code** (for vouchers):
   - Recommendation: `qrcode` (version ^1.5.3)

### Internal Dependencies
- ✅ All pricing tables from Phase 4 (ready)
- ✅ Exchange rate system (ready)
- ✅ Idempotency system (ready)
- ✅ Audit logging (ready)
- ✅ Authentication & RBAC (ready)

---

## Testing Requirements

### Unit Tests
- Duplicate quotation logic
- Repricing calculations
- Cancellation fee calculations
- Itinerary validation

### Integration Tests
- Full booking creation flow
- Quote → Booking → Cancellation flow
- PDF voucher generation end-to-end
- Reprice with different locked rates

### API Tests
- All new endpoints with various scenarios
- Error cases (404, 409, 422)
- Idempotency key handling
- Rate limiting

---

## Success Criteria

Phase 5 will be considered **complete** when:

✅ **Endpoints**:
- [x] POST `/api/quotations/{id}/duplicate` working
- [x] POST `/api/quotations/{id}/reprice` working with locked rates
- [x] GET/PUT `/api/quotations/{id}/itinerary` working
- [x] GET `/api/bookings/{id}/voucher` generating PDFs
- [x] POST `/api/bookings/{id}/cancel` with policy enforcement

✅ **Documentation**:
- [x] State machine diagrams created
- [x] All transitions documented
- [x] OpenAPI spec updated
- [x] Examples provided for all endpoints

✅ **Testing**:
- [x] Unit tests passing (>80% coverage)
- [x] Integration tests passing
- [x] Manual testing completed
- [x] No breaking changes to existing functionality

✅ **Quality**:
- [x] All endpoints follow Phase 1 standards
- [x] Proper error handling
- [x] Audit logging for all operations
- [x] Rate limiting configured
- [x] Security review passed

---

## Estimated Effort Summary

| Task | Estimated Time | Complexity | Status |
|------|----------------|------------|--------|
| Duplicate quotation | 3 hours | Low | ❌ Not started |
| Itinerary sub-resource (GET/PUT) | 6 hours | Low | ⚠️ Partial (POST exists) |
| Repricing endpoint | 2 days | Medium | ❌ Not started |
| PDF voucher generation | 3 days | Medium | ❌ Not started |
| Cancellation with policies | 2 days | Medium | ⚠️ Partial (basic exists) |
| State machine documentation | 4 hours | Low | ❌ Not started |
| API documentation updates | 3 hours | Low | ❌ Not started |
| Database enhancements | 2 hours | Low | ❌ Not started |
| Testing (all endpoints) | 2 days | Medium | ❌ Not started |

**Total Estimated Time**: 1.5-2 weeks (7-10 working days)

**vs. Original Roadmap Estimate**: 2 weeks

**Efficiency Gain**: Already have 70% of foundation complete, saving ~3-4 days

---

## Recommended Starting Point

### Option A: User-Facing Features First (Recommended)
**Order**: Duplicate → Itinerary → Cancellation → Voucher → Reprice

**Rationale**: Deliver immediate user value
- Users can quickly duplicate quotes (saves time)
- Itinerary management improves UX
- Cancellation is critical for operations
- Voucher generation is highly visible
- Repricing can wait (manual workaround exists)

**Timeline**: Week 1 covers most critical features

---

### Option B: Technical Completeness First
**Order**: Reprice → Cancellation → Duplicate → Itinerary → Voucher

**Rationale**: Build complex logic first
- Repricing is most technically complex
- Cancellation requires policy engine
- Other features are straightforward

**Timeline**: Front-loads complexity

---

### Option C: Quick Wins First (Fastest ROI)
**Order**: Duplicate → Itinerary → Voucher → Cancellation → Reprice

**Rationale**: Ship features fast
- Duplicate is easiest (2-3 hours)
- Itinerary is simple refactor (6 hours)
- Get early feedback before complex features

**Timeline**: Show progress quickly

---

## Conclusion

**Phase 5 Readiness**: 🟢 **70% Complete**

We are in an **excellent position** to complete Phase 5 quickly:
- Core booking infrastructure is production-ready
- Database schema is solid
- Supporting systems (auth, audit, idempotency) are mature
- Only need to build 5 new endpoints + documentation

**Recommendation**: Start with **Option A (User-Facing First)** to deliver immediate business value while building momentum.

**Next Steps**:
1. Review this analysis with the team
2. Choose starting point (Option A recommended)
3. Install PDF library (`@react-pdf/renderer`)
4. Create Phase 5 task breakdown
5. Begin implementation

**Confidence Level**: 🟢 **High** - Well-prepared with clear path forward

---

**Prepared by**: Claude Code
**Date**: November 6, 2025
**Phase**: 5/8 (Booking Lifecycle)
**Status**: ✅ **READY TO START**
