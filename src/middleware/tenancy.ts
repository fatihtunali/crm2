/**
 * Tenancy Middleware
 * Handles multi-tenant request validation and tenant ID extraction
 */

import { NextRequest } from 'next/server';
import type { Problem } from '@/types/api';

/**
 * Extract tenant ID from request headers
 * @param request - The incoming Next.js request
 * @returns The tenant ID if valid, null otherwise
 */
export function extractTenantId(request: NextRequest): string | null {
  const tenantId = request.headers.get('X-Tenant-Id');

  if (!tenantId) {
    return null;
  }

  // Validate tenant ID format (should be a positive integer)
  const tenantIdNum = parseInt(tenantId, 10);
  if (isNaN(tenantIdNum) || tenantIdNum <= 0) {
    return null;
  }

  return tenantId;
}

/**
 * Enforce tenant requirement for the request
 * Returns either the validated tenant ID or an RFC 7807 Problem error
 * @param request - The incoming Next.js request
 * @returns Object containing either tenantId or error Problem
 */
export function requireTenant(
  request: NextRequest
): { tenantId: string } | { error: Problem } {
  const tenantId = extractTenantId(request);

  if (!tenantId) {
    const headerValue = request.headers.get('X-Tenant-Id');

    if (!headerValue) {
      return {
        error: {
          type: 'https://api.crm2.com/problems/missing-tenant',
          title: 'Missing Tenant ID',
          status: 400,
          detail: 'The X-Tenant-Id header is required for this request',
          instance: request.url,
        },
      };
    }

    return {
      error: {
        type: 'https://api.crm2.com/problems/invalid-tenant',
        title: 'Invalid Tenant ID',
        status: 400,
        detail: `The X-Tenant-Id header value '${headerValue}' is not a valid tenant identifier. Expected a positive integer.`,
        instance: request.url,
      },
    };
  }

  return { tenantId };
}
