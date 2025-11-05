import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { query } from './db';

// Skip validation during build time (when Next.js is collecting page data)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                    process.env.NEXT_PHASE === 'phase-development-build';

// Load environment config (validates JWT_SECRET)
// Use build-time placeholder to avoid errors during Next.js build
let jwtSecretString: string;

if (isBuildTime) {
  jwtSecretString = 'build-time-placeholder-secret-12345678901234567890';
} else {
  // This import will validate all environment variables including JWT_SECRET
  const { env } = require('./env');
  jwtSecretString = env.JWT_SECRET;
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretString);

export interface JWTPayload {
  userId: number;
  email: string;
  organizationId: number;
  role: string;
}

/**
 * Create a JWT token with the given payload
 */
export async function createToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Type assertion after verification - payload structure is guaranteed by our createToken function
    return payload as unknown as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract and verify JWT token from request cookies
 */
export async function verifyRequestToken(request: NextRequest): Promise<JWTPayload> {
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    throw new Error('No authentication token provided');
  }

  return await verifyToken(token);
}

/**
 * Check if user is authenticated and return payload
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<JWTPayload | null> {
  try {
    return await verifyRequestToken(request);
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<JWTPayload> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}

// ============================================
// REFRESH TOKEN FUNCTIONS (Phase 2)
// ============================================

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

interface RefreshTokenRecord {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

/**
 * Generate a secure refresh token
 * Uses crypto.randomBytes to create a 64-character hex token
 * @returns Secure random token string
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Store refresh token in database
 * @param userId - User ID to associate with the token
 * @param token - The refresh token to store
 * @returns The stored refresh token record ID
 */
export async function storeRefreshToken(userId: number, token: string): Promise<number> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  const result: any = await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );

  // For INSERT queries, mysql2 returns a ResultSetHeader with insertId
  return (result as any).insertId || 0;
}

/**
 * Validate refresh token and retrieve user information
 * Checks if token exists, is not expired, and is not revoked
 * @param token - The refresh token to validate
 * @returns User information if token is valid, null otherwise
 */
export async function validateRefreshToken(token: string): Promise<{
  userId: number;
  email: string;
  organizationId: number;
  role: string;
  tokenId: number;
} | null> {
  // Query for the token with user information
  const result = await query<any>(
    `SELECT
      rt.id as token_id,
      rt.user_id,
      rt.expires_at,
      rt.revoked_at,
      u.email,
      u.organization_id,
      u.role,
      u.status
    FROM refresh_tokens rt
    INNER JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ?`,
    [token]
  );

  if (result.length === 0) {
    return null; // Token not found
  }

  const record = result[0];

  // Check if token is revoked
  if (record.revoked_at !== null) {
    return null; // Token has been revoked
  }

  // Check if token is expired
  const expiresAt = new Date(record.expires_at);
  if (expiresAt < new Date()) {
    return null; // Token has expired
  }

  // Check if user is still active
  if (record.status !== 'active') {
    return null; // User is not active
  }

  return {
    userId: record.user_id,
    email: record.email,
    organizationId: record.organization_id,
    role: record.role,
    tokenId: record.token_id,
  };
}

/**
 * Revoke a refresh token by marking it as revoked
 * Used during token rotation or logout
 * @param token - The refresh token to revoke
 * @returns True if token was revoked, false if not found
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  const result: any = await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL',
    [token]
  );

  // For UPDATE queries, mysql2 returns a ResultSetHeader with affectedRows
  return ((result as any).affectedRows || 0) > 0;
}

/**
 * Revoke all refresh tokens for a user
 * Useful for logout from all devices
 * @param userId - The user ID whose tokens should be revoked
 * @returns Number of tokens revoked
 */
export async function revokeAllUserTokens(userId: number): Promise<number> {
  const result: any = await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  );

  // For UPDATE queries, mysql2 returns a ResultSetHeader with affectedRows
  return (result as any).affectedRows || 0;
}
