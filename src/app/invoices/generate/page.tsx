'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Booking {
  id: number;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_price: number;
  has_invoices: boolean;
}

export default function GenerateInvoicesPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<number[]>([]);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    try {
      const res = await fetch('/api/quotations?status=accepted');
      const data = await res.json();

      // Check which bookings already have invoices
      const bookingsWithStatus = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (booking: Booking) => {
          const invoicesRes = await fetch(`/api/invoices/check/${booking.id}`);
          const invoiceData = await invoicesRes.json();
          return {
            ...booking,
            has_invoices: invoiceData.has_invoices || false
          };
        })
      );

      setBookings(bookingsWithStatus);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleBooking(bookingId: number) {
    setSelectedBookings(prev =>
      prev.includes(bookingId)
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  }

  function selectAll() {
    const availableBookings = bookings
      .filter(b => !b.has_invoices)
      .map(b => b.id);
    setSelectedBookings(availableBookings);
  }

  function deselectAll() {
    setSelectedBookings([]);
  }

  async function generateInvoices() {
    if (selectedBookings.length === 0) {
      alert('Please select at least one booking');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingIds: selectedBookings })
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Successfully generated ${result.payables_count} payable and ${result.receivables_count} receivable invoices`);
        router.push('/invoices');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to generate invoices'}`);
      }
    } catch (error) {
      console.error('Failed to generate invoices:', error);
      alert('Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  }

  const availableBookings = bookings.filter(b => !b.has_invoices);
  const processedBookings = bookings.filter(b => b.has_invoices);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generate Invoices</h1>
            <p className="text-gray-500 mt-1">Create payable and receivable invoices from bookings</p>
          </div>
          <Link
            href="/invoices"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Invoices
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
          <div className="text-3xl font-bold text-gray-900">{bookings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Available to Invoice</div>
          <div className="text-3xl font-bold text-green-600">{availableBookings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Already Invoiced</div>
          <div className="text-3xl font-bold text-blue-600">{processedBookings.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          Loading bookings...
        </div>
      ) : availableBookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-gray-500 mb-4">No bookings available to invoice</div>
          <Link
            href="/bookings"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            View Bookings →
          </Link>
        </div>
      ) : (
        <>
          {/* Action Buttons */}
          <div className="mb-6 flex gap-4">
            <button
              onClick={selectAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={generateInvoices}
              disabled={selectedBookings.length === 0 || generating}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedBookings.length === 0 || generating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {generating ? 'Generating...' : `Generate Invoices (${selectedBookings.length})`}
            </button>
          </div>

          {/* Available Bookings */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Available Bookings</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700">Select</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Booking #</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Customer</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Destination</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Travel Dates</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {availableBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedBookings.includes(booking.id)}
                        onChange={() => toggleBooking(booking.id)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                    </td>
                    <td className="p-4 font-medium text-primary-600">
                      {booking.quote_number}
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{booking.customer_name}</div>
                        <div className="text-sm text-gray-500">{booking.customer_email}</div>
                      </div>
                    </td>
                    <td className="p-4">{booking.destination}</td>
                    <td className="p-4 text-sm">
                      {new Date(booking.start_date).toLocaleDateString()} -<br />
                      {new Date(booking.end_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-bold text-green-600">
                      €{Number(booking.total_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Already Processed */}
          {processedBookings.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Already Invoiced</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-700">Booking #</th>
                    <th className="text-left p-4 font-semibold text-gray-700">Customer</th>
                    <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {processedBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-gray-100">
                      <td className="p-4 font-medium text-gray-600">
                        {booking.quote_number}
                      </td>
                      <td className="p-4">{booking.customer_name}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Invoiced
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
