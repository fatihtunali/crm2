import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';
import { createMoney } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    // Require tenant
    const tenantResult = requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'last_30_days';
    const { startDate, endDate } = calculateDateRange(period);

    // Quotes by status
    const quotesByStatus = await query(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_price) as total_value,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'accepted' THEN 1
          WHEN 'sent' THEN 2
          WHEN 'draft' THEN 3
          WHEN 'rejected' THEN 4
          WHEN 'expired' THEN 5
        END
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Conversion funnel with time metrics
    const [funnelResult] = await query(`
      SELECT
        COUNT(*) as total_quotes,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status IN ('sent', 'accepted', 'rejected', 'expired') THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
        AVG(CASE
          WHEN status = 'accepted' AND sent_at IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, sent_at, updated_at)
        END) as avg_hours_to_acceptance,
        AVG(CASE
          WHEN status = 'rejected' AND sent_at IS NOT NULL
          THEN TIMESTAMPDIFF(HOUR, sent_at, updated_at)
        END) as avg_hours_to_rejection
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    const totalQuotes = parseInt(funnelResult?.total_quotes || 0);
    const sent = parseInt(funnelResult?.sent || 0);
    const accepted = parseInt(funnelResult?.accepted || 0);
    const rejected = parseInt(funnelResult?.rejected || 0);

    const conversionRate = sent > 0 ? (accepted / sent) * 100 : 0;
    const rejectionRate = sent > 0 ? (rejected / sent) * 100 : 0;

    // Quote value distribution (buckets)
    const valueDistribution = await query(`
      SELECT
        CASE
          WHEN total_price < 1000 THEN 'Under €1,000'
          WHEN total_price BETWEEN 1000 AND 2499 THEN '€1,000 - €2,499'
          WHEN total_price BETWEEN 2500 AND 4999 THEN '€2,500 - €4,999'
          WHEN total_price BETWEEN 5000 AND 9999 THEN '€5,000 - €9,999'
          ELSE '€10,000+'
        END as value_range,
        COUNT(*) as count,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
      AND total_price IS NOT NULL
      GROUP BY value_range
      ORDER BY MIN(total_price)
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Conversion rate by category
    const conversionByCategory = await query(`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status IN ('sent', 'accepted', 'rejected') THEN 1 END) as sent,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
      AND category IS NOT NULL
      GROUP BY category
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Conversion rate by destination
    const conversionByDestination = await query(`
      SELECT
        destination,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status IN ('sent', 'accepted', 'rejected') THEN 1 END) as sent,
        AVG(total_price) as avg_value
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
      AND destination IS NOT NULL
      GROUP BY destination
      ORDER BY total DESC
      LIMIT 10
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Response time analysis
    const [responseTimeResult] = await query(`
      SELECT
        AVG(TIMESTAMPDIFF(HOUR, created_at, sent_at)) as avg_time_to_send,
        MIN(TIMESTAMPDIFF(HOUR, created_at, sent_at)) as min_time_to_send,
        MAX(TIMESTAMPDIFF(HOUR, created_at, sent_at)) as max_time_to_send
      FROM quotes
      WHERE organization_id = ?
      AND created_at BETWEEN ? AND ?
      AND sent_at IS NOT NULL
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Top performing quotes
    const topQuotes = await query(`
      SELECT
        id,
        quote_number,
        customer_name,
        destination,
        total_price,
        status,
        created_at,
        sent_at
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND start_date BETWEEN ? AND ?
      ORDER BY total_price DESC
      LIMIT 10
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Format response
    const data = {
      period: {
        start_date: startDate,
        end_date: endDate
      },
      summary: {
        totalQuotes: totalQuotes,
        conversionRate: Math.round(conversionRate * 100) / 100,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        avgTimeToAcceptance: Math.round(parseFloat(funnelResult?.avg_hours_to_acceptance || 0)),
        avgTimeToRejection: Math.round(parseFloat(funnelResult?.avg_hours_to_rejection || 0)),
        avgTimeToSend: Math.round(parseFloat(responseTimeResult?.avg_time_to_send || 0))
      },
      byStatus: quotesByStatus.map((s: any) => ({
        status: s.status,
        count: parseInt(s.count || 0),
        totalValue: createMoney(parseFloat(s.total_value || 0), 'EUR'),
        avgValue: createMoney(parseFloat(s.avg_value || 0), 'EUR')
      })),
      conversionFunnel: {
        draft: parseInt(funnelResult?.draft || 0),
        sent: sent,
        accepted: accepted,
        rejected: rejected,
        expired: parseInt(funnelResult?.expired || 0),
        draftToSentRate: totalQuotes > 0 ? Math.round((sent / totalQuotes) * 100 * 100) / 100 : 0,
        sentToAcceptedRate: conversionRate,
        sentToRejectedRate: rejectionRate
      },
      valueDistribution: valueDistribution.map((v: any) => ({
        range: v.value_range,
        count: parseInt(v.count || 0),
        avgValue: createMoney(parseFloat(v.avg_value || 0), 'EUR')
      })),
      conversionByCategory: conversionByCategory.map((c: any) => {
        const catSent = parseInt(c.sent || 0);
        const catAccepted = parseInt(c.accepted || 0);
        return {
          category: c.category,
          total: parseInt(c.total || 0),
          accepted: catAccepted,
          sent: catSent,
          conversionRate: catSent > 0 ? Math.round((catAccepted / catSent) * 100 * 100) / 100 : 0,
          avgValue: createMoney(parseFloat(c.avg_value || 0), 'EUR')
        };
      }),
      conversionByDestination: conversionByDestination.map((d: any) => {
        const destSent = parseInt(d.sent || 0);
        const destAccepted = parseInt(d.accepted || 0);
        return {
          destination: d.destination,
          total: parseInt(d.total || 0),
          accepted: destAccepted,
          sent: destSent,
          conversionRate: destSent > 0 ? Math.round((destAccepted / destSent) * 100 * 100) / 100 : 0,
          avgValue: createMoney(parseFloat(d.avg_value || 0), 'EUR')
        };
      }),
      topQuotes: topQuotes.map((q: any) => ({
        id: q.id,
        quoteNumber: q.quote_number,
        customerName: q.customer_name,
        destination: q.destination,
        value: createMoney(parseFloat(q.total_price || 0), 'EUR'),
        status: q.status,
        createdAt: q.created_at,
        sentAt: q.sent_at
      }))
    };

    return successResponse(data);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem(request.url));
  }
}

function calculateDateRange(period: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now);

  switch(period) {
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_90_days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
