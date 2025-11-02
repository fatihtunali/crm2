import { useState } from 'react';

interface NewHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewHotelModal({ isOpen, onClose, onSuccess }: NewHotelModalProps) {
  const [formData, setFormData] = useState({
    google_place_id: '',
    organization_id: '',
    hotel_name: '',
    city: '',
    star_rating: '',
    hotel_category: 'standard_4star',
    room_count: '',
    is_boutique: '0',
    address: '',
    latitude: '',
    longitude: '',
    google_maps_url: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
    photo_url_1: '',
    photo_url_2: '',
    photo_url_3: '',
    rating: '',
    user_ratings_total: '',
    website: '',
    editorial_summary: '',
    place_types: '',
    price_level: '',
    business_status: 'OPERATIONAL'
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
      if (!formData.hotel_name.trim()) {
        setFormError('Hotel name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.city.trim()) {
        setFormError('City is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_place_id: formData.google_place_id || null,
          organization_id: formData.organization_id ? parseInt(formData.organization_id) : null,
          hotel_name: formData.hotel_name,
          city: formData.city,
          star_rating: formData.star_rating ? parseInt(formData.star_rating) : null,
          hotel_category: formData.hotel_category || null,
          room_count: formData.room_count ? parseInt(formData.room_count) : null,
          is_boutique: parseInt(formData.is_boutique),
          address: formData.address || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          google_maps_url: formData.google_maps_url || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          notes: formData.notes || null,
          photo_url_1: formData.photo_url_1 || null,
          photo_url_2: formData.photo_url_2 || null,
          photo_url_3: formData.photo_url_3 || null,
          rating: formData.rating ? parseFloat(formData.rating) : null,
          user_ratings_total: formData.user_ratings_total ? parseInt(formData.user_ratings_total) : null,
          website: formData.website || null,
          editorial_summary: formData.editorial_summary || null,
          place_types: formData.place_types || null,
          price_level: formData.price_level ? parseInt(formData.price_level) : null,
          business_status: formData.business_status || null
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create hotel');
      }

      setFormData({
        google_place_id: '', organization_id: '', hotel_name: '', city: '', star_rating: '',
        hotel_category: 'standard_4star', room_count: '', is_boutique: '0', address: '',
        latitude: '', longitude: '', google_maps_url: '', contact_phone: '', contact_email: '',
        notes: '', photo_url_1: '', photo_url_2: '', photo_url_3: '', rating: '',
        user_ratings_total: '', website: '', editorial_summary: '', place_types: '',
        price_level: '', business_status: 'OPERATIONAL'
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Failed to create hotel. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Hotel</h2>
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
                      Hotel Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.hotel_name}
                      onChange={(e) => handleFormChange('hotel_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Grand Hyatt Istanbul"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Star Rating</label>
                    <select
                      value={formData.star_rating}
                      onChange={(e) => handleFormChange('star_rating', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      <option value="5">5 Star</option>
                      <option value="4">4 Star</option>
                      <option value="3">3 Star</option>
                      <option value="2">2 Star</option>
                      <option value="1">1 Star</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Category</label>
                    <select
                      value={formData.hotel_category}
                      onChange={(e) => handleFormChange('hotel_category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="budget">Budget</option>
                      <option value="standard_3star">Standard 3-Star</option>
                      <option value="standard_4star">Standard 4-Star</option>
                      <option value="standard_5star">Standard 5-Star</option>
                      <option value="special_class">Special Class</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Count</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.room_count}
                      onChange={(e) => handleFormChange('room_count', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Type</label>
                    <select
                      value={formData.is_boutique}
                      onChange={(e) => handleFormChange('is_boutique', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="0">Standard Hotel</option>
                      <option value="1">Boutique Hotel</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleFormChange('address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Full address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => handleFormChange('contact_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="+90 212 123 4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => handleFormChange('contact_email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="info@hotel.com"
                    />
                  </div>
                  <div className="md:col-span-2">
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

              {/* Location */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude}
                      onChange={(e) => handleFormChange('latitude', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="41.0082"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude}
                      onChange={(e) => handleFormChange('longitude', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="28.9784"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Rating</label>
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
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.editorial_summary}
                    onChange={(e) => handleFormChange('editorial_summary', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Hotel description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Internal notes..."
                  />
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
              {formSubmitting ? 'Creating...' : 'Create Hotel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
