/**
 * Token Refresh API Endpoint - Phase 2
 * Implements secure token refresh with token rotation
 *
 * POST /api/auth/refresh - Refresh access token using refresh token
 *
 * Security Features:
 * - Token rotation: Old refresh token is revoked when new one is issued
 * - Expiry validation: Checks if refresh token is expired
 * - Revocation checking: Validates token hasn't been revoked
 * - User status validation: Ensures user is still active
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateRefreshToken,
  revokeRefreshToken,
  generateRefreshToken,
  storeRefreshToken,
  createToken,
} from '@/lib/jwt';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
} from '@/lib/response';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';

/**
 * POST /api/auth/refresh
 * Refresh access token using a valid refresh token
 *
 * Request body:
 * {
 *   "refresh_token": "64-character-hex-string"
 * }
 *
 * Success response (200):
 * {
 *   "access_token": "jwt-token",
 *   "refresh_token": "new-64-character-hex-string",
 *   "expires_in": 604800
 * }
 *
 * Error responses:
 * - 400: Missing or invalid refresh token
 * - 401: Expired, revoked, or invalid refresh token
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Parse request body
    const body = await request.json();
    const { refresh_token } = body;

    // 2. Validate request
    if (!refresh_token || typeof refresh_token !== 'string') {
      logResponse(requestId, 400, Date.now() - startTime);
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'refresh_token', issue: 'required', message: 'Refresh token is required' }],
        requestId
      );
    }

    // 3. Validate refresh token format (should be 64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(refresh_token)) {
      logResponse(requestId, 400, Date.now() - startTime);
      return validationErrorResponse(
        'Invalid request data',
        [{ field: 'refresh_token', issue: 'invalid_format', message: 'Invalid refresh token format' }],
        requestId
      );
    }

    // 4. Validate refresh token against database
    const tokenData = await validateRefreshToken(refresh_token);

    if (!tokenData) {
      // Token is invalid, expired, revoked, or user is inactive
      logResponse(requestId, 401, Date.now() - startTime, {
        reason: 'invalid_refresh_token'
      });
      return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        'Invalid or expired refresh token',
        401,
        undefined,
        requestId
      );
    }

    // 5. Revoke old refresh token (token rotation security measure)
    await revokeRefreshToken(refresh_token);

    // 6. Generate new access token
    const accessToken = await createToken({
      userId: tokenData.userId,
      email: tokenData.email,
      organizationId: tokenData.organizationId,
      role: tokenData.role,
    });

    // 7. Generate and store new refresh token
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(tokenData.userId, newRefreshToken);

    // 8. Log successful token refresh
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: tokenData.userId,
      action: 'token_refresh',
    });

    // 9. Return new tokens
    return NextResponse.json(
      {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_in: 604800, // 7 days in seconds
        token_type: 'Bearer',
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
        },
      }
    );
  } catch (error) {
    // Log error
    console.error('[Token Refresh Error]', {
      request_id: requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    logResponse(requestId, 500, Date.now() - startTime, {
      error: 'internal_error',
    });

    // Return generic error (don't expose internal details)
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An error occurred while refreshing the token. Please try again.',
      500,
      undefined,
      requestId
    );
  }
}
