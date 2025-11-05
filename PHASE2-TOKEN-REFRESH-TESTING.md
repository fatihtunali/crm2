# Phase 2: Token Refresh Implementation - Testing Guide

## Overview
This document provides testing instructions for the token refresh functionality implemented in Phase 2.

## Implementation Summary

### Files Modified/Created:
1. **C:\Users\fatih\Desktop\CRM\src\lib\jwt.ts** - Added refresh token functions
2. **C:\Users\fatih\Desktop\CRM\src\app\api\auth\refresh\route.ts** - New refresh endpoint
3. **C:\Users\fatih\Desktop\CRM\src\app\api\auth\login\route.ts** - Updated to generate refresh tokens

### Key Features:
- Secure refresh token generation using crypto.randomBytes (64 hex characters)
- Token rotation: Old refresh tokens are automatically revoked when new ones are issued
- 30-day refresh token expiry
- Database-backed token validation with revocation support
- Phase 1 compliance: Uses request correlation IDs and standardized error responses

---

## Prerequisites

### 1. Database Schema
Ensure the Phase 2 database schema is applied:

```bash
mysql -u root -p crm_db < database-phase-2-schema.sql
```

Verify the `refresh_tokens` table exists:
```sql
SHOW TABLES LIKE 'refresh_tokens';
DESCRIBE refresh_tokens;
```

Expected structure:
```
+------------+---------------------+------+-----+-------------------+
| Field      | Type                | Null | Key | Default           |
+------------+---------------------+------+-----+-------------------+
| id         | bigint unsigned     | NO   | PRI | NULL              |
| user_id    | int unsigned        | NO   | MUL | NULL              |
| token      | varchar(255)        | NO   | UNI | NULL              |
| expires_at | timestamp           | NO   | MUL | NULL              |
| created_at | timestamp           | YES  |     | CURRENT_TIMESTAMP |
| revoked_at | timestamp           | YES  | MUL | NULL              |
+------------+---------------------+------+-----+-------------------+
```

---

## Testing Procedures

### Test 1: Login with Refresh Token Generation

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Expected Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "organizationId": 1
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
  "expires_in": 604800,
  "token_type": "Bearer"
}
```

**Validation:**
- Response includes both `access_token` and `refresh_token`
- `refresh_token` is 64 hex characters
- Cookie `auth-token` is set with the access token
- Database check: `SELECT * FROM refresh_tokens WHERE user_id = 1;` shows new token

---

### Test 2: Successful Token Refresh

**Endpoint:** `POST /api/auth/refresh`

**Request:**
```json
{
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
}
```

**Expected Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "f2e1d0c9b8a7z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1",
  "expires_in": 604800,
  "token_type": "Bearer"
}
```

**Headers:**
```
X-Request-Id: <uuid>
```

**Validation:**
- New access token is generated
- New refresh token is different from old token
- Old refresh token is revoked in database
- Database check: Old token has `revoked_at` timestamp set

---

### Test 3: Token Rotation Validation

**Scenario:** Use old refresh token after it's been rotated

**Request:**
```json
{
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Invalid or expired refresh token",
    "request_id": "<uuid>",
    "type": "https://api.crm2.com/problems/authentication-required"
  }
}
```

**Validation:**
- Old token is rejected
- Response uses standardized error format
- Request ID is included

---

### Test 4: Invalid Refresh Token Format

**Request:**
```json
{
  "refresh_token": "invalid-token"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "refresh_token",
        "issue": "invalid_format",
        "message": "Invalid refresh token format"
      }
    ],
    "request_id": "<uuid>",
    "type": "https://api.crm2.com/problems/validation-error"
  }
}
```

---

### Test 5: Missing Refresh Token

**Request:**
```json
{}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "refresh_token",
        "issue": "required",
        "message": "Refresh token is required"
      }
    ],
    "request_id": "<uuid>",
    "type": "https://api.crm2.com/problems/validation-error"
  }
}
```

---

### Test 6: Expired Refresh Token

**Setup:**
```sql
-- Manually expire a refresh token for testing
UPDATE refresh_tokens
SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE token = 'your-test-token-here';
```

**Request:**
```json
{
  "refresh_token": "your-test-token-here"
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Invalid or expired refresh token",
    "request_id": "<uuid>",
    "type": "https://api.crm2.com/problems/authentication-required"
  }
}
```

---

### Test 7: Revoked Refresh Token

**Setup:**
```sql
-- Manually revoke a refresh token for testing
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE token = 'your-test-token-here';
```

**Request:**
```json
{
  "refresh_token": "your-test-token-here"
}
```

**Expected Response (401 Unauthorized):**
Same as Test 6 - token is invalid

---

### Test 8: Inactive User Token

**Setup:**
```sql
-- Deactivate a user
UPDATE users SET status = 'inactive' WHERE id = 1;
```

**Request:**
Use a valid refresh token for the inactive user

