# Phase 2: Enhanced Auth & Audit - Implementation Plan

**Estimated Time:** 1-2 weeks
**Priority:** HIGH
**Dependencies:** Phase 1 complete ✅

---

## Overview

Phase 2 enhances the authentication and authorization system with token refresh, role management, user invitations, and comprehensive audit logging for compliance and security.

---

## Goals

1. **Complete Auth System** - Add missing auth endpoints (refresh, roles, invitations)
2. **Audit Trail** - Full audit logging for compliance
3. **RBAC Enhancement** - Scope-based permissions beyond basic roles
4. **Security** - Automatic audit logging for sensitive operations

---

## Deliverables

### 1. Token Refresh Endpoint ⏱️ 2-3 hours

**Endpoint:** `POST /api/auth/refresh`

**Purpose:** Allow clients to refresh JWT tokens without re-login

**Request:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

**Response:**
```json
{
  "access_token": "new_jwt_token",
  "refresh_token": "new_refresh_token",
  "expires_in": 3600
}
```

**Implementation Steps:**
1. Create `refresh_tokens` table:
   ```sql
   CREATE TABLE refresh_tokens (
     id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     user_id INT UNSIGNED NOT NULL,
     token VARCHAR(255) NOT NULL UNIQUE,
     expires_at TIMESTAMP NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     revoked_at TIMESTAMP NULL DEFAULT NULL,
     INDEX idx_user_id (user_id),
     INDEX idx_token (token),
     INDEX idx_expires_at (expires_at)
   );
   ```

2. Update `/api/auth/login` to return refresh token
3. Create `/api/auth/refresh` endpoint
4. Add refresh token validation and rotation
5. Add cleanup job for expired tokens

**Files to Create:**
- `src/app/api/auth/refresh/route.ts`

**Files to Modify:**
- `src/app/api/auth/login/route.ts`
- `src/lib/jwt.ts` (add refresh token functions)

---

### 2. Role Management ⏱️ 4-5 hours

**Endpoints:**
- `GET /api/roles` - List all roles
- `GET /api/roles/:id` - Get role details
- `POST /api/roles` - Create new role
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role

**Database Schema:**
```sql
CREATE TABLE roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON NOT NULL,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_org_name (organization_id, name),
  INDEX idx_organization_id (organization_id)
);

CREATE TABLE user_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  assigned_by_user_id INT UNSIGNED,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_role (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id)
);
```

**Default System Roles:**
- `super_admin` - Full system access
- `admin` - Organization admin
- `agent` - Sales agent
- `user` - Basic user

**Permissions Structure:**
```json
{
  "quotations": {
    "read": true,
    "create": true,
    "update": true,
    "delete": false
  },
  "clients": {
    "read": true,
    "create": true,
    "update": true,
    "delete": false
  },
  "invoices": {
    "read": true,
    "create": false,
    "update": false,
    "delete": false
  },
  "reports": {
    "read": true
  }
}
```

**Files to Create:**
- `src/app/api/roles/route.ts`
- `src/app/api/roles/[id]/route.ts`
- `src/lib/rbac.ts` (permission checking utilities)

---

### 3. User Invitation System ⏱️ 3-4 hours

**Endpoints:**
- `GET /api/invitations` - List pending invitations
- `POST /api/invitations` - Create invitation
- `POST /api/invitations/:id/accept` - Accept invitation
- `DELETE /api/invitations/:id` - Cancel invitation

**Database Schema:**
```sql
CREATE TABLE invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  organization_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED,
  invited_by_user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_token (token),
  INDEX idx_organization_id (organization_id),
  INDEX idx_expires_at (expires_at)
);
```

**Flow:**
1. Admin creates invitation with email and role
2. System generates unique token and sends email
3. User clicks link, registers with token
4. Token is validated and marked as accepted
5. User is created with specified role

**Email Template:**
```
Subject: You've been invited to join [Organization Name]

Hi,

You've been invited to join [Organization Name] on CRM System.

Click here to accept: https://app.crm2.com/invite/[token]

This invitation expires in 7 days.
```

**Files to Create:**
- `src/app/api/invitations/route.ts`
- `src/app/api/invitations/[id]/route.ts`
- `src/app/api/invitations/[id]/accept/route.ts`
- `src/lib/email.ts` (email sending utilities)

---

