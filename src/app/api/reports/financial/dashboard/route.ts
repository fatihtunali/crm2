import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    // Receivables summary
    const [receivablesResult] = await query(`
      SELECT
        SUM(total_amount) as total,
        SUM(paid_amount) as paid,
        SUM(total_amount - paid_amount) as outstanding,
        COUNT(*) as invoice_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
      FROM invoices_receivable ir
      JOIN quotes q ON ir.booking_id = q.id
      WHERE q.organization_id = ?
    `, [parseInt(tenantId)]) as any[];

    // Payables summary
    const [payablesResult] = await query(`
      SELECT
        SUM(total_amount) as total,
        SUM(paid_amount) as paid,
        SUM(total_amount - paid_amount) as outstanding,
        COUNT(*) as invoice_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
      FROM invoices_payable ip
      JOIN quotes q ON ip.booking_id = q.id
      WHERE q.organization_id = ?
    `, [parseInt(tenantId)]) as any[];

    // Aging buckets - Receivables
    const [receivablesAging] = await query(`
      SELECT
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN total_amount - paid_amount ELSE 0 END) as current,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN total_amount - paid_amount ELSE 0 END) as days_1_30,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN total_amount - paid_amount ELSE 0 END) as days_31_60,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN total_amount - paid_amount ELSE 0 END) as days_61_90,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN total_amount - paid_amount ELSE 0 END) as days_90_plus
      FROM invoices_receivable ir
      JOIN quotes q ON ir.booking_id = q.id
      WHERE q.organization_id = ?
      AND ir.status != 'paid'
    `, [parseInt(tenantId)]) as any[];

    // Aging buckets - Payables
    const [payablesAging] = await query(`
      SELECT
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN total_amount - paid_amount ELSE 0 END) as current,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN total_amount - paid_amount ELSE 0 END) as days_1_30,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN total_amount - paid_amount ELSE 0 END) as days_31_60,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN total_amount - paid_amount ELSE 0 END) as days_61_90,
        SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN total_amount - paid_amount ELSE 0 END) as days_90_plus
      FROM invoices_payable ip
      JOIN quotes q ON ip.booking_id = q.id
      WHERE q.organization_id = ?
      AND ip.status != 'paid'
    `, [parseInt(tenantId)]) as any[];

    // Cash flow projection (next 30 days)
    const [cashFlowResult] = await query(`
      SELECT
        SUM(CASE WHEN due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          THEN total_amount - paid_amount ELSE 0 END) as expected_receivables,
        (SELECT SUM(CASE WHEN due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          THEN total_amount - paid_amount ELSE 0 END)
          FROM invoices_payable ip2
          JOIN quotes q2 ON ip2.booking_id = q2.id
          WHERE q2.organization_id = ? AND ip2.status != 'paid') as expected_payables
      FROM invoices_receivable ir
      JOIN quotes q ON ir.booking_id = q.id
      WHERE q.organization_id = ?
      AND ir.status != 'paid'
    `, [parseInt(tenantId), parseInt(tenantId)]) as any[];

    // Monthly revenue and costs trend
    const monthlyTrend = await query(`
      SELECT
        DATE_FORMAT(invoice_date, '%Y-%m') as month,
        SUM(total_amount) as receivables,
        (SELECT SUM(total_amount)
         FROM invoices_payable ip2
         JOIN quotes q2 ON ip2.booking_id = q2.id
         WHERE q2.organization_id = ?
         AND DATE_FORMAT(ip2.invoice_date, '%Y-%m') = DATE_FORMAT(ir.invoice_date, '%Y-%m')) as payables
      FROM invoices_receivable ir
      JOIN quotes q ON ir.booking_id = q.id
      WHERE q.organization_id = ?
      AND ir.invoice_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, [parseInt(tenantId), parseInt(tenantId)]) as any[];

    const data = {
      receivables: {
        total: createMoney(parseFloat(receivablesResult?.total || 0), 'EUR'),
        paid: createMoney(parseFloat(receivablesResult?.paid || 0), 'EUR'),
        outstanding: createMoney(parseFloat(receivablesResult?.outstanding || 0), 'EUR'),
        invoiceCount: parseInt(receivablesResult?.invoice_count || 0),
        paidCount: parseInt(receivablesResult?.paid_count || 0),
        overdueCount: parseInt(receivablesResult?.overdue_count || 0)
      },
      payables: {
        total: createMoney(parseFloat(payablesResult?.total || 0), 'EUR'),
        paid: createMoney(parseFloat(payablesResult?.paid || 0), 'EUR'),
        outstanding: createMoney(parseFloat(payablesResult?.outstanding || 0), 'EUR'),
        invoiceCount: parseInt(payablesResult?.invoice_count || 0),
        paidCount: parseInt(payablesResult?.paid_count || 0),
        overdueCount: parseInt(payablesResult?.overdue_count || 0)
      },
      netPosition: createMoney(
        parseFloat(receivablesResult?.outstanding || 0) - parseFloat(payablesResult?.outstanding || 0),
        'EUR'
      ),
      receivablesAging: {
        current: createMoney(parseFloat(receivablesAging?.current || 0), 'EUR'),
        days1To30: createMoney(parseFloat(receivablesAging?.days_1_30 || 0), 'EUR'),
        days31To60: createMoney(parseFloat(receivablesAging?.days_31_60 || 0), 'EUR'),
        days61To90: createMoney(parseFloat(receivablesAging?.days_61_90 || 0), 'EUR'),
        days90Plus: createMoney(parseFloat(receivablesAging?.days_90_plus || 0), 'EUR')
      },
      payablesAging: {
        current: createMoney(parseFloat(payablesAging?.current || 0), 'EUR'),
        days1To30: createMoney(parseFloat(payablesAging?.days_1_30 || 0), 'EUR'),
        days31To60: createMoney(parseFloat(payablesAging?.days_31_60 || 0), 'EUR'),
        days61To90: createMoney(parseFloat(payablesAging?.days_61_90 || 0), 'EUR'),
        days90Plus: createMoney(parseFloat(payablesAging?.days_90_plus || 0), 'EUR')
      },
      cashFlow30Days: {
        expectedReceivables: createMoney(parseFloat(cashFlowResult?.expected_receivables || 0), 'EUR'),
        expectedPayables: createMoney(parseFloat(cashFlowResult?.expected_payables || 0), 'EUR'),
        netCashFlow: createMoney(
          parseFloat(cashFlowResult?.expected_receivables || 0) - parseFloat(cashFlowResult?.expected_payables || 0),
          'EUR'
        )
      },
      monthlyTrend: monthlyTrend.map((m: any) => ({
        month: m.month,
        receivables: createMoney(parseFloat(m.receivables || 0), 'EUR'),
        payables: createMoney(parseFloat(m.payables || 0), 'EUR'),
        netIncome: createMoney(parseFloat(m.receivables || 0) - parseFloat(m.payables || 0), 'EUR')
      })).reverse()
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}
