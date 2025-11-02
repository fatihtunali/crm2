'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ViewQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotation();
  }, []);

  async function updateStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/quotations/${resolvedParams.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setQuotation({ ...quotation, status: newStatus });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async function fetchQuotation() {
    try {
      const res = await fetch(`/api/quotations/${resolvedParams.id}`);
      const data = await res.json();
      setQuotation(data);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-red-500">Quotation not found</div>
      </div>
    );
  }

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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">{quotation.quote_number}</h1>
            <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${getStatusColor(quotation.status)}`}>
              {quotation.status}
            </span>
          </div>
          <p className="text-gray-500 mt-1">{quotation.destination}</p>
        </div>
        <div className="flex gap-3">
          {quotation.status === 'draft' && (
            <button
              onClick={() => updateStatus('sent')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              📧 Mark as Sent
            </button>
          )}
          {quotation.status === 'sent' && (
            <button
              onClick={() => updateStatus('accepted')}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
            >
              ✅ Mark as Accepted
            </button>
          )}
          <Link
            href={`/quotations/${resolvedParams.id}/itinerary`}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            📋 View Itinerary
          </Link>
          <Link
            href={`/quotations/${resolvedParams.id}`}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
          >
            ✏️ Edit Quotation
          </Link>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Customer Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-500">Name</div>
            <div className="font-medium">{quotation.customer_name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-medium">{quotation.customer_email}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Phone</div>
            <div className="font-medium">{quotation.customer_phone || '-'}</div>
          </div>
        </div>
      </div>

      {/* Trip Details */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Trip Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">Destination</div>
            <div className="font-medium">{quotation.destination}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Start Date</div>
            <div className="font-medium">{new Date(quotation.start_date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">End Date</div>
            <div className="font-medium">{new Date(quotation.end_date).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Tour Type</div>
            <div className="font-medium">{quotation.tour_type}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Adults</div>
            <div className="font-medium">{quotation.adults}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Children</div>
            <div className="font-medium">{quotation.children}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Total PAX</div>
            <div className="font-medium">{quotation.pax || (quotation.adults + quotation.children)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Category</div>
            <div className="font-medium">{quotation.category || '-'}</div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Pricing</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">Markup (%)</div>
            <div className="font-medium">{quotation.markup || 0}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Tax (%)</div>
            <div className="font-medium">{quotation.tax || 0}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Transport Pricing</div>
            <div className="font-medium capitalize">{quotation.transport_pricing_mode || 'total'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Total Price</div>
            <div className="font-bold text-xl text-primary-600">
              €{quotation.total_price ? Number(quotation.total_price).toFixed(2) : '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Itinerary Days */}
      {quotation.days && quotation.days.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Itinerary ({quotation.days.length} days)</h2>
          <div className="space-y-4">
            {quotation.days.map((day: any, index: number) => (
              <div key={index} className="border-l-4 border-primary-500 pl-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">
                    {day.title || `Day ${day.day_number}`}
                  </h3>
                  <div className="text-sm text-gray-500">
                    {new Date(day.date).toLocaleDateString()}
                  </div>
                </div>
                {day.narrative && (
                  <p className="text-gray-700 mb-2 whitespace-pre-line">{day.narrative}</p>
                )}
                {day.meals && (
                  <div className="text-sm text-gray-500 mb-2">Meals: {day.meals}</div>
                )}
                <div className="text-sm font-medium text-gray-700">
                  {day.expenses?.length || 0} expense(s)
                  {day.expenses && day.expenses.length > 0 && (
                    <span className="ml-2 text-gray-500">
                      - €{Number(day.expenses.reduce((sum: number, exp: any) => sum + (Number(exp.price) || 0), 0)).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
