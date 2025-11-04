'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface ClientAcquisitionRetention {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalClients: number;
    newClients: number;
    returningClients: number;
    retentionRate: number;
    churnRate: number;
    averageClientLifespan: number; // months
  };
  monthlyTrend: Array<{
    month: string;
    newClients: number;
    returningClients: number;
    totalActive: number;
    retentionRate: number;
  }>;
  acquisitionSource: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  cohortAnalysis: Array<{
    cohort: string;
    acquired: number;
    stillActive: number;
    retentionRate: number;
  }>;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ClientAcquisitionRetentionPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<ClientAcquisitionRetention | null>(null);
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
        `/api/reports/clients/acquisition-retention?period=${dateRange}`,
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
            <h1 className="text-3xl font-bold text-gray-900">Client Acquisition & Retention</h1>
            <p className="text-gray-500 mt-1">Track new clients and retention rates</p>
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
              <option value="last_year">Last Year</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Clients</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">New Clients</div>
          <div className="text-3xl font-bold text-green-600">{data.summary.newClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Returning</div>
          <div className="text-3xl font-bold text-blue-600">{data.summary.returningClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-500 mb-1">Retention Rate</div>
          <div className="text-3xl font-bold text-purple-600">{formatPercentage(data.summary.retentionRate)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <div className="text-sm text-gray-500 mb-1">Churn Rate</div>
          <div className="text-3xl font-bold text-red-600">{formatPercentage(data.summary.churnRate)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-500 mb-1">Avg Lifespan</div>
          <div className="text-3xl font-bold text-yellow-600">{data.summary.averageClientLifespan.toFixed(1)}<span className="text-lg">mo</span></div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New vs Returning Clients Over Time</h3>
        {/* Line chart showing new vs returning clients would go here */}
        <div className="space-y-3">
          {data.monthlyTrend.map((month, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 w-16">{month.month}</span>
                <div className="flex-1 mx-4">
                  <div className="flex gap-1 h-8">
                    <div
                      className="bg-green-500 rounded-l flex items-center justify-center text-white text-xs font-semibold"
                      style={{ width: `${(month.newClients / month.totalActive) * 100}%` }}
                    >
                      {month.newClients > 0 && month.newClients}
                    </div>
                    <div
                      className="bg-blue-500 rounded-r flex items-center justify-center text-white text-xs font-semibold"
                      style={{ width: `${(month.returningClients / month.totalActive) * 100}%` }}
                    >
                      {month.returningClients > 0 && month.returningClients}
                    </div>
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className="text-sm font-semibold text-gray-900">{month.totalActive} total</div>
                  <div className="text-xs text-purple-600">{formatPercentage(month.retentionRate)} retention</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-600">New Clients</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Returning Clients</span>
          </div>
        </div>
      </div>

      {/* Acquisition Source & Cohort Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acquisition Source Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acquisition Source Breakdown</h3>
          <div className="space-y-4">
            {data.acquisitionSource.map((source, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{source.source}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{source.count}</span>
                    <span className="text-sm text-gray-500 ml-2">({formatPercentage(source.percentage)})</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary-600 h-3 rounded-full"
                    style={{ width: `${source.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cohort Analysis */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cohort Retention Analysis</h3>
          <div className="space-y-3">
            {data.cohortAnalysis.map((cohort, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{cohort.cohort}</span>
                  <span className={`text-sm font-semibold ${
                    cohort.retentionRate >= 80 ? 'text-green-600' :
                    cohort.retentionRate >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {formatPercentage(cohort.retentionRate)} retained
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Acquired: {cohort.acquired}</span>
                  <span className="text-gray-600">Still Active: {cohort.stillActive}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      cohort.retentionRate >= 80 ? 'bg-green-500' :
                      cohort.retentionRate >= 70 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${cohort.retentionRate}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
