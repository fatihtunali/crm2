'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface DestinationRevenue {
  destination: string;
  currentYear: {
    revenue: Money;
    bookings: number;
    averageValue: Money;
  };
  previousYear: {
    revenue: Money;
    bookings: number;
    averageValue: Money;
  };
  growth: {
    revenueChange: number;
    bookingsChange: number;
  };
}

interface RevenueByDestination {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalRevenue: Money;
    totalBookings: number;
    destinationCount: number;
  };
  destinations: DestinationRevenue[];
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function RevenueByDestinationPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<RevenueByDestination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('this_year');
  const [sortBy, setSortBy] = useState('revenue');

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
        `/api/reports/sales/destinations?period=${dateRange}`,
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

  const sortedDestinations = data ? [...data.destinations].sort((a, b) => {
    if (sortBy === 'revenue') {
      return b.currentYear.revenue.amount_minor - a.currentYear.revenue.amount_minor;
    } else if (sortBy === 'bookings') {
      return b.currentYear.bookings - a.currentYear.bookings;
    } else if (sortBy === 'growth') {
      return b.growth.revenueChange - a.growth.revenueChange;
    }
    return 0;
  }) : [];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
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

  const maxRevenue = Math.max(...data.destinations.map(d => d.currentYear.revenue.amount_minor));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue by Destination</h1>
            <p className="text-gray-500 mt-1">Compare revenue across different destinations</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="revenue">Revenue (High to Low)</option>
              <option value="bookings">Bookings (High to Low)</option>
              <option value="growth">Growth Rate (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.summary.totalRevenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalBookings}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Active Destinations</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.destinationCount}</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Comparison</h3>
        {/* Horizontal bar chart showing revenue by destination would go here */}
        <div className="space-y-6">
          {sortedDestinations.map((dest, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 w-32">{dest.destination}</span>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="bg-primary-600 h-8 rounded-full flex items-center justify-end pr-3"
                      style={{ width: `${(dest.currentYear.revenue.amount_minor / maxRevenue) * 100}%` }}
                    >
                      <span className="text-white text-xs font-semibold">
                        {formatMoney(dest.currentYear.revenue)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right w-24">
                  <span className={`text-sm font-semibold ${
                    dest.growth.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercentage(dest.growth.revenueChange)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 ml-32">
                <span>{dest.currentYear.bookings} bookings</span>
                <span>Avg: {formatMoney(dest.currentYear.averageValue)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Destination</th>
                <th className="text-right p-4 font-semibold text-gray-700">Current Year Revenue</th>
                <th className="text-right p-4 font-semibold text-gray-700">Bookings</th>
                <th className="text-right p-4 font-semibold text-gray-700">Avg Value</th>
                <th className="text-right p-4 font-semibold text-gray-700">Previous Year Revenue</th>
                <th className="text-right p-4 font-semibold text-gray-700">Revenue Growth</th>
                <th className="text-right p-4 font-semibold text-gray-700">Booking Growth</th>
              </tr>
            </thead>
            <tbody>
              {sortedDestinations.map((dest, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-semibold text-gray-900">{dest.destination}</div>
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-900">
                    {formatMoney(dest.currentYear.revenue)}
                  </td>
                  <td className="p-4 text-right text-gray-600">{dest.currentYear.bookings}</td>
                  <td className="p-4 text-right text-gray-600">{formatMoney(dest.currentYear.averageValue)}</td>
                  <td className="p-4 text-right text-gray-600">{formatMoney(dest.previousYear.revenue)}</td>
                  <td className="p-4 text-right">
                    <span className={`font-semibold ${
                      dest.growth.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercentage(dest.growth.revenueChange)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className={`font-semibold ${
                      dest.growth.bookingsChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercentage(dest.growth.bookingsChange)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="p-4 text-gray-900">TOTAL</td>
                <td className="p-4 text-right text-gray-900">
                  {formatMoney(data.summary.totalRevenue)}
                </td>
                <td className="p-4 text-right text-gray-900">{data.summary.totalBookings}</td>
                <td className="p-4 text-right text-gray-900">
                  {formatMoney({
                    amount_minor: Math.round(data.summary.totalRevenue.amount_minor / data.summary.totalBookings),
                    currency: 'EUR'
                  })}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
