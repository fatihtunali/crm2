# Phase 6: Payments & Integration - Analysis

**Goal:** Payment processing, external integrations, financial accuracy

**Timeline:** 2 weeks (Week 11-13)

---

## What We Have Already ✅

### Database Tables (Ready)
1. ✅ **invoices_receivable** (21 columns)
   - Customer invoices with payment tracking
   - Fields: paid_amount, payment_date, payment_method, payment_reference
   - Status: draft, sent, partial, paid, overdue, cancelled

2. ✅ **invoices_payable** (23 columns)
   - Supplier invoices with payment tracking
   - Currency support: currency, original_amount, exchange_rate
   - Fields: paid_amount, payment_date, payment_method, payment_reference
   - Status: pending, partial, paid, overdue

3. ✅ **payment_methods** table
   - Store available payment methods

4. ✅ **exchange_rates** table
   - Currency conversion rates (22 pairs seeded)

5. ✅ **currency_rates** table
   - Historical FX rate tracking

6. ✅ **booking_cancellations** table
   - Refund tracking fields: refund_amount, refund_status

### API Endpoints (Partially Ready)
1. ✅ **POST /api/invoices/receivable/{id}/payment**
   - Records customer payments
   - Idempotency: checkIdempotencyKeyDB, storeIdempotencyKeyDB
   - Rate limiting: 20 payments/hour per user
   - Overpayment validation
   - Status: PRODUCTION READY

2. ✅ **POST /api/invoices/payable/{id}/payment**
   - Records supplier payments
   - Idempotency: checkIdempotencyKeyDB, storeIdempotencyKeyDB
   - Rate limiting: 20 payments/hour per user
   - Overpayment validation
   - Status: PRODUCTION READY

3. ✅ **GET /api/invoices/receivable** & **GET /api/invoices/payable**
   - List invoices with filtering
   - Status: PRODUCTION READY

4. ✅ **POST /api/invoices/generate**
   - Generate invoices from bookings
   - Status: PRODUCTION READY

### Libraries & Utilities (Ready)
1. ✅ **src/lib/money.ts**
   - Money format functions (minor units)
   - createMoney, formatMoney utilities
   - Precision handling (no float arithmetic)

2. ✅ **Idempotency System**
   - Database-backed: idempotency_keys table
   - Functions: checkIdempotencyKeyDB, storeIdempotencyKeyDB
   - 24-hour retention

3. ✅ **Rate Limiting**
   - globalRateLimitTracker
   - Per-user payment limits (20/hour)

4. ✅ **Audit Logging**
   - audit_logs table
   - All payment transactions logged

---

## What Needs to Be Built 🔨

### 1. Payment API Endpoints (NEW)

#### `/api/payments/receivable` (NEW)
**Purpose:** Unified customer payment endpoint (not tied to specific invoice)
- POST: Record payment (can apply to multiple invoices)
- GET: List all customer payments with filtering
- Features:
  - Multi-invoice payment allocation
  - Overpayment handling (create credit)
  - Payment method validation
  - Transaction tracking
  - Receipt generation

#### `/api/payments/payable` (NEW)
**Purpose:** Unified supplier payment endpoint
- POST: Record payment (can apply to multiple invoices)
- GET: List all supplier payments with filtering
- Features:
  - Multi-invoice payment allocation
  - Batch payment support
  - Currency conversion
  - Payment reconciliation

**Estimated Effort:** 2-3 days

---

### 2. Refund System (NEW)

#### `/api/invoices/receivable/{id}/refund` (NEW)
**Purpose:** Process refunds for customer invoices
- POST: Initiate refund
- Body:
  ```json
  {
    "amount": 10000, // minor units
    "currency": "EUR",
    "reason": "Cancellation policy",
    "refund_method": "original_method",
    "idempotency_key": "unique-key"
  }
  ```
- Features:
  - Partial/full refunds
  - Refund tracking (links to booking_cancellations)
  - Status tracking: pending → processing → completed/failed
  - Integration with cancellation policy
  - Audit trail

**Database Changes:**
```sql
CREATE TABLE payment_refunds (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  invoice_id INT NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_method VARCHAR(50),
  refund_reference VARCHAR(255),
  refund_status ENUM('pending', 'processing', 'completed', 'failed'),
  refund_reason TEXT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoice (invoice_id),
  INDEX idx_status (refund_status),
  FOREIGN KEY (invoice_id) REFERENCES invoices_receivable(id)
);
```

**Estimated Effort:** 2 days

---

### 3. Webhook System (NEW)

#### `/api/webhooks/payments/{provider}` (NEW)
**Purpose:** Receive payment notifications from PSPs (Stripe, PayPal, etc.)
- POST: Handle webhook from payment provider
- Features:
  - Signature verification
  - Event validation
  - Idempotency (prevent duplicate processing)
  - Status updates (payment_status, invoice_status)
  - Automatic reconciliation
  - Retry mechanism for failures

**Supported Providers:**
- Stripe
- PayPal
- Turkish PSPs (for Phase 8)

**Database Changes:**
```sql
CREATE TABLE webhook_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload TEXT NOT NULL,
  signature VARCHAR(255),
  status ENUM('pending', 'processing', 'completed', 'failed'),
  retry_count INT DEFAULT 0,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_id (event_id),
  INDEX idx_status (status),
  INDEX idx_provider (provider)
);
```

