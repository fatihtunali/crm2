interface Transfer {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
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

interface TransferTableProps {
  transfers: Transfer[];
  loading: boolean;
  onView: (transfer: Transfer) => void;
  onEdit: (transfer: Transfer) => void;
  onDelete: (transfer: Transfer) => void;
}

export default function TransferTable({
  transfers,
  loading,
  onView,
  onEdit,
  onDelete
}: TransferTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getVehicleInfo = (transfer: Transfer) => {
    if (!transfer.vehicle_type) return 'N/A';

    const parts = [transfer.vehicle_type];
    if (transfer.brand && transfer.model) {
      parts.push(`${transfer.brand} ${transfer.model}`);
    }
    if (transfer.capacity) {
      parts.push(`(${transfer.capacity} pax)`);
    }
    return parts.join(' - ');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No transfers found</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider / Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">One-Way Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round-Trip Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{transfer.provider_name || 'Not assigned'}</div>
                  {transfer.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{transfer.provider_id}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {transfer.from_city} → {transfer.to_city}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{getVehicleInfo(transfer)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{transfer.season_name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(transfer.start_date).toLocaleDateString('en-GB')} - {new Date(transfer.end_date).toLocaleDateString('en-GB')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {transfer.estimated_duration_hours
                      ? `${parseFloat(transfer.estimated_duration_hours.toString()).toFixed(1)} hrs`
                      : 'N/A'
                    }
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    EUR {parseFloat(transfer.price_oneway.toString()).toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    EUR {parseFloat(transfer.price_roundtrip.toString()).toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(transfer.status)}`}>
                    {transfer.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(transfer)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(transfer)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(transfer)}
                      className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
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
