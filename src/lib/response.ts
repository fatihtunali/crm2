/**
 * Response utility functions for Next.js API routes
 * Provides consistent response formatting following REST best practices
 * @module lib/response
 */

import { NextResponse } from 'next/server';
import type { Problem } from '@/types/api';

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
