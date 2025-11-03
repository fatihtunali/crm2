import { useState, Fragment } from 'react';

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

  const getVehicleInfo = (transfer: Transfer) => {
    if (!transfer.vehicle_type) return 'N/A';

    const parts = [transfer.vehicle_type];
    if (transfer.capacity) {
      parts.push(`(${transfer.capacity} pax)`);
    }
    return parts.join(' ');
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider / Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transfers.map((transfer) => {
              const isExpanded = expandedRows.has(transfer.id);

              return (
                <Fragment key={transfer.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpand(transfer.id)}
                        className="text-gray-400 hover:text-gray-600 transition-transform"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      >
                        ▶
                      </button>
                    </td>
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

              {/* Expandable Pricing Row */}
              {isExpanded && (
                <tr className="bg-gray-50">
                  <td colSpan={7} className="px-4 py-4">
                    <div className="ml-12 mr-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Transfer Details - {transfer.season_name}
                        </h4>
                        <span className="text-xs text-gray-500">
                          Valid: {new Date(transfer.start_date).toLocaleDateString()} - {new Date(transfer.end_date).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Pricing Table */}
                        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                          <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                            <h5 className="text-sm font-semibold text-blue-900">Transfer Pricing</h5>
                            <p className="text-xs text-blue-600">{transfer.from_city} → {transfer.to_city}</p>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trip Type</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">
                                  <div className="font-medium">One-Way</div>
                                  <div className="text-xs text-gray-500">Single trip</div>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(transfer.price_oneway)}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">
                                  <div className="font-medium">Round-Trip</div>
                                  <div className="text-xs text-gray-500">Return journey included</div>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(transfer.price_roundtrip)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Vehicle & Trip Details */}
                        <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                          <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                            <h5 className="text-sm font-semibold text-green-900">Vehicle & Trip Information</h5>
                            <p className="text-xs text-green-600">Additional details</p>
                          </div>
                          <div className="p-4 space-y-3">
                            <div>
                              <div className="text-xs text-gray-500 uppercase">Vehicle Type</div>
                              <div className="text-sm font-medium text-gray-900">{transfer.vehicle_type || 'N/A'}</div>
                            </div>
                            {transfer.capacity && (
                              <div>
                                <div className="text-xs text-gray-500 uppercase">Passenger Capacity</div>
                                <div className="text-sm font-medium text-gray-900">{transfer.capacity} passengers</div>
                              </div>
                            )}
                            {transfer.estimated_duration_hours && (
                              <div>
                                <div className="text-xs text-gray-500 uppercase">Estimated Duration</div>
                                <div className="text-sm font-medium text-gray-900">
                                  {parseFloat(transfer.estimated_duration_hours.toString()).toFixed(1)} hours
                                </div>
                              </div>
                            )}
                            {transfer.notes && (
                              <div>
                                <div className="text-xs text-gray-500 uppercase">Notes</div>
                                <div className="text-sm text-gray-900">{transfer.notes}</div>
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
