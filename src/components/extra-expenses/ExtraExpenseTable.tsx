import { useState, Fragment } from 'react';

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

interface ExtraExpenseTableProps {
  expenses: ExtraExpense[];
  loading: boolean;
  onView: (expense: ExtraExpense) => void;
  onEdit: (expense: ExtraExpense) => void;
  onDelete: (expense: ExtraExpense) => void;
}

export default function ExtraExpenseTable({
  expenses,
  loading,
  onView,
  onEdit,
  onDelete
}: ExtraExpenseTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatPrice = (price: number, currency: string) => {
    const numPrice = parseFloat(price.toString());
    return `${currency} ${numPrice.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No extra expenses found</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider / Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expense Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => {
              const isExpanded = expandedRows.has(expense.id);

              return (
                <Fragment key={expense.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpand(expense.id)}
                        className="text-gray-400 hover:text-gray-600 transition-transform"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      >
                        ▶
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{expense.provider_name || 'Not assigned'}</div>
                      {expense.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{expense.provider_id}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{expense.expense_name}</div>
                      {expense.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">{expense.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{expense.expense_category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{expense.city}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(expense.unit_price, expense.currency)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{expense.unit_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(expense.status)}`}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onView(expense)}
                          className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => onEdit(expense)}
                          className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(expense)}
                          className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Details Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Pricing Information Table */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 bg-blue-50 px-3 py-1 rounded">
                              Pricing Information
                            </h4>
                            <table className="min-w-full text-sm">
                              <tbody className="divide-y divide-gray-200">
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Unit Price</td>
                                  <td className="py-2 text-gray-900">{formatPrice(expense.unit_price, expense.currency)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Unit Type</td>
                                  <td className="py-2 text-gray-900">{expense.unit_type}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Currency</td>
                                  <td className="py-2 text-gray-900">{expense.currency}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Category</td>
                                  <td className="py-2 text-gray-900">{expense.expense_category}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Expense Information Table */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 bg-green-50 px-3 py-1 rounded">
                              Expense Information
                            </h4>
                            <table className="min-w-full text-sm">
                              <tbody className="divide-y divide-gray-200">
                                {expense.description && (
                                  <tr>
                                    <td className="py-2 font-medium text-gray-600">Description</td>
                                    <td className="py-2 text-gray-900">{expense.description}</td>
                                  </tr>
                                )}
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">City</td>
                                  <td className="py-2 text-gray-900">{expense.city}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Created At</td>
                                  <td className="py-2 text-gray-900">
                                    {new Date(expense.created_at).toLocaleDateString('en-GB')}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Updated At</td>
                                  <td className="py-2 text-gray-900">
                                    {new Date(expense.updated_at).toLocaleDateString('en-GB')}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-2 font-medium text-gray-600">Expense ID</td>
                                  <td className="py-2 text-gray-900">#{expense.id}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
