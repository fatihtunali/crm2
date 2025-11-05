/**
 * Finance Summary Report API Endpoint - PHASE 1 STANDARDS APPLIED
 * Demonstrates Phase 1 standards:
 * - Request correlation IDs (X-Request-Id)
 * - Standardized error responses with error codes
 * - Rate limiting (100 requests/hour for reports)
 * - Request/response logging
 * - Standard headers
 *
 * GET /api/finance/summary - Get finance summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { standardErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { checkIdempotencyKeyDB, storeIdempotencyKeyDB } from '@/middleware/idempotency-db';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  try {
    // 1. Authenticate and get tenant
    const authResult = await requirePermission(request, 'finance', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // 2. Rate limiting (100 requests per hour per user for read-only reports)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}_finance`,
      100,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }

// Require tenant
        // Get receivables summary with tenant filtering
        const receivablesSummary = await query(`
          SELECT
            COUNT(*) as total_invoices,
            SUM(ir.total_amount) as total_amount,
            SUM(ir.paid_amount) as total_received,
            SUM(ir.total_amount - ir.paid_amount) as total_outstanding,
            COUNT(CASE WHEN ir.status = 'overdue' THEN 1 END) as overdue_count,
            SUM(CASE WHEN ir.status = 'overdue' THEN ir.total_amount - ir.paid_amount ELSE 0 END) as overdue_amount
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE q.organization_id = ?
        `, [parseInt(tenantId)]);

        // Get payables summary with tenant filtering
        const payablesSummary = await query(`
          SELECT
            COUNT(*) as total_invoices,
            SUM(ip.total_amount) as total_amount,
            SUM(ip.paid_amount) as total_paid,
            SUM(ip.total_amount - ip.paid_amount) as total_outstanding,
            COUNT(CASE WHEN ip.status = 'overdue' THEN 1 END) as overdue_count,
            SUM(CASE WHEN ip.status = 'overdue' THEN ip.total_amount - ip.paid_amount ELSE 0 END) as overdue_amount
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
        `, [parseInt(tenantId)]);

        // Get aging data for receivables
        const receivablesAging = await query(`
          SELECT
            SUM(CASE WHEN DATEDIFF(NOW(), ir.due_date) <= 30 AND ir.status != 'paid' THEN ir.total_amount - ir.paid_amount ELSE 0 END) as aging_0_30,
            SUM(CASE WHEN DATEDIFF(NOW(), ir.due_date) BETWEEN 31 AND 60 AND ir.status != 'paid' THEN ir.total_amount - ir.paid_amount ELSE 0 END) as aging_31_60,
            SUM(CASE WHEN DATEDIFF(NOW(), ir.due_date) > 60 AND ir.status != 'paid' THEN ir.total_amount - ir.paid_amount ELSE 0 END) as aging_60_plus
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE q.organization_id = ?
        `, [parseInt(tenantId)]);

        // Get aging data for payables
        const payablesAging = await query(`
          SELECT
            SUM(CASE WHEN DATEDIFF(NOW(), ip.due_date) <= 30 AND ip.status != 'paid' THEN ip.total_amount - ip.paid_amount ELSE 0 END) as aging_0_30,
            SUM(CASE WHEN DATEDIFF(NOW(), ip.due_date) BETWEEN 31 AND 60 AND ip.status != 'paid' THEN ip.total_amount - ip.paid_amount ELSE 0 END) as aging_31_60,
            SUM(CASE WHEN DATEDIFF(NOW(), ip.due_date) > 60 AND ip.status != 'paid' THEN ip.total_amount - ip.paid_amount ELSE 0 END) as aging_60_plus
          FROM invoices_payable ip
          JOIN quotes q ON ip.booking_id = q.id
          WHERE q.organization_id = ?
        `, [parseInt(tenantId)]);

        // Get top suppliers we owe
        const topSuppliers = await query(`
          SELECT
            p.provider_name,
            SUM(ip.total_amount - ip.paid_amount) as outstanding
          FROM invoices_payable ip
          JOIN providers p ON ip.provider_id = p.id
          JOIN quotes q ON ip.booking_id = q.id
          WHERE ip.status != 'paid'
            AND q.organization_id = ?
          GROUP BY p.id, p.provider_name
          ORDER BY outstanding DESC
          LIMIT 5
        `, [parseInt(tenantId)]);

        // Get top customers who owe us
        const topCustomers = await query(`
          SELECT
            q.customer_name,
            SUM(ir.total_amount - ir.paid_amount) as outstanding
          FROM invoices_receivable ir
          JOIN quotes q ON ir.booking_id = q.id
          WHERE ir.status != 'paid'
            AND q.organization_id = ?
          GROUP BY q.customer_name
          ORDER BY outstanding DESC
          LIMIT 5
        `, [parseInt(tenantId)]);

        // Calculate business metrics
        const totalTurnover = parseFloat((receivablesSummary as any)[0]?.total_amount || 0);
        const totalCosts = parseFloat((payablesSummary as any)[0]?.total_amount || 0);
        const netMargin = totalTurnover - totalCosts;
        const marginPercentage = totalTurnover > 0 ? ((netMargin / totalTurnover) * 100) : 0;

        // Transform to use Money types
        const receivablesData = (receivablesSummary as any)[0] || {};
        const payablesData = (payablesSummary as any)[0] || {};
        const receivablesAgingData = (receivablesAging as any)[0] || {};
        const payablesAgingData = (payablesAging as any)[0] || {};

        const summary = {
          receivables: {
            total_invoices: receivablesData.total_invoices || 0,
            total_amount: createMoney(parseFloat(receivablesData.total_amount || 0), 'EUR'),
            total_received: createMoney(parseFloat(receivablesData.total_received || 0), 'EUR'),
            total_outstanding: createMoney(parseFloat(receivablesData.total_outstanding || 0), 'EUR'),
            overdue_count: receivablesData.overdue_count || 0,
            overdue_amount: createMoney(parseFloat(receivablesData.overdue_amount || 0), 'EUR')
          },
          payables: {
            total_invoices: payablesData.total_invoices || 0,
            total_amount: createMoney(parseFloat(payablesData.total_amount || 0), 'EUR'),
            total_paid: createMoney(parseFloat(payablesData.total_paid || 0), 'EUR'),
            total_outstanding: createMoney(parseFloat(payablesData.total_outstanding || 0), 'EUR'),
            overdue_count: payablesData.overdue_count || 0,
            overdue_amount: createMoney(parseFloat(payablesData.overdue_amount || 0), 'EUR')
          },
          receivablesAging: {
            aging_0_30: createMoney(parseFloat(receivablesAgingData.aging_0_30 || 0), 'EUR'),
            aging_31_60: createMoney(parseFloat(receivablesAgingData.aging_31_60 || 0), 'EUR'),
            aging_60_plus: createMoney(parseFloat(receivablesAgingData.aging_60_plus || 0), 'EUR')
          },
          payablesAging: {
            aging_0_30: createMoney(parseFloat(payablesAgingData.aging_0_30 || 0), 'EUR'),
            aging_31_60: createMoney(parseFloat(payablesAgingData.aging_31_60 || 0), 'EUR'),
            aging_60_plus: createMoney(parseFloat(payablesAgingData.aging_60_plus || 0), 'EUR')
          },
          topSuppliers: (topSuppliers as any[]).map(s => ({
            provider_name: s.provider_name,
            outstanding: createMoney(parseFloat(s.outstanding || 0), 'EUR')
          })),
          topCustomers: (topCustomers as any[]).map(c => ({
            customer_name: c.customer_name,
            outstanding: createMoney(parseFloat(c.outstanding || 0), 'EUR')
          })),
          netPosition: createMoney(
            parseFloat(receivablesData.total_outstanding || 0) - parseFloat(payablesData.total_outstanding || 0),
            'EUR'
          ),
          // Business metrics
          totalTurnover: createMoney(totalTurnover, 'EUR'),
          totalCosts: createMoney(totalCosts, 'EUR'),
          netMargin: createMoney(netMargin, 'EUR'),
          marginPercentage: marginPercentage.toFixed(2)
        };

    // Create response with headers
    const response = NextResponse.json({ data: summary });
    addRateLimitHeaders(response, rateLimit);
    addStandardHeaders(response, requestId);

    // Log response
    logResponse(requestId, 200, Date.now() - startTime, {
      user_id: user.userId,
      tenant_id: tenantId,
      report: 'finance_summary',
    });

    return response;
  } catch (error: any) {
    console.error('Error in finance summary report:', error);
    logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message
    });
    return standardErrorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An unexpected error occurred while generating the report',
      500,
      undefined,
      requestId
    );
  }
}

