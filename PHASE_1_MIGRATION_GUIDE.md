# Phase 1: Foundation & Standards - Migration Guide

**Status:** ✅ Core utilities implemented
**Date:** 2025-11-05
**Estimated migration time per endpoint:** 15-30 minutes

---

## What's New in Phase 1

### 1. Standardized Pagination (`page[size]` and `page[number]`)

**Old format:**
```
GET /api/quotations?page=2&pageSize=25
```

**New standardized format:**
```
GET /api/quotations?page[size]=25&page[number]=2
```

**Backward compatible:** Both formats work!

### 2. Standardized List Responses

**Old response:**
```json
{
  "data": [...],
  "total": 100,
  "page": 2,
  "limit": 25,
  "totalPages": 4
}
```

**New standardized response:**
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "size": 25,
    "total": 100,
    "total_pages": 4,
    "filters": {
      "status": "active",
      "city": "Istanbul"
    }
  },
  "links": {
    "self": "https://api.example.com/api/quotations?page[size]=25&page[number]=2&status=active",
    "first": "https://api.example.com/api/quotations?page[size]=25&page[number]=1&status=active",
    "prev": "https://api.example.com/api/quotations?page[size]=25&page[number]=1&status=active",
    "next": "https://api.example.com/api/quotations?page[size]=25&page[number]=3&status=active",
    "last": "https://api.example.com/api/quotations?page[size]=25&page[number]=4&status=active"
  }
}
```

**Benefits:**
- Self-documenting with hypermedia links
- Easier frontend implementation (just follow links for pagination)
- Consistent across all endpoints
- Includes applied filters in metadata

### 3. Standardized Error Responses

**Old error response (RFC 7807):**
```json
{
  "type": "https://httpstatuses.com/404",
  "title": "Not Found",
  "status": 404,
  "detail": "Quotation with ID 123 not found"
}
```

**New standardized error response:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Quotation with ID 123 not found",
    "request_id": "req_abc123",
    "type": "https://api.crm2.com/problems/not-found"
  }
}
```

**With validation errors:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "check_in",
        "issue": "before_check_out",
        "message": "Check-in date must be before check-out date"
      },
      {
        "field": "email",
        "issue": "invalid_format",
        "message": "Invalid email address format"
      }
    ],
    "request_id": "req_abc123",
    "type": "https://api.crm2.com/problems/validation-error"
  }
}
```

**Benefits:**
- Machine-readable error codes
- Request correlation IDs for debugging
- Structured validation errors
- Consistent error handling across all endpoints

### 4. Request Correlation IDs

**All responses now include:**
```
X-Request-Id: uuid-abc-123-def-456
```

**Benefits:**
- Easy debugging across logs
- Request tracing in distributed systems
- Client can pass their own request ID

### 5. Rate Limit Headers

**All responses include rate limit information:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699123456
```

**When rate limit exceeded:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699123456
Retry-After: 3600
```

### 6. Health Check Endpoints

**Basic health check:**
```bash
GET /api/health

Response:
{
  "status": "healthy",
  "timestamp": "2025-11-05T12:00:00.000Z",
  "service": "CRM API",
  "version": "1.0.0"
}
```

**Dependency health check:**
```bash
GET /api/health/deps

Response:
{
  "status": "healthy",
  "timestamp": "2025-11-05T12:00:00.000Z",
  "service": "CRM API",
  "version": "1.0.0",
  "check_duration_ms": 45,
  "dependencies": [
    {
      "name": "database",
      "status": "healthy",
      "response_time_ms": 42,
      "details": {
        "host": "134.209.137.11",
        "port": 3306,
        "database": "crm_db"
      }
    },
    {
      "name": "anthropic_ai",
      "status": "healthy",
      "details": {
        "configured": true
      }
    }
  ]
}
```

---

## Migration Steps for Each Endpoint

### Step 1: Import New Utilities

**Add to your route file:**
```typescript
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import {
  standardErrorResponse,
  notFoundErrorResponse,
  validationErrorResponse,
  ErrorCodes
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
```

### Step 2: Add Request Correlation

**At the start of your handler:**
```typescript
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  // Optional: Log request for debugging
  logRequest(request, requestId);

  try {
    // ... your logic
  } finally {
    // Optional: Log response
    logResponse(requestId, 200, Date.now() - startTime);
  }
}
```

### Step 3: Update Pagination Parsing

**Old:**
```typescript
const { searchParams } = new URL(request.url);
const { page, pageSize, offset } = parsePaginationParams(searchParams);
```

**New (backward compatible):**
```typescript
const { searchParams } = new URL(request.url);
const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);
```

### Step 4: Update Response Building

**Old:**
```typescript
const quotes = await query('SELECT * FROM quotes LIMIT ? OFFSET ?', [pageSize, offset]);
const [{ count: total }] = await query('SELECT COUNT(*) as count FROM quotes');

