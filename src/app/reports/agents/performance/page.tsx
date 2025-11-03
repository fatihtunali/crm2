'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface AgentPerformance {
  id: number;
  name: string;
  email: string;
  revenue: Money;
  clients: number;
  bookings: number;
  averageBookingValue: Money;
  conversionRate: number;
}

interface AgentPerformanceReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalAgents: number;
    totalRevenue: Money;
    totalBookings: number;
    totalClients: number;
  };
  agents: AgentPerformance[];
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function AgentPerformancePage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<AgentPerformanceReport | null>(null);
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
        `/api/reports/agents/performance?period=${dateRange}`,
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

  const sortedAgents = data ? [...data.agents].sort((a, b) => {
    if (sortBy === 'revenue') {
      return b.revenue.amount_minor - a.revenue.amount_minor;
    } else if (sortBy === 'bookings') {
      return b.bookings - a.bookings;
    } else if (sortBy === 'clients') {
      return b.clients - a.clients;
    } else if (sortBy === 'conversion') {
      return b.conversionRate - a.conversionRate;
    }
    return 0;
  }) : [];

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

  const maxRevenue = Math.max(...data.agents.map(a => a.revenue.amount_minor));

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agent Performance Dashboard</h1>
            <p className="text-gray-500 mt-1">Compare performance across tour operators</p>
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
              <option value="clients">Clients (High to Low)</option>
              <option value="conversion">Conversion Rate (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.summary.totalRevenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalBookings}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Total Clients</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-500 mb-1">Active Agents</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalAgents}</div>
        </div>
      </div>

      {/* Revenue by Agent Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue by Agent/Tour Operator</h3>
        {/* Bar chart showing revenue by agent would go here */}
        <div className="space-y-4">
          {sortedAgents.map((agent, index) => (
            <div key={agent.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 w-48 truncate">{agent.name}</span>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div
                      className="bg-primary-600 h-8 rounded-full flex items-center justify-end pr-3"
                      style={{ width: `${(agent.revenue.amount_minor / maxRevenue) * 100}%` }}
                    >
                      <span className="text-white text-xs font-semibold">
                        {formatMoney(agent.revenue)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right w-32">
                  <span className="text-sm font-semibold text-gray-900">{agent.bookings} bookings</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Rankings Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Agent Rankings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Rank</th>
                <th className="text-left p-4 font-semibold text-gray-700">Agent/Tour Operator</th>
                <th className="text-right p-4 font-semibold text-gray-700">Revenue</th>
                <th className="text-right p-4 font-semibold text-gray-700">Bookings</th>
                <th className="text-right p-4 font-semibold text-gray-700">Clients</th>
                <th className="text-right p-4 font-semibold text-gray-700">Avg Booking Value</th>
                <th className="text-right p-4 font-semibold text-gray-700">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((agent, index) => (
                <tr key={agent.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-gray-900">{agent.name}</div>
                    <div className="text-sm text-gray-500">{agent.email}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-bold text-primary-600">{formatMoney(agent.revenue)}</div>
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-900">{agent.bookings}</td>
                  <td className="p-4 text-right font-semibold text-gray-900">{agent.clients}</td>
                  <td className="p-4 text-right text-gray-600">{formatMoney(agent.averageBookingValue)}</td>
                  <td className="p-4 text-right">
                    <span className="font-semibold text-green-600">{formatPercentage(agent.conversionRate)}</span>
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
