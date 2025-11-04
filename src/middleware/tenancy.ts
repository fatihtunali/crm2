/**
 * Tenancy Middleware
 * Handles multi-tenant request validation and tenant ID extraction from JWT
 *
 * SECURITY: Tenant ID is extracted from the authenticated user's JWT token,
 * not from request headers. This prevents users from accessing other
 * organizations' data by manipulating headers.
 */

import { NextRequest } from 'next/server';
import type { Problem } from '@/types/api';
import { getAuthUser, type JWTPayload } from '@/lib/jwt';

export interface TenantContext {
  tenantId: string;
  user: JWTPayload;
}

/**
 * Require authentication and extract tenant ID from JWT token
 * This is the secure way to handle multi-tenancy - the organization ID
 * comes from the authenticated user's token, not from request headers.
 *
 * @param request - The incoming Next.js request
 * @returns Object containing either tenant context or error Problem
 */
export async function requireTenant(
  request: NextRequest
): Promise<{ tenantId: string; user: JWTPayload } | { error: Problem }> {
  try {
    // First, verify the user is authenticated
    const user = await getAuthUser(request);

    if (!user) {
      return {
        error: {
          type: 'https://api.crm2.com/problems/unauthorized',
          title: 'Authentication Required',
          status: 401,
          detail: 'You must be authenticated to access this resource',
          instance: request.url,
        },
      };
    }

    // Extract tenant ID from the authenticated user's JWT
    // This ensures users can only access their own organization's data
    const tenantId = user.organizationId.toString();

    if (!tenantId || tenantId === '0') {
      return {
        error: {
          type: 'https://api.crm2.com/problems/invalid-user',
          title: 'Invalid User Configuration',
          status: 403,
          detail: 'Your user account is not associated with an organization',
          instance: request.url,
        },
      };
    }

    return { tenantId, user };
  } catch (error) {
    return {
      error: {
        type: 'https://api.crm2.com/problems/authentication-error',
        title: 'Authentication Error',
        status: 401,
        detail: 'Failed to authenticate request',
        instance: request.url,
      },
    };
  }
}

/**
 * Optional tenant extraction - returns null if not authenticated
 * Use this for endpoints that may have different behavior based on authentication
 * @param request - The incoming Next.js request
 * @returns Tenant context or null if not authenticated
 */
export async function optionalTenant(
  request: NextRequest
): Promise<TenantContext | null> {
  try {
    const user = await getAuthUser(request);

    if (!user || !user.organizationId) {
      return null;
    }

    return {
      tenantId: user.organizationId.toString(),
      user,
    };
  } catch {
    return null;
  }
}
