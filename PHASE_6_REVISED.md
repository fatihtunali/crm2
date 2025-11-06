# Phase 6: Manual Payment Tracking & Email Notifications - Revised Plan

**Goal:** Track manual payments (bank transfers + payment links), send email notifications via Brevo

**Timeline:** 1-1.5 weeks (7-10 days) - REDUCED from 2 weeks

---

## Implementation Approach: Manual Payment Tracking

### Payment Methods
1. **Bank Transfer** - Manual entry by staff after bank confirmation
2. **Credit Card Payment Link** - External payment gateway, manual confirmation with reference number

### Email System
- **Brevo** (already in use) - Send payment receipts, invoices, refund confirmations

---

## Phase 6 Deliverables - REVISED

### 1. Payment Recording Enhancement (2 days) ⚡ SIMPLIFIED

**Enhance existing endpoints:**
- ✅ POST `/api/invoices/receivable/{id}/payment` - ALREADY EXISTS
- ✅ POST `/api/invoices/payable/{id}/payment` - ALREADY EXISTS

**Add payment method validation:**
```typescript
// Add to existing endpoints
enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD_LINK = 'credit_card_link',
  CASH = 'cash',
  CHEQUE = 'cheque'
}

interface PaymentRequest {
  amount: number; // minor units
  currency: string;
  payment_method: PaymentMethod;
  payment_reference: string; // Bank reference or payment link transaction ID
  payment_date: string; // YYYY-MM-DD
  notes?: string;
  idempotency_key: string;
}
```

**Changes:**
- Add `payment_method` enum validation
- Require `payment_reference` for tracking
- Add `payment_date` (can be backdated for bank transfers)

---

### 2. Payment List API (1 day) 🆕

**GET `/api/payments/receivable`**
- List all customer payments across all invoices
- Filters: date_from, date_to, payment_method, status
- Aggregation: total_received, total_pending

**GET `/api/payments/payable`**
- List all supplier payments across all invoices
- Filters: date_from, date_to, payment_method, provider_id
- Aggregation: total_paid, total_pending

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "payment_id": 123,
      "invoice_id": 456,
      "invoice_number": "INV-2025-001",
      "customer_name": "John Doe",
      "amount": 50000,
      "currency": "EUR",
      "payment_method": "bank_transfer",
      "payment_reference": "TRX-20251106-001",
      "payment_date": "2025-11-06",
      "status": "completed",
      "created_at": "2025-11-06T10:00:00Z"
    }
  ],
  "summary": {
    "total_received": 150000,
    "total_pending": 50000,
    "currency": "EUR"
  }
}
```

---

### 3. Refund System (2 days) 🆕

**POST `/api/invoices/receivable/{id}/refund`**
```json
{
  "amount": 10000,
  "currency": "EUR",
  "refund_method": "bank_transfer",
  "refund_reference": "REF-20251106-001",
  "reason": "Booking cancellation",
  "idempotency_key": "unique-key"
}
```

**Features:**
- Links to `booking_cancellations` table (use existing refund_amount, refund_status)
- Status tracking: pending → processing → completed
- Email notification via Brevo
- Partial/full refund support

**Database:**
```sql
-- Add to existing booking_cancellations table (already has refund fields)
ALTER TABLE booking_cancellations
  ADD COLUMN refund_method VARCHAR(50) NULL,
  ADD COLUMN refund_reference VARCHAR(255) NULL,
  ADD COLUMN refund_processed_by INT NULL,
  ADD COLUMN refund_completed_at TIMESTAMP NULL;
```

---

### 4. Brevo Email Integration (2-3 days) 🆕

**Install Brevo SDK:**
```bash
npm install @getbrevo/brevo
```

**Create Email Service: `src/lib/email-brevo.ts`**
```typescript
import * as brevo from '@getbrevo/brevo';

export class BrevoEmailService {
  private apiInstance: brevo.TransactionalEmailsApi;

  constructor() {
    const apiKey = brevo.ApiClient.instance.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY;
    this.apiInstance = new brevo.TransactionalEmailsApi();
  }

  async sendPaymentReceipt(payment: Payment, invoice: Invoice) {
    const sendSmtpEmail = {
      to: [{ email: invoice.customer_email, name: invoice.customer_name }],
      templateId: 1, // Brevo template ID
      params: {
        customer_name: invoice.customer_name,
        invoice_number: invoice.invoice_number,
        amount: formatMoney(payment.amount),
        payment_reference: payment.payment_reference,
        payment_date: payment.payment_date
      }
    };
    return await this.apiInstance.sendTransacEmail(sendSmtpEmail);
  }

  async sendInvoice(invoice: Invoice) { /* ... */ }
  async sendRefundConfirmation(refund: Refund) { /* ... */ }
  async sendPaymentReminder(invoice: Invoice) { /* ... */ }
}
```

**Email Templates (Create in Brevo Dashboard):**
1. Payment Receipt
2. Invoice Notification
3. Refund Confirmation
4. Payment Reminder (overdue)
5. Booking Voucher (already have PDF)

**Integration Points:**
- POST `/api/invoices/receivable/{id}/payment` → sendPaymentReceipt()
- POST `/api/invoices/generate` → sendInvoice()
- POST `/api/invoices/receivable/{id}/refund` → sendRefundConfirmation()
- GET `/api/bookings/{id}/voucher` → sendBookingVoucher() (attach PDF)

---

### 5. Currency Validation Middleware (1 day) 🆕

**Create: `src/middleware/currency-validation.ts`**
```typescript
export function validatePaymentCurrency(
  paymentCurrency: string,
  invoiceCurrency: string
): { valid: boolean; error?: string } {
  if (paymentCurrency !== invoiceCurrency) {
    return {
      valid: false,
      error: `Payment currency (${paymentCurrency}) does not match invoice currency (${invoiceCurrency})`
    };
  }
  return { valid: true };
}

