'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface MonthlyData {
  month: string;
  year: number;
  revenue: Money;
  bookings: number;
  averageValue: Money;
}

interface SeasonalPattern {
  season: string;
  months: string[];
  averageRevenue: Money;
  averageBookings: number;
  percentage: number;
}

interface SalesTrends {
  period: {
    start_date: string;
    end_date: string;
  };
  monthlyData: MonthlyData[];
  yearOverYear: {
    currentYear: {
      revenue: Money;
      bookings: number;
    };
    previousYear: {
      revenue: Money;
      bookings: number;
    };
    growth: {
      revenueGrowth: number;
      bookingsGrowth: number;
    };
  };
  seasonalPatterns: SeasonalPattern[];
  growthMetrics: {
    monthlyAverageGrowth: number;
    bestMonth: {
      month: string;
      revenue: Money;
      growth: number;
    };
    worstMonth: {
      month: string;
      revenue: Money;
      growth: number;
    };
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

export default function SalesTrendsPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<SalesTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'revenue' | 'bookings'>('revenue');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/sales/trends`,
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
          <div className="h-64 bg-gray-200 rounded"></div>
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

  const maxValue = Math.max(...data.monthlyData.map(d => viewMode === 'revenue' ? d.revenue.amount_minor : d.bookings * 100000));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Trends</h1>
            <p className="text-gray-500 mt-1">Monthly and yearly sales patterns</p>
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

      {/* View Mode Toggle */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('revenue')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'revenue' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setViewMode('bookings')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'bookings' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Bookings
          </button>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Current Year Revenue</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(data.yearOverYear.currentYear.revenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Previous Year Revenue</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoney(data.yearOverYear.previousYear.revenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Revenue Growth</div>
          <div className="text-2xl font-bold text-green-600">{formatPercentage(data.yearOverYear.growth.revenueGrowth)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-500 mb-1">Bookings Growth</div>
          <div className="text-2xl font-bold text-purple-600">{formatPercentage(data.yearOverYear.growth.bookingsGrowth)}</div>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          {viewMode === 'revenue' ? 'Monthly Revenue Trend' : 'Monthly Bookings Trend'}
        </h3>
        {/* Line chart showing monthly trends would go here */}
        <div className="space-y-2">
          {data.monthlyData.map((month, index) => (
            <div key={index} className="flex items-center gap-4">
              <span className="text-xs text-gray-600 w-20">{month.month}</span>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className={`h-6 rounded-full ${
                      month.year === 2025 ? 'bg-primary-600' : 'bg-gray-400'
                    }`}
                    style={{
                      width: `${viewMode === 'revenue'
                        ? (month.revenue.amount_minor / maxValue) * 100
                        : (month.bookings / (maxValue / 100000)) * 100
                      }%`
                    }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-900 w-32 text-right">
                {viewMode === 'revenue' ? formatMoney(month.revenue) : `${month.bookings} bookings`}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded"></div>
            <span className="text-gray-600">2024</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary-600 rounded"></div>
            <span className="text-gray-600">2025</span>
          </div>
        </div>
      </div>

      {/* Seasonal Patterns & Growth Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonal Patterns */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Seasonal Patterns</h3>
          <div className="space-y-4">
            {data.seasonalPatterns.map((season, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{season.season}</span>
                  <span className="text-sm text-primary-600 font-semibold">{season.percentage.toFixed(1)}% of annual</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Avg Revenue</div>
                    <div className="font-semibold text-gray-900">{formatMoney(season.averageRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Avg Bookings</div>
                    <div className="font-semibold text-gray-900">{season.averageBookings}</div>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{ width: `${season.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Growth Metrics */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Metrics</h3>
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-600 mb-2">Monthly Average Growth</div>
              <div className="text-3xl font-bold text-blue-600">
                {formatPercentage(data.growthMetrics.monthlyAverageGrowth)}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-600 mb-2">Best Performing Month</div>
              <div className="text-xl font-bold text-green-600">{data.growthMetrics.bestMonth.month}</div>
              <div className="text-sm text-gray-700 mt-1">
                {formatMoney(data.growthMetrics.bestMonth.revenue)} • {formatPercentage(data.growthMetrics.bestMonth.growth)}
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
              <div className="text-sm text-gray-600 mb-2">Lowest Month (Opportunity for Growth)</div>
              <div className="text-xl font-bold text-yellow-600">{data.growthMetrics.worstMonth.month}</div>
              <div className="text-sm text-gray-700 mt-1">
                {formatMoney(data.growthMetrics.worstMonth.revenue)} • {formatPercentage(data.growthMetrics.worstMonth.growth)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
