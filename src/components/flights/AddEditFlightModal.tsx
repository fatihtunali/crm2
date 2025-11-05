'use client';

import { useEffect, useState } from 'react';

interface Provider {
  id: number;
  provider_name: string;
}

interface Flight {
  id: number;
  provider_id: number | null;
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
}

interface AddEditFlightModalProps {
  flight: Flight | null;
  onClose: () => void;
  organizationId: string;
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

export default function AddEditFlightModal({ flight, onClose, organizationId }: AddEditFlightModalProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    provider_id: flight?.provider_id || null,
    from_airport: flight?.from_airport || '',
    to_airport: flight?.to_airport || '',
    from_city: flight?.from_city || '',
    to_city: flight?.to_city || '',
    season_name: flight?.season_name || 'Winter 2025-26 Season',
    start_date: flight?.start_date ? flight.start_date.substring(0, 10) : '2025-11-01',
    end_date: flight?.end_date ? flight.end_date.substring(0, 10) : '2026-03-14',
    departure_time: flight?.departure_time || '',
    arrival_time: flight?.arrival_time || '',
    price_oneway: flight?.price_oneway || 0,
    price_roundtrip: flight?.price_roundtrip || 0,
    airline: flight?.airline || '',
    flight_number: flight?.flight_number || '',
    booking_class: flight?.booking_class || 'Economy',
    baggage_allowance: flight?.baggage_allowance || '20kg',
    currency: flight?.currency || 'EUR',
    notes: flight?.notes || '',
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  // Auto-fill city when airport is selected
  useEffect(() => {
    if (formData.from_airport && !formData.from_city) {
      const airport = TURKISH_AIRPORTS.find(a => a.code === formData.from_airport);
      if (airport) {
        setFormData(prev => ({ ...prev, from_city: airport.city }));
      }
    }
  }, [formData.from_airport]);

  useEffect(() => {
    if (formData.to_airport && !formData.to_city) {
      const airport = TURKISH_AIRPORTS.find(a => a.code === formData.to_airport);
      if (airport) {
        setFormData(prev => ({ ...prev, to_city: airport.city }));
      }
    }
  }, [formData.to_airport]);

  async function fetchProviders() {
    try {
      const res = await fetch('/api/providers?limit=1000', {
        headers: { 'X-Tenant-Id': organizationId }
      });
      const data = await res.json();
      setProviders(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = flight ? `/api/flights/${flight.id}` : '/api/flights';
      const method = flight ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to save flight');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving flight:', error);
      alert(error.message || 'Failed to save flight');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {flight ? 'Edit Flight' : 'Add New Flight'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Provider Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider / Supplier <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={formData.provider_id || ''}
                onChange={(e) => setFormData({...formData, provider_id: e.target.value ? parseInt(e.target.value) : null})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Direct Airline Booking</option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.provider_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select a provider if booking through an operator, leave blank for direct airline booking
              </p>
            </div>

            {/* Route Section */}
            <div className="md:col-span-2 border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Flight Route</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Airport <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.from_airport}
                onChange={(e) => setFormData({...formData, from_airport: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select Airport</option>
                {TURKISH_AIRPORTS.map(airport => (
                  <option key={airport.code} value={airport.code}>
                    {airport.code} - {airport.name} ({airport.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Airport <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.to_airport}
                onChange={(e) => setFormData({...formData, to_airport: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select Airport</option>
                {TURKISH_AIRPORTS.map(airport => (
                  <option key={airport.code} value={airport.code}>
                    {airport.code} - {airport.name} ({airport.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From City</label>
              <input
                type="text"
                value={formData.from_city}
                onChange={(e) => setFormData({...formData, from_city: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Auto-filled from airport"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To City</label>
              <input
                type="text"
                value={formData.to_city}
                onChange={(e) => setFormData({...formData, to_city: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Auto-filled from airport"
              />
            </div>

            {/* Flight Details Section */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Flight Details</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Airline</label>
              <input
                type="text"
                value={formData.airline}
                onChange={(e) => setFormData({...formData, airline: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., Turkish Airlines"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Flight Number</label>
              <input
                type="text"
                value={formData.flight_number}
                onChange={(e) => setFormData({...formData, flight_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., TK123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Departure Time</label>
              <input
                type="time"
                value={formData.departure_time}
                onChange={(e) => setFormData({...formData, departure_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arrival Time</label>
              <input
                type="time"
                value={formData.arrival_time}
                onChange={(e) => setFormData({...formData, arrival_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Booking Class</label>
              <select
                value={formData.booking_class}
                onChange={(e) => setFormData({...formData, booking_class: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Economy">Economy</option>
                <option value="Business">Business</option>
                <option value="First">First</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Baggage Allowance</label>
              <input
                type="text"
                value={formData.baggage_allowance}
                onChange={(e) => setFormData({...formData, baggage_allowance: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., 20kg"
              />
            </div>

            {/* Pricing Section */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="TRY">TRY</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            <div></div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                One-way Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price_oneway}
                onChange={(e) => setFormData({...formData, price_oneway: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Round-trip Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price_roundtrip}
                onChange={(e) => setFormData({...formData, price_roundtrip: parseFloat(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            {/* Season Section */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Season & Validity</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Season Name</label>
              <input
                type="text"
                value={formData.season_name}
                onChange={(e) => setFormData({...formData, season_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div></div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Additional notes about this flight..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : flight ? 'Update Flight' : 'Add Flight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
