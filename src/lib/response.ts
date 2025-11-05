/**
 * Response utility functions for Next.js API routes
 * Provides consistent response formatting following REST best practices
 * @module lib/response
 */

import { NextResponse } from 'next/server';
import type { Problem, StandardErrorResponse } from '@/types/api';
import { randomUUID } from 'crypto';

/**
 * Create a successful response with data
 *
 * @param data - The data to return in the response body
 * @param status - HTTP status code (defaults to 200)
 * @returns NextResponse with JSON data
 *
 * @example
 * successResponse({ id: 1, name: 'John' })
 * successResponse(items, 200)
 */
export function successResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Create a 201 Created response with Location header
 * Used when a new resource has been successfully created
 *
 * @param data - The created resource data
 * @param location - URI of the newly created resource
 * @returns NextResponse with 201 status and Location header
 *
 * @example
 * createdResponse({ id: 123, name: 'New Item' }, '/api/items/123')
 */
export function createdResponse(data: any, location: string): NextResponse {
  return NextResponse.json(data, {
    status: 201,
    headers: {
      Location: location,
    },
  });
}

/**
 * Create a 204 No Content response
 * Used for successful requests that don't return data (e.g., DELETE)
 *
 * @returns NextResponse with 204 status and no body
 *
 * @example
 * noContentResponse()
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Create an error response following RFC 7807 Problem Details
 *
 * @param problem - Problem Details object
 * @returns NextResponse with error status and Problem JSON
 *
 * @example
 * errorResponse(createProblem(404, 'Not Found', 'Customer not found'))
 */
export function errorResponse(problem: Problem): NextResponse {
  return NextResponse.json(problem, {
    status: problem.status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
}

/**
 * Create a Problem Details object following RFC 7807
 *
 * @param status - HTTP status code
 * @param title - Short, human-readable summary
 * @param detail - Optional detailed explanation
 * @param instance - Optional URI reference to the specific occurrence
 * @returns Problem object ready to be used in errorResponse
 *
 * @example
 * createProblem(404, 'Not Found', 'Customer with ID 123 not found', '/api/customers/123')
 * createProblem(400, 'Bad Request', 'Invalid email format')
 */
export function createProblem(
  status: number,
  title: string,
  detail?: string,
  instance?: string
): Problem {
  return {
    type: `https://httpstatuses.com/${status}`,
    title,
    status,
    ...(detail && { detail }),
    ...(instance && { instance }),
  };
}

/**
 * Common problem creators for frequently used errors
 */

/**
 * Create a 400 Bad Request problem
 */
export function badRequestProblem(detail: string, instance?: string): Problem {
  return createProblem(400, 'Bad Request', detail, instance);
}

/**
 * Create a 404 Not Found problem
 */
export function notFoundProblem(detail: string, instance?: string): Problem {
  return createProblem(404, 'Not Found', detail, instance);
}

/**
 * Create a 409 Conflict problem
 */
export function conflictProblem(detail: string, instance?: string): Problem {
  return createProblem(409, 'Conflict', detail, instance);
}

/**
 * Create a 500 Internal Server Error problem
 */
export function internalServerErrorProblem(
  detail: string = 'An unexpected error occurred',
  instance?: string
): Problem {
  return createProblem(500, 'Internal Server Error', detail, instance);
}

/**
 * Error code constants for standardized error responses
 */
export const ErrorCodes = {
  // 4xx Client Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',

  // 5xx Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

/**
 * Create a standardized error response
 *
 * @param code - Machine-readable error code
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional array of detailed error information
 * @param requestId - Optional request correlation ID
 * @returns NextResponse with standardized error format
 *
 * @example
 * ```ts
 * standardErrorResponse(
 *   'VALIDATION_ERROR',
 *   'Check-in date must be before check-out date',
 *   400,
 *   [{ field: 'check_in', issue: 'before_check_out' }],
 *   'req_abc123'
 * )
 * ```
 */
export function standardErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ field?: string; issue: string; message?: string }>,
  requestId?: string
): NextResponse {
  const errorResponse: StandardErrorResponse = {
    error: {
      code,
      message,
      ...(details && details.length > 0 && { details }),
      ...(requestId && { request_id: requestId }),
      type: `https://api.crm2.com/problems/${code.toLowerCase().replace(/_/g, '-')}`,
    },
  };

  return NextResponse.json(errorResponse, {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      ...(requestId && { 'X-Request-Id': requestId }),
    },
  });
}