return NextResponse.json(buildPagedResponse(quotes, total, page, pageSize));
```

**New:**
```typescript
const quotes = await query('SELECT * FROM quotes LIMIT ? OFFSET ?', [pageSize, offset]);
const [{ count: total }] = await query('SELECT COUNT(*) as count FROM quotes');

// Build base URL for links
const url = new URL(request.url);
const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

// Extract filters from query params
const filters: Record<string, any> = {};
if (searchParams.get('status')) filters.status = searchParams.get('status');
if (searchParams.get('city')) filters.city = searchParams.get('city');

const response = NextResponse.json(
  buildStandardListResponse(quotes, total, page, pageSize, baseUrl, filters)
);

// Add request ID header
response.headers.set('X-Request-Id', requestId);

return response;
```

### Step 5: Update Error Handling

**Old:**
```typescript
if (!quote) {
  return errorResponse(notFoundProblem(`Quote ${id} not found`));
}
```

**New:**
```typescript
if (!quote) {
  return notFoundErrorResponse(`Quote ${id} not found`, requestId);
}
```

**Validation errors (old):**
```typescript
if (!email || !isValidEmail(email)) {
  return errorResponse(badRequestProblem('Invalid email'));
}
```

**Validation errors (new):**
```typescript
const errors: Array<{ field: string; issue: string; message?: string }> = [];

if (!email) {
  errors.push({ field: 'email', issue: 'required', message: 'Email is required' });
} else if (!isValidEmail(email)) {
  errors.push({ field: 'email', issue: 'invalid_format', message: 'Invalid email format' });
}

if (errors.length > 0) {
  return validationErrorResponse('Invalid request data', errors, requestId);
}
```

### Step 6: Add Rate Limiting (Optional)

**For endpoints that need rate limiting:**
```typescript
// Track request and check rate limit
const userId = user.userId.toString(); // or IP address, email, etc.
const rateLimit = globalRateLimitTracker.trackRequest(
  userId,
  100,  // max 100 requests
  3600  // per hour (3600 seconds)
);

// Check if rate limit exceeded
if (rateLimit.remaining === 0) {
  return rateLimitErrorResponse(
    `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60)} minutes.`,
    rateLimit.reset,
    requestId
  );
}

// ... process request

