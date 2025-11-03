'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface ExecutiveSummary {
  period: {
    start_date: string;
    end_date: string;
  };
  keyMetrics: {
    totalRevenue: Money;
    totalBookings: number;
    averageBookingValue: Money;
    netMargin: Money;
    netMarginPercentage: number;
    totalClients: number;
    newClients: number;
    activeAgents: number;
  };
  comparison: {
    revenueChange: number;
    bookingsChange: number;
    marginChange: number;
    clientsChange: number;
  };
  topPerformers: {
    destinations: Array<{
      name: string;
      revenue: Money;
      bookings: number;
    }>;
    agents: Array<{
      id: number;
      name: string;
      revenue: Money;
      bookings: number;
    }>;
    clients: Array<{
      id: number;
      name: string;
      revenue: Money;
      bookings: number;
    }>;
  };
  financialHealth: {
    outstandingReceivables: Money;
    outstandingPayables: Money;
    cashPosition: Money;
    daysReceivableOutstanding: number;
    daysPayableOutstanding: number;
  };
  operationalMetrics: {
    conversionRate: number;
    averageQuoteValue: Money;
    averageResponseTime: number; // hours
    upcomingToursCount: number;
    resourceUtilization: number; // percentage
  };
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function ExecutiveSummaryPage() {
  const { organizationId } = useAuth();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('last_30_days');
  const [comparisonPeriod, setComparisonPeriod] = useState('previous_period');

  useEffect(() => {
    if (organizationId) {
      fetchSummary();
    }
  }, [organizationId, dateRange, comparisonPeriod]);

  async function fetchSummary() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/executive/summary?period=${dateRange}&comparison=${comparisonPeriod}`,
        {
          headers: {
            'X-Tenant-Id': organizationId
          }
        }
      );

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setSummary(data.data || null);
    } catch (error) {
      console.error('Failed to fetch executive summary:', error);
      setError('Failed to load executive summary. Please try again.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          Back to Reports
        </Link>
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Report</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchSummary}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!summary || !summary.keyMetrics) {
    return (
      <div className="p-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          Back to Reports
        </Link>
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-6">
            There is no data for the selected period. Create some bookings and quotations to see reports.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/quotations"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Quotation
            </Link>
            <button
              onClick={fetchSummary}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Executive Summary Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {new Date(summary.period.start_date).toLocaleDateString()} - {new Date(summary.period.end_date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              📄 Export PDF
            </button>
            <button
              onClick={fetchSummary}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_90_days">Last 90 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="last_year">Last Year</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Compare To</label>
          <select
            value={comparisonPeriod}
            onChange={(e) => setComparisonPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="previous_period">Previous Period</option>
            <option value="last_year">Same Period Last Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
            <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-gray-900">{formatMoney(summary.keyMetrics.totalRevenue)}</div>
            <div className={`text-sm mt-2 ${summary.comparison.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(summary.comparison.revenueChange)} vs previous
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
            <div className="text-3xl font-bold text-gray-900">{summary.keyMetrics.totalBookings}</div>
            <div className={`text-sm mt-2 ${summary.comparison.bookingsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(summary.comparison.bookingsChange)} vs previous
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="text-sm text-gray-500 mb-1">Net Margin</div>
            <div className="text-3xl font-bold text-gray-900">{formatMoney(summary.keyMetrics.netMargin)}</div>
            <div className={`text-sm mt-2 ${summary.comparison.marginChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(summary.comparison.marginChange)} vs previous • {summary.keyMetrics.netMarginPercentage.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="text-sm text-gray-500 mb-1">Active Clients</div>
            <div className="text-3xl font-bold text-gray-900">{summary.keyMetrics.totalClients}</div>
            <div className={`text-sm mt-2 ${summary.comparison.clientsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(summary.comparison.clientsChange)} • {summary.keyMetrics.newClients} new
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Avg Booking Value</div>
            <div className="text-2xl font-bold text-gray-900">{formatMoney(summary.keyMetrics.averageBookingValue)}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Active Agents</div>
            <div className="text-2xl font-bold text-gray-900">{summary.keyMetrics.activeAgents}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Conversion Rate</div>
            <div className="text-2xl font-bold text-gray-900">{summary.operationalMetrics.conversionRate}%</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Upcoming Tours</div>
            <div className="text-2xl font-bold text-gray-900">{summary.operationalMetrics.upcomingToursCount}</div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Top Destinations */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🌍 Top Destinations</h3>
          <div className="space-y-3">
            {summary.topPerformers.destinations.map((dest, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{dest.name}</div>
                  <div className="text-sm text-gray-500">{dest.bookings} bookings</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary-600">{formatMoney(dest.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Agents */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🏢 Top Tour Operators</h3>
          <div className="space-y-3">
            {summary.topPerformers.agents.map((agent, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{agent.name}</div>
                  <div className="text-sm text-gray-500">{agent.bookings} bookings</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary-600">{formatMoney(agent.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Top Clients</h3>
          <div className="space-y-3">
            {summary.topPerformers.clients.map((client, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{client.name}</div>
                  <div className="text-sm text-gray-500">{client.bookings} bookings</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary-600">{formatMoney(client.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Health & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Health */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Financial Health</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Outstanding Receivables</span>
              <span className="font-semibold text-gray-900">{formatMoney(summary.financialHealth.outstandingReceivables)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Outstanding Payables</span>
              <span className="font-semibold text-gray-900">{formatMoney(summary.financialHealth.outstandingPayables)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Net Cash Position</span>
              <span className="font-semibold text-green-600">{formatMoney(summary.financialHealth.cashPosition)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Days Receivable Outstanding</span>
              <span className="font-semibold text-gray-900">{summary.financialHealth.daysReceivableOutstanding} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Days Payable Outstanding</span>
              <span className="font-semibold text-gray-900">{summary.financialHealth.daysPayableOutstanding} days</span>
            </div>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Operational Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Quote Conversion Rate</span>
              <span className="font-semibold text-green-600">{summary.operationalMetrics.conversionRate}%</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Average Quote Value</span>
              <span className="font-semibold text-gray-900">{formatMoney(summary.operationalMetrics.averageQuoteValue)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Avg Response Time</span>
              <span className="font-semibold text-gray-900">{summary.operationalMetrics.averageResponseTime} hours</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Upcoming Tours</span>
              <span className="font-semibold text-gray-900">{summary.operationalMetrics.upcomingToursCount} tours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Resource Utilization</span>
              <span className="font-semibold text-gray-900">{summary.operationalMetrics.resourceUtilization}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
