'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

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
  const { organizationId } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [converting, setConverting] = useState<number | null>(null);

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter]);

  async function fetchQuotations() {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '10000');

      const res = await fetch(`/api/quotations?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const quotationsData = Array.isArray(data.data) ? data.data : [];
      setQuotations(quotationsData);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  }

  async function acceptQuotation(quotationId: number) {
    if (!confirm('Accept this quotation? This will automatically create a booking.')) {
      return;
    }

    setConverting(quotationId);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({ status: 'accepted' })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to accept quotation');
      }

      const result = await res.json();
      alert(`Successfully accepted quotation and created booking!\nBooking ID: ${result.booking.id}`);

      // Refresh quotations list
      fetchQuotations();

      // Redirect to bookings page
      window.location.href = '/bookings';
    } catch (error: any) {
      console.error('Failed to accept quotation:', error);
      alert(`Failed to accept quotation: ${error.message}`);
    } finally {
      setConverting(null);
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
                      {(quote.status === 'draft' || quote.status === 'sent') && (
                        <button
                          onClick={() => acceptQuotation(quote.id)}
                          disabled={converting === quote.id}
                          className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {converting === quote.id ? 'Accepting...' : 'Accept'}
                        </button>
                      )}
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
