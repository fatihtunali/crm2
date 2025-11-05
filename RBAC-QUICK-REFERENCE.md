# RBAC Quick Reference Guide

Quick copy-paste examples for implementing permission checks in your API endpoints.

## Import Statement

```typescript
import { requirePermission } from '@/middleware/permissions';
```

## Pattern 1: Single Permission Check (Most Common)

Use for endpoints that require one specific permission.

```typescript
export async function DELETE(request: NextRequest) {
  const authResult = await requirePermission(request, 'quotations', 'delete');
  if ('error' in authResult) {
    return authResult.error;
  }
  const { user, tenantId } = authResult;
  // Your code here
}
```

## Pattern 2: Multiple Permission Check (OR)

Use when user needs ANY of the listed permissions.

```typescript
import { requireAnyPermission } from '@/middleware/permissions';

export async function GET(request: NextRequest) {
  const authResult = await requireAnyPermission(request, [
    { resource: 'quotations', action: 'read' },
    { resource: 'quotations', action: 'create' },
  ]);
  if ('error' in authResult) {
    return authResult.error;
  }
  const { user, tenantId } = authResult;
  // Your code here
}
```

## Pattern 3: Multiple Permission Check (AND)

Use when user needs ALL of the listed permissions.

```typescript
import { requireAllPermissions } from '@/middleware/permissions';

export async function PATCH(request: NextRequest) {
  const authResult = await requireAllPermissions(request, [
    { resource: 'quotations', action: 'read' },
    { resource: 'quotations', action: 'update' },
  ]);
  if ('error' in authResult) {
    return authResult.error;
  }
  const { user, tenantId } = authResult;
  // Your code here
}
```

## Pattern 4: Conditional Logic

Use for different behavior based on permissions.

```typescript
import { requirePermission, hasPermission } from '@/middleware/permissions';

export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'quotations', 'read');
  if ('error' in authResult) {
    return authResult.error;
  }
  const { user, tenantId } = authResult;

  // Check additional permission for conditional logic
  const canViewAll = await hasPermission(user.userId, tenantId, 'quotations', 'update');

  if (canViewAll) {
    // Show all data
  } else {
    // Show limited data
  }
}
```

## Available Resources

```typescript
'quotations'   // Quote management
'clients'      // Client management
'invoices'     // Invoice management
'users'        // User management
'reports'      // Report viewing
'bookings'     // Booking management
'roles'        // Role management
'audit_logs'   // Audit log viewing
```

## Available Actions

```typescript
'read'    // View/list resources
'create'  // Create new resources
'update'  // Modify resources
'delete'  // Delete resources
```

## Cache Management

```typescript
import {
  clearUserPermissionCache,
  clearAllPermissionCache
} from '@/middleware/permissions';

// After updating a user's role
clearUserPermissionCache(userId);

// After modifying role permissions
clearAllPermissionCache();
```

## Complete Endpoint Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/middleware/permissions';
import { query } from '@/lib/db';
import { getRequestId, logResponse } from '@/middleware/correlation';
import {
  standardErrorResponse,
  notFoundErrorResponse,
  ErrorCodes
} from '@/lib/response';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    const { id } = await params;

    // RBAC: Check permission
    const authResult = await requirePermission(request, 'quotations', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user, tenantId } = authResult;

    // Verify resource exists and belongs to tenant
    const [item] = await query(
      'SELECT * FROM quotes WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    ) as any[];

    if (!item) {
      return notFoundErrorResponse(`Quote ${id} not found`, requestId);
    }

    // Perform deletion
    await query(
      'DELETE FROM quotes WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    );

    logResponse(requestId, 204, Date.now() - startTime, {
      quotation_id: id,
      deleted_by: user.userId,
    });

    return new NextResponse(null, {
      status: 204,
      headers: { 'X-Request-Id': requestId },
    });
  } catch (error: any) {
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to delete quotation',
      500,
      undefined,
      requestId
    );
  }
}
```

## Testing Your Permissions

```bash
# Test with different user roles
curl -X DELETE http://localhost:3000/api/quotations/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return 403 if user lacks permission:
{
  "error": {
    "code": "AUTHORIZATION_FAILED",
    "message": "You do not have permission to delete quotations",
    "type": "https://api.crm2.com/problems/authorization-failed"
  }
}
```

## Common Mistakes to Avoid

1. **Don't forget error handling:**
   ```typescript
   // WRONG
   const { user, tenantId } = await requirePermission(...);

   // CORRECT
   const authResult = await requirePermission(...);
   if ('error' in authResult) {
     return authResult.error;
   }
   const { user, tenantId } = authResult;
   ```

2. **Always scope to tenantId:**
   ```typescript
   // WRONG
   await query('DELETE FROM quotes WHERE id = ?', [id]);

   // CORRECT
   await query('DELETE FROM quotes WHERE id = ? AND organization_id = ?', [id, tenantId]);
   ```

3. **Clear cache after permission changes:**
   ```typescript
   // After updating user roles
   await assignRoleToUser(userId, roleId);
   clearUserPermissionCache(userId); // Don't forget this!
   ```

## Performance Tips

1. Cache is automatic (5-minute TTL)
2. First request per user: ~10-20ms (database query)
3. Cached requests: ~2ms
4. Clear cache only when permissions actually change
5. Use `requireAllPermissions()` sparingly (multiple permission checks)

## Need More Examples?

See: `src/middleware/permissions.example.ts`

## Full Documentation

See: `RBAC-IMPLEMENTATION.md`