// Add rate limit headers to response
const response = NextResponse.json(data);
addRateLimitHeaders(response, rateLimit);
response.headers.set('X-Request-Id', requestId);
return response;
```

---

## Complete Example: Migrated Endpoint

Here's a complete example of a migrated endpoint with all Phase 1 features:

```typescript
/**
 * GET /api/quotations
 * List quotations with standardized pagination and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireTenant } from '@/middleware/tenancy';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import {
  standardErrorResponse,
  notFoundErrorResponse,
  ErrorCodes
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';

export async function GET(request: NextRequest) {
  // 1. Get request correlation ID
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 2. Authenticate and get tenant
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      );
    }
    const { tenantId, user } = tenantResult;

    // 3. Rate limiting (100 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      100,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // 4. Parse pagination (supports both old and new format)
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 5. Extract filters
    const filters: Record<string, any> = {};
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');

    let sql = 'SELECT * FROM quotes WHERE organization_id = ?';
    const params: any[] = [parseInt(tenantId)];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
      filters.status = status;
    }

    if (customerId) {
      sql += ' AND customer_id = ?';
      params.push(parseInt(customerId));
      filters.customer_id = customerId;
    }

    // 6. Execute queries
    const quotes = await query(
      `${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [{ count: total }] = await query(
      `SELECT COUNT(*) as count FROM quotes WHERE organization_id = ?${status ? ' AND status = ?' : ''}${customerId ? ' AND customer_id = ?' : ''}`,
      params
    );

    // 7. Build response with hypermedia links
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    const responseData = buildStandardListResponse(
      quotes,
      total,
      page,
      pageSize,
      baseUrl,
      filters
    );

    // 8. Create response with headers
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // 9. Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: quotes.length,
    });

    return response;
  } catch (error: any) {
    // Log error
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred',
      500,
      undefined,
      requestId
    );
  }
}
```

---

## Testing Your Migrated Endpoint

### Test pagination (old format - still works):
```bash
curl "http://localhost:3000/api/quotations?page=2&pageSize=10"
```

### Test pagination (new format):
```bash
curl "http://localhost:3000/api/quotations?page[size]=10&page[number]=2"
```

### Test with filters:
```bash
curl "http://localhost:3000/api/quotations?page[size]=25&page[number]=1&status=active&customer_id=5"
```

### Check headers:
```bash
curl -i "http://localhost:3000/api/quotations" | grep -E "(X-Request-Id|X-RateLimit)"
```

### Test health checks:
```bash
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/health/deps"
```

---

## Rollout Strategy

### Phase 1A: Low-Risk Endpoints (Week 1)
Start with read-only, low-traffic endpoints:
- `/api/dashboard/*` - Dashboard endpoints
- `/api/reports/*` - Report endpoints (read-only)

### Phase 1B: Core Resources (Week 2)
Migrate high-traffic CRUD endpoints:
- `/api/quotations`
- `/api/clients`
- `/api/agents`
- `/api/hotels`, `/api/guides`, `/api/vehicles`

### Phase 1C: Financial Endpoints (Week 3)
Migrate critical financial endpoints:
- `/api/invoices/receivable`
- `/api/invoices/payable`
- `/api/finance/*`

### Phase 1D: Admin & Auth (Week 4)
Complete migration with admin and auth endpoints:
- `/api/admin/*`
- `/api/auth/*` (already using some standards)
- `/api/users`

---

## Checklist for Each Endpoint

- [ ] Import new utilities (`pagination`, `response`, `correlation`, `rateLimit`)
- [ ] Add request correlation ID (`getRequestId`)
- [ ] Update pagination parsing (`parseStandardPaginationParams`)
- [ ] Update response building (`buildStandardListResponse`)
- [ ] Update error responses (`standardErrorResponse`, etc.)
- [ ] Add rate limiting (if needed)
- [ ] Add X-Request-Id header to all responses
- [ ] Add rate limit headers (if rate limited)
- [ ] Test old pagination format (backward compatibility)
- [ ] Test new pagination format
- [ ] Test with filters
- [ ] Test error responses
- [ ] Test rate limiting (if applicable)
- [ ] Update OpenAPI documentation

---

## Monitoring & Debugging

### View Request Logs
All requests are logged with correlation IDs:
```
[REQUEST] {
  request_id: 'uuid-abc-123',
  method: 'GET',
  path: '/api/quotations',
  query: { status: 'active' },
  user_agent: 'Mozilla/5.0...',
  ip: '192.168.1.1',
  timestamp: '2025-11-05T12:00:00.000Z'
}

[RESPONSE] {
  request_id: 'uuid-abc-123',
  status: 200,
  duration_ms: 145,
  timestamp: '2025-11-05T12:00:00.145Z',
  user_id: 5,
  tenant_id: 1,
  results_count: 25
}
```

### Monitor Health
```bash
# Basic health
watch -n 5 'curl -s http://localhost:3000/api/health | jq'

# Dependency health
watch -n 30 'curl -s http://localhost:3000/api/health/deps | jq'
```

### Track Rate Limits
Check response headers:
```bash
curl -i "http://localhost:3000/api/quotations" | grep X-RateLimit
```

---

## Benefits Summary

### For Developers
- ✅ Consistent API patterns
- ✅ Easy debugging with request IDs
- ✅ Clear error codes
- ✅ Self-documenting responses (hypermedia)

### For Frontend
- ✅ Predictable response format
- ✅ Easy pagination (just follow links)
- ✅ Better error handling
- ✅ Rate limit visibility

### For Operations
- ✅ Health check endpoints for monitoring
- ✅ Request tracing across systems
- ✅ Rate limit protection
- ✅ Better observability

---

## Next Steps

After Phase 1 completion:
1. **Generate TypeScript SDK** from OpenAPI spec
2. **Set up monitoring** using health check endpoints
3. **Move to Phase 2:** Enhanced Auth & Audit
4. **Gradually migrate** all 85+ endpoints

---

**Need Help?**
- See `/src/lib/pagination.ts` for pagination utilities
- See `/src/lib/response.ts` for error response utilities
- See `/src/middleware/correlation.ts` for request correlation
- See `/src/middleware/rateLimit.ts` for rate limiting
- See complete example above for reference implementation
