# Phase 1 Standards - Completion Guide

## Current Status: 4 of 63 Endpoints Complete

### What Has Been Done

**Completed Endpoints (4):**
1. ✅ `src/app/api/clients/route.ts` - Full Phase 1 implementation
2. ✅ `src/app/api/clients/[id]/route.ts` - Full Phase 1 implementation
3. ✅ `src/app/api/bookings/route.ts` - Full Phase 1 implementation
4. ✅ `src/app/api/bookings/[id]/route.ts` - Full Phase 1 implementation

All 4 files now have:
- ✅ Request correlation IDs (getRequestId, logResponse)
- ✅ Rate limiting with proper limits and headers
- ✅ Standardized pagination (buildStandardListResponse)
- ✅ Standardized errors (standardErrorResponse, validationErrorResponse, ErrorCodes)
- ✅ Standard headers (addStandardHeaders)

## Remaining Work: 59 Endpoints

### Priority Order

#### PRIORITY 1: Invoice Endpoints (6 files) - CRITICAL
These handle financial data and need immediate attention:
- `src/app/api/invoices/payable/route.ts`
- `src/app/api/invoices/receivable/route.ts`
- `src/app/api/invoices/payable/[id]/route.ts`
- `src/app/api/invoices/receivable/[id]/route.ts`
- `src/app/api/invoices/payable/[id]/payment/route.ts`
- `src/app/api/invoices/receivable/[id]/payment/route.ts`

#### PRIORITY 2: Quotation Sub-routes (5 files)
- `src/app/api/quotations/[id]/route.ts`
- `src/app/api/quotations/[id]/status/route.ts`
- `src/app/api/quotations/[id]/days/route.ts`
- `src/app/api/quotations/[id]/expenses/route.ts`
- `src/app/api/quotations/[id]/generate-itinerary/route.ts`

#### PRIORITY 3: Dashboard Endpoints (3 files) - PARTIAL UPDATE ONLY
These already have correlation IDs, just need rate limiting:
- `src/app/api/dashboard/stats/route.ts`
- `src/app/api/dashboard/recent-requests/route.ts`
- `src/app/api/dashboard/upcoming-tours/route.ts`

**Quick fix for each:**
1. Add import: `import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';`
2. Add rate limiting after auth (100 req/hour for GET)
3. Add `addRateLimitHeaders(response, rateLimit);` before return

#### PRIORITY 4: Users & Requests (4 files)
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/requests/route.ts`
- `src/app/api/requests/[id]/route.ts`

#### PRIORITY 5: Providers (14 files)
- Hotels, Guides, Vehicles, Restaurants, Transfers, Providers, Suppliers

#### PRIORITY 6: Reports (22 files)
- All report endpoints (largest category, lower priority)

#### PRIORITY 7: Admin (3 files)
- Admin utilities

## How to Apply Phase 1 to Each File

### Step-by-Step Template

For every file, follow this pattern (use `quotations/route.ts` as reference):

#### 1. Update Imports
```typescript
// OLD imports to replace:
import { successResponse, errorResponse, notFoundProblem, ... } from '@/lib/response';
import { parsePaginationParams } from '@/lib/pagination';

// NEW imports:
import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
```

#### 2. Add to Method Start
```typescript
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const authResult = await requirePermission(request, 'resource', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Rate limiting (100 requests per hour for GET)
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

    // ... rest of method
```

#### 3. Replace Pagination (list endpoints only)
```typescript
// OLD:
const { page, pageSize, offset } = parsePaginationParams(searchParams);
const response = buildPagedResponse(data, total, page, pageSize);

// NEW:
const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);
const url = new URL(request.url);
const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
const responseData = buildStandardListResponse(data, total, page, pageSize, baseUrl, appliedFilters);
```

#### 4. Replace Error Responses
```typescript
// OLD:
return errorResponse(notFoundProblem('Not found', request.url));
return errorResponse(badRequestProblem('Invalid data', request.url));
return errorResponse(internalServerErrorProblem('Error', request.url));

// NEW:
return standardErrorResponse(ErrorCodes.NOT_FOUND, 'Not found', 404, undefined, requestId);
return validationErrorResponse('Invalid data', [{field, issue, message}], requestId);
return standardErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Error', 500, undefined, requestId);
```

#### 5. Update Success Responses
```typescript
// OLD:
return successResponse(data);

