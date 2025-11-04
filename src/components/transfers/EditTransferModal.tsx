import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Transfer {
  id: number;
  organization_id: number;
  provider_id: number | null;
  vehicle_id: number;
  from_city: string;
  to_city: string;
  season_name: string;
  start_date: string;
  end_date: string;
  price_oneway: number;
  price_roundtrip: number;
  estimated_duration_hours: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  created_by: number | null;
  vehicle_type: string | null;
  capacity: number | null;
}

interface Vehicle {
  id: number;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  capacity: number | null;
}

interface Provider {
  id: number;
  provider_name: string;
  provider_type: string;
}

interface EditTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transfer: Transfer | null;
}

export default function EditTransferModal({ isOpen, onClose, onSuccess, transfer }: EditTransferModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
    id: 0,
    provider_id: null as number | null,
    vehicle_id: '',
    from_city: '',
    to_city: '',
    season_name: '',
    start_date: '',
    end_date: '',
    price_oneway: '',
    price_roundtrip: '',
    estimated_duration_hours: '',
    notes: '',
    status: 'active'
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (organizationId == null) return;
    fetchProviders();
  }, [organizationId]);

  useEffect(() => {
    if (isOpen && organizationId != null) {
      fetchVehicles();
    }
  }, [isOpen, organizationId]);

  useEffect(() => {
    if (transfer) {
      setFormData({
        id: transfer.id,
        provider_id: transfer.provider_id,
        vehicle_id: transfer.vehicle_id.toString(),
        from_city: transfer.from_city,
        to_city: transfer.to_city,
        season_name: transfer.season_name,
        start_date: transfer.start_date.split('T')[0],
        end_date: transfer.end_date.split('T')[0],
        price_oneway: transfer.price_oneway.toString(),
        price_roundtrip: transfer.price_roundtrip.toString(),
        estimated_duration_hours: transfer.estimated_duration_hours ? transfer.estimated_duration_hours.toString() : '',
        notes: transfer.notes || '',
        status: transfer.status
      });
    }
  }, [transfer]);

  async function fetchProviders() {
    if (organizationId == null) return;
    try {
      const res = await fetch('/api/providers?include_all=true&limit=1000', {
        headers: {
          'X-Tenant-Id': organizationId.toString()
        }
      });
      const data = await res.json();
      setProviders(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    }
  }

  async function fetchVehicles() {
    if (organizationId == null) return;
    try {
      const res = await fetch('/api/vehicles?limit=1000', {
        headers: {
          'X-Tenant-Id': organizationId.toString()
        }
      });
      const data = await res.json();
      setVehicles(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      setVehicles([]);
    }
  }

  if (!isOpen || !transfer) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.vehicle_id) {
        setFormError('Vehicle is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.from_city.trim()) {
        setFormError('From city is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.to_city.trim()) {
        setFormError('To city is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.season_name.trim()) {
        setFormError('Season name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.start_date) {
        setFormError('Start date is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.end_date) {
        setFormError('End date is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.price_oneway) {
        setFormError('One-way price is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.price_roundtrip) {
        setFormError('Round-trip price is required');
        setFormSubmitting(false);
        return;
      }

      if (organizationId == null) {
        setFormError('Unable to determine organization context. Please refresh and try again.');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/transfers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId.toString()
        },
        body: JSON.stringify({
          id: formData.id,
          provider_id: formData.provider_id,
          vehicle_id: parseInt(formData.vehicle_id),
          from_city: formData.from_city,
          to_city: formData.to_city,
          season_name: formData.season_name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          price_oneway: parseFloat(formData.price_oneway),
          price_roundtrip: parseFloat(formData.price_roundtrip),
          estimated_duration_hours: formData.estimated_duration_hours ? parseFloat(formData.estimated_duration_hours) : null,
          notes: formData.notes || null,
          status: formData.status
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update transfer');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Edit form submission error:', error);
      setFormError('Failed to update transfer. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const getVehicleLabel = (vehicle: Vehicle) => {
    const parts = [vehicle.vehicle_type];
    if (vehicle.brand && vehicle.model) {
      parts.push(`- ${vehicle.brand} ${vehicle.model}`);
    }
    if (vehicle.capacity) {
      parts.push(`(${vehicle.capacity} pax)`);
    }
    return parts.join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Intercity Transfer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={formSubmitting}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-6">
              {/* Route Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Route Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider / Company
                    </label>
                    <select
                      value={formData.provider_id || ''}
                      onChange={(e) => handleFormChange('provider_id', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Not assigned</option>
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.provider_name} ({provider.provider_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.from_city}
                      onChange={(e) => handleFormChange('from_city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Istanbul"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      To City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.to_city}
                      onChange={(e) => handleFormChange('to_city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Cappadocia"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Duration (hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.estimated_duration_hours}
                      onChange={(e) => handleFormChange('estimated_duration_hours', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., 8.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.vehicle_id}
                      onChange={(e) => handleFormChange('vehicle_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {getVehicleLabel(vehicle)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Season & Dates */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Season & Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Season Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.season_name}
                      onChange={(e) => handleFormChange('season_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Summer 2024"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => handleFormChange('start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => handleFormChange('end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing (EUR)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      One-Way Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price_oneway}
                      onChange={(e) => handleFormChange('price_oneway', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Round-Trip Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price_roundtrip}
                      onChange={(e) => handleFormChange('price_roundtrip', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                {formData.price_oneway && formData.price_roundtrip && (
                  <div className="mt-2 text-sm text-gray-600">
                    Savings with round-trip: EUR {(parseFloat(formData.price_oneway) * 2 - parseFloat(formData.price_roundtrip)).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Additional notes or special conditions..."
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              disabled={formSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={formSubmitting}
            >
              {formSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
