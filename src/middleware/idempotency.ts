/**
 * Idempotency Middleware
 * Prevents duplicate requests using idempotency keys
 * Currently uses in-memory storage (will be upgraded to Redis/DB later)
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Stored idempotency entry
 */
interface IdempotencyEntry {
  response: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
  expiresAt: number;
}

/**
 * In-memory idempotency store
 * Key: idempotency key
 * Value: cached response and expiration timestamp
 */
const idempotencyStore = new Map<string, IdempotencyEntry>();

/**
 * Cleanup interval for expired entries (run every 5 minutes)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Idempotency key expiration time (24 hours)
 */
const EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Periodically clean up expired entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (entry.expiresAt <= now) {
      idempotencyStore.delete(key);
    }
  }
}

// Start cleanup interval
if (typeof window === 'undefined') {
  // Only run on server-side
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Check if an idempotency key exists and return cached response if found
 * @param request - The incoming Next.js request
 * @param key - The idempotency key
 * @returns The cached NextResponse if key exists and hasn't expired, null otherwise
 */
export async function checkIdempotencyKey(
  request: NextRequest,
  key: string
): Promise<NextResponse | null> {
  const entry = idempotencyStore.get(key);

  if (!entry) {
    return null;
  }

  // Check if entry has expired
  if (entry.expiresAt <= Date.now()) {
    idempotencyStore.delete(key);
    return null;
  }

  // Reconstruct the cached response
  const headers = new Headers(entry.response.headers);
  headers.set('X-Idempotent-Replay', 'true');

  return new NextResponse(entry.response.body, {
    status: entry.response.status,
    headers,
  });
}

/**
 * Store an idempotency key with its response
 * @param key - The idempotency key
 * @param response - The NextResponse to cache
 */
export function storeIdempotencyKey(
  key: string,
  response: NextResponse
): void {
  const expiresAt = Date.now() + EXPIRATION_MS;

  // Extract response headers
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Clone the response to read the body
  response.clone().text().then((body) => {
    idempotencyStore.set(key, {
      response: {
        status: response.status,
        headers,
        body,
      },
      expiresAt,
    });
  });
}

/**
 * Get the current size of the idempotency store (for monitoring/debugging)
 */
export function getIdempotencyStoreSize(): number {
  return idempotencyStore.size;
}

/**
 * Clear the entire idempotency store (for testing purposes)
 */
export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}
