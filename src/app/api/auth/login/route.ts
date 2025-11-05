import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/jwt';

interface User {
  id: number;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  organization_id: number;
  status: string;
}

// SECURITY: Rate limiting for login attempts (in-memory, will be moved to MySQL later)
const loginAttempts = new Map<string, { count: number; resetTime: number; lockedUntil?: number }>();
const MAX_ATTEMPTS = 5; // 5 failed attempts
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts?: number; lockedUntil?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  // Check if account is locked
  if (attempt?.lockedUntil && now < attempt.lockedUntil) {
    const minutesLeft = Math.ceil((attempt.lockedUntil - now) / 1000 / 60);
    return { allowed: false, lockedUntil: minutesLeft };
  }

  // Reset if window expired
  if (!attempt || now > attempt.resetTime) {
    loginAttempts.set(identifier, { count: 0, resetTime: now + RATE_WINDOW });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  return {
    allowed: attempt.count < MAX_ATTEMPTS,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempt.count)
  };
}

function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  if (!attempt || now > attempt.resetTime) {
    loginAttempts.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
  } else {
    attempt.count++;
    if (attempt.count >= MAX_ATTEMPTS) {
      attempt.lockedUntil = now + LOCKOUT_DURATION;
    }
  }
}

function resetAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // SECURITY: Check rate limit for this email
    const rateLimitCheck = checkRateLimit(email.toLowerCase());
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account locked for ${rateLimitCheck.lockedUntil} minutes.`,
          lockedUntil: rateLimitCheck.lockedUntil
        },
        { status: 429 }
      );
    }

    // Find user by email
    const users = await query<User>(
      'SELECT id, email, password_hash, first_name, last_name, role, organization_id, status FROM users WHERE email = ? AND status = ?',
      [email, 'active']
    );

    if (users.length === 0) {
      // SECURITY: Record failed attempt
      recordFailedAttempt(email.toLowerCase());
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // SECURITY: Record failed attempt
      recordFailedAttempt(email.toLowerCase());
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // SECURITY: Reset rate limit on successful login
    resetAttempts(email.toLowerCase());

    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      organizationId: user.organization_id,
      role: user.role,
    });

    // Create response
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id,
      },
    });

    // SECURITY: Set httpOnly cookie with strict sameSite policy
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // SECURITY: Strict to prevent CSRF attacks
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    // SECURITY: Don't expose internal error details
    return NextResponse.json(
      { error: 'An error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}
