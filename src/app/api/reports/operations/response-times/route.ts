import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse, internalServerErrorProblem } from '@/lib/response';
import { requireTenant } from '@/middleware/tenancy';

export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId } = tenantResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'last_30_days';
    const { startDate, endDate } = calculateDateRange(period);

    // Overall response time metrics
    const [overallMetrics] = await query(`
      SELECT
        AVG(TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at)) as avg_response_hours,
        MIN(TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at)) as min_response_hours,
        MAX(TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at)) as max_response_hours,
        COUNT(*) as total_responses
      FROM customer_itineraries ci
      JOIN quotes q ON ci.customer_email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE q.organization_id = ?
      AND q.created_at BETWEEN ? AND ?
      AND ci.created_at < q.created_at
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Time to send quote (draft to sent)
    const [sendTimeMetrics] = await query(`
      SELECT
        AVG(TIMESTAMPDIFF(HOUR, created_at, sent_at)) as avg_send_hours,
        MIN(TIMESTAMPDIFF(HOUR, created_at, sent_at)) as min_send_hours,
        MAX(TIMESTAMPDIFF(HOUR, created_at, sent_at)) as max_send_hours
      FROM quotes
      WHERE organization_id = ?
      AND sent_at IS NOT NULL
      AND sent_at BETWEEN ? AND ?
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Time to close (sent to accepted)
    const [closeTimeMetrics] = await query(`
      SELECT
        AVG(TIMESTAMPDIFF(HOUR, sent_at, updated_at)) as avg_close_hours,
        MIN(TIMESTAMPDIFF(HOUR, sent_at, updated_at)) as min_close_hours,
        MAX(TIMESTAMPDIFF(HOUR, sent_at, updated_at)) as max_close_hours
      FROM quotes
      WHERE organization_id = ?
      AND status = 'accepted'
      AND sent_at IS NOT NULL
      AND updated_at BETWEEN ? AND ?
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Response time by destination
    const byDestination = await query(`
      SELECT
        q.destination,
        AVG(TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at)) as avg_response_hours,
        COUNT(*) as quote_count
      FROM customer_itineraries ci
      JOIN quotes q ON ci.customer_email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE q.organization_id = ?
      AND q.created_at BETWEEN ? AND ?
      AND ci.created_at < q.created_at
      AND q.destination IS NOT NULL
      GROUP BY q.destination
      HAVING quote_count > 0
      ORDER BY avg_response_hours ASC
      LIMIT 10
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Response time trend (daily average)
    const dailyTrend = await query(`
      SELECT
        DATE(q.created_at) as date,
        AVG(TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at)) as avg_response_hours,
        COUNT(*) as responses
      FROM customer_itineraries ci
      JOIN quotes q ON ci.customer_email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE q.organization_id = ?
      AND q.created_at BETWEEN ? AND ?
      AND ci.created_at < q.created_at
      GROUP BY DATE(q.created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    // Response time distribution
    const distribution = await query(`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at) <= 2 THEN '0-2 hours'
          WHEN TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at) <= 6 THEN '2-6 hours'
          WHEN TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at) <= 24 THEN '6-24 hours'
          WHEN TIMESTAMPDIFF(HOUR, ci.created_at, q.created_at) <= 48 THEN '24-48 hours'
          ELSE '48+ hours'
        END as time_range,
        COUNT(*) as count
      FROM customer_itineraries ci
      JOIN quotes q ON ci.customer_email COLLATE utf8mb4_unicode_ci = q.customer_email COLLATE utf8mb4_unicode_ci
      WHERE q.organization_id = ?
      AND q.created_at BETWEEN ? AND ?
      AND ci.created_at < q.created_at
      GROUP BY time_range
      ORDER BY
        CASE time_range
          WHEN '0-2 hours' THEN 1
          WHEN '2-6 hours' THEN 2
          WHEN '6-24 hours' THEN 3
          WHEN '24-48 hours' THEN 4
          WHEN '48+ hours' THEN 5
        END
    `, [parseInt(tenantId), startDate, endDate]) as any[];

    const data = {
      period: { start_date: startDate, end_date: endDate },
      overallMetrics: {
        avgResponseHours: Math.round(parseFloat(overallMetrics?.avg_response_hours || 0)),
        minResponseHours: Math.round(parseFloat(overallMetrics?.min_response_hours || 0)),
        maxResponseHours: Math.round(parseFloat(overallMetrics?.max_response_hours || 0)),
        totalResponses: parseInt(overallMetrics?.total_responses || 0)
      },
      sendTimeMetrics: {
        avgSendHours: Math.round(parseFloat(sendTimeMetrics?.avg_send_hours || 0)),
        minSendHours: Math.round(parseFloat(sendTimeMetrics?.min_send_hours || 0)),
        maxSendHours: Math.round(parseFloat(sendTimeMetrics?.max_send_hours || 0))
      },
      closeTimeMetrics: {
        avgCloseHours: Math.round(parseFloat(closeTimeMetrics?.avg_close_hours || 0)),
        minCloseHours: Math.round(parseFloat(closeTimeMetrics?.min_close_hours || 0)),
        maxCloseHours: Math.round(parseFloat(closeTimeMetrics?.max_close_hours || 0))
      },
      byDestination: byDestination.map((d: any) => ({
        destination: d.destination,
        avgResponseHours: Math.round(parseFloat(d.avg_response_hours || 0)),
        quoteCount: parseInt(d.quote_count || 0)
      })),
      dailyTrend: dailyTrend.map((t: any) => ({
        date: t.date,
        avgResponseHours: Math.round(parseFloat(t.avg_response_hours || 0)),
        responses: parseInt(t.responses || 0)
      })).reverse(),
      distribution: distribution.map((d: any) => ({
        timeRange: d.time_range,
        count: parseInt(d.count || 0)
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
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
