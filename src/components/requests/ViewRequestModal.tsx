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
  total_price: string;
  price_per_person: string;
  status: string;
  tour_type: string | null;
  hotel_category: string | null;
  source: string;
  created_at: string;
}

interface ViewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onQuote: () => void;
  request: Request | null;
}

export default function ViewRequestModal({ isOpen, onClose, onEdit, onQuote, request }: ViewRequestModalProps) {
  if (!isOpen || !request) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Request Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Customer Name</h3>
              <p className="text-gray-900">{request.customer_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
              <p className="text-gray-900">{request.customer_email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
              <p className="text-gray-900">{request.customer_phone || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(request.status)}`}>
                {request.status}
              </span>
            </div>
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Destination</h3>
              <p className="text-gray-900">{request.destination}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Start Date</h3>
              <p className="text-gray-900">{new Date(request.start_date).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">End Date</h3>
              <p className="text-gray-900">{new Date(request.end_date).toLocaleDateString('en-GB')}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Adults</h3>
              <p className="text-gray-900">{request.adults}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Children</h3>
              <p className="text-gray-900">{request.children}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Tour Type</h3>
              <p className="text-gray-900">{request.tour_type || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Hotel Category</h3>
              <p className="text-gray-900">{request.hotel_category ? `${request.hotel_category}-star` : 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Price</h3>
              <p className="text-lg font-semibold text-gray-900">€{parseFloat(request.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Price Per Person</h3>
              <p className="text-lg font-semibold text-gray-900">€{parseFloat(request.price_per_person).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Source</h3>
              <p className="text-gray-900 capitalize">{request.source}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Created At</h3>
              <p className="text-gray-900">{new Date(request.created_at).toLocaleString('en-GB')}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => { onClose(); onQuote(); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Create Quote
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
