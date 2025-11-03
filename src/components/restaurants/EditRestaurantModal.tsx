import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Restaurant {
  id: number;
  organization_id: number;
  provider_id: number | null;
  restaurant_name: string;
  city: string;
  meal_type: string;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  adult_lunch_price: number | null;
  child_lunch_price: number | null;
  adult_dinner_price: number | null;
  child_dinner_price: number | null;
  menu_description: string | null;
  effective_from: string | null;
  created_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface Provider {
  id: number;
  provider_name: string;
  provider_type: string;
}

interface EditRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  restaurant: Restaurant | null;
}

export default function EditRestaurantModal({ isOpen, onClose, onSuccess, restaurant }: EditRestaurantModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
    id: 0,
    organization_id: 1,
    provider_id: null as number | null,
    restaurant_name: '',
    city: '',
    meal_type: 'Both',
    season_name: '',
    start_date: '',
    end_date: '',
    currency: 'EUR',
    adult_lunch_price: '',
    child_lunch_price: '',
    adult_dinner_price: '',
    child_dinner_price: '',
    menu_description: '',
    effective_from: '',
    created_by: '',
    notes: '',
    status: 'active'
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (restaurant) {
      setFormData({
        id: restaurant.id,
        organization_id: restaurant.organization_id,
        provider_id: restaurant.provider_id,
        restaurant_name: restaurant.restaurant_name,
        city: restaurant.city,
        meal_type: restaurant.meal_type,
        season_name: restaurant.season_name,
        start_date: new Date(restaurant.start_date).toISOString().split('T')[0],
        end_date: new Date(restaurant.end_date).toISOString().split('T')[0],
        currency: restaurant.currency,
        adult_lunch_price: restaurant.adult_lunch_price?.toString() || '',
        child_lunch_price: restaurant.child_lunch_price?.toString() || '',
        adult_dinner_price: restaurant.adult_dinner_price?.toString() || '',
        child_dinner_price: restaurant.child_dinner_price?.toString() || '',
        menu_description: restaurant.menu_description || '',
        effective_from: restaurant.effective_from ? new Date(restaurant.effective_from).toISOString().split('T')[0] : '',
        created_by: restaurant.created_by || '',
        notes: restaurant.notes || '',
        status: restaurant.status
      });
    }
  }, [restaurant]);

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
    }
  }

  if (!isOpen || !restaurant) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.restaurant_name.trim()) {
        setFormError('Restaurant name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.city.trim()) {
        setFormError('City is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.season_name.trim()) {
        setFormError('Season name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.start_date || !formData.end_date) {
        setFormError('Start and end dates are required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/restaurants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          organization_id: formData.organization_id,
          provider_id: formData.provider_id,
          restaurant_name: formData.restaurant_name,
          city: formData.city,
          meal_type: formData.meal_type,
          season_name: formData.season_name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          currency: formData.currency,
          adult_lunch_price: formData.adult_lunch_price ? parseFloat(formData.adult_lunch_price) : null,
          child_lunch_price: formData.child_lunch_price ? parseFloat(formData.child_lunch_price) : null,
          adult_dinner_price: formData.adult_dinner_price ? parseFloat(formData.adult_dinner_price) : null,
          child_dinner_price: formData.child_dinner_price ? parseFloat(formData.child_dinner_price) : null,
          menu_description: formData.menu_description || null,
          effective_from: formData.effective_from || null,
          created_by: formData.created_by || null,
          notes: formData.notes || null,
          status: formData.status
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update restaurant');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Edit form submission error:', error);
      setFormError('Failed to update restaurant. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Edit Restaurant</h2>
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
                      Restaurant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.restaurant_name}
                      onChange={(e) => handleFormChange('restaurant_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Grand Palace Restaurant"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleFormChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Istanbul"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meal Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.meal_type}
                      onChange={(e) => handleFormChange('meal_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleFormChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="TRY">TRY</option>
                    </select>
                  </div>
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

              {/* Season & Dates */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Season & Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Season Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.season_name}
                      onChange={(e) => handleFormChange('season_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Winter 2025-26"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective From
                    </label>
                    <input
                      type="date"
                      value={formData.effective_from}
                      onChange={(e) => handleFormChange('effective_from', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adult Lunch Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.adult_lunch_price}
                      onChange={(e) => handleFormChange('adult_lunch_price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Child Lunch Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.child_lunch_price}
                      onChange={(e) => handleFormChange('child_lunch_price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adult Dinner Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.adult_dinner_price}
                      onChange={(e) => handleFormChange('adult_dinner_price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Child Dinner Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.child_dinner_price}
                      onChange={(e) => handleFormChange('child_dinner_price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Menu Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Menu Description</h3>
                <textarea
                  value={formData.menu_description}
                  onChange={(e) => handleFormChange('menu_description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe the menu offerings..."
                />
              </div>

              {/* Additional Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Created By
                    </label>
                    <input
                      type="text"
                      value={formData.created_by}
                      onChange={(e) => handleFormChange('created_by', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Your name or identifier"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleFormChange('notes', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
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
