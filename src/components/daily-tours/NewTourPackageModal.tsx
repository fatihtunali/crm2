import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface NewTourPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewTourPackageModal({ isOpen, onClose, onSuccess }: NewTourPackageModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
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
    website: ''
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

      const res = await fetch('/api/daily-tours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({
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
          website: formData.website || null
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create tour package');
      }

      setFormData({
        tour_name: '', tour_code: '', city: '', duration_days: '', duration_hours: '',
        duration_type: 'DAYS', description: '', tour_type: 'SIC', inclusions: '',
        exclusions: '', photo_url_1: '', photo_url_2: '', photo_url_3: '',
        rating: '', user_ratings_total: '', website: ''
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Failed to create tour package. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Tour Package</h2>
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
              {formSubmitting ? 'Creating...' : 'Create Tour Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