// NEW:
logResponse(requestId, 200, Date.now() - startTime, {
  user_id: user.userId,
  tenant_id: tenantId,
  results_count: data.length,
});

const response = NextResponse.json(data);
addRateLimitHeaders(response, rateLimit); // if rate limiting applied
addStandardHeaders(response, requestId);
return response;
```

#### 6. Update Catch Blocks
```typescript
catch (error: any) {
  logResponse(requestId, 500, Date.now() - startTime, {
    error: error.message,
  });

  return standardErrorResponse(
    ErrorCodes.INTERNAL_ERROR,
    'Descriptive error message',
    500,
    undefined,
    requestId
  );
}
```

## Rate Limits by Method

| Method | Limit | Window | Key Suffix |
|--------|-------|--------|------------|
| GET    | 100   | 3600s  | (none)     |
| POST   | 50    | 3600s  | `_create`  |
| PUT    | 50    | 3600s  | `_update`  |
| PATCH  | 50    | 3600s  | `_update`  |
| DELETE | 20    | 3600s  | `_delete`  |

## Quick Validation Checklist

For each updated file, verify:

- [ ] Imports include: `getRequestId, logResponse, standardErrorResponse, ErrorCodes, addStandardHeaders`
- [ ] If list endpoint: `parseStandardPaginationParams, buildStandardListResponse`
- [ ] If mutating endpoint: `addRateLimitHeaders, globalRateLimitTracker`
- [ ] Each method has: `const requestId = getRequestId(request); const startTime = Date.now();`
- [ ] Rate limiting is applied (except for simple GET single resource)
- [ ] All error responses use `standardErrorResponse` or `validationErrorResponse`
- [ ] All success responses have `addStandardHeaders(response, requestId)`
- [ ] All methods log response: `logResponse(requestId, statusCode, Date.now() - startTime, metadata)`
- [ ] No old functions: `errorResponse`, `successResponse`, `notFoundProblem`, `badRequestProblem`

## Files Created

1. `PHASE1_MIGRATION_STATUS.md` - Detailed checklist of all 63 endpoints
2. `PHASE1_COMPLETION_GUIDE.md` - This file, step-by-step guide
3. `scripts/migrate-phase1.js` - Automated migration script (manual review recommended)
4. `update-phase1-endpoints.py` - Python migration script

## Testing After Updates

```bash
# 1. Check TypeScript compilation
npm run build

# 2. Test critical endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clients
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/quotations
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/bookings

# 3. Check rate limit headers in response
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clients

# Should see:
# X-Request-Id: <uuid>
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: <timestamp>
```

## Common Pitfalls to Avoid

1. ❌ Don't remove existing RBAC (`requirePermission`) - keep it
2. ❌ Don't remove audit logging (`auditLog`) - keep it
3. ❌ Don't change the business logic - only update infrastructure
4. ❌ Don't skip requestId parameter in error responses
5. ❌ Don't forget to add rate limit headers to responses
6. ❌ Don't use old pagination functions in list endpoints

## Estimated Time

- Invoice endpoints (6 files): 30-45 minutes
- Quotation sub-routes (5 files): 25-35 minutes
- Dashboard quick fixes (3 files): 10 minutes
- Users/Requests (4 files): 20-30 minutes
- Providers (14 files): 60-90 minutes
- Reports (22 files): 90-120 minutes
- Admin (3 files): 15-20 minutes

**Total estimated time: 4-6 hours for manual updates**

## Recommendation

### Immediate Actions (Next 2 Hours)
1. ✅ Complete invoice endpoints (highest business impact)
2. ✅ Update dashboard endpoints (quick wins)
3. ✅ Complete quotation sub-routes
4. ✅ Update users/requests endpoints

### Next Session
5. Update provider endpoints (14 files)
6. Update report endpoints (22 files)
7. Update admin endpoints (3 files)
8. Run full TypeScript compilation
9. Run integration tests
10. Deploy to staging

## Reference Implementation

**Perfect Example:** `src/app/api/quotations/route.ts`

This file demonstrates ALL Phase 1 standards correctly:
- Request correlation IDs ✅
- Rate limiting with headers ✅
- Standardized pagination ✅
- Standardized errors ✅
- Standard headers ✅
- Proper logging ✅

Copy this pattern to all other endpoints!
