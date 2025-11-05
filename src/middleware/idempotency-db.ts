/**
 * MySQL-Based Idempotency Middleware
 * Production-ready implementation using database storage
 * @module middleware/idempotency-db
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Check if an idempotency key exists in the database
 * @param request - The incoming Next.js request
 * @param key - The idempotency key from header
 * @param organizationId - Tenant ID for multi-tenant isolation
 * @returns The cached NextResponse if key exists and hasn't expired, null otherwise
 */
export async function checkIdempotencyKeyDB(
  request: NextRequest,
  key: string,
  organizationId: number
): Promise<NextResponse | null> {
  try {
    const [rows] = await query(
      `SELECT response_status_code, response_body, response_headers, status
       FROM idempotency_keys
       WHERE idempotency_key = ?
         AND organization_id = ?
         AND expires_at > NOW()
       LIMIT 1`,
      [key, organizationId]
    ) as any[];

    const entry = rows[0];

    if (!entry) {
      return null;
    }

    // If still processing, return 409 Conflict
    if (entry.status === 'processing') {
      return NextResponse.json(
        {
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'A request with this idempotency key is already being processed',
            request_id: key,
          },
        },
        { status: 409 }
      );
    }

    // If failed, return null to allow retry
    if (entry.status === 'failed') {
      return null;
    }

    // Return cached response
    const responseBody = entry.response_body ? JSON.parse(entry.response_body) : null;
    const responseHeaders = entry.response_headers ? JSON.parse(entry.response_headers) : {};

    const headers = new Headers(responseHeaders);
    headers.set('X-Idempotent-Replay', 'true');

    return new NextResponse(
      responseBody ? JSON.stringify(responseBody) : null,
      {
        status: entry.response_status_code,
        headers,
      }
    );
  } catch (error) {
    console.error('[IDEMPOTENCY] Error checking key:', error);
    // On error, allow request to proceed
    return null;
  }
}

/**
 * Store an idempotency key with its response in the database
 * @param key - The idempotency key
 * @param response - The NextResponse to cache
 * @param organizationId - Tenant ID
 * @param userId - User ID who made the request
 * @param request - The original request (for metadata)
 */
export async function storeIdempotencyKeyDB(
  key: string,
  response: NextResponse,
  organizationId: number,
  userId: number,
  request: NextRequest
): Promise<void> {
  try {
    // Extract response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Clone response to read body
    const body = await response.clone().text();
    const parsedBody = body ? JSON.parse(body) : null;

    // Extract request metadata
    const method = request.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    const endpoint_path = new URL(request.url).pathname;

    // Set expiration to 24 hours from now
    await query(
      `INSERT INTO idempotency_keys (
        idempotency_key,
        organization_id,
        user_id,
        http_method,
        endpoint_path,
        response_status_code,
        response_body,
        response_headers,
        status,
        expires_at,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW())
      ON DUPLICATE KEY UPDATE
        response_status_code = VALUES(response_status_code),
        response_body = VALUES(response_body),
        response_headers = VALUES(response_headers),
        status = 'completed',
        completed_at = NOW()`,
      [
        key,
        organizationId,
        userId,
        method,
        endpoint_path,
        response.status,
        JSON.stringify(parsedBody),
        JSON.stringify(headers),
      ]
    );
  } catch (error) {
    // Don't fail the request if storing fails
    console.error('[IDEMPOTENCY] Error storing key:', error);
  }
}

/**
 * Mark an idempotency key as processing (to prevent concurrent requests)
 * @param key - The idempotency key
 * @param organizationId - Tenant ID
 * @param userId - User ID
 * @param request - The request
 */
export async function markIdempotencyKeyProcessing(
  key: string,
  organizationId: number,
  userId: number,
  request: NextRequest
): Promise<boolean> {
  try {
    const method = request.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    const endpoint_path = new URL(request.url).pathname;

    await query(
      `INSERT INTO idempotency_keys (
        idempotency_key,
        organization_id,
        user_id,
        http_method,
        endpoint_path,
        response_status_code,
        status,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, 0, 'processing', DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [key, organizationId, userId, method, endpoint_path]
    );

    return true;
  } catch (error: any) {
    // If duplicate key error, another request is already processing
    if (error.code === 'ER_DUP_ENTRY') {
      return false;
    }
    console.error('[IDEMPOTENCY] Error marking as processing:', error);
    return true; // Allow request to proceed on other errors
  }
}

/**
 * Mark an idempotency key as failed
 * @param key - The idempotency key
 * @param organizationId - Tenant ID
 * @param errorMessage - Error message
 */
export async function markIdempotencyKeyFailed(
  key: string,
  organizationId: number,
  errorMessage: string
): Promise<void> {
  try {
    await query(
      `UPDATE idempotency_keys
       SET status = 'failed',
           error_message = ?,
           completed_at = NOW()
       WHERE idempotency_key = ?
         AND organization_id = ?`,
      [errorMessage, key, organizationId]
    );
  } catch (error) {
    console.error('[IDEMPOTENCY] Error marking as failed:', error);
  }
}
