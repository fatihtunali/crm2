interface Vehicle {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
  vehicle_type: string;
  max_capacity: number;
  city: string;
  description: string | null;
  status: string;
  created_at: string;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  price_per_day: number | null;
  price_half_day: number | null;
}

interface VehicleTableProps {
  vehicles: Vehicle[];
  loading: boolean;
  onView: (vehicle: Vehicle) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
}

export default function VehicleTable({
  vehicles,
  loading,
  onView,
  onEdit,
  onDelete
}: VehicleTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriceDisplay = (vehicle: Vehicle) => {
    if (!vehicle.pricing_id) return 'No pricing';

    const currency = vehicle.currency || 'EUR';
    const pricePerDay = vehicle.price_per_day;
    const priceHalfDay = vehicle.price_half_day;

    if (pricePerDay && priceHalfDay) {
      return `${currency} ${parseFloat(pricePerDay.toString()).toFixed(2)}/day, ${parseFloat(priceHalfDay.toString()).toFixed(2)}/half`;
    } else if (pricePerDay) {
      return `${currency} ${parseFloat(pricePerDay.toString()).toFixed(2)}/day`;
    } else if (priceHalfDay) {
      return `${currency} ${parseFloat(priceHalfDay.toString()).toFixed(2)}/half day`;
    }

    return 'No pricing';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No vehicles found</div>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Capacity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Pricing</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{vehicle.provider_name || 'Not assigned'}</div>
                  {vehicle.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{vehicle.provider_id}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{vehicle.vehicle_type}</div>
                  {vehicle.description && (
                    <div className="text-xs text-gray-500 line-clamp-1">{vehicle.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{vehicle.max_capacity} passengers</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{vehicle.city}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{getPriceDisplay(vehicle)}</div>
                  {vehicle.season_name && (
                    <div className="text-xs text-gray-500">{vehicle.season_name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(vehicle)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(vehicle)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(vehicle)}
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
