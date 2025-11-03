'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface QuotePerformance {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalQuotes: number;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    expired: number;
  };
  metrics: {
    conversionRate: number;
    averageTimeToAcceptance: number; // hours
    averageQuoteValue: Money;
    totalQuoteValue: Money;
    acceptedValue: Money;
  };
  quotesByCategory: Array<{
    category: string;
    count: number;
    accepted: number;
    conversionRate: number;
  }>;
  conversionFunnel: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  recentQuotes: Array<{
    id: number;
    reference: string;
    client: string;
    destination: string;
    value: Money;
    status: string;
    created_at: string;
    response_time?: number; // hours
  }>;
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function QuotePerformancePage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<QuotePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('last_30_days');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, dateRange, statusFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/sales/quotes?period=${dateRange}&status=${statusFilter}`,
        {
          headers: {
            'X-Tenant-Id': organizationId
          }
        }
      );
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const result = await res.json();
      setData(result.data || null);
    } catch (error) {
      console.error('Failed to fetch:', error);
      setError('Failed to load report. Please try again.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
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
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
    return (
      <div className="p-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          Back to Reports
        </Link>
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Report</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
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
              onClick={fetchData}
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
            <h1 className="text-3xl font-bold text-gray-900">Quote Performance Report</h1>
            <p className="text-gray-500 mt-1">
              Quote-to-booking conversion and lifecycle analysis
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
              onClick={fetchData}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
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
              <option value="this_year">This Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quote Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-500">
          <div className="text-sm text-gray-500 mb-1">Total Quotes</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalQuotes}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-500 mb-1">Draft</div>
          <div className="text-3xl font-bold text-yellow-600">{data.summary.draft}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Sent</div>
          <div className="text-3xl font-bold text-blue-600">{data.summary.sent}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Accepted</div>
          <div className="text-3xl font-bold text-green-600">{data.summary.accepted}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <div className="text-sm text-gray-500 mb-1">Rejected</div>
          <div className="text-3xl font-bold text-red-600">{data.summary.rejected}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-400">
          <div className="text-sm text-gray-500 mb-1">Expired</div>
          <div className="text-3xl font-bold text-gray-600">{data.summary.expired}</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Conversion Rate</div>
          <div className="text-3xl font-bold text-primary-600">{formatPercentage(data.metrics.conversionRate)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Avg Time to Acceptance</div>
          <div className="text-3xl font-bold text-gray-900">{data.metrics.averageTimeToAcceptance.toFixed(1)}h</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Avg Quote Value</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(data.metrics.averageQuoteValue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Accepted Value</div>
          <div className="text-2xl font-bold text-green-600">{formatMoney(data.metrics.acceptedValue)}</div>
        </div>
      </div>

      {/* Conversion Funnel & Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          {/* Funnel visualization would go here */}
          <div className="space-y-4">
            {data.conversionFunnel.map((stage, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{stage.count}</span>
                    <span className="text-sm text-gray-500 ml-2">({formatPercentage(stage.percentage)})</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8">
                  <div
                    className="bg-gradient-to-r from-primary-600 to-primary-400 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{ width: `${stage.percentage}%` }}
                  >
                    {stage.percentage > 20 && `${formatPercentage(stage.percentage)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quotes by Category */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Category</h3>
          <div className="space-y-4">
            {data.quotesByCategory.map((cat, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{cat.category}</span>
                  <span className="text-sm font-semibold text-primary-600">
                    {formatPercentage(cat.conversionRate)} conversion
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Total</div>
                    <div className="font-semibold text-gray-900">{cat.count}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Accepted</div>
                    <div className="font-semibold text-green-600">{cat.accepted}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Pending</div>
                    <div className="font-semibold text-blue-600">{cat.count - cat.accepted}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${cat.conversionRate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Quotes */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Quotes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Reference</th>
                <th className="text-left p-4 font-semibold text-gray-700">Client</th>
                <th className="text-left p-4 font-semibold text-gray-700">Destination</th>
                <th className="text-left p-4 font-semibold text-gray-700">Value</th>
                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Response Time</th>
                <th className="text-right p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.recentQuotes.map((quote) => (
                <tr key={quote.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-mono text-sm font-semibold text-primary-600">{quote.reference}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{quote.client}</div>
                  </td>
                  <td className="p-4 text-gray-600">{quote.destination}</td>
                  <td className="p-4 font-semibold text-gray-900">{formatMoney(quote.value)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      quote.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">
                    {quote.response_time ? `${quote.response_time}h` : '-'}
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/quotations/${quote.id}`}
                      className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
