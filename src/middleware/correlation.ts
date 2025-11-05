/**
 * Request correlation middleware
 * Adds unique request IDs for tracing and debugging
 * @module middleware/correlation
 */

import { NextRequest } from 'next/server';
import { generateRequestId } from '@/lib/response';

/**
 * Get or generate a request correlation ID
 *
 * Checks for existing X-Request-Id header from client,
 * otherwise generates a new UUID
 *
 * @param request - Next.js request object
 * @returns Request correlation ID
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const requestId = getRequestId(request);
 *   console.log('Processing request:', requestId);
 *
 *   // Use in response
 *   const response = NextResponse.json(data);
 *   response.headers.set('X-Request-Id', requestId);
 *   return response;
 * }
 * ```
 */
export function getRequestId(request: NextRequest): string {
  // Check if client provided a request ID
  const clientRequestId = request.headers.get('X-Request-Id');

  if (clientRequestId && clientRequestId.trim() !== '') {
    return clientRequestId;
  }

  // Generate new request ID
  return generateRequestId();
}

/**
 * Extract request metadata for logging and debugging
 *
 * @param request - Next.js request object
 * @param requestId - Request correlation ID
 * @returns Object with request metadata
 *
 * @example
 * ```ts
 * const requestId = getRequestId(request);
 * const metadata = getRequestMetadata(request, requestId);
 * console.log('Request:', metadata);
 * // {
 * //   request_id: 'uuid-123',
 * //   method: 'GET',
 * //   path: '/api/quotations',
 * //   user_agent: 'Mozilla/5.0...',
 * //   ip: '192.168.1.1'
 * // }
 * ```
 */
export function getRequestMetadata(request: NextRequest, requestId: string) {
  const url = new URL(request.url);

  return {
    request_id: requestId,
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    user_agent: request.headers.get('user-agent') || 'unknown',
    ip: request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log request with correlation ID
 * Useful for debugging and tracing requests across services
 *
 * @param request - Next.js request object
 * @param requestId - Request correlation ID
 * @param additionalData - Optional additional data to log
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const requestId = getRequestId(request);
 *   logRequest(request, requestId, { user_id: 123, action: 'create_quote' });
 *   // ...
 * }
 * ```
 */
export function logRequest(
  request: NextRequest,
  requestId: string,
  additionalData?: Record<string, any>
) {
  const metadata = getRequestMetadata(request, requestId);

  console.log('[REQUEST]', {
    ...metadata,
    ...additionalData,
  });
}

/**
 * Log response with correlation ID
 * Useful for debugging and performance monitoring
 *
 * @param requestId - Request correlation ID
 * @param status - HTTP status code
 * @param durationMs - Request duration in milliseconds
 * @param additionalData - Optional additional data to log
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const requestId = getRequestId(request);
 *   const startTime = Date.now();
 *
 *   // ... process request
 *
 *   logResponse(requestId, 200, Date.now() - startTime);
 *   return response;
 * }
 * ```
 */
export function logResponse(
  requestId: string,
  status: number,
  durationMs: number,
  additionalData?: Record<string, any>
) {
  console.log('[RESPONSE]', {
    request_id: requestId,
    status,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
}
