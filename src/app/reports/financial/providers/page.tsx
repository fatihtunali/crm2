'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface ProviderPayment {
  id: number;
  name: string;
  type: string;
  totalPaid: Money;
  outstanding: Money;
  invoiceCount: number;
  lastPayment: string;
}

interface ProviderPaymentReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalPaid: Money;
    totalOutstanding: Money;
    providerCount: number;
  };
  byType: Array<{
    type: string;
    totalPaid: Money;
    providerCount: number;
  }>;
  providers: ProviderPayment[];
}

function formatMoney(money: Money | undefined): string {
  if (!money) return '€0.00';
  const amount = money.amount_minor / 100;
  return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function ProviderPaymentPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<ProviderPaymentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('this_year');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, dateRange, typeFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/financial/providers?period=${dateRange}&type=${typeFilter}`,
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

  const maxPaid = Math.max(...data.providers.map(p => p.totalPaid.amount_minor), 1);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Provider Payment Analysis</h1>
            <p className="text-gray-500 mt-1">Track payments to suppliers</p>
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
              <option value="this_month">This Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
              <option value="all">All Types</option>
              <option value="Hotel">Hotels</option>
              <option value="Transport">Transport</option>
              <option value="Guide">Guides</option>
              <option value="Entrance Fee">Entrance Fees</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Paid</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.summary.totalPaid)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <div className="text-sm text-gray-500 mb-1">Total Outstanding</div>
          <div className="text-3xl font-bold text-red-600">{formatMoney(data.summary.totalOutstanding)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Active Providers</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.providerCount}</div>
        </div>
      </div>

      {/* Payment by Type */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payments by Provider Type</h3>
        {/* Bar chart showing payments by type would go here */}
        <div className="space-y-4">
          {data.byType.map((type, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{type.type}</span>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{formatMoney(type.totalPaid)}</span>
                  <span className="text-sm text-gray-500 ml-2">({type.providerCount} providers)</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full"
                  style={{ width: `${(type.totalPaid.amount_minor / data.summary.totalPaid.amount_minor) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Providers */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Providers by Payment Volume</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Provider</th>
                <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                <th className="text-right p-4 font-semibold text-gray-700">Total Paid</th>
                <th className="text-right p-4 font-semibold text-gray-700">Outstanding</th>
                <th className="text-right p-4 font-semibold text-gray-700">Invoices</th>
                <th className="text-left p-4 font-semibold text-gray-700">Last Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((provider) => (
                <tr key={provider.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-semibold text-gray-900">{provider.name}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {provider.type}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-primary-600">{formatMoney(provider.totalPaid)}</td>
                  <td className="p-4 text-right font-semibold text-red-600">{formatMoney(provider.outstanding)}</td>
                  <td className="p-4 text-right text-gray-600">{provider.invoiceCount}</td>
                  <td className="p-4 text-sm text-gray-600">{formatDate(provider.lastPayment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
