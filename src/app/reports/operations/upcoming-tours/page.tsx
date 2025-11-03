'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Money {
  amount_minor: number;
  currency: string;
}

interface UpcomingTour {
  id: number;
  quote_id: number;
  reference: string;
  client_name: string;
  client_email: string;
  destination: string;
  start_date: string;
  end_date: string;
  days: number;
  pax: number;
  tour_type: 'SIC' | 'Private';
  status: 'confirmed' | 'pending' | 'cancelled';
  total_price: Money;
  hotels: Array<{
    name: string;
    city: string;
    check_in: string;
    check_out: string;
    confirmed: boolean;
  }>;
  guides: Array<{
    name: string;
    language: string;
    confirmed: boolean;
  }>;
  vehicles: Array<{
    type: string;
    confirmed: boolean;
  }>;
  payment_status: 'paid' | 'partial' | 'pending';
  amount_paid: Money;
  outstanding: Money;
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

export default function UpcomingToursPage() {
  const { organizationId } = useAuth();
  const [tours, setTours] = useState<UpcomingTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('next_30_days');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    if (organizationId) {
      fetchTours();
    }
  }, [organizationId, statusFilter, dateRange]);

  async function fetchTours() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/reports/operations/upcoming-tours?status=${statusFilter}&period=${dateRange}`,
        {
          headers: {
            'X-Tenant-Id': organizationId
          }
        }
      );
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setTours(data.data || []);
    } catch (error) {
      console.error('Failed to fetch:', error);
      setError('Failed to load report. Please try again.');
      setTours([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredTours = tours ? tours.filter(tour => {
    const matchesSearch =
      tour.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tour.destination.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tour.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) : [];

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
            onClick={fetchTours}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!tours || tours.length === 0) {
    return (
      <div className="p-8">
        <Link href="/reports" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          Back to Reports
        </Link>
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-6">
            There are no upcoming tours. Create some bookings to see tour schedules.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/quotations"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Quotation
            </Link>
            <button
              onClick={fetchTours}
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
            <h1 className="text-3xl font-bold text-gray-900">Upcoming Tours</h1>
            <p className="text-gray-500 mt-1">View and manage all upcoming tour bookings</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              📄 Export PDF
            </button>
            <button
              onClick={fetchTours}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by reference, client, or destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="next_7_days">Next 7 Days</option>
            <option value="next_30_days">Next 30 Days</option>
            <option value="next_90_days">Next 90 Days</option>
            <option value="this_month">This Month</option>
            <option value="next_month">Next Month</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending Confirmation</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`flex-1 px-4 py-2 border rounded-lg ${
                viewMode === 'table' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-300'
              }`}
            >
              📋 Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 px-4 py-2 border rounded-lg ${
                viewMode === 'grid' ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-300'
              }`}
            >
              🗂️ Cards
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-500">Total Tours</div>
          <div className="text-3xl font-bold text-gray-900">{filteredTours.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-500">Confirmed</div>
          <div className="text-3xl font-bold text-green-600">
            {filteredTours.filter(t => t.status === 'confirmed').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">
            {filteredTours.filter(t => t.status === 'pending').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-500">Total Pax</div>
          <div className="text-3xl font-bold text-gray-900">
            {filteredTours.reduce((sum, tour) => sum + tour.pax, 0)}
          </div>
        </div>
      </div>

      {/* Tours Display */}
      {filteredTours.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No upcoming tours found</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700">Reference</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Client</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Destination</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Dates</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Pax</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Payment</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Resources</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTours.map((tour) => (
                  <tr key={tour.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-mono text-sm font-semibold text-primary-600">{tour.reference}</div>
                      <div className="text-xs text-gray-500">{tour.tour_type}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{tour.client_name}</div>
                      <div className="text-sm text-gray-500">{tour.client_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{tour.destination}</div>
                      <div className="text-sm text-gray-500">{tour.days} days</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-900">{formatDate(tour.start_date)}</div>
                      <div className="text-xs text-gray-500">to {formatDate(tour.end_date)}</div>
                    </td>
                    <td className="p-4 font-semibold text-gray-900">{tour.pax}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tour.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        tour.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {tour.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-gray-900">{formatMoney(tour.total_price)}</div>
                      <div className={`text-xs ${
                        tour.payment_status === 'paid' ? 'text-green-600' :
                        tour.payment_status === 'partial' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {tour.payment_status === 'paid' ? 'Paid in full' :
                         tour.payment_status === 'partial' ? `${formatMoney(tour.outstanding)} due` :
                         'Payment pending'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className={tour.hotels.every(h => h.confirmed) ? 'text-green-600' : 'text-yellow-600'}>
                          🏨 {tour.hotels.length} hotel(s)
                        </div>
                        {tour.guides.length > 0 && (
                          <div className={tour.guides.every(g => g.confirmed) ? 'text-green-600' : 'text-yellow-600'}>
                            👨‍🏫 {tour.guides.length} guide(s)
                          </div>
                        )}
                        <div className={tour.vehicles.every(v => v.confirmed) ? 'text-green-600' : 'text-yellow-600'}>
                          🚗 {tour.vehicles.length} vehicle(s)
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/quotations/${tour.quote_id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTours.map((tour) => (
            <div key={tour.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className={`p-4 ${
                tour.status === 'confirmed' ? 'bg-green-50 border-b-2 border-green-500' :
                tour.status === 'pending' ? 'bg-yellow-50 border-b-2 border-yellow-500' :
                'bg-red-50 border-b-2 border-red-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-semibold text-primary-600">{tour.reference}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    tour.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    tour.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {tour.status}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{tour.destination}</h3>
                <p className="text-sm text-gray-600">{tour.client_name} • {tour.pax} pax</p>
              </div>

              <div className="p-4">
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-1">Dates</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatDate(tour.start_date)} - {formatDate(tour.end_date)}
                  </div>
                  <div className="text-xs text-gray-500">{tour.days} days • {tour.tour_type}</div>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">Resources</div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">🏨 Hotels</span>
                      <span className={tour.hotels.every(h => h.confirmed) ? 'text-green-600' : 'text-yellow-600'}>
                        {tour.hotels.filter(h => h.confirmed).length}/{tour.hotels.length} confirmed
                      </span>
                    </div>
                    {tour.guides.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">👨‍🏫 Guides</span>
                        <span className={tour.guides.every(g => g.confirmed) ? 'text-green-600' : 'text-yellow-600'}>
                          {tour.guides.filter(g => g.confirmed).length}/{tour.guides.length} confirmed
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">🚗 Vehicles</span>
                      <span className={tour.vehicles.every(v => v.confirmed) ? 'text-green-600' : 'text-yellow-600'}>
                        {tour.vehicles.filter(v => v.confirmed).length}/{tour.vehicles.length} confirmed
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-lg font-bold text-gray-900">{formatMoney(tour.total_price)}</span>
                  </div>
                  <div className={`text-xs text-right ${
                    tour.payment_status === 'paid' ? 'text-green-600' :
                    tour.payment_status === 'partial' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {tour.payment_status === 'paid' ? '✓ Paid in full' :
                     tour.payment_status === 'partial' ? `${formatMoney(tour.outstanding)} outstanding` :
                     'Payment pending'}
                  </div>
                </div>

                <Link
                  href={`/quotations/${tour.quote_id}`}
                  className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  View Full Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
