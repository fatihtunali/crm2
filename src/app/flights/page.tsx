'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AddEditFlightModal from '@/components/flights/AddEditFlightModal';

interface Flight {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
  from_airport: string;
  to_airport: string;
  from_city: string | null;
  to_city: string | null;
  season_name: string | null;
  start_date: string;
  end_date: string;
  departure_time: string | null;
  arrival_time: string | null;
  price_oneway: number;
  price_roundtrip: number;
  airline: string | null;
  flight_number: string | null;
  booking_class: string;
  baggage_allowance: string | null;
  currency: string;
  notes: string | null;
  status: string;
  created_at: string;
}

interface PagedResponse {
  data: Flight[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Turkish Airports
const TURKISH_AIRPORTS = [
  { code: 'IST', name: 'Istanbul Airport', city: 'Istanbul' },
  { code: 'SAW', name: 'Sabiha Gökçen Airport', city: 'Istanbul' },
  { code: 'AYT', name: 'Antalya Airport', city: 'Antalya' },
  { code: 'ADB', name: 'Izmir Adnan Menderes Airport', city: 'Izmir' },
  { code: 'ESB', name: 'Ankara Esenboğa Airport', city: 'Ankara' },
  { code: 'ASR', name: 'Kayseri Erkilet Airport', city: 'Cappadocia' },
  { code: 'BJV', name: 'Bodrum-Milas Airport', city: 'Bodrum' },
  { code: 'DLM', name: 'Dalaman Airport', city: 'Dalaman' },
  { code: 'GZT', name: 'Gaziantep Airport', city: 'Gaziantep' },
  { code: 'TZX', name: 'Trabzon Airport', city: 'Trabzon' },
  { code: 'NAV', name: 'Nevşehir Kapadokya Airport', city: 'Cappadocia' },
];

export default function FlightsPage() {
  const { organizationId } = useAuth();

  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [fromAirportFilter, setFromAirportFilter] = useState('all');
  const [toAirportFilter, setToAirportFilter] = useState('all');
  const [bookingClassFilter, setBookingClassFilter] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);

  useEffect(() => {
    fetchFlights();
  }, [page, searchTerm, statusFilter, fromAirportFilter, toAirportFilter, bookingClassFilter]);

  async function fetchFlights() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        status: statusFilter,
      });

      if (searchTerm) params.append('search', searchTerm);
      if (fromAirportFilter !== 'all') params.append('from_airport', fromAirportFilter);
      if (toAirportFilter !== 'all') params.append('to_airport', toAirportFilter);
      if (bookingClassFilter !== 'all') params.append('booking_class', bookingClassFilter);

      const res = await fetch(`/api/flights?${params}`, {
        headers: { 'X-Tenant-Id': organizationId }
      });

      if (!res.ok) throw new Error('Failed to fetch flights');

      const data: PagedResponse = await res.json();
      setFlights(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching flights:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleAddFlight() {
    setEditingFlight(null);
    setIsModalOpen(true);
  }

  function handleEditFlight(flight: Flight) {
    setEditingFlight(flight);
    setIsModalOpen(true);
  }

  async function handleDeleteFlight(id: number) {
    if (!confirm('Are you sure you want to archive this flight?')) return;

    try {
      const res = await fetch(`/api/flights/${id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': organizationId }
      });

      if (!res.ok) throw new Error('Failed to delete flight');

      fetchFlights();
    } catch (error) {
      console.error('Error deleting flight:', error);
      alert('Failed to delete flight');
    }
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingFlight(null);
    fetchFlights();
  }

  function getAirportName(code: string): string {
    const airport = TURKISH_AIRPORTS.find(a => a.code === code);
    return airport ? `${airport.name} (${code})` : code;
  }

  function formatTime(time: string | null): string {
    if (!time) return '-';
    return time.substring(0, 5); // Format HH:MM
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-GB');
  }

  function formatPrice(price: number | string, currency: string): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `${currency} ${numPrice.toFixed(2)}`;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Flight Management</h1>
        <p className="text-gray-600 mt-2">Manage flight tickets and pricing</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search flights..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Airport</label>
            <select
              value={fromAirportFilter}
              onChange={(e) => {
                setFromAirportFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Airports</option>
              {TURKISH_AIRPORTS.map(airport => (
                <option key={airport.code} value={airport.code}>
                  {airport.code} - {airport.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Airport</label>
            <select
              value={toAirportFilter}
              onChange={(e) => {
                setToAirportFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Airports</option>
              {TURKISH_AIRPORTS.map(airport => (
                <option key={airport.code} value={airport.code}>
                  {airport.code} - {airport.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <select
              value={bookingClassFilter}
              onChange={(e) => {
                setBookingClassFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Classes</option>
              <option value="Economy">Economy</option>
              <option value="Business">Business</option>
              <option value="First">First</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Found {total} flight{total !== 1 ? 's' : ''}
          </p>
          <button
            onClick={handleAddFlight}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Flight
          </button>
        </div>
      </div>

      {/* Flights Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading flights...</div>
        ) : flights.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No flights found. Click "Add Flight" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flight Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Times
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pricing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Season
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {flights.map((flight) => (
                  <tr key={flight.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {flight.from_airport} → {flight.to_airport}
                          </div>
                          <div className="text-xs text-gray-500">
                            {flight.from_city || flight.from_airport} to {flight.to_city || flight.to_airport}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {flight.airline || 'N/A'}
                        {flight.flight_number && ` - ${flight.flight_number}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {flight.booking_class} Class
                        {flight.baggage_allowance && ` • ${flight.baggage_allowance}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{formatTime(flight.departure_time)} - {formatTime(flight.arrival_time)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        One-way: {formatPrice(flight.price_oneway, flight.currency)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Round-trip: {formatPrice(flight.price_roundtrip, flight.currency)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {flight.provider_name || 'Direct Airline'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {flight.season_name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(flight.start_date)} - {formatDate(flight.end_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        flight.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {flight.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditFlight(flight)}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteFlight(flight.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <AddEditFlightModal
          flight={editingFlight}
          onClose={handleModalClose}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
