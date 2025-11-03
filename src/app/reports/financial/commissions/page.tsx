'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface CommissionData {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalMarkup: Money;
    averageMarkupPercentage: number;
    bookingCount: number;
  };
  byAgent: Array<{
    agentName: string;
    totalMarkup: Money;
    bookings: number;
    averageMarkup: number;
  }>;
  byDestination: Array<{
    destination: string;
    totalMarkup: Money;
    bookings: number;
    averageMarkup: number;
  }>;
  byTourType: Array<{
    type: string;
    totalMarkup: Money;
    bookings: number;
    averageMarkup: number;
  }>;
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CommissionTrackingPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('this_year');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, dateRange]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/financial/commissions?period=${dateRange}`,
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
          <div className="h-96 bg-gray-200 rounded"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Commission Tracking</h1>
            <p className="text-gray-500 mt-1">Markup and commission analysis</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              📄 Export PDF
            </button>
            <button onClick={fetchData} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Total Markup/Commission</div>
          <div className="text-3xl font-bold text-green-600">{formatMoney(data.summary.totalMarkup)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Avg Markup Percentage</div>
          <div className="text-3xl font-bold text-primary-600">{data.summary.averageMarkupPercentage.toFixed(1)}%</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.bookingCount}</div>
        </div>
      </div>

      {/* Markup by Agent & Destination */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* By Agent */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Commission by Tour Operator</h3>
          {/* Bar chart showing markup by agent would go here */}
          <div className="space-y-4">
            {data.byAgent.map((agent, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{agent.agentName}</span>
                  <span className="text-lg font-bold text-green-600">{formatMoney(agent.totalMarkup)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Bookings:</span>
                    <span className="ml-2 font-semibold text-gray-900">{agent.bookings}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Markup:</span>
                    <span className="ml-2 font-semibold text-primary-600">{agent.averageMarkup.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Destination */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Markup by Destination</h3>
          {/* Bar chart showing markup by destination would go here */}
          <div className="space-y-4">
            {data.byDestination.map((dest, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{dest.destination}</span>
                  <span className="text-lg font-bold text-green-600">{formatMoney(dest.totalMarkup)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Bookings:</span>
                    <span className="ml-2 font-semibold text-gray-900">{dest.bookings}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Markup:</span>
                    <span className="ml-2 font-semibold text-primary-600">{dest.averageMarkup.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Markup by Tour Type */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Markup by Tour Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.byTourType.map((type, index) => (
            <div key={index} className="bg-gradient-to-br from-primary-50 to-white rounded-lg p-6 border-2 border-primary-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 mb-2">{type.type} Tours</div>
                <div className="text-4xl font-bold text-green-600 mb-4">{formatMoney(type.totalMarkup)}</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-gray-500">Bookings</div>
                    <div className="font-bold text-gray-900 text-lg">{type.bookings}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500">Avg Markup</div>
                    <div className="font-bold text-primary-600 text-lg">{type.averageMarkup.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
