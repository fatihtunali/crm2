import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface NewRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewRestaurantModal({ isOpen, onClose, onSuccess }: NewRestaurantModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
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
    notes: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({
          organization_id: organizationId,
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
          notes: formData.notes || null
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create restaurant');
      }

      setFormData({
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
        notes: ''
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Failed to create restaurant. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">New Restaurant</h2>
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
              {formSubmitting ? 'Creating...' : 'Create Restaurant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