/**
 * Create a validation error response
 *
 * @param message - Human-readable validation error message
 * @param errors - Array of field-specific validation errors
 * @param requestId - Optional request correlation ID
 * @returns NextResponse with 400 status and validation details
 *
 * @example
 * ```ts
 * validationErrorResponse(
 *   'Invalid request data',
 *   [
 *     { field: 'email', issue: 'invalid_format', message: 'Invalid email address' },
 *     { field: 'age', issue: 'out_of_range', message: 'Age must be between 18 and 100' }
 *   ]
 * )
 * ```
 */
export function validationErrorResponse(
  message: string,
  errors: Array<{ field: string; issue: string; message?: string }>,
  requestId?: string
): NextResponse {
  return standardErrorResponse(
    ErrorCodes.VALIDATION_ERROR,
    message,
    400,
    errors,
    requestId
  );
}

/**
 * Create a not found error response
 *
 * @param message - Human-readable error message
 * @param requestId - Optional request correlation ID
 * @returns NextResponse with 404 status
 */
export function notFoundErrorResponse(
  message: string,
  requestId?: string
): NextResponse {
  return standardErrorResponse(
    ErrorCodes.NOT_FOUND,
    message,
    404,
    undefined,
    requestId
  );
}

/**
 * Create an authentication required error response
 *
 * @param message - Human-readable error message
 * @param requestId - Optional request correlation ID
 * @returns NextResponse with 401 status
 */
export function authenticationErrorResponse(
  message: string = 'Authentication required',
  requestId?: string
): NextResponse {
  return standardErrorResponse(
    ErrorCodes.AUTHENTICATION_REQUIRED,
    message,
    401,
    undefined,
    requestId
  );
}

/**
 * Create an authorization failed error response
 *
 * @param message - Human-readable error message
 * @param requestId - Optional request correlation ID
 * @returns NextResponse with 403 status
 */
export function authorizationErrorResponse(
  message: string = 'You do not have permission to perform this action',
  requestId?: string
): NextResponse {
  return standardErrorResponse(
    ErrorCodes.AUTHORIZATION_FAILED,
    message,
    403,
    undefined,
    requestId
  );
}

/**
 * Create a rate limit exceeded error response
 *
 * @param message - Human-readable error message
 * @param resetTime - Optional time when the rate limit resets
 * @param requestId - Optional request correlation ID
 * @returns NextResponse with 429 status and rate limit headers
 */
export function rateLimitErrorResponse(
  message: string,
  resetTime?: number,
  requestId?: string
): NextResponse {
  const response = standardErrorResponse(
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    message,
    429,
    undefined,
    requestId
  );

  if (resetTime) {
    response.headers.set('X-RateLimit-Reset', resetTime.toString());
    response.headers.set('Retry-After', Math.ceil((resetTime - Date.now()) / 1000).toString());
  }

  return response;
}

/**
 * Generate a unique request ID
 * Used for request correlation and tracing
 *
 * @returns A unique UUID v4 string
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Add standard headers to a response
 * Includes request ID and CORS headers if needed
 *
 * @param response - NextResponse to add headers to
 * @param requestId - Request correlation ID
 * @param additionalHeaders - Optional additional headers to add
 * @returns Modified NextResponse with added headers
 */
export function addStandardHeaders(
  response: NextResponse,
  requestId: string,
  additionalHeaders?: Record<string, string>
): NextResponse {
  response.headers.set('X-Request-Id', requestId);

  if (additionalHeaders) {
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}
