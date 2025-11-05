# Migration Script: Adding RBAC to Existing Endpoints

This guide helps you systematically add permission checks to existing API endpoints.

## Step-by-Step Migration Process

### Step 1: Identify Endpoints Needing Protection

Create a checklist of all API endpoints:

```
Quotations:
[ ] GET /api/quotations - requires 'quotations.read'
[ ] POST /api/quotations - requires 'quotations.create'
[ ] GET /api/quotations/[id] - requires 'quotations.read'
[ ] PATCH /api/quotations/[id] - requires 'quotations.update'
[ ] DELETE /api/quotations/[id] - requires 'quotations.delete'

Clients:
[ ] GET /api/clients - requires 'clients.read'
[ ] POST /api/clients - requires 'clients.create'
[ ] PATCH /api/clients/[id] - requires 'clients.update'
[ ] DELETE /api/clients/[id] - requires 'clients.delete'

... (continue for all resources)
```

### Step 2: For Each Endpoint

#### 2.1: Add Import

```typescript
// Add this to the top of the file
import { requirePermission } from '@/middleware/permissions';
```

#### 2.2: Find Existing Auth Check

Look for existing `requireTenant()` calls:

```typescript
// BEFORE
export async function DELETE(request: NextRequest) {
  const tenantResult = await requireTenant(request);
  if ('error' in tenantResult) {
    return NextResponse.json(tenantResult.error, {
      status: tenantResult.error.status
    });
  }
  const { user, tenantId } = tenantResult;
  // ... rest of code
}
```

#### 2.3: Replace with Permission Check

```typescript
// AFTER
export async function DELETE(request: NextRequest) {
  const authResult = await requirePermission(request, 'quotations', 'delete');
  if ('error' in authResult) {
    return authResult.error;
  }
  const { user, tenantId } = authResult;
  // ... rest of code (unchanged)
}
```

#### 2.4: Determine Correct Resource and Action

| HTTP Method | Typical Action | Examples |
|-------------|----------------|----------|
| GET (list)  | `read`        | `requirePermission(request, 'quotations', 'read')` |
| GET (single)| `read`        | `requirePermission(request, 'quotations', 'read')` |
| POST        | `create`      | `requirePermission(request, 'quotations', 'create')` |
| PUT         | `update`      | `requirePermission(request, 'quotations', 'update')` |
| PATCH       | `update`      | `requirePermission(request, 'quotations', 'update')` |
| DELETE      | `delete`      | `requirePermission(request, 'quotations', 'delete')` |

### Step 3: Test Each Endpoint

#### 3.1: Test with Super Admin
- Should have access to everything
- Test all CRUD operations

#### 3.2: Test with Admin
- Should have access to most things
- Test create, read, update operations

#### 3.3: Test with Agent
- Should have limited access
- Should succeed: create, read, update
- Should fail: delete (403 error)

#### 3.4: Test with Basic User
- Should have minimal access
- Should succeed: read
- Should fail: create, update, delete (403 errors)

### Step 4: Verify Error Responses

Ensure all permission failures return proper 403 responses:

```json
{
  "error": {
    "code": "AUTHORIZATION_FAILED",
    "message": "You do not have permission to delete quotations",
    "type": "https://api.crm2.com/problems/authorization-failed",
    "request_id": "req_123"
  }
}
```

## Automated Testing Script

Use this template to test all endpoints:

```bash
#!/bin/bash

# Test configuration
BASE_URL="http://localhost:3000"
SUPER_ADMIN_TOKEN="eyJ..."
ADMIN_TOKEN="eyJ..."
AGENT_TOKEN="eyJ..."
USER_TOKEN="eyJ..."

# Test quotations DELETE (should only work for super_admin and admin)
echo "Testing quotations DELETE..."

echo "  Super Admin (should succeed):"
curl -X DELETE "$BASE_URL/api/quotations/1" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -w "\n  Status: %{http_code}\n\n"

echo "  Admin (should succeed):"
curl -X DELETE "$BASE_URL/api/quotations/2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w "\n  Status: %{http_code}\n\n"

echo "  Agent (should fail - 403):"
curl -X DELETE "$BASE_URL/api/quotations/3" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -w "\n  Status: %{http_code}\n\n"

echo "  User (should fail - 403):"
curl -X DELETE "$BASE_URL/api/quotations/4" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -w "\n  Status: %{http_code}\n\n"

# Add more tests for other endpoints...
```

## Migration Checklist Template

