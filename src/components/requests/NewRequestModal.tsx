import { useState } from 'react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewRequestModal({ isOpen, onClose, onSuccess }: NewRequestModalProps) {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    destination: '',
    start_date: '',
    end_date: '',
    adults: 2,
    children: 0,
    tour_type: '',
    hotel_category: '',
    total_price: '',
    special_requests: ''
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
      if (!formData.customer_name.trim()) {
        setFormError('Customer name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.customer_email.trim()) {
        setFormError('Customer email is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.destination.trim()) {
        setFormError('Destination is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.start_date || !formData.end_date) {
        setFormError('Start and end dates are required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.total_price || parseFloat(formData.total_price) <= 0) {
        setFormError('Valid total price is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone || null,
          destination: formData.destination,
          start_date: formData.start_date,
          end_date: formData.end_date,
          adults: formData.adults,
          children: formData.children,
          tour_type: formData.tour_type || null,
          hotel_category: formData.hotel_category || null,
          total_price: parseFloat(formData.total_price),
          special_requests: formData.special_requests || null
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create request');
      }

      setFormData({
        customer_name: '', customer_email: '', customer_phone: '', destination: '',
        start_date: '', end_date: '', adults: 2, children: 0, tour_type: '',
        hotel_category: '', total_price: '', special_requests: ''
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Failed to create request. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Request</h2>
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
              {/* Customer Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => handleFormChange('customer_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => handleFormChange('customer_email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="customer@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => handleFormChange('customer_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="+1234567890"
                    />
                  </div>
                </div>
              </div>

              {/* Trip Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Trip Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.destination}
                      onChange={(e) => handleFormChange('destination', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Turkey, Istanbul"
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

              {/* Passengers & Preferences */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Passengers & Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adults <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.adults}
                      onChange={(e) => handleFormChange('adults', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.children}
                      onChange={(e) => handleFormChange('children', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tour Type</label>
                    <select
                      value={formData.tour_type}
                      onChange={(e) => handleFormChange('tour_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select type</option>
                      <option value="SIC">SIC (Seat-in-Coach)</option>
                      <option value="PRIVATE">Private Tour</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Category</label>
                    <select
                      value={formData.hotel_category}
                      onChange={(e) => handleFormChange('hotel_category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select category</option>
                      <option value="3">3-star</option>
                      <option value="4">4-star</option>
                      <option value="5">5-star</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Price (€) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.total_price}
                      onChange={(e) => handleFormChange('total_price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600">
                      <span className="block mb-1 font-medium">Price per person:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        €{formData.total_price && (formData.adults + formData.children) > 0
                          ? (parseFloat(formData.total_price) / (formData.adults + formData.children)).toFixed(2)
                          : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                  <textarea
                    value={formData.special_requests}
                    onChange={(e) => handleFormChange('special_requests', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Any special requirements or notes..."
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
              {formSubmitting ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