### 4. Audit Logging System ⏱️ 5-6 hours

**Endpoint:**
- `GET /api/audit-logs` - Query audit logs with filters

**Database Schema:**
```sql
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  changes JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_organization_id (organization_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at),
  INDEX idx_request_id (request_id)
);
```

**Audited Actions:**
- `user.login` - User login
- `user.logout` - User logout
- `user.created` - User created
- `user.updated` - User updated
- `user.deleted` - User deleted
- `quotation.created` - Quotation created
- `quotation.updated` - Quotation updated
- `quotation.deleted` - Quotation deleted
- `quotation.status_changed` - Status change
- `invoice.created` - Invoice created
- `invoice.paid` - Invoice payment recorded
- `booking.created` - Booking created
- `booking.cancelled` - Booking cancelled
- `role.assigned` - Role assigned to user
- `permissions.changed` - Permissions modified

**Query Filters:**
- `?actor=user_id` - Filter by user who performed action
- `?resource=quotation` - Filter by resource type
- `?resource_id=123` - Filter by specific resource
- `?action=quotation.created` - Filter by action
- `?date_from=2025-01-01` - Start date
- `?date_to=2025-12-31` - End date
- `?request_id=req_123` - Filter by correlation ID

**Response:**
```json
{
  "data": [
    {
      "id": 12345,
      "organization_id": 1,
      "user_id": 5,
      "user_email": "john@example.com",
      "action": "quotation.created",
      "resource_type": "quotation",
      "resource_id": "789",
      "ip_address": "192.168.1.1",
      "request_id": "req_abc123",
      "changes": {
        "customer_name": "Jane Doe",
        "destination": "Istanbul",
        "status": "draft"
      },
      "created_at": "2025-11-05T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "size": 25,
    "total": 1523,
    "total_pages": 61
  },
  "links": {
    "self": "...",
    "next": "...",
    "prev": null
  }
}
```

**Audit Middleware:**
```typescript
// src/middleware/audit.ts
export async function auditLog(
  organizationId: number,
  userId: number,
  action: string,
  resourceType: string,
  resourceId?: string,
  changes?: object,
  metadata?: object,
  request?: NextRequest
) {
  const requestId = request ? getRequestId(request) : undefined;
  const ipAddress = request?.headers.get('x-forwarded-for') ||
                    request?.headers.get('x-real-ip');
  const userAgent = request?.headers.get('user-agent');

  await query(
    `INSERT INTO audit_logs (
      organization_id, user_id, action, resource_type, resource_id,
      ip_address, user_agent, request_id, changes, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      organizationId,
      userId,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      requestId,
      changes ? JSON.stringify(changes) : null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}
