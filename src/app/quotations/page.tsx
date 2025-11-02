'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Quotation {
  id: number;
  quote_number: string;
  category: string;
  customer_name: string;
  customer_email: string;
  destination: string;
  start_date: string;
  end_date: string;
  tour_type: string;
  pax: number;
  adults: number;
  children: number;
  total_price: number | null;
  status: string;
  total_days: number;
  created_at: string;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter]);

  async function fetchQuotations() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }

  const statusCounts = {
    all: quotations.length,
    draft: quotations.filter(q => q.status === 'draft').length,
    sent: quotations.filter(q => q.status === 'sent').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'accepted': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-500 mt-1">Manage customer quotations</p>
        </div>
        <Link
          href="/quotations/new"
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Quotation
        </Link>
      </div>

      {/* Status Filter */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                statusFilter === status
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : quotations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No quotations found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Quote #</th>
                <th className="text-left p-4 font-semibold text-gray-700">Customer</th>
                <th className="text-left p-4 font-semibold text-gray-700">Destination</th>
                <th className="text-left p-4 font-semibold text-gray-700">Dates</th>
                <th className="text-left p-4 font-semibold text-gray-700">PAX</th>
                <th className="text-left p-4 font-semibold text-gray-700">Days</th>
                <th className="text-left p-4 font-semibold text-gray-700">Total</th>
                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quote) => (
                <tr key={quote.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-primary-600">{quote.quote_number}</td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium">{quote.customer_name}</div>
                      <div className="text-sm text-gray-500">{quote.customer_email}</div>
                    </div>
                  </td>
                  <td className="p-4">{quote.destination}</td>
                  <td className="p-4">
                    <div className="text-sm">
                      {new Date(quote.start_date).toLocaleDateString()} -
                      {new Date(quote.end_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4">
                    {quote.pax || quote.adults}
                    {quote.children > 0 && ` + ${quote.children}`}
                  </td>
                  <td className="p-4">{quote.total_days}</td>
                  <td className="p-4 font-medium">
                    {quote.total_price ? `€${Number(quote.total_price).toFixed(2)}` : '-'}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <Link
                        href={`/quotations/${quote.id}/view`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View
                      </Link>
                      <Link
                        href={`/quotations/${quote.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
