# Phase 1 Standards Migration - Provider Endpoints

## Overview
This document describes the Phase 1 standards applied to all 11 provider endpoint files.

## Files Updated
1. ✅ `src/app/api/hotels/route.ts` - COMPLETED
2. ⏳ `src/app/api/hotels/[id]/route.ts` - IN PROGRESS
3. ⏳ `src/app/api/guides/route.ts`
4. ⏳ `src/app/api/guides/[id]/route.ts`
5. ⏳ `src/app/api/vehicles/route.ts`
6. ⏳ `src/app/api/vehicles/[id]/route.ts`
7. ⏳ `src/app/api/restaurants/route.ts`
8. ⏳ `src/app/api/transfers/route.ts`
9. ⏳ `src/app/api/providers/route.ts`
10. ⏳ `src/app/api/providers/[id]/route.ts`
11. ⏳ `src/app/api/suppliers/search/route.ts`

## Phase 1 Standards Applied

### 1. Standardized Imports
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  parseStandardPaginationParams,  // ← Changed from parsePaginationParams
  parseSortParams,
  buildStandardListResponse,       // ← Changed from buildPagedResponse
} from '@/lib/pagination';
import {
  buildWhereClause,
  buildSearchClause,
  buildQuery,
} from '@/lib/query-builder';
import {
  standardErrorResponse,           // ← Changed from errorResponse
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';  // ← NEW
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';  // ← NEW
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';
```

### 2. GET Method Pattern

```typescript
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);  // ← NEW: Request correlation
  const startTime = Date.now();             // ← NEW: Performance tracking

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'providers', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (100 requests per hour per user) ← NEW
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

    // 3. Parse pagination (supports both old and new format) ← CHANGED
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parseStandardPaginationParams(searchParams);

    // 4. Extract filters
    const filters: Record<string, any> = {
      'resource.organization_id': parseInt(tenantId)  // Security: Always filter by org
    };

    // 5. Parse search
    const searchTerm = searchParams.get('search') || searchParams.get('q') || '';

    // 6. Parse sort with whitelisted columns
    const sortParam = searchParams.get('sort') || '-created_at';
    const ALLOWED_COLUMNS = ['id', 'name', 'created_at', 'updated_at', 'status'];
    const orderBy = parseSortParams(sortParam, ALLOWED_COLUMNS) || 'resource.created_at DESC';

    // 7. Build WHERE clause ← CHANGED to use query-builder
    const whereClause = buildWhereClause(filters);

    // 8. Build search clause ← CHANGED to use query-builder
    const searchClause = buildSearchClause(searchTerm, ['resource.name', 'resource.city']);

    // 9. Build main query ← CHANGED to use buildQuery
    const baseQuery = `SELECT * FROM resources`;
    const { sql, params } = buildQuery(baseQuery, {
      where: whereClause,
      search: searchClause,
      orderBy,
      limit: pageSize,
      offset,
    });

    // 10. Execute query
    const rows = await query(sql, params);

    // 11. Get total count
    const countBaseQuery = 'SELECT COUNT(*) as count FROM resources';
    const { sql: countSql, params: countParams } = buildQuery(countBaseQuery, {
      where: whereClause,
      search: searchClause,
    });

    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.count || 0;

    // 12. Build base URL for hypermedia links ← NEW
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // 13. Extract applied filters for metadata ← NEW
    const appliedFilters: Record<string, any> = {};
    if (searchTerm) appliedFilters.search = searchTerm;

    // 14. Build standardized response with hypermedia ← CHANGED
    const responseData = buildStandardListResponse(
      rows,
      total,
      page,
      pageSize,
      baseUrl,
      appliedFilters
    );

    // 15. Create response with headers ← NEW
    const response = NextResponse.json(responseData);
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);

    // 16. Log response ← NEW
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      results_count: (rows as any[]).length,
      total_results: total,
      page,
      page_size: pageSize,
    });

    return response;
  } catch (error: any) {
    // Log error ← NEW
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(  // ← CHANGED from errorResponse
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred',
      500,
      undefined,
      requestId
    );
  }
}
```

### 3. POST Method Pattern

```typescript
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);  // ← NEW
  const startTime = Date.now();             // ← NEW

  try {
    // 1. Authenticate
    const authResult = await requirePermission(request, 'providers', 'create');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (50 creates per hour per user) ← NEW
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_create`,
      50,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Creation rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

    // 3. Check for Idempotency-Key header ← IMPROVED
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (idempotencyKey) {
      const existing = await query(
        'SELECT * FROM resources WHERE idempotency_key = ? AND organization_id = ?',
        [idempotencyKey, parseInt(tenantId)]
      ) as any[];

      if (existing.length > 0) {
        const existingResource = existing[0];

        logResponse(requestId, 201, Date.now() - startTime, {
          user_id: user.userId,
          tenant_id: tenantId,
          resource_id: existingResource.id,
          idempotent: true,
        });

        const response = NextResponse.json(existingResource, {
          status: 201,
          headers: { 'Location': `/api/resources/${existingResource.id}` },
        });
        response.headers.set('X-Request-Id', requestId);
        addRateLimitHeaders(response, rateLimit);
        return response;
      }
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const { name, description } = body;

    // 5. Validation ← CHANGED to use validationErrorResponse
    const validationErrors: Array<{ field: string; issue: string; message?: string }> = [];

    if (!name || name.trim() === '') {
      validationErrors.push({
        field: 'name',
        issue: 'required',
        message: 'Name is required'
      });
    }

    if (validationErrors.length > 0) {
      return validationErrorResponse(
        'Invalid request data',
        validationErrors,
        requestId
      );
    }

    // 6. Insert with idempotency key
    const insertFields = ['organization_id', 'name', 'description', 'status'];
    const insertValues = [parseInt(tenantId), name, description, 'active'];

    if (idempotencyKey) {
      insertFields.push('idempotency_key');
      insertValues.push(idempotencyKey);
    }

    const placeholders = insertValues.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO resources (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    const insertId = (result as any).insertId;

    // 7. Fetch created resource
    const [createdResource] = await query(
      'SELECT * FROM resources WHERE id = ?',
      [insertId]
    ) as any[];

    // 8. AUDIT: Log creation ← KEPT (existing RBAC and audit)
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_CREATED,
      AuditResources.PROVIDER,
      insertId.toString(),
      { name, description },
      { status: 'active' },
      request
    );

    // 9. Log response ← NEW
    logResponse(requestId, 201, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      resource_id: insertId,
    });

    // 10. Return 201 Created ← IMPROVED with headers
    const response = NextResponse.json(createdResource, {
      status: 201,
      headers: { 'Location': `/api/resources/${insertId}` },
    });
    response.headers.set('X-Request-Id', requestId);
    addRateLimitHeaders(response, rateLimit);
    return response;

  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create resource',
      500,
      undefined,
      requestId
    );
  }
}
```

### 4. PUT Method Pattern

```typescript
export async function PUT(request: NextRequest) {
  const requestId = getRequestId(request);  // ← NEW
  const startTime = Date.now();             // ← NEW

  try {
    const authResult = await requirePermission(request, 'providers', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return validationErrorResponse(  // ← CHANGED
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Resource ID is required' }],
        requestId
      );
    }

    // Fetch existing for audit trail
    const [existingResource] = await query(
      'SELECT * FROM resources WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingResource) {
      return standardErrorResponse(  // ← CHANGED
        ErrorCodes.NOT_FOUND,
        'Resource not found',
        404,
        undefined,
        requestId
      );
    }

    // Update
    await query(
      `UPDATE resources SET name = ?, description = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [updateFields.name, updateFields.description, updateFields.status, id, parseInt(tenantId)]
    );

    // AUDIT: Log update ← KEPT
    const changes: Record<string, any> = {};
    if (updateFields.name !== existingResource.name) changes.name = updateFields.name;
    if (updateFields.status !== existingResource.status) changes.status = updateFields.status;

    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_UPDATED,
      AuditResources.PROVIDER,
      id.toString(),
      changes,
      { fields_updated: Object.keys(changes) },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {  // ← NEW
      user_id: user.userId,
      tenant_id: tenantId,
      resource_id: id,
    });

    const response = NextResponse.json({ success: true });
    response.headers.set('X-Request-Id', requestId);  // ← NEW
    return response;

  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update resource',
      500,
      undefined,
      requestId
    );
  }
}
```

### 5. DELETE Method Pattern

```typescript
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);  // ← NEW
  const startTime = Date.now();             // ← NEW

  try {
    const authResult = await requirePermission(request, 'providers', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    const { id } = await request.json();

    if (!id) {
      return validationErrorResponse(  // ← CHANGED
        'Invalid request data',
        [{ field: 'id', issue: 'required', message: 'Resource ID is required' }],
        requestId
      );
    }

    // Fetch existing for audit trail
    const [existingResource] = await query(
      'SELECT * FROM resources WHERE id = ? AND organization_id = ?',
      [id, parseInt(tenantId)]
    ) as any[];

    if (!existingResource) {
      return standardErrorResponse(  // ← CHANGED
        ErrorCodes.NOT_FOUND,
        'Resource not found',
        404,
        undefined,
        requestId
      );
    }

    // Soft delete
    await query(
      'UPDATE resources SET status = ? WHERE id = ? AND organization_id = ?',
      ['inactive', id, parseInt(tenantId)]
    );

    // AUDIT: Log deletion ← KEPT
    await auditLog(
      parseInt(tenantId),
      user.userId,
      AuditActions.PROVIDER_DELETED,
      AuditResources.PROVIDER,
      id.toString(),
      { status: 'inactive', previous_status: existingResource.status },
      { deletion_type: 'soft_delete' },
      request
    );

    logResponse(requestId, 200, Date.now() - startTime, {  // ← NEW
      user_id: user.userId,
      tenant_id: tenantId,
      resource_id: id,
    });

    const response = NextResponse.json({ success: true });
    response.headers.set('X-Request-Id', requestId);  // ← NEW
    return response;

  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete resource',
      500,
      undefined,
      requestId
    );
  }
}
```

## Key Changes Summary

### Import Changes
- ❌ `parsePaginationParams` → ✅ `parseStandardPaginationParams`
- ❌ `buildPagedResponse` → ✅ `buildStandardListResponse`
- ❌ `errorResponse` → ✅ `standardErrorResponse`
- ✨ Added: `getRequestId`, `logRequest`, `logResponse`
- ✨ Added: `addRateLimitHeaders`, `globalRateLimitTracker`
- ✨ Added: `validationErrorResponse`, `ErrorCodes`

### Request Handling
- ✨ Added request ID correlation (`X-Request-Id` header)
- ✨ Added rate limiting (100 GET, 50 POST per hour)
- ✨ Added request/response logging with timing
- ✨ Added standardized error responses with error codes

### Response Format
- ✨ Hypermedia links (self, first, prev, next, last)
- ✨ Standardized pagination (`page[size]`, `page[number]`)
- ✨ Applied filters in metadata
- ✨ Rate limit headers (`X-RateLimit-*`)

### Validation & Errors
- ✨ Structured validation errors with field-level details
- ✨ Error codes (`RATE_LIMIT_EXCEEDED`, `NOT_FOUND`, etc.)
- ✨ Consistent error response format

### Security & Audit
- ✅ RBAC kept intact (existing `requirePermission`)
- ✅ Audit logging kept intact (existing `auditLog`)
- ✅ Tenant isolation maintained
- ✨ Enhanced with request correlation

## Testing Checklist

After applying changes to each endpoint:

### GET Endpoints
- [ ] Pagination with `page[size]` and `page[number]`
- [ ] Hypermedia links in response
- [ ] Search with `?search=term` or `?q=term`
- [ ] Filters applied correctly
- [ ] Rate limiting works (returns 429 after limit)
- [ ] `X-Request-Id` header present
- [ ] `X-RateLimit-*` headers present

### POST Endpoints
- [ ] Idempotency with `Idempotency-Key` header
- [ ] Validation errors properly formatted
- [ ] `201 Created` with `Location` header
- [ ] Audit log entry created
- [ ] Rate limiting works

### PUT Endpoints
- [ ] Update validation
- [ ] Audit log with change tracking
- [ ] 404 for non-existent resources

### DELETE Endpoints
- [ ] Soft delete (status='inactive')
- [ ] Audit log entry created
- [ ] 404 for non-existent resources

## Rate Limit Configuration

Current settings:
- **GET requests**: 100 per hour per user
- **POST requests**: 50 per hour per user
- **PUT requests**: No specific limit (uses general auth limits)
- **DELETE requests**: No specific limit (uses general auth limits)

Adjust as needed in each endpoint.

## Next Steps

1. ✅ Complete hotels/route.ts (DONE)
2. ⏳ Apply to hotels/[id]/route.ts
3. ⏳ Apply to guides/route.ts and guides/[id]/route.ts
4. ⏳ Apply to vehicles/route.ts and vehicles/[id]/route.ts
5. ⏳ Apply to restaurants/route.ts
6. ⏳ Apply to transfers/route.ts
7. ⏳ Apply to providers/route.ts and providers/[id]/route.ts
8. ⏳ Apply to suppliers/search/route.ts
9. 🧪 Test all endpoints
10. 📝 Update API documentation