export function validateCurrencyCode(currency: string): boolean {
  const validCurrencies = ['EUR', 'USD', 'GBP', 'TRY', 'CHF', 'CAD', 'AUD'];
  return validCurrencies.includes(currency);
}
```

**Apply to:**
- Payment recording endpoints
- Refund endpoints
- Invoice generation

---

### 6. Payment Dashboard API (1 day) 🆕

**GET `/api/finance/summary`** - ALREADY EXISTS ✅

**Enhance with payment tracking:**
```typescript
{
  "receivables": {
    "total_invoiced": 500000,
    "total_received": 350000,
    "total_pending": 150000,
    "overdue_amount": 50000
  },
  "payables": {
    "total_invoiced": 300000,
    "total_paid": 200000,
    "total_pending": 100000,
    "overdue_amount": 25000
  },
  "payments_this_month": {
    "received": 120000,
    "paid": 80000
  }
}
```

---

## Phase 6 Deliverables Summary - REVISED

| # | Deliverable | Status | Effort | Priority |
|---|-------------|--------|--------|----------|
| 1 | Enhance payment recording (add validation) | ⏳ ENHANCE | 2 days | HIGH |
| 2 | GET /api/payments/receivable & payable | ⏳ NEW | 1 day | HIGH |
| 3 | POST /api/invoices/receivable/{id}/refund | ⏳ NEW | 2 days | HIGH |
| 4 | Brevo email integration | ⏳ NEW | 2-3 days | HIGH |
| 5 | Currency validation middleware | ⏳ NEW | 1 day | MEDIUM |
| 6 | Payment dashboard enhancements | ⏳ ENHANCE | 1 day | LOW |
| **TOTAL** | | **6 items** | **9-11 days** | |

---

## Environment Setup

### Add to `.env`:
```bash
# Brevo Configuration
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=Your Company Name

# Email Template IDs (from Brevo dashboard)
BREVO_TEMPLATE_PAYMENT_RECEIPT=1
BREVO_TEMPLATE_INVOICE=2
BREVO_TEMPLATE_REFUND=3
BREVO_TEMPLATE_PAYMENT_REMINDER=4
BREVO_TEMPLATE_BOOKING_VOUCHER=5
```

### Get Brevo Credentials:
1. SSH to TQA server: `ssh root@[TQA_SERVER_IP]`
2. Get credentials: `cat /path/to/tqa/.env | grep BREVO`
3. Copy to local `.env` file

---

## Implementation Timeline - REVISED

### Week 1 (Days 1-7):
- **Day 1-2:** Enhance payment recording with validation
- **Day 3:** Payment list API (GET /api/payments/*)
- **Day 4-5:** Refund system
- **Day 6-7:** Brevo email integration

### Week 2 (Days 8-10):
- **Day 8:** Currency validation middleware
- **Day 9:** Payment dashboard enhancements
- **Day 10:** Testing & integration

---

## Simplified Architecture

```
Customer Payment Flow:
1. Customer pays via bank transfer or payment link
2. Staff receives bank confirmation / payment link confirmation
3. Staff enters payment in CRM: POST /api/invoices/receivable/{id}/payment
4. System validates currency, updates invoice status
5. System sends payment receipt via Brevo email
6. Invoice status changes: sent → partial/paid

Refund Flow:
1. Booking cancelled → cancellation_fee calculated (Phase 5)
2. Staff initiates refund: POST /api/invoices/receivable/{id}/refund
3. System creates refund record in booking_cancellations table
4. Finance team processes bank transfer
5. Staff marks refund as completed
6. System sends refund confirmation via Brevo email
```

---

## Testing Requirements

### Manual Tests
1. Record bank transfer payment with reference number
2. Record credit card link payment with transaction ID
3. Generate payment receipt email via Brevo
4. Process refund and verify email notification
5. Test currency mismatch validation
6. Test overpayment rejection

### Integration Tests
1. Payment → Invoice status update
2. Payment → Email notification
3. Refund → Booking cancellation link
4. Multi-currency invoice handling

---

## What's NOT Included (Future Phases)

❌ Automated webhook integration (Stripe, PayPal)
❌ Real-time payment gateway API calls
❌ Automatic bank statement reconciliation
❌ ACH/SEPA direct debit
❌ Recurring payment automation

These can be added later as Phase 6.5 if needed.

---

## Current Readiness: 50% → 60%

### Already Complete (60%)
- ✅ Database schema (invoices_receivable, invoices_payable)
- ✅ Payment recording endpoints with idempotency
- ✅ Money utilities
- ✅ Exchange rates system
- ✅ Audit logging
- ✅ booking_cancellations table with refund fields

### Still Needed (40%)
- ⏳ Payment method validation
- ⏳ Payment list API
- ⏳ Refund endpoint
- ⏳ Brevo email integration
- ⏳ Currency validation middleware

---

**Next Step:** Get Brevo credentials from TQA server, then start implementation!

**Estimated Completion:** 7-10 days (1-1.5 weeks)
