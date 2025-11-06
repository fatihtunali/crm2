import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import FavoritePriorityField from '@/components/common/FavoritePriorityField';

interface TourPackage {
  id: number;
  provider_id: number | null;
  tour_name: string;
  tour_code: string;
  city: string;
  duration_days: number | null;
  duration_hours: number | null;
  duration_type: string | null;
  description: string;
  tour_type: string;
  inclusions: string | null;
  exclusions: string | null;
  status: string;
  photo_url_1: string | null;
  photo_url_2: string | null;
  photo_url_3: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  website: string | null;
}

interface Provider {
  id: number;
  provider_name: string;
  provider_type: string;
  provider_types?: string[] | string;
}

interface EditTourPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tourPackage: TourPackage | null;
}

export default function EditTourPackageModal({ isOpen, onClose, onSuccess, tourPackage }: EditTourPackageModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
    id: 0,
    provider_id: null as number | null,
    tour_name: '',
    tour_code: '',
    city: '',
    duration_days: '',
    duration_hours: '',
    duration_type: 'DAYS',
    description: '',
    tour_type: 'SIC',
    inclusions: '',
    exclusions: '',
    photo_url_1: '',
    photo_url_2: '',
    photo_url_3: '',
    rating: '',
    user_ratings_total: '',
    website: '',
    status: 'active',
    favorite_priority: 0
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (tourPackage) {
      setFormData({
        id: tourPackage.id,
        provider_id: tourPackage.provider_id,
        tour_name: tourPackage.tour_name,
        tour_code: tourPackage.tour_code,
        city: tourPackage.city,
        duration_days: tourPackage.duration_days ? tourPackage.duration_days.toString() : '',
        duration_hours: tourPackage.duration_hours ? tourPackage.duration_hours.toString() : '',
        duration_type: tourPackage.duration_type || 'DAYS',
        description: tourPackage.description || '',
        tour_type: tourPackage.tour_type,
        inclusions: tourPackage.inclusions || '',
        exclusions: tourPackage.exclusions || '',
        photo_url_1: tourPackage.photo_url_1 || '',
        photo_url_2: tourPackage.photo_url_2 || '',
        photo_url_3: tourPackage.photo_url_3 || '',
        rating: tourPackage.rating ? tourPackage.rating.toString() : '',
        user_ratings_total: tourPackage.user_ratings_total ? tourPackage.user_ratings_total.toString() : '',
        website: tourPackage.website || '',
        status: tourPackage.status,
        favorite_priority: (tourPackage as any).favorite_priority || 0
      });
    }
  }, [tourPackage]);

  async function fetchProviders() {
    try {
      // Only fetch tour operators for daily tours
      const res = await fetch('/api/providers?provider_type=tour_operator&limit=1000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });

      if (!res.ok) {
        console.error('Failed to fetch providers:', res.status);
        setProviders([]);
        return;
      }

      const data = await res.json();
      // Handle both paginated and non-paginated responses
      setProviders(Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []));
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    }
  }

  if (!isOpen || !tourPackage) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.tour_name.trim()) {
        setFormError('Tour name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.tour_code.trim()) {
        setFormError('Tour code is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.city.trim()) {
        setFormError('City is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch(`/api/daily-tours/${formData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({
          id: formData.id,
          provider_id: formData.provider_id,
          tour_name: formData.tour_name,
          tour_code: formData.tour_code,
          city: formData.city,
          duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
          duration_hours: formData.duration_hours ? parseInt(formData.duration_hours) : null,
          duration_type: formData.duration_type,
          description: formData.description || null,
          tour_type: formData.tour_type,
          inclusions: formData.inclusions || null,
          exclusions: formData.exclusions || null,
          photo_url_1: formData.photo_url_1 || null,
          photo_url_2: formData.photo_url_2 || null,
          photo_url_3: formData.photo_url_3 || null,
          rating: formData.rating ? parseFloat(formData.rating) : null,
          user_ratings_total: formData.user_ratings_total ? parseInt(formData.user_ratings_total) : null,
          website: formData.website || null,
          status: formData.status,
          favorite_priority: formData.favorite_priority
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update tour package');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Edit form submission error:', error);
      setFormError('Failed to update tour package. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Tour Package</h2>
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider / Company
                    </label>
                    <select
                      value={formData.provider_id || ''}
                      onChange={(e) => handleFormChange('provider_id', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Not assigned</option>
                      {providers.map(provider => {
                        // For multi-type providers, show "Tour Operator" if available, otherwise show primary type
                        let displayType = provider.provider_type;
                        if (provider.provider_types) {
                          const types = typeof provider.provider_types === 'string'
                            ? JSON.parse(provider.provider_types)
                            : provider.provider_types;
                          if (types.includes('tour_operator')) {
                            displayType = 'tour_operator';
                          }
                        }
                        return (
                          <option key={provider.id} value={provider.id}>
                            {provider.provider_name} ({displayType})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tour Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.tour_name}
                      onChange={(e) => handleFormChange('tour_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Bosphorus Cruise & Asian Side"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tour Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.tour_code}
                      onChange={(e) => handleFormChange('tour_code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., BOS-SIC-01"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tour Type</label>
                    <select
                      value={formData.tour_type}
                      onChange={(e) => handleFormChange('tour_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="SIC">SIC (Seat-in-Coach)</option>
                      <option value="PRIVATE">Private Tour</option>
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

              {/* Duration */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Duration</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration Type</label>
                    <select
                      value={formData.duration_type}
                      onChange={(e) => handleFormChange('duration_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="DAYS">Days</option>
                      <option value="HOURS">Hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.duration_days}
                      onChange={(e) => handleFormChange('duration_days', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.duration_hours}
                      onChange={(e) => handleFormChange('duration_hours', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0"
                    />
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
                  placeholder="Describe the tour package..."
                />
              </div>

              {/* Inclusions & Exclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Inclusions</h3>
                  <textarea
                    value={formData.inclusions}
                    onChange={(e) => handleFormChange('inclusions', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="What's included in the tour..."
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Exclusions</h3>
                  <textarea
                    value={formData.exclusions}
                    onChange={(e) => handleFormChange('exclusions', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="What's not included in the tour..."
                  />
                </div>
              </div>

              {/* Photos */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Photos</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL 1</label>
                    <input
                      type="url"
                      value={formData.photo_url_1}
                      onChange={(e) => handleFormChange('photo_url_1', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com/photo1.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL 2</label>
                    <input
                      type="url"
                      value={formData.photo_url_2}
                      onChange={(e) => handleFormChange('photo_url_2', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com/photo2.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL 3</label>
                    <input
                      type="url"
                      value={formData.photo_url_3}
                      onChange={(e) => handleFormChange('photo_url_3', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com/photo3.jpg"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.rating}
                      onChange={(e) => handleFormChange('rating', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.0 - 5.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Reviews</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.user_ratings_total}
                      onChange={(e) => handleFormChange('user_ratings_total', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleFormChange('website', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Favorite Priority */}
              <div className="border-t border-gray-200 pt-4">
                <FavoritePriorityField
                  value={formData.favorite_priority || 0}
                  onChange={(val) => setFormData({ ...formData, favorite_priority: val })}
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
