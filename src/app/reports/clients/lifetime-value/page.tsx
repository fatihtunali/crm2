'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface ClientLifetimeValue {
  id: number;
  name: string;
  email: string;
  clientType: string;
  nationality: string;
  totalRevenue: Money;
  totalBookings: number;
  averageBookingValue: Money;
  firstBooking: string;
  lastBooking: string;
  daysSinceLastBooking: number;
}

interface CLVReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    totalClients: number;
    totalRevenue: Money;
    averageCLV: Money;
  };
  clients: ClientLifetimeValue[];
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

export default function ClientLifetimeValuePage() {
  const { organizationId } = useAuth();
  const [data, setData] = useState<CLVReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('revenue');

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, clientTypeFilter]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/clients/lifetime-value?clientType=${clientTypeFilter}`,
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

  const filteredClients = data ? data.clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.nationality.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = clientTypeFilter === 'all' || client.clientType === clientTypeFilter;

    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'revenue') {
      return b.totalRevenue.amount_minor - a.totalRevenue.amount_minor;
    } else if (sortBy === 'bookings') {
      return b.totalBookings - a.totalBookings;
    } else if (sortBy === 'avgValue') {
      return b.averageBookingValue.amount_minor - a.averageBookingValue.amount_minor;
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          ← Back to Reports
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Client Lifetime Value</h1>
            <p className="text-gray-500 mt-1">Identify your most valuable clients</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by name, email, or nationality..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={clientTypeFilter}
            onChange={(e) => setClientTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Client Types</option>
            <option value="Direct Individual">Direct Individual</option>
            <option value="Tour Operator">Tour Operator</option>
            <option value="Travel Agent">Travel Agent</option>
            <option value="Corporate">Corporate</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="revenue">Sort by Revenue (High to Low)</option>
            <option value="bookings">Sort by Bookings (High to Low)</option>
            <option value="avgValue">Sort by Avg Value (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-500">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.summary.totalRevenue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Total Clients</div>
          <div className="text-3xl font-bold text-gray-900">{data.summary.totalClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Average CLV</div>
          <div className="text-3xl font-bold text-gray-900">{formatMoney(data.summary.averageCLV)}</div>
        </div>
      </div>

      {/* Top Clients Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Top Clients by Lifetime Value ({filteredClients.length} clients)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Rank</th>
                <th className="text-left p-4 font-semibold text-gray-700">Client</th>
                <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                <th className="text-left p-4 font-semibold text-gray-700">Nationality</th>
                <th className="text-right p-4 font-semibold text-gray-700">Total Revenue</th>
                <th className="text-right p-4 font-semibold text-gray-700">Bookings</th>
                <th className="text-right p-4 font-semibold text-gray-700">Avg Value</th>
                <th className="text-left p-4 font-semibold text-gray-700">Last Booking</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client, index) => (
                <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                    <div className="font-semibold text-gray-900">{client.name}</div>
                    <div className="text-sm text-gray-500">{client.email}</div>
                  </td>
                  <td className="p-4 text-gray-600">{client.clientType}</td>
                  <td className="p-4 text-gray-600">{client.nationality}</td>
                  <td className="p-4 text-right">
                    <div className="font-bold text-primary-600">{formatMoney(client.totalRevenue)}</div>
                  </td>
                  <td className="p-4 text-right font-semibold text-gray-900">{client.totalBookings}</td>
                  <td className="p-4 text-right text-gray-600">{formatMoney(client.averageBookingValue)}</td>
                  <td className="p-4">
                    <div className="text-sm text-gray-900">{formatDate(client.lastBooking)}</div>
                    <div className="text-xs text-gray-500">{client.daysSinceLastBooking} days ago</div>
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
