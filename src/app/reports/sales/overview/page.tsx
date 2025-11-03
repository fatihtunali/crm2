'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface SalesOverview {
  period: {
    start_date: string;
    end_date: string;
  };
  keyMetrics: {
    totalRevenue: Money;
    totalBookings: number;
    averageBookingValue: Money;
    conversionRate: number;
  };
  comparison: {
    revenueChange: number;
    bookingsChange: number;
    avgValueChange: number;
    conversionChange: number;
  };
  revenueByMonth: Array<{
    month: string;
    revenue: Money;
    bookings: number;
  }>;
  revenueByDestination: Array<{
    destination: string;
    revenue: Money;
    bookings: number;
    percentage: number;
  }>;
  revenueByTourType: Array<{
    type: string;
    revenue: Money;
    bookings: number;
  }>;
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function SalesOverviewPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('last_90_days');

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
        `/api/reports/sales/overview?period=${dateRange}`,
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
            <h1 className="text-3xl font-bold text-gray-900">Sales Overview Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {new Date(data.period.start_date).toLocaleDateString()} - {new Date(data.period.end_date).toLocaleDateString()}
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
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="last_6_months">Last 6 Months</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.keyMetrics.totalRevenue)}</div>
          <div className={`text-sm mt-2 ${data.comparison.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(data.comparison.revenueChange)} vs previous period
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{data.keyMetrics.totalBookings}</div>
          <div className={`text-sm mt-2 ${data.comparison.bookingsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(data.comparison.bookingsChange)} vs previous period
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Avg Booking Value</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.keyMetrics.averageBookingValue)}</div>
          <div className={`text-sm mt-2 ${data.comparison.avgValueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(data.comparison.avgValueChange)} vs previous period
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-500 mb-1">Conversion Rate</div>
          <div className="text-3xl font-bold text-gray-900">{data.keyMetrics.conversionRate}%</div>
          <div className={`text-sm mt-2 ${data.comparison.conversionChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentage(data.comparison.conversionChange)} vs previous period
          </div>
        </div>
      </div>

      {/* Revenue by Month */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        {/* Line chart showing revenue trend would go here */}
        <div className="space-y-4">
          {data.revenueByMonth.map((month, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{month.month}</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{formatMoney(month.revenue)}</span>
                  <span className="text-sm text-gray-500 ml-2">({month.bookings} bookings)</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full"
                  style={{ width: `${(month.revenue.amount_minor / data.revenueByMonth[data.revenueByMonth.length - 1].revenue.amount_minor) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue by Destination & Tour Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Destination */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Destination</h3>
          {/* Bar chart showing destination revenue would go here */}
          <div className="space-y-4">
            {data.revenueByDestination.map((dest, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{dest.destination}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{formatMoney(dest.revenue)}</span>
                    <span className="text-sm text-gray-500 ml-2">({dest.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{ width: `${dest.percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{dest.bookings} bookings</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Tour Type */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Tour Type</h3>
          {/* Pie chart showing tour type distribution would go here */}
          <div className="space-y-6">
            {data.revenueByTourType.map((type, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-gray-900">{type.type}</span>
                  <span className="text-2xl font-bold text-primary-600">{formatMoney(type.revenue)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Bookings</div>
                    <div className="font-semibold text-gray-900">{type.bookings}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Avg Value</div>
                    <div className="font-semibold text-gray-900">
                      {formatMoney({ amount_minor: Math.round(type.revenue.amount_minor / type.bookings), currency: 'EUR' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
