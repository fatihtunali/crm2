# Phase 3: Idempotency & Resilience - Implementation Plan

**Status:** In Progress
**Timeline:** 1 week (Week 5-6)
**Goal:** Production reliability - prevent duplicate operations, safer retries, better data lifecycle

---

## Deliverables

### 1️⃣ MySQL-Based Idempotency System
**Goal:** Replace in-memory idempotency storage with persistent MySQL table

**Tasks:**
- ✅ Schema already defined: `database-idempotency-table.sql`
- ⏳ Apply schema to production database
- ⏳ Update `src/middleware/idempotency.ts` to use MySQL
- ⏳ Add idempotency enforcement to all POST/PUT/PATCH endpoints

**Benefits:**
- Survives server restarts
- Works across multiple server instances (horizontal scaling)
- Persistent audit trail
- Automatic cleanup with TTL (24 hours)

**Schema:**
```sql
CREATE TABLE idempotency_keys (
  idempotency_key VARCHAR(255),
  organization_id INT,
  user_id INT,
  http_method ENUM,
  endpoint_path VARCHAR(500),
  response_status_code SMALLINT,
  response_body JSON,
  status ENUM('processing', 'completed', 'failed'),
  expires_at TIMESTAMP
);
```

---

### 2️⃣ Enforce Idempotency-Key Headers
**Goal:** Require idempotency keys on all write operations

**Endpoints to Update** (POST/PUT/PATCH only):
- `/api/quotations` (POST)
- `/api/quotations/[id]` (PUT/PATCH)
- `/api/quotations/[id]/status` (POST)
- `/api/invoices/*` (POST/PUT/PATCH)
- `/api/users` (POST)
- `/api/users/[id]` (PUT/PATCH)
- `/api/roles` (POST)
- `/api/roles/[id]` (PUT/PATCH)
- `/api/providers/*` (POST/PATCH)
- `/api/hotels/*`, `/api/guides/*`, etc. (POST/PATCH)
- All other write endpoints (40+ total)

**Implementation Pattern:**
```typescript
// At start of POST/PUT/PATCH handlers
const idempotencyKey = request.headers.get('Idempotency-Key');
if (idempotencyKey) {
  const cached = await checkIdempotencyKey(request, idempotencyKey, tenantId);
  if (cached) return cached;
}

// ... process request ...

// After successful response
if (idempotencyKey) {
  await storeIdempotencyKey(idempotencyKey, response, tenantId, user.userId);
}
```

**Enforcement Strategy:**
- Phase 3.1: Optional (add support, encourage use via docs)
- Phase 3.2: Warning (return `X-Idempotency-Missing: true` header)
- Phase 3.3: Required (return 400 if missing on POST/PUT/PATCH)

---

### 3️⃣ Consistent Soft Delete with archived_at
**Goal:** Add soft delete support across all resources

**Tables to Update:**
- `quotes` (quotations)
- `bookings`
- `users`
- `clients`
- `agents`
- `providers`
- `hotels`
- `guides`
- `vehicles`
- `daily_tours`
- `restaurants`
- `transfers`
- `entrance_fees`
- `extra_expenses`
- `roles` (custom roles only)
- `invoices_receivable`
- `invoices_payable`

**Schema Change:**
```sql
ALTER TABLE quotes ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE quotes ADD INDEX idx_archived_at (archived_at);
-- Repeat for all tables above
```

**Implementation:**
- Change DELETE endpoints to set `archived_at = NOW()`
- Keep existing DELETE logic for hard deletes (admin only)
- Update all GET queries to filter `WHERE archived_at IS NULL` by default

---

### 4️⃣ ?include_archived=true Support
**Goal:** Allow querying archived records

**Implementation:**
- Add query parameter parsing to all list endpoints
- Update WHERE clauses conditionally:
  ```typescript
  let whereClause = 'WHERE organization_id = ?';
  if (!includeArchived) {
    whereClause += ' AND archived_at IS NULL';
  }
  ```

**Endpoints to Update:**
- All list endpoints (GET /api/quotations, GET /api/users, etc.)
- All detail endpoints (GET /api/quotations/[id], etc.)

**Response Headers:**
- `X-Archived-Included: true` (when ?include_archived=true)
- `X-Archived-Count: 5` (number of archived items in response)

---

## Implementation Order

### Day 1-2: Database Schema
1. Apply `database-idempotency-table.sql`
2. Enable MySQL event scheduler
3. Verify tables created
4. Add `archived_at` to all tables

### Day 3-4: Idempotency Middleware
1. Update `src/middleware/idempotency.ts` to use MySQL
2. Add helper functions: `checkIdempotencyKeyDB`, `storeIdempotencyKeyDB`
3. Keep backward compatibility with in-memory (fallback)
4. Add unit tests

### Day 5-6: Soft Delete Implementation
1. Update DELETE endpoints to set `archived_at`
2. Add `?include_archived=true` support to GET endpoints
3. Add restore functionality (optional): POST /api/{resource}/{id}/restore
4. Update frontend to handle archived items

### Day 7: Testing & Documentation
1. Test idempotency with duplicate requests
2. Test soft delete and restore
3. Test `?include_archived=true` filtering
4. Update API documentation
5. Create migration guide

---

## Success Criteria

- ✅ `idempotency_keys` table exists and is functional
- ✅ All POST/PUT/PATCH endpoints support idempotency
- ✅ Duplicate requests return cached responses
- ✅ All resources support soft delete (`archived_at`)
- ✅ All list endpoints support `?include_archived=true`
- ✅ MySQL events cleaning up expired entries
- ✅ Build passing (0 TypeScript errors)
- ✅ All Phase 1 & 2 standards maintained

---

## Database Commands

### Apply Schema
```bash
mysql -h 134.209.137.11 -u crm -p crm_db < database-idempotency-table.sql
```

### Enable Event Scheduler
```sql
SET GLOBAL event_scheduler = ON;
```

### Verify Tables
```sql
SHOW TABLES LIKE '%idempotency%';
SHOW TABLES LIKE '%rate_limit%';
SHOW EVENTS WHERE Name LIKE 'cleanup%';
```

### Add archived_at to Tables
```sql
-- Run for each table
ALTER TABLE quotes ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE quotes ADD INDEX idx_archived_at (archived_at);
```

---

## Migration Guide

### For Backend Developers

**Before:**
```typescript
await query('DELETE FROM quotations WHERE id = ?', [id]);
```

**After:**
```typescript
await query('UPDATE quotations SET archived_at = NOW() WHERE id = ?', [id]);
```

**Optional - Restore:**
```typescript
await query('UPDATE quotations SET archived_at = NULL WHERE id = ?', [id]);
```

### For Frontend Developers

**Archived Badge:**
```tsx
{item.archived_at && (
  <span className="badge badge-gray">Archived</span>
)}
```

**Include Archived Toggle:**
```tsx
<Checkbox
  label="Show archived"
  onChange={(checked) => setIncludeArchived(checked)}
/>
```

---

## Next Steps After Phase 3

**Phase 4:** Advanced Supplier & Pricing
- Rate plans & contracts
- Availability management
- Unified pricing engine
- Tax code library

**Phase 5:** Booking Lifecycle
- Quote to booking conversion
- Voucher generation
- Cancellation policies
- State machine

---

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
