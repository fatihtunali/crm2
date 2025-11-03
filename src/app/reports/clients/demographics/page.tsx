'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface ClientDemographics {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalClients: number;
    newClients: number;
    activeClients: number;
  };
  byNationality: Array<{
    nationality: string;
    count: number;
    percentage: number;
  }>;
  byClientType: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  byLanguage: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  acquisitionTrend: Array<{
    month: string;
    newClients: number;
    totalClients: number;
  }>;
}

export default function ClientDemographicsPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<ClientDemographics | null>(null);
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
        `/api/reports/clients/demographics?period=${dateRange}`,
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
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Client Demographics</h1>
            <p className="text-gray-500 mt-1">Understand your customer base by nationality, type, and language</p>
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
              <option value="all_time">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Clients</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">New Clients</div>
          <div className="text-3xl font-bold text-green-600">{data.summary.newClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Active Clients</div>
          <div className="text-3xl font-bold text-blue-600">{data.summary.activeClients}</div>
        </div>
      </div>

      {/* Client Nationality */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Clients by Nationality (Top 10)</h3>
        {/* Geographic map visualization would go here */}
        <div className="space-y-3">
          {data.byNationality.map((nat, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{nat.nationality}</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{nat.count}</span>
                  <span className="text-sm text-gray-500 ml-2">({nat.percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full"
                  style={{ width: `${nat.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Type & Language */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Client Type Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Type Distribution</h3>
          {/* Pie chart showing client type distribution would go here */}
          <div className="space-y-4">
            {data.byClientType.map((type, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    index === 0 ? 'bg-primary-600' :
                    index === 1 ? 'bg-blue-500' :
                    index === 2 ? 'bg-green-500' :
                    'bg-purple-500'
                  }`}></div>
                  <span className="font-medium text-gray-900">{type.type}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{type.count}</div>
                  <div className="text-xs text-gray-500">{type.percentage.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Language Preference */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Language Preference</h3>
          {/* Bar chart showing language preferences would go here */}
          <div className="space-y-4">
            {data.byLanguage.map((lang, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{lang.language}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{lang.count}</span>
                    <span className="text-sm text-gray-500 ml-2">({lang.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${lang.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client Acquisition Trend */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Client Acquisition Trend</h3>
        {/* Line chart showing acquisition trend would go here */}
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
          {data.acquisitionTrend.map((month, index) => (
            <div key={index} className="text-center">
              <div className="mb-2">
                <div className="h-24 flex items-end justify-center">
                  <div
                    className="w-full bg-primary-600 rounded-t"
                    style={{
                      height: `${(month.newClients / Math.max(...data.acquisitionTrend.map(m => m.newClients))) * 100}%`,
                      minHeight: '8px'
                    }}
                  ></div>
                </div>
              </div>
              <div className="text-xs font-semibold text-gray-900">{month.newClients}</div>
              <div className="text-xs text-gray-500">{month.month}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Average New Clients/Month</div>
              <div className="font-semibold text-gray-900">
                {(data.acquisitionTrend.reduce((sum, m) => sum + m.newClients, 0) / data.acquisitionTrend.length).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Total Growth</div>
              <div className="font-semibold text-green-600">
                +{data.acquisitionTrend.reduce((sum, m) => sum + m.newClients, 0)} clients
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