**Estimated Effort:** 3-4 days

---

### 4. Currency Validation Enforcement (ENHANCEMENT)

**Purpose:** Ensure currency consistency across all financial operations
- Validate currency on all payment endpoints
- Reject mismatched currencies (invoice vs payment)
- Automatic FX rate lookup when needed
- Lock exchange rates on booking confirmation

**Changes Required:**
1. Add middleware: `src/middleware/currency-validation.ts`
   - validateCurrency(amount, currency, expected_currency)
   - convertCurrency(amount, from_currency, to_currency, date)

2. Update existing endpoints:
   - POST /api/invoices/receivable/{id}/payment
   - POST /api/invoices/payable/{id}/payment
   - POST /api/bookings (currency locking)
   - POST /api/quotations (currency validation)

3. Add currency mismatch error:
   ```typescript
   ErrorCodes.CURRENCY_MISMATCH = 'CURRENCY_MISMATCH'
   // "Payment currency (USD) does not match invoice currency (EUR)"
   ```

**Estimated Effort:** 1-2 days

---

### 5. Payment State Machine (DOCUMENTATION)

**Purpose:** Document payment lifecycle and state transitions

**Payment States:**
```
pending → processing → completed
pending → processing → failed → retry_pending
partial → completed (after multiple payments)
```

**Refund States:**
```
pending → processing → completed
pending → processing → failed → manual_review
```

Create: `PAYMENT_STATE_MACHINES.md`
- Mermaid diagrams
- State transition rules
- Error codes for each transition
- Webhook event mapping

**Estimated Effort:** 1 day

---

## Phase 6 Deliverables Summary

| # | Deliverable | Status | Effort | Priority |
|---|-------------|--------|--------|----------|
| 1 | POST/GET /api/payments/receivable | ⏳ NEW | 2-3 days | HIGH |
| 2 | POST/GET /api/payments/payable | ⏳ NEW | 2-3 days | HIGH |
| 3 | POST /api/invoices/receivable/{id}/refund | ⏳ NEW | 2 days | HIGH |
| 4 | POST /api/webhooks/payments/{provider} | ⏳ NEW | 3-4 days | MEDIUM |
| 5 | Currency validation enforcement | ⏳ ENHANCE | 1-2 days | MEDIUM |
| 6 | Payment state machine docs | ⏳ NEW | 1 day | LOW |
| **TOTAL** | | **6 items** | **11-15 days** | |

---

## Current Readiness: 40%

### Already Complete (40%)
- ✅ Database schema (invoices_receivable, invoices_payable, payment_methods)
- ✅ Invoice payment endpoints (with idempotency, rate limiting)
- ✅ Money utilities (src/lib/money.ts)
- ✅ Exchange rates system (22 currency pairs)
- ✅ Audit logging for payments

### Still Needed (60%)
- ⏳ Unified payment endpoints (not invoice-specific)
- ⏳ Refund system with tracking
- ⏳ Webhook infrastructure for PSP integration
- ⏳ Currency validation middleware
- ⏳ Payment state machine documentation
- ⏳ Multi-invoice payment allocation

---

## Dependencies

### Phase 5 (COMPLETE) ✅
- ✅ Cancellation policy system → needed for refund calculations
- ✅ booking_cancellations table → stores refund_amount, refund_status

### External Services (TBD)
- Payment Service Providers (PSPs):
  - Stripe API keys
  - PayPal API credentials
  - Webhook secret keys
- Email service for payment receipts
- SMS service for payment notifications (optional)

---

## Implementation Approach

### Week 1 (Days 1-5):
1. **Day 1-2:** Build unified payment endpoints (/api/payments/receivable, /api/payments/payable)
2. **Day 3-4:** Implement refund system (/api/invoices/receivable/{id}/refund)
3. **Day 5:** Currency validation middleware

### Week 2 (Days 6-10):
1. **Day 6-8:** Webhook infrastructure (/api/webhooks/payments/{provider})
2. **Day 9:** Payment state machine documentation
3. **Day 10:** Testing, bug fixes, integration tests

---

## Testing Requirements

### Unit Tests
- Payment allocation logic
- Currency conversion
- Refund calculations
- Webhook signature verification

### Integration Tests
- Multi-invoice payment flow
- Partial payment → full payment transition
- Refund → invoice status update
- Webhook → payment reconciliation

### Manual Tests
- Stripe sandbox: test card payments
- PayPal sandbox: test PayPal payments
- Overpayment handling
- Currency mismatch errors

---

## Next Steps

1. **Decision:** Which PSP to integrate first?
   - Stripe (recommended - best docs, webhook reliability)
   - PayPal (popular, but complex webhook handling)
   - Turkish PSPs (needed for Phase 8)

2. **Decision:** Email service for receipts?
   - SendGrid
   - AWS SES
   - Resend

3. **Review:** Current payment endpoints for any security gaps
   - SQL injection tests
   - Authorization checks
   - Rate limiting effectiveness

---

**Status:** Ready to begin implementation
**Blockers:** None - all dependencies met
**Risk:** Medium (external PSP integration complexity)
