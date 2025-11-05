/**
 * Rate limit headers middleware
 * Adds standard rate limit headers to API responses
 * @module middleware/rateLimit
 */

import { NextResponse } from 'next/server';

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the limit resets */
  reset: number;
}

/**
 * Add rate limit headers to a response
 *
 * Follows standard HTTP rate limit header conventions:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 * - Retry-After: Seconds until limit resets (included if remaining = 0)
 *
 * @param response - NextResponse to add headers to
 * @param rateLimitInfo - Rate limit information
 * @returns Modified NextResponse with rate limit headers
 *
 * @example
 * ```ts
 * const response = NextResponse.json(data);
 * addRateLimitHeaders(response, {
 *   limit: 100,
 *   remaining: 95,
 *   reset: Math.floor(Date.now() / 1000) + 3600
 * });
 * ```
 */
export function addRateLimitHeaders(
  response: NextResponse,
  rateLimitInfo: RateLimitInfo
): NextResponse {
  response.headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimitInfo.reset.toString());

  // If rate limit exhausted, add Retry-After header
  if (rateLimitInfo.remaining === 0) {
    const retryAfter = Math.max(0, rateLimitInfo.reset - Math.floor(Date.now() / 1000));
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * Calculate rate limit reset timestamp
 *
 * @param windowSeconds - Rate limit window duration in seconds
 * @returns Unix timestamp when the limit resets
 *
 * @example
 * ```ts
 * // For a 1-hour window
 * const resetTime = calculateResetTime(3600);
 * // Returns: current time + 3600 seconds
 * ```
 */
export function calculateResetTime(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000) + windowSeconds;
}

/**
 * Rate limit tracker for in-memory tracking
 * Used for simple rate limiting without external dependencies
 *
 * For production use with multiple servers, use database-based rate limiting
 * from the rate_limit_tracking table
 */
export class RateLimitTracker {
  private limits: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.limits = new Map();
  }

  /**
   * Track a request and check if rate limit is exceeded
   *
   * @param identifier - Unique identifier (user ID, IP address, etc.)
   * @param limit - Maximum requests allowed in window
   * @param windowSeconds - Window duration in seconds
   * @returns Rate limit information
   *
   * @example
   * ```ts
   * const tracker = new RateLimitTracker();
   *
   * const rateLimit = tracker.trackRequest('user_123', 100, 3600);
   * if (rateLimit.remaining === 0) {
   *   return rateLimitErrorResponse('Rate limit exceeded', rateLimit.reset);
   * }
   * ```
   */
  trackRequest(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): RateLimitInfo {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.limits.get(identifier);

    // No entry or window expired - create new window
    if (!entry || now >= entry.resetTime) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + windowSeconds,
      });

      return {
        limit,
        remaining: limit - 1,
        reset: now + windowSeconds,
      };
    }

    // Increment count in current window
    entry.count++;
    this.limits.set(identifier, entry);

    return {
      limit,
      remaining: Math.max(0, limit - entry.count),
      reset: entry.resetTime,
    };
  }

  /**
   * Get current rate limit status without incrementing
   *
   * @param identifier - Unique identifier
   * @param limit - Maximum requests allowed in window
   * @param windowSeconds - Window duration in seconds
   * @returns Rate limit information
   */
  getStatus(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): RateLimitInfo {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.limits.get(identifier);

    if (!entry || now >= entry.resetTime) {
      return {
        limit,
        remaining: limit,
        reset: now + windowSeconds,
      };
    }

    return {
      limit,
      remaining: Math.max(0, limit - entry.count),
      reset: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for an identifier
   *
   * @param identifier - Unique identifier to reset
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Clean up expired entries
   * Should be called periodically to prevent memory leaks
   */
  cleanup(): void {
    const now = Math.floor(Date.now() / 1000);

    for (const [identifier, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(identifier);
      }
    }
  }
}

/**
 * Global rate limit tracker instance
 * Shared across all API routes
 */
export const globalRateLimitTracker = new RateLimitTracker();

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    globalRateLimitTracker.cleanup();
  }, 5 * 60 * 1000);
}
