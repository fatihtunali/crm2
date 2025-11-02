import { useState, useEffect } from 'react';

interface EntranceFee {
  id: number;
  google_place_id: string | null;
  organization_id: number | null;
  provider_id: number | null;
  site_name: string;
  city: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
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
}

interface EditEntranceFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entranceFee: EntranceFee | null;
}

export default function EditEntranceFeeModal({ isOpen, onClose, onSuccess, entranceFee }: EditEntranceFeeModalProps) {
  const [formData, setFormData] = useState({
    id: 0,
    provider_id: null as number | null,
    site_name: '',
    city: '',
    description: '',
    google_place_id: '',
    organization_id: '',
    latitude: '',
    longitude: '',
    google_maps_url: '',
    photo_url_1: '',
    photo_url_2: '',
    photo_url_3: '',
    rating: '',
    user_ratings_total: '',
    website: '',
    status: 'active'
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (entranceFee) {
      setFormData({
        id: entranceFee.id,
        provider_id: entranceFee.provider_id,
        site_name: entranceFee.site_name,
        city: entranceFee.city,
        description: entranceFee.description || '',
        google_place_id: entranceFee.google_place_id || '',
        organization_id: entranceFee.organization_id ? entranceFee.organization_id.toString() : '',
        latitude: entranceFee.latitude ? entranceFee.latitude.toString() : '',
        longitude: entranceFee.longitude ? entranceFee.longitude.toString() : '',
        google_maps_url: entranceFee.google_maps_url || '',
        photo_url_1: entranceFee.photo_url_1 || '',
        photo_url_2: entranceFee.photo_url_2 || '',
        photo_url_3: entranceFee.photo_url_3 || '',
        rating: entranceFee.rating ? entranceFee.rating.toString() : '',
        user_ratings_total: entranceFee.user_ratings_total ? entranceFee.user_ratings_total.toString() : '',
        website: entranceFee.website || '',
        status: entranceFee.status
      });
    }
  }, [entranceFee]);

  async function fetchProviders() {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  }

  if (!isOpen || !entranceFee) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.site_name.trim()) {
        setFormError('Site name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.city.trim()) {
        setFormError('City is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/entrance-fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          provider_id: formData.provider_id,
          site_name: formData.site_name,
          city: formData.city,
          description: formData.description || null,
          google_place_id: formData.google_place_id || null,
          organization_id: formData.organization_id ? parseInt(formData.organization_id) : null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          google_maps_url: formData.google_maps_url || null,
          photo_url_1: formData.photo_url_1 || null,
          photo_url_2: formData.photo_url_2 || null,
          photo_url_3: formData.photo_url_3 || null,
          rating: formData.rating ? parseFloat(formData.rating) : null,
          user_ratings_total: formData.user_ratings_total ? parseInt(formData.user_ratings_total) : null,
          website: formData.website || null,
          status: formData.status
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update entrance fee');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Edit form submission error:', error);
      setFormError('Failed to update entrance fee. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Entrance Fee</h2>
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Site Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.site_name}
                      onChange={(e) => handleFormChange('site_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Hagia Sophia"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
                    <input
                      type="number"
                      value={formData.organization_id}
                      onChange={(e) => handleFormChange('organization_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., 1"
                    />
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

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe the site..."
                />
              </div>

              {/* Google & Location Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Location Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Place ID</label>
                    <input
                      type="text"
                      value={formData.google_place_id}
                      onChange={(e) => handleFormChange('google_place_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="ChIJ..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps URL</label>
                    <input
                      type="url"
                      value={formData.google_maps_url}
                      onChange={(e) => handleFormChange('google_maps_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => handleFormChange('latitude', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="41.008583"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => handleFormChange('longitude', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="28.980185"
                    />
                  </div>
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
