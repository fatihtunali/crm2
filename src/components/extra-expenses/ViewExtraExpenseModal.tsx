interface ExtraExpense {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
  expense_name: string;
  expense_category: string;
  city: string;
  currency: string;
  unit_price: number;
  unit_type: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ViewExtraExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  expense: ExtraExpense | null;
}

export default function ViewExtraExpenseModal({ isOpen, onClose, onEdit, expense }: ViewExtraExpenseModalProps) {
  if (!isOpen || !expense) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatPrice = (price: number, currency: string) => {
    const numPrice = parseFloat(price.toString());
    return `${numPrice.toFixed(2)} ${currency}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Extra Expense Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Expense Name</h3>
              <p className="text-lg font-semibold text-gray-900">{expense.expense_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
              <p className="text-gray-900">{expense.expense_category}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">City</h3>
              <p className="text-gray-900">{expense.city}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Unit Price</h3>
              <p className="text-gray-900 font-medium">{formatPrice(expense.unit_price, expense.currency)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Unit Type</h3>
              <p className="text-gray-900">{expense.unit_type}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Currency</h3>
              <p className="text-gray-900">{expense.currency}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(expense.status)}`}>
                {expense.status}
              </span>
            </div>
            {expense.description && (
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-gray-900">{expense.description}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Created At</h3>
              <p className="text-gray-900">{new Date(expense.created_at).toLocaleString('en-GB')}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Updated At</h3>
              <p className="text-gray-900">{new Date(expense.updated_at).toLocaleString('en-GB')}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