```markdown
# RBAC Migration Progress

## Quotations API
- [x] GET /api/quotations - Added 'quotations.read' check
- [x] POST /api/quotations - Added 'quotations.create' check
- [x] GET /api/quotations/[id] - Added 'quotations.read' check
- [x] PATCH /api/quotations/[id] - Added 'quotations.update' check
- [x] DELETE /api/quotations/[id] - Added 'quotations.delete' check
- [x] Tested with all user roles
- [x] Error responses verified

## Clients API
- [ ] GET /api/clients
- [ ] POST /api/clients
- [ ] PATCH /api/clients/[id]
- [ ] DELETE /api/clients/[id]
- [ ] Tested with all user roles
- [ ] Error responses verified

## Invoices API
- [ ] GET /api/invoices
- [ ] POST /api/invoices
- [ ] PATCH /api/invoices/[id]
- [ ] DELETE /api/invoices/[id]
- [ ] Tested with all user roles
- [ ] Error responses verified

... (continue for all resources)
```

## Common Migration Patterns

### Pattern 1: Simple Replace

```typescript
// BEFORE
const { user, tenantId } = await requireTenant(request);

// AFTER
const authResult = await requirePermission(request, 'quotations', 'read');
if ('error' in authResult) {
  return authResult.error;
}
const { user, tenantId } = authResult;
```

### Pattern 2: Conditional Access

```typescript
// For endpoints that need different permissions based on operation
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === 'approve') {
    // Approving requires update permission
    const authResult = await requirePermission(request, 'quotations', 'update');
    if ('error' in authResult) return authResult.error;
  } else {
    // Creating requires create permission
    const authResult = await requirePermission(request, 'quotations', 'create');
    if ('error' in authResult) return authResult.error;
  }

  const { user, tenantId } = authResult;
  // ... rest of code
}
```

### Pattern 3: Cross-Resource Check

```typescript
// When one operation affects multiple resources
export async function POST(request: NextRequest) {
  // Check primary resource permission
  const authResult = await requirePermission(request, 'quotations', 'create');
  if ('error' in authResult) {
    return authResult.error;
  }

  const { user, tenantId } = authResult;
  const body = await request.json();

  // If linking to a client, verify client access
  if (body.client_id) {
    const hasClientAccess = await hasPermission(
      user.userId,
      tenantId,
      'clients',
      'read'
    );

    if (!hasClientAccess) {
      return authorizationErrorResponse(
        'You do not have permission to link quotations to clients'
      );
    }
  }

  // ... rest of code
}
```

## Rollback Plan

If you need to rollback RBAC changes:

1. Keep git commits small (one resource at a time)
2. Each commit should be for one API resource group
3. To rollback: `git revert <commit-hash>`

Example commit structure:
```
commit 1: Add RBAC to quotations API
commit 2: Add RBAC to clients API
commit 3: Add RBAC to invoices API
```

## Performance Monitoring

After migration, monitor these metrics:

1. **Response Time:** Should be <2ms overhead for cached permissions
2. **Cache Hit Rate:** Should be >90% after warmup period
3. **403 Error Rate:** Should be low (<5% of requests)
4. **Database Load:** Permission queries should be minimal due to caching

## Troubleshooting

### Issue: All users getting 403 errors

**Cause:** Users may not have any roles assigned

**Fix:**
```sql
-- Check user roles
SELECT u.id, u.email, r.name as role_name
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.organization_id = 1;

-- Assign default role to users without roles
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, (SELECT id FROM roles WHERE name = 'user' LIMIT 1)
FROM users u
WHERE u.id NOT IN (SELECT user_id FROM user_roles);
```

### Issue: Permission changes not taking effect

**Cause:** Permission cache not cleared

**Fix:**
```typescript
import { clearUserPermissionCache } from '@/middleware/permissions';

// Clear specific user's cache
clearUserPermissionCache(userId);

// Or clear all caches
import { clearAllPermissionCache } from '@/middleware/permissions';
clearAllPermissionCache();
```

### Issue: Inconsistent permission checks

**Cause:** Some endpoints still using old `requireTenant()` instead of `requirePermission()`

**Fix:** Search codebase and replace all instances:

```bash
# Find endpoints still using requireTenant
grep -r "requireTenant" src/app/api/

# Should only appear in GET endpoints that need basic auth without permissions
```

## Validation Checklist

Before marking migration complete:

- [ ] All endpoints have permission checks
- [ ] Import statements updated
- [ ] Old `requireTenant()` calls replaced (except where appropriate)
- [ ] All HTTP methods covered (GET, POST, PATCH, DELETE)
- [ ] Tests pass with different user roles
- [ ] Error responses are standardized
- [ ] Cache clearing logic in place for role updates
- [ ] Documentation updated
- [ ] Migration committed to git
- [ ] Production deployment plan created

## Next Steps

After completing migration:

1. Monitor production logs for 403 errors
2. Adjust permissions based on user feedback
3. Create custom roles for specific use cases
4. Implement audit logging for permission checks (Phase 3)
5. Add resource-level permissions (Phase 3+)
