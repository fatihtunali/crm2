import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import FavoritePriorityField from '@/components/common/FavoritePriorityField';

interface NewProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParentProvider {
  id: number;
  provider_name: string;
  company_legal_name: string | null;
}

export default function NewProviderModal({ isOpen, onClose, onSuccess }: NewProviderModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
    provider_name: '',
    provider_type: 'tour_operator',
    provider_types: ['tour_operator'] as string[],
    city: '',
    address: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
    status: 'active',
    is_parent: false,
    parent_provider_id: '',
    company_tax_id: '',
    company_legal_name: '',
    favorite_priority: 0
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [parentProviders, setParentProviders] = useState<ParentProvider[]>([]);

  // Fetch parent providers
  useEffect(() => {
    if (isOpen) {
      fetchParentProviders();
    }
  }, [isOpen]);

  const fetchParentProviders = async () => {
    try {
      const res = await fetch('/api/providers?include_all=true&limit=1000', {
        headers: { 'X-Tenant-Id': organizationId }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter to only show parent companies or standalone providers
        const parents = data.data.filter((p: any) => p.is_parent === 1);
        setParentProviders(parents);
      }
    } catch (error) {
      console.error('Failed to fetch parent providers:', error);
    }
  };

  if (!isOpen) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.provider_name.trim()) {
        setFormError('Provider name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.provider_type) {
        setFormError('Provider type is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/providers?include_all=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({
          provider_name: formData.provider_name,
          provider_type: formData.provider_type,
          provider_types: formData.provider_types,
          city: formData.city || null,
          address: formData.address || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          is_parent: formData.is_parent ? 1 : 0,
          parent_provider_id: formData.parent_provider_id ? parseInt(formData.parent_provider_id) : null,
          company_tax_id: formData.company_tax_id || null,
          company_legal_name: formData.company_legal_name || null,
          notes: formData.notes || null,
          status: formData.status,
          favorite_priority: formData.favorite_priority
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create provider');
      }

      setFormData({
        provider_name: '',
        provider_type: 'tour_operator',
        provider_types: ['tour_operator'],
        city: '',
        address: '',
        contact_email: '',
        contact_phone: '',
        notes: '',
        status: 'active',
        is_parent: false,
        parent_provider_id: '',
        company_tax_id: '',
        company_legal_name: '',
        favorite_priority: 0
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Failed to create provider. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Supplier</h2>
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
                      Provider Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.provider_name}
                      onChange={(e) => handleFormChange('provider_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Acme Travel Services"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider Type{formData.is_parent ? 's' : ''} <span className="text-red-500">*</span>
                    </label>
                    {formData.is_parent ? (
                      <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <p className="text-xs text-gray-600 mb-2">Select all services this parent company provides:</p>
                        {[
                          { value: 'tour_operator', label: 'Tour Operator' },
                          { value: 'transport', label: 'Transport' },
                          { value: 'restaurant', label: 'Restaurant' },
                          { value: 'government', label: 'Government' },
                          { value: 'entrance_fee', label: 'Entrance Fee' },
                          { value: 'other', label: 'Other' }
                        ].map(type => (
                          <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.provider_types.includes(type.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleFormChange('provider_types', [...formData.provider_types, type.value]);
                                  if (formData.provider_types.length === 0) {
                                    handleFormChange('provider_type', type.value);
                                  }
                                } else {
                                  const newTypes = formData.provider_types.filter(t => t !== type.value);
                                  handleFormChange('provider_types', newTypes);
                                  if (newTypes.length > 0 && formData.provider_type === type.value) {
                                    handleFormChange('provider_type', newTypes[0]);
                                  }
                                }
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <select
                        value={formData.provider_type}
                        onChange={(e) => {
                          handleFormChange('provider_type', e.target.value);
                          handleFormChange('provider_types', [e.target.value]);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="hotel">Hotel</option>
                        <option value="tour_operator">Tour Operator</option>
                        <option value="transport">Transport</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="government">Government</option>
                        <option value="guide">Guide</option>
                        <option value="entrance_fee">Entrance Fee</option>
                        <option value="other">Other</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleFormChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="e.g., Istanbul"
                    />
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
                      placeholder="contact@provider.com"
                    />
                  </div>
                </div>
              </div>

              {/* Company Structure */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Company Structure</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_parent}
                        onChange={(e) => {
                          handleFormChange('is_parent', e.target.checked);
                          if (e.target.checked) {
                            handleFormChange('parent_provider_id', '');
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        📁 This is a parent company (has multiple divisions)
                      </span>
                    </label>
                  </div>

                  {!formData.is_parent && parentProviders.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent Company (Optional)
                      </label>
                      <select
                        value={formData.parent_provider_id}
                        onChange={(e) => handleFormChange('parent_provider_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">None - Independent Provider</option>
                        {parentProviders.map(parent => (
                          <option key={parent.id} value={parent.id}>
                            {parent.provider_name} {parent.company_legal_name && `(${parent.company_legal_name})`}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Select if this provider is a division of a larger company
                      </p>
                    </div>
                  )}

                  {formData.is_parent && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Legal Company Name
                        </label>
                        <input
                          type="text"
                          value={formData.company_legal_name}
                          onChange={(e) => handleFormChange('company_legal_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="e.g., Acme Travel Services Ltd."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Official legal name for contracts and invoices
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tax ID / VAT Number
                        </label>
                        <input
                          type="text"
                          value={formData.company_tax_id}
                          onChange={(e) => handleFormChange('company_tax_id', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="e.g., TR1234567890"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tax identification number for billing
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Additional Information */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleFormChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleFormChange('notes', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Internal notes about this provider..."
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
              {formSubmitting ? 'Creating...' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
