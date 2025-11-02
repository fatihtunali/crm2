import { useState } from 'react';

interface NewExtraExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewExtraExpenseModal({ isOpen, onClose, onSuccess }: NewExtraExpenseModalProps) {
  const [formData, setFormData] = useState({
    expense_name: '',
    expense_category: '',
    city: '',
    currency: 'EUR',
    unit_price: '',
    unit_type: '',
    description: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleFormChange = (field: string, value: string) => {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_name: formData.expense_name,
          expense_category: formData.expense_category,
          city: formData.city,
          currency: formData.currency,
          unit_price: parseFloat(formData.unit_price),
          unit_type: formData.unit_type,
          description: formData.description || null
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create extra expense');
      }

      setFormData({
        expense_name: '',
        expense_category: '',
        city: '',
        currency: 'EUR',
        unit_price: '',
        unit_type: '',
        description: ''
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Failed to create extra expense. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Extra Expense</h2>
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
                  Expense Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.expense_name}
                  onChange={(e) => handleFormChange('expense_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter expense name"
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
                    placeholder="e.g., Transportation, Food"
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
                    placeholder="e.g., Istanbul, Cappadocia"
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
                    placeholder="0.00"
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
                    placeholder="e.g., per person, per item"
                    required
                  />
                </div>
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
              {formSubmitting ? 'Creating...' : 'Create Extra Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
