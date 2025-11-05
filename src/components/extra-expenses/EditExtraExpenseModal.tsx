import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ExtraExpense {
  id: number;
  organization_id: number;
  provider_id: number | null;
  expense_name: string;
  expense_category: string;
  city: string;
  currency: string;
  unit_price: number;
  unit_type: string;
  description: string | null;
  status: string;
}

interface Provider {
  id: number;
  provider_name: string;
  provider_type: string;
}

interface EditExtraExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: ExtraExpense | null;
}

export default function EditExtraExpenseModal({ isOpen, onClose, onSuccess, expense }: EditExtraExpenseModalProps) {
  const { organizationId } = useAuth();
  const [formData, setFormData] = useState({
    id: 0,
    provider_id: null as number | null,
    expense_name: '',
    expense_category: '',
    city: '',
    currency: 'EUR',
    unit_price: '',
    unit_type: '',
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
    if (expense) {
      setFormData({
        id: expense.id,
        provider_id: expense.provider_id,
        expense_name: expense.expense_name,
        expense_category: expense.expense_category,
        city: expense.city,
        currency: expense.currency,
        unit_price: expense.unit_price.toString(),
        unit_type: expense.unit_type,
        description: expense.description || '',
        status: expense.status
      });
    }
  }, [expense]);

  async function fetchProviders() {
    try {
      // Fetch providers for extra expenses (excludes hotels and guides by default)
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

  if (!isOpen || !expense) return null;

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      if (!formData.expense_name.trim()) {
        setFormError('Expense name is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.expense_category.trim()) {
        setFormError('Expense category is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.city.trim()) {
        setFormError('City is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.unit_price || parseFloat(formData.unit_price) <= 0) {
        setFormError('Valid unit price is required');
        setFormSubmitting(false);
        return;
      }
      if (!formData.unit_type.trim()) {
        setFormError('Unit type is required');
        setFormSubmitting(false);
        return;
      }

      const res = await fetch('/api/extra-expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          provider_id: formData.provider_id,
          expense_name: formData.expense_name,
          expense_category: formData.expense_category,
          city: formData.city,
          currency: formData.currency,
          unit_price: parseFloat(formData.unit_price),
          unit_type: formData.unit_type,
          description: formData.description || null,
          status: formData.status
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update extra expense');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Edit form submission error:', error);
      setFormError('Failed to update extra expense. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Extra Expense</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={formSubmitting}
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
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
                  Expense Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.expense_name}
                  onChange={(e) => handleFormChange('expense_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expense_category}
                    onChange={(e) => handleFormChange('expense_category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_price}
                    onChange={(e) => handleFormChange('unit_price', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleFormChange('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  >
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="TRY">TRY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.unit_type}
                    onChange={(e) => handleFormChange('unit_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter expense description..."
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
