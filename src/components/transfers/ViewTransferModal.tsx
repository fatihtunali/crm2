interface Transfer {
  id: number;
  organization_id: number;
  vehicle_id: number;
  from_city: string;
  to_city: string;
  season_name: string;
  start_date: string;
  end_date: string;
  price_oneway: number;
  price_roundtrip: number;
  estimated_duration_hours: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  created_by: number | null;
  vehicle_type: string | null;
  capacity: number | null;
  brand: string | null;
  model: string | null;
}

interface ViewTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  transfer: Transfer | null;
}

export default function ViewTransferModal({ isOpen, onClose, onEdit, transfer }: ViewTransferModalProps) {
  if (!isOpen || !transfer) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getVehicleInfo = () => {
    if (!transfer.vehicle_type) return 'N/A';

    const parts = [transfer.vehicle_type];
    if (transfer.brand && transfer.model) {
      parts.push(`${transfer.brand} ${transfer.model}`);
    }
    if (transfer.capacity) {
      parts.push(`(Capacity: ${transfer.capacity} passengers)`);
    }
    return parts.join(' - ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Transfer Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Route Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Route Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">From City</h4>
                <p className="text-gray-900 font-semibold text-lg">{transfer.from_city}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">To City</h4>
                <p className="text-gray-900 font-semibold text-lg">{transfer.to_city}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Estimated Duration</h4>
                <p className="text-gray-900">
                  {transfer.estimated_duration_hours
                    ? `${parseFloat(transfer.estimated_duration_hours.toString()).toFixed(1)} hours`
                    : 'Not specified'
                  }
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(transfer.status)}`}>
                  {transfer.status}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Vehicle Information</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-900">{getVehicleInfo()}</p>
            </div>
          </div>

          {/* Season & Pricing Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Season & Pricing</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="mb-3">
                <h4 className="font-semibold text-gray-900 mb-1">{transfer.season_name}</h4>
                <p className="text-sm text-gray-600">
                  {new Date(transfer.start_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })} - {new Date(transfer.end_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-white border border-blue-300 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">One-Way Price</h5>
                  <p className="text-2xl font-bold text-primary-600">
                    EUR {parseFloat(transfer.price_oneway.toString()).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white border border-blue-300 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Round-Trip Price</h5>
                  <p className="text-2xl font-bold text-primary-600">
                    EUR {parseFloat(transfer.price_roundtrip.toString()).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                <p>Savings with round-trip: EUR {(parseFloat(transfer.price_oneway.toString()) * 2 - parseFloat(transfer.price_roundtrip.toString())).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{transfer.notes}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Record Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Created:</span> {new Date(transfer.created_at).toLocaleString('en-GB')}
              </div>
              <div>
                <span className="font-medium">Transfer ID:</span> #{transfer.id}
              </div>
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
