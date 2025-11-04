import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

// Validate JWT_SECRET exists and is strong enough
// Skip validation during build time (when Next.js is collecting page data)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                    process.env.NEXT_PHASE === 'phase-development-build';

if (!isBuildTime) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required. Generate one with: openssl rand -base64 32'
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long for security'
    );
  }
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'build-time-placeholder');

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
