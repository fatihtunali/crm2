import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Vehicle {
  id: number;
  organization_id: number;
  provider_id: number | null;
  vehicle_type: string;
  max_capacity: number;
  city: string;
  description: string | null;
  status: string;
}

interface Provider {
  id: number;
  provider_name: string;
  provider_type: string;
}

interface EditVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle: Vehicle | null;
}

export default function EditVehicleModal({ isOpen, onClose, onSuccess, vehicle }: EditVehicleModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
    id: 0,
    provider_id: null as number | null,
    vehicle_type: '',
    max_capacity: '',
    city: '',
    description: '',
    status: 'active'
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        id: vehicle.id,
        provider_id: vehicle.provider_id,
        vehicle_type: vehicle.vehicle_type,
        max_capacity: vehicle.max_capacity.toString(),
        city: vehicle.city,
        description: vehicle.description || '',
        status: vehicle.status
      });
    }
  }, [vehicle]);

  async function fetchProviders() {
    try {
      const res = await fetch('/api/providers?limit=1000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setProviders(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    }
  }

  if (!isOpen || !vehicle) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.vehicle_type.trim()) {
        setFormError('Vehicle type is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.max_capacity || parseInt(formData.max_capacity) <= 0) {
        setFormError('Max capacity must be greater than 0');
        setFormSubmitting(false);
        return;
      }
      if (!formData.city.trim()) {
        setFormError('City is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          provider_id: formData.provider_id,
          vehicle_type: formData.vehicle_type,
          max_capacity: parseInt(formData.max_capacity),
          city: formData.city,
          description: formData.description || null,
          status: formData.status
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update vehicle');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Edit form submission error:', error);
      setFormError('Failed to update vehicle. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Vehicle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={formSubmitting}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                <div className="space-y-4">
                  {/* Provider */}
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

                  {/* Vehicle Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.vehicle_type}
                      onChange={(e) => handleFormChange('vehicle_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Mercedes-Benz Sprinter, Minivan, Sedan"
                      required
                    />
                  </div>

                  {/* Max Capacity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_capacity}
                      onChange={(e) => handleFormChange('max_capacity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., 8"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Number of passengers this vehicle can accommodate</p>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleFormChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Istanbul, Antalya, Cappadocia"
                      required
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

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Additional details about the vehicle (features, amenities, etc.)"
                />
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
