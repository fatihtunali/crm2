'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface AgentClientAnalysis {
  id: number;
  name: string;
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  topNationalities: Array<{
    nationality: string;
    count: number;
  }>;
  bookingPattern: {
    averageBookingsPerClient: number;
    repeatClientRate: number;
  };
}

interface AgentClientReport {
  period: {
    start_date: string;
    end_date: string;
  };
  agents: AgentClientAnalysis[];
}

export default function AgentClientAnalysisPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<AgentClientReport | null>(null);
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
        `/api/reports/agents/clients?period=${dateRange}`,
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
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Agent Client Analysis</h1>
            <p className="text-gray-500 mt-1">Client portfolio by tour operator</p>
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
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Agent Client Details */}
      <div className="space-y-6">
        {data.agents.map((agent) => (
          <div key={agent.id} className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{agent.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Total Clients</div>
                  <div className="text-2xl font-bold text-blue-600">{agent.totalClients}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Active Clients</div>
                  <div className="text-2xl font-bold text-green-600">{agent.activeClients}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Inactive Clients</div>
                  <div className="text-2xl font-bold text-gray-600">{agent.inactiveClients}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Active Rate</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {((agent.activeClients / agent.totalClients) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client Nationalities */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Top Client Nationalities</h4>
                {/* Stacked bar chart showing nationalities would go here */}
                <div className="space-y-2">
                  {agent.topNationalities.map((nat, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{nat.nationality}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-primary-600 rounded-full"
                            style={{ width: `${(nat.count / agent.totalClients) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-6 text-right">{nat.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking Patterns */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Booking Patterns</h4>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Avg Bookings per Client</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {agent.bookingPattern.averageBookingsPerClient.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Repeat Client Rate</div>
                    <div className="text-2xl font-bold text-green-600">
                      {agent.bookingPattern.repeatClientRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