```

**Files to Create:**
- `src/app/api/audit-logs/route.ts`
- `src/middleware/audit.ts`

**Files to Modify:**
- `src/app/api/auth/login/route.ts` - Add audit log
- `src/app/api/quotations/route.ts` - Add audit logs
- `src/app/api/invoices/*/route.ts` - Add audit logs
- `src/app/api/bookings/route.ts` - Add audit logs

---

### 5. Enhanced RBAC ⏱️ 3-4 hours

**Permission Checking Middleware:**
```typescript
// src/middleware/permissions.ts
export async function requirePermission(
  request: NextRequest,
  resource: string,
  action: 'read' | 'create' | 'update' | 'delete'
) {
  const tenantResult = await requireTenant(request);
  if ('error' in tenantResult) {
    return tenantResult;
  }

  const { user } = tenantResult;

  // Get user's roles
  const roles = await query(
    `SELECT r.permissions
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [user.userId]
  );

  // Check if user has permission
  for (const role of roles) {
    const permissions = JSON.parse(role.permissions);
    if (permissions[resource]?.[action]) {
      return { user, allowed: true };
    }
  }

  return {
    error: {
      type: 'https://api.crm2.com/problems/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: `You do not have permission to ${action} ${resource}`
    }
  };
}
```

**Usage:**
```typescript
export async function DELETE(request: NextRequest) {
  const permissionCheck = await requirePermission(request, 'quotations', 'delete');
  if ('error' in permissionCheck) {
    return errorResponse(permissionCheck.error);
  }

  // ... proceed with delete
}
```

**Files to Create:**
- `src/middleware/permissions.ts`

---

## Implementation Order

### Day 1-2: Token Refresh
- [ ] Create refresh_tokens table
- [ ] Implement refresh token generation
- [ ] Create /api/auth/refresh endpoint
- [ ] Update /api/auth/login
- [ ] Test token refresh flow

### Day 3-4: Role Management
- [ ] Create roles and user_roles tables
- [ ] Seed default system roles
- [ ] Implement GET /api/roles
- [ ] Implement POST /api/roles
- [ ] Implement PUT /api/roles/:id
- [ ] Implement DELETE /api/roles/:id
- [ ] Test role CRUD operations

### Day 5-6: User Invitations
- [ ] Create invitations table
- [ ] Implement POST /api/invitations
- [ ] Implement GET /api/invitations
- [ ] Implement POST /api/invitations/:id/accept
- [ ] Implement DELETE /api/invitations/:id
- [ ] Set up email sending (or mock for now)
- [ ] Test invitation flow

### Day 7-8: Audit Logging
- [ ] Create audit_logs table
- [ ] Create audit middleware
- [ ] Implement GET /api/audit-logs with filters
- [ ] Add audit logging to auth endpoints
- [ ] Add audit logging to quotations
- [ ] Add audit logging to invoices
- [ ] Add audit logging to bookings
- [ ] Test audit queries

### Day 9-10: Enhanced RBAC
- [ ] Create permission checking middleware
- [ ] Update endpoints to use requirePermission
- [ ] Test permission enforcement
- [ ] Document permission structure

---

## Database Migration Script

```sql
-- Phase 2 Database Schema

-- 1. Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON NOT NULL,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_org_name (organization_id, name),
  INDEX idx_organization_id (organization_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  assigned_by_user_id INT UNSIGNED,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_role (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  organization_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED,
  invited_by_user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_token (token),
  INDEX idx_organization_id (organization_id),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  changes JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_organization_id (organization_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at),
  INDEX idx_request_id (request_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default system roles
INSERT INTO roles (organization_id, name, description, permissions, is_system_role) VALUES
(1, 'super_admin', 'Full system access', '{"*": {"read": true, "create": true, "update": true, "delete": true}}', TRUE),
(1, 'admin', 'Organization administrator', '{"quotations": {"read": true, "create": true, "update": true, "delete": true}, "clients": {"read": true, "create": true, "update": true, "delete": true}, "invoices": {"read": true, "create": true, "update": true, "delete": true}, "reports": {"read": true}}', TRUE),
(1, 'agent', 'Sales agent', '{"quotations": {"read": true, "create": true, "update": true, "delete": false}, "clients": {"read": true, "create": true, "update": true, "delete": false}, "reports": {"read": true}}', TRUE),
(1, 'user', 'Basic user', '{"quotations": {"read": true}, "clients": {"read": true}, "reports": {"read": true}}', TRUE);
```

Save as: `database-phase-2-schema.sql`

---

## Testing Checklist

### Token Refresh
- [ ] Login returns refresh token
- [ ] Refresh token can be used to get new access token
- [ ] Expired refresh tokens are rejected
- [ ] Revoked tokens are rejected
- [ ] Refresh token rotation works

### Roles
- [ ] Can list all roles for organization
- [ ] Can create custom role with permissions
- [ ] Can update role permissions
- [ ] Cannot delete system roles
- [ ] Can delete custom roles
- [ ] Permissions are enforced on endpoints

### Invitations
- [ ] Can create invitation
- [ ] Email is sent (or mocked)
- [ ] Can accept invitation
- [ ] Expired invitations are rejected
- [ ] Used invitations cannot be reused
- [ ] Can cancel pending invitation

### Audit Logs
- [ ] Login events are logged
- [ ] Quotation create/update/delete are logged
- [ ] Invoice operations are logged
- [ ] Can filter by user, resource, date range
- [ ] Pagination works correctly
- [ ] Request correlation IDs are captured

---

## Success Criteria

- [ ] All 5 deliverables implemented
- [ ] Database schema deployed
- [ ] Build passing with 0 errors
- [ ] All endpoints using Phase 1 standards
- [ ] Comprehensive test coverage
- [ ] Documentation updated
- [ ] Ready for Phase 3

---

## Next Phase: Phase 3 - Idempotency & Resilience

After Phase 2 completion, proceed to Phase 3 for production reliability improvements.

---

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