**Expected Response (401 Unauthorized):**
Token is rejected because user is not active

**Cleanup:**
```sql
UPDATE users SET status = 'active' WHERE id = 1;
```

---

## Manual Testing with cURL

### 1. Login and capture tokens:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' | jq .
```

Save the `refresh_token` from the response.

### 2. Refresh the token:
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: test-request-123" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN_HERE"
  }' | jq .
```

### 3. Try using old token (should fail):
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "OLD_TOKEN_HERE"
  }' | jq .
```

---

## Database Verification Queries

### Check refresh tokens for a user:
```sql
SELECT
  id,
  user_id,
  LEFT(token, 10) as token_prefix,
  expires_at,
  created_at,
  revoked_at,
  CASE
    WHEN revoked_at IS NOT NULL THEN 'Revoked'
    WHEN expires_at < NOW() THEN 'Expired'
    ELSE 'Active'
  END as status
FROM refresh_tokens
WHERE user_id = 1
ORDER BY created_at DESC;
```

### Count active vs revoked tokens:
```sql
SELECT
  COUNT(*) as total_tokens,
  SUM(CASE WHEN revoked_at IS NULL AND expires_at > NOW() THEN 1 ELSE 0 END) as active_tokens,
  SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) as revoked_tokens,
  SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired_tokens
FROM refresh_tokens;
```

### Find tokens expiring soon:
```sql
SELECT
  user_id,
  LEFT(token, 10) as token_prefix,
  expires_at,
  TIMESTAMPDIFF(DAY, NOW(), expires_at) as days_until_expiry
FROM refresh_tokens
WHERE revoked_at IS NULL
  AND expires_at > NOW()
  AND expires_at < DATE_ADD(NOW(), INTERVAL 7 DAY)
ORDER BY expires_at;
```

---

## Security Verification

### 1. Token Format Validation:
- Tokens should be exactly 64 hex characters (a-f0-9)
- Tokens should be cryptographically random
- No predictable patterns in generated tokens

### 2. Token Rotation:
- After refresh, old token should be immediately revoked
- Attempting to use old token should fail
- Only one active refresh token per refresh operation

### 3. Expiry Handling:
- Tokens expire after 30 days
- Expired tokens are rejected
- Automatic cleanup job runs daily (check event scheduler)

### 4. User Status:
- Tokens for inactive users should be rejected
- User reactivation should not automatically revalidate old tokens

---

## Performance Testing

### 1. Concurrent Refresh Requests:
Test multiple simultaneous refresh requests with the same token:
- Only first request should succeed
- Subsequent requests should fail (token already revoked)

### 2. Load Testing:
```bash
# Using Apache Bench
ab -n 1000 -c 10 -p refresh_payload.json \
  -T application/json \
  http://localhost:3000/api/auth/refresh
```

Expected:
- Average response time < 100ms
- No database deadlocks or connection issues
- Consistent error handling

---

## Common Issues and Troubleshooting

### Issue 1: "Cannot find module @/lib/jwt"
**Solution:** Ensure TypeScript paths are configured in `tsconfig.json`

### Issue 2: Database connection errors
**Solution:**
- Verify database credentials in `.env`
- Ensure `refresh_tokens` table exists
- Check database connection pool settings

### Issue 3: Token validation always fails
**Solution:**
- Check system time synchronization
- Verify `expires_at` calculation
- Check user status in database

### Issue 4: TypeScript errors on `insertId` or `affectedRows`
**Solution:**
- These are cast to `any` in implementation
- Errors are cosmetic and don't affect runtime
- Will be resolved with proper typing in future phases

---

## Next Steps

After successful testing:

1. **Integration Testing:**
   - Test with frontend authentication flow
   - Verify token storage in client
   - Test automatic token refresh logic

2. **Security Audit:**
   - Review token storage security
   - Validate all error messages don't leak information
   - Test for timing attacks

3. **Documentation:**
   - Update API documentation
   - Document client-side integration
   - Add token refresh to developer guides

4. **Monitoring:**
   - Add metrics for token refresh rate
   - Monitor token revocation patterns
   - Alert on unusual refresh activity

---

## Success Criteria

- [x] Login endpoint returns refresh token
- [x] Refresh endpoint validates and rotates tokens
- [x] Old tokens are revoked after refresh
- [x] Expired tokens are rejected
- [x] Invalid tokens are rejected with proper errors
- [x] Phase 1 standards are followed (request IDs, error format)
- [x] Database schema is properly implemented
- [ ] All tests pass
- [ ] No security vulnerabilities identified
- [ ] Performance meets requirements

---

## API Reference Quick Guide

### POST /api/auth/login
Returns access_token + refresh_token on successful login

### POST /api/auth/refresh
Exchanges refresh_token for new access_token + refresh_token

Both endpoints follow Phase 1 standards:
- Include X-Request-Id header
- Use standardized error responses
- Return consistent JSON structure
- Include proper HTTP status codes
