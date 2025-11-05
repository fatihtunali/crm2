/**
 * Audit Logging Middleware
 * Logs user actions to the audit_logs table for compliance and security tracking
 * @module middleware/audit
 */

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getRequestId } from '@/middleware/correlation';

/**
 * Log an action to the audit trail
 *
 * Captures user actions, resource changes, and request metadata
 * for security monitoring, compliance, and debugging purposes.
 *
 * @param organizationId - Organization ID (tenant ID)
 * @param userId - User ID performing the action (null for system actions)
 * @param action - Action performed (e.g., 'user.login', 'quotation.created')
 * @param resourceType - Type of resource affected (e.g., 'quotation', 'user', 'invoice')
 * @param resourceId - ID of the resource affected (optional)
 * @param changes - Object containing changed fields and their values
 * @param metadata - Additional context about the action
 * @param request - Next.js request object (optional, for background jobs set to null)
 *
 * @example
 * ```ts
 * // Log a quotation creation
 * await auditLog(
 *   1,
 *   123,
 *   'quotation.created',
 *   'quotation',
 *   '456',
 *   { customer_name: 'John Doe', destination: 'Istanbul' },
 *   { quote_number: 'Q-2025-0001' },
 *   request
 * );
 *
 * // Log a user login
 * await auditLog(
 *   1,
 *   123,
 *   'user.login',
 *   'user',
 *   '123',
 *   null,
 *   { login_method: 'password' },
 *   request
 * );
 *
 * // Log a system action (background job)
 * await auditLog(
 *   1,
 *   null,
 *   'invoice.auto_sent',
 *   'invoice',
 *   '789',
 *   { status: 'sent' },
 *   { scheduled: true },
 *   null
 * );
 * ```
 *
 * @remarks
 * Action naming convention: `resource.action`
 * - user.login, user.logout, user.created, user.updated, user.deleted
 * - quotation.created, quotation.updated, quotation.deleted, quotation.sent
 * - invoice.created, invoice.paid, invoice.cancelled
 * - client.created, client.updated, client.deleted
 */
export async function auditLog(
  organizationId: number,
  userId: number | null,
  action: string,
  resourceType: string,
  resourceId: string | null = null,
  changes: Record<string, any> | null = null,
  metadata: Record<string, any> | null = null,
  request: NextRequest | null = null
): Promise<void> {
  try {
    // Extract request metadata if request is provided
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    let requestId: string | null = null;

    if (request) {
      // Get IP address (handle various proxy headers)
      ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') || // Cloudflare
        'unknown';

      // Get user agent
      userAgent = request.headers.get('user-agent') || null;

      // Get or generate request ID
      requestId = getRequestId(request);
    }

    // Insert audit log entry
    await query(
      `INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        request_id,
        changes,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        organizationId,
        userId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        requestId,
        changes ? JSON.stringify(changes) : null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    // Log to console for real-time monitoring
    console.log('[AUDIT]', {
      timestamp: new Date().toISOString(),
      organization_id: organizationId,
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      request_id: requestId,
      ip_address: ipAddress,
    });
  } catch (error) {
    // IMPORTANT: Audit logging failures should not break the main request
    // Log the error but don't throw it
    console.error('[AUDIT ERROR] Failed to write audit log:', error);
    console.error('[AUDIT ERROR] Context:', {
      organization_id: organizationId,
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
    });
  }
}

/**
 * Action constants for common audit log actions
 * Use these constants to ensure consistency across the application
 */
export const AuditActions = {
  // User actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PASSWORD_RESET: 'user.password_reset',

  // Quotation actions
  QUOTATION_CREATED: 'quotation.created',
  QUOTATION_UPDATED: 'quotation.updated',
  QUOTATION_DELETED: 'quotation.deleted',
  QUOTATION_SENT: 'quotation.sent',
  QUOTATION_APPROVED: 'quotation.approved',
  QUOTATION_REJECTED: 'quotation.rejected',

  // Invoice actions
  INVOICE_CREATED: 'invoice.created',
  INVOICE_UPDATED: 'invoice.updated',
  INVOICE_DELETED: 'invoice.deleted',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_CANCELLED: 'invoice.cancelled',

  // Client actions
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_DELETED: 'client.deleted',

  // Booking actions
  BOOKING_CREATED: 'booking.created',
  BOOKING_UPDATED: 'booking.updated',
  BOOKING_CANCELLED: 'booking.cancelled',

  // Role & Permission actions
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REVOKED: 'role.revoked',

  // Settings actions
  SETTINGS_UPDATED: 'settings.updated',

  // Export actions
  DATA_EXPORTED: 'data.exported',

  // Admin actions
  ADMIN_ACTION: 'admin.action',
  ADMIN_CLEANUP: 'admin.cleanup',
  ADMIN_MIGRATION: 'admin.migration',

  // Provider actions
  PROVIDER_CREATED: 'provider.created',
  PROVIDER_UPDATED: 'provider.updated',
  PROVIDER_DELETED: 'provider.deleted',

  // Request actions
  REQUEST_CREATED: 'request.created',
  REQUEST_UPDATED: 'request.updated',
  REQUEST_DELETED: 'request.deleted',
} as const;

/**
 * Resource type constants for common audit log resources
 */
export const AuditResources = {
  USER: 'user',
  QUOTATION: 'quotation',
  INVOICE: 'invoice',
  CLIENT: 'client',
  BOOKING: 'booking',
  ROLE: 'role',
  SETTINGS: 'settings',
  REPORT: 'report',
  TOUR: 'tour',
  ADMIN: 'admin',
  PROVIDER: 'provider',
  REQUEST: 'request',
  HOTEL: 'hotel',
  GUIDE: 'guide',
  VEHICLE: 'vehicle',
  RESTAURANT: 'restaurant',
  TRANSFER: 'transfer',
  ENTRANCE_FEE: 'entrance_fee',
  SUPPLIER: 'supplier',
} as const;
