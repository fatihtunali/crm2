'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface Booking {
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

export default function BookingsPage() {
  const { organizationId } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    try {
      // Fetch only accepted quotes (bookings)
      const res = await fetch('/api/quotations?status=accepted&limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const bookingsData = Array.isArray(data.data) ? data.data : [];
      setBookings(bookingsData);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500 mt-1">Confirmed customer bookings</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{bookings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">This Month</div>
          <div className="text-3xl font-bold text-primary-600">
            {bookings.filter(b => {
              const bookingDate = new Date(b.created_at);
              const now = new Date();
              return bookingDate.getMonth() === now.getMonth() &&
                     bookingDate.getFullYear() === now.getFullYear();
            }).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">
            €{bookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Total PAX</div>
          <div className="text-3xl font-bold text-blue-600">
            {bookings.reduce((sum, b) => sum + (b.pax || b.adults + b.children), 0)}
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 mb-4">No bookings yet</div>
            <Link
              href="/quotations"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              View Quotations →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Booking #</th>
                <th className="text-left p-4 font-semibold text-gray-700">Customer</th>
                <th className="text-left p-4 font-semibold text-gray-700">Destination</th>
                <th className="text-left p-4 font-semibold text-gray-700">Travel Dates</th>
                <th className="text-left p-4 font-semibold text-gray-700">PAX</th>
                <th className="text-left p-4 font-semibold text-gray-700">Days</th>
                <th className="text-left p-4 font-semibold text-gray-700">Total</th>
                <th className="text-left p-4 font-semibold text-gray-700">Booked</th>
                <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-medium text-primary-600">{booking.quote_number}</div>
                    <div className="text-xs text-gray-500 capitalize">{booking.category}</div>
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium">{booking.customer_name}</div>
                      <div className="text-sm text-gray-500">{booking.customer_email}</div>
                    </div>
                  </td>
                  <td className="p-4">{booking.destination}</td>
                  <td className="p-4">
                    <div className="text-sm">
                      {new Date(booking.start_date).toLocaleDateString()} -
                      <br />
                      {new Date(booking.end_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4">
                    {booking.pax || booking.adults}
                    {booking.children > 0 && ` + ${booking.children}`}
                  </td>
                  <td className="p-4">{booking.total_days}</td>
                  <td className="p-4">
                    <div className="font-bold text-green-600">
                      €{booking.total_price ? Number(booking.total_price).toFixed(2) : '0.00'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-500">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <Link
                        href={`/quotations/${booking.id}/view`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View
                      </Link>
                      <Link
                        href={`/quotations/${booking.id}/itinerary`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Itinerary
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
