import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch financial summary/dashboard data
export async function GET() {
  try {
    // Get receivables summary
    const receivablesSummary = await query(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_received,
        SUM(total_amount - paid_amount) as total_outstanding,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
        SUM(CASE WHEN status = 'overdue' THEN total_amount - paid_amount ELSE 0 END) as overdue_amount
      FROM invoices_receivable
    `);

    // Get payables summary
    const payablesSummary = await query(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(total_amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(total_amount - paid_amount) as total_outstanding,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
        SUM(CASE WHEN status = 'overdue' THEN total_amount - paid_amount ELSE 0 END) as overdue_amount
      FROM invoices_payable
    `);

    // Get aging data for receivables
    const receivablesAging = await query(`
      SELECT
        SUM(CASE WHEN DATEDIFF(NOW(), due_date) <= 30 AND status != 'paid' THEN total_amount - paid_amount ELSE 0 END) as aging_0_30,
        SUM(CASE WHEN DATEDIFF(NOW(), due_date) BETWEEN 31 AND 60 AND status != 'paid' THEN total_amount - paid_amount ELSE 0 END) as aging_31_60,
        SUM(CASE WHEN DATEDIFF(NOW(), due_date) > 60 AND status != 'paid' THEN total_amount - paid_amount ELSE 0 END) as aging_60_plus
      FROM invoices_receivable
    `);

    // Get aging data for payables
    const payablesAging = await query(`
      SELECT
        SUM(CASE WHEN DATEDIFF(NOW(), due_date) <= 30 AND status != 'paid' THEN total_amount - paid_amount ELSE 0 END) as aging_0_30,
        SUM(CASE WHEN DATEDIFF(NOW(), due_date) BETWEEN 31 AND 60 AND status != 'paid' THEN total_amount - paid_amount ELSE 0 END) as aging_31_60,
        SUM(CASE WHEN DATEDIFF(NOW(), due_date) > 60 AND status != 'paid' THEN total_amount - paid_amount ELSE 0 END) as aging_60_plus
      FROM invoices_payable
    `);

    // Get top suppliers we owe
    const topSuppliers = await query(`
      SELECT
        p.provider_name,
        SUM(ip.total_amount - ip.paid_amount) as outstanding
      FROM invoices_payable ip
      JOIN providers p ON ip.provider_id = p.id
      WHERE ip.status != 'paid'
      GROUP BY p.id, p.provider_name
      ORDER BY outstanding DESC
      LIMIT 5
    `);

    // Get top customers who owe us
    const topCustomers = await query(`
      SELECT
        q.customer_name,
        SUM(ir.total_amount - ir.paid_amount) as outstanding
      FROM invoices_receivable ir
      JOIN quotes q ON ir.booking_id = q.id
      WHERE ir.status != 'paid'
      GROUP BY q.customer_name
      ORDER BY outstanding DESC
      LIMIT 5
    `);

    // Calculate business metrics
    const totalTurnover = receivablesSummary[0]?.total_amount || 0;
    const totalCosts = payablesSummary[0]?.total_amount || 0;
    const netMargin = totalTurnover - totalCosts;
    const marginPercentage = totalTurnover > 0 ? ((netMargin / totalTurnover) * 100) : 0;

    const summary = {
      receivables: receivablesSummary[0] || {},
      payables: payablesSummary[0] || {},
      receivablesAging: receivablesAging[0] || {},
      payablesAging: payablesAging[0] || {},
      topSuppliers: topSuppliers || [],
      topCustomers: topCustomers || [],
      netPosition: (receivablesSummary[0]?.total_outstanding || 0) - (payablesSummary[0]?.total_outstanding || 0),
      // Business metrics
      totalTurnover,
      totalCosts,
      netMargin,
      marginPercentage
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial summary' },
      { status: 500 }
    );
  }
}
