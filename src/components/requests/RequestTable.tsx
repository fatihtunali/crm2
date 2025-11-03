import type { Money } from '@/types/api';

interface Request {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  adults: number;
  children: number;
  total_price: Money;
  price_per_person: Money;
  status: string;
  tour_type: string | null;
  hotel_category: string | null;
  source: string;
  created_at: string;
}

interface RequestTableProps {
  requests: Request[];
  loading: boolean;
  onView: (request: Request) => void;
  onEdit: (request: Request) => void;
  onQuote: (request: Request) => void;
  onDelete: (request: Request) => void;
}

export default function RequestTable({
  requests,
  loading,
  onView,
  onEdit,
  onQuote,
  onDelete
}: RequestTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'booked': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No requests found</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pax</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{request.customer_name}</div>
                    <div className="text-sm text-gray-500">{request.customer_email}</div>
                    {request.customer_phone && (
                      <div className="text-xs text-gray-400">{request.customer_phone}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{request.destination}</div>
                  <div className="text-xs text-gray-500">
                    {request.tour_type && <span className="mr-2">{request.tour_type}</span>}
                    {request.hotel_category && <span>{request.hotel_category}-star</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(request.start_date).toLocaleDateString('en-GB')}
                  </div>
                  <div className="text-xs text-gray-500">
                    to {new Date(request.end_date).toLocaleDateString('en-GB')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {request.adults + request.children} pax
                  </div>
                  <div className="text-xs text-gray-500">
                    {request.adults}A {request.children > 0 && `+ ${request.children}C`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    €{((request.total_price?.amount_minor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500">
                    €{((request.price_per_person?.amount_minor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} pp
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(request)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(request)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onQuote(request)}
                      className="text-green-600 hover:text-green-900 px-3 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                      Quote
                    </button>
                    <button
                      onClick={() => onDelete(request)}
                      className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
