import { useState, Fragment } from 'react';

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
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatPrice = (price: number | null, currency: string = 'EUR') => {
    if (price === null || price === undefined) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `${currency} ${numPrice.toFixed(2)}`;
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
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
            {vehicles.map((vehicle) => {
              const isExpanded = expandedRows.has(vehicle.id);

              return (
                <Fragment key={vehicle.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpand(vehicle.id)}
                        className="text-gray-400 hover:text-gray-600 transition-transform"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      >
                        ▶
                      </button>
                    </td>
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

                  {/* Expandable Pricing Row */}
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="ml-12 mr-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Vehicle Details - {vehicle.vehicle_type}
                            </h4>
                            {vehicle.season_name && (
                              <span className="text-xs text-gray-500">
                                Season: {vehicle.season_name}
                                {vehicle.season_start && vehicle.season_end && (
                                  <> ({new Date(vehicle.season_start).toLocaleDateString()} - {new Date(vehicle.season_end).toLocaleDateString()})</>
                                )}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Pricing Table */}
                            <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                              <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                <h5 className="text-sm font-semibold text-blue-900">Vehicle Pricing</h5>
                                <p className="text-xs text-blue-600">{vehicle.city}</p>
                              </div>
                              {vehicle.pricing_id ? (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rental Type</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {vehicle.price_per_day && (
                                      <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-700">
                                          <div className="font-medium">Per Day</div>
                                          <div className="text-xs text-gray-500">Full day rental</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-semibold text-blue-700">
                                          {formatPrice(vehicle.price_per_day, vehicle.currency || 'EUR')}
                                        </td>
                                      </tr>
                                    )}
                                    {vehicle.price_half_day && (
                                      <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-700">
                                          <div className="font-medium">Half Day</div>
                                          <div className="text-xs text-gray-500">Half day rental</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-semibold text-blue-700">
                                          {formatPrice(vehicle.price_half_day, vehicle.currency || 'EUR')}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="p-4 text-center text-sm text-gray-500">
                                  No pricing available for current period
                                </div>
                              )}
                            </div>

                            {/* Vehicle Details */}
                            <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                              <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                                <h5 className="text-sm font-semibold text-green-900">Vehicle Information</h5>
                                <p className="text-xs text-green-600">Additional details</p>
                              </div>
                              <div className="p-4 space-y-3">
                                {vehicle.description && (
                                  <div>
                                    <div className="text-xs text-gray-500 uppercase">Description</div>
                                    <div className="text-sm text-gray-900">{vehicle.description}</div>
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs text-gray-500 uppercase">City</div>
                                  <div className="text-sm font-medium text-gray-900">{vehicle.city}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 uppercase">Max Capacity</div>
                                  <div className="text-sm font-medium text-gray-900">{vehicle.max_capacity} passengers</div>
                                </div>
                                {vehicle.provider_name && (
                                  <div>
                                    <div className="text-xs text-gray-500 uppercase">Provider</div>
                                    <div className="text-sm font-medium text-gray-900">{vehicle.provider_name}</div>
                                  </div>
                                )}
                              </div>
                            </div>
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
