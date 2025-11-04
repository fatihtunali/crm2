'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface OverdueInvoice {
  id: number;
  reference: string;
  client: string;
  type: 'receivable' | 'payable';
  amount: Money;
  dueDate: string;
  daysOverdue: number;
  agingBucket: string;
}

interface InvoiceAgingReport {
  period: {
    start_date: string;
    end_date: string;
  };
  receivables: {
    total: Money;
    current: Money;
    days30: Money;
    days60: Money;
    days90plus: Money;
  };
  payables: {
    total: Money;
    current: Money;
    days30: Money;
    days60: Money;
    days90plus: Money;
  };
  overdueInvoices: OverdueInvoice[];
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

export default function InvoiceAgingPage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<InvoiceAgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'receivable' | 'payable'>('all');
  const [filterBucket, setFilterBucket] = useState('all');

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
        `/api/reports/financial/aging`,
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

  const filteredInvoices = data ? data.overdueInvoices.filter(inv => {
    const matchesType = filterType === 'all' || inv.type === filterType;
    const matchesBucket = filterBucket === 'all' || inv.agingBucket === filterBucket;
    return matchesType && matchesBucket;
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice Aging Report</h1>
            <p className="text-gray-500 mt-1">Outstanding invoices by aging bucket</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Types</option>
              <option value="receivable">Receivables Only</option>
              <option value="payable">Payables Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aging Bucket</label>
            <select
              value={filterBucket}
              onChange={(e) => setFilterBucket(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Aging Buckets</option>
              <option value="0-30 days">0-30 days</option>
              <option value="31-60 days">31-60 days</option>
              <option value="61-90 days">61-90 days</option>
              <option value="90+ days">90+ days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Receivables Aging */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Receivables Aging</h3>
          {/* Stacked bar chart for receivables aging would go here */}
          <div className="mb-6">
            <div className="text-3xl font-bold text-primary-600 mb-2">{formatMoney(data.receivables.total)}</div>
            <div className="text-sm text-gray-500">Total Outstanding</div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Current (0-30 days)</span>
              <span className="font-bold text-green-600">{formatMoney(data.receivables.current)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">31-60 days</span>
              <span className="font-bold text-yellow-600">{formatMoney(data.receivables.days30)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">61-90 days</span>
              <span className="font-bold text-orange-600">{formatMoney(data.receivables.days60)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">90+ days</span>
              <span className="font-bold text-red-600">{formatMoney(data.receivables.days90plus)}</span>
            </div>
          </div>
        </div>

        {/* Payables Aging */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payables Aging</h3>
          {/* Stacked bar chart for payables aging would go here */}
          <div className="mb-6">
            <div className="text-3xl font-bold text-red-600 mb-2">{formatMoney(data.payables.total)}</div>
            <div className="text-sm text-gray-500">Total Outstanding</div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Current (0-30 days)</span>
              <span className="font-bold text-green-600">{formatMoney(data.payables.current)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">31-60 days</span>
              <span className="font-bold text-yellow-600">{formatMoney(data.payables.days30)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">61-90 days</span>
              <span className="font-bold text-orange-600">{formatMoney(data.payables.days60)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">90+ days</span>
              <span className="font-bold text-red-600">{formatMoney(data.payables.days90plus)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Overdue Invoices ({filteredInvoices.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Reference</th>
                <th className="text-left p-4 font-semibold text-gray-700">Client/Supplier</th>
                <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                <th className="text-right p-4 font-semibold text-gray-700">Amount</th>
                <th className="text-left p-4 font-semibold text-gray-700">Due Date</th>
                <th className="text-center p-4 font-semibold text-gray-700">Days Overdue</th>
                <th className="text-left p-4 font-semibold text-gray-700">Aging Bucket</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <span className="font-mono text-sm font-semibold text-primary-600">{invoice.reference}</span>
                  </td>
                  <td className="p-4 font-medium text-gray-900">{invoice.client}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      invoice.type === 'receivable' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {invoice.type}
                    </span>
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-900">{formatMoney(invoice.amount)}</td>
                  <td className="p-4 text-sm text-gray-600">{formatDate(invoice.dueDate)}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                      invoice.daysOverdue >= 90 ? 'bg-red-100 text-red-700' :
                      invoice.daysOverdue >= 60 ? 'bg-orange-100 text-orange-700' :
                      invoice.daysOverdue >= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {invoice.daysOverdue} days
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">{invoice.agingBucket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
