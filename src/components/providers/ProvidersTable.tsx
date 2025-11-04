import { useState, Fragment } from 'react';

interface Provider {
  id: number;
  organization_id: number;
  provider_name: string;
  provider_type: string;
  city: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  daily_tours_count?: number;
  transfers_count?: number;
  vehicles_count?: number;
  restaurants_count?: number;
  entrance_fees_count?: number;
  extra_expenses_count?: number;
}

interface ProvidersTableProps {
  providers: Provider[];
  loading: boolean;
  onView: (provider: Provider) => void;
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
}

export default function ProvidersTable({
  providers,
  loading,
  onView,
  onEdit,
  onDelete
}: ProvidersTableProps) {
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

  const getProviderTypeColor = (type: string) => {
    switch (type) {
      case 'hotel': return 'bg-blue-100 text-blue-700';
      case 'tour_operator': return 'bg-purple-100 text-purple-700';
      case 'transport': return 'bg-yellow-100 text-yellow-700';
      case 'restaurant': return 'bg-orange-100 text-orange-700';
      case 'government': return 'bg-indigo-100 text-indigo-700';
      case 'guide': return 'bg-green-100 text-green-700';
      case 'entrance_fee': return 'bg-pink-100 text-pink-700';
      case 'other': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatProviderTypeName = (type: string) => {
    const names: { [key: string]: string } = {
      'hotel': 'Hotel',
      'tour_operator': 'Tour Operator',
      'transport': 'Transport',
      'restaurant': 'Restaurant',
      'government': 'Government',
      'guide': 'Guide',
      'entrance_fee': 'Entrance Fee',
      'other': 'Other'
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No suppliers found</div>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Info</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {providers.map((provider) => {
              const isExpanded = expandedRows.has(provider.id);
              const hasExpandableContent = provider.address || provider.notes;

              return (
                <Fragment key={provider.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {hasExpandableContent && (
                        <button
                          onClick={() => toggleExpand(provider.id)}
                          className="text-gray-400 hover:text-gray-600 transition-transform"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          ▶
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-500">#{provider.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{provider.provider_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getProviderTypeColor(provider.provider_type)}`}>
                        {formatProviderTypeName(provider.provider_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {provider.daily_tours_count && provider.daily_tours_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium" title="Daily Tours">
                            🗺️ {provider.daily_tours_count}
                          </span>
                        ) : null}
                        {provider.transfers_count && provider.transfers_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-medium" title="Transfers">
                            🚗 {provider.transfers_count}
                          </span>
                        ) : null}
                        {provider.vehicles_count && provider.vehicles_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium" title="Vehicles">
                            🚙 {provider.vehicles_count}
                          </span>
                        ) : null}
                        {provider.restaurants_count && provider.restaurants_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded font-medium" title="Restaurants">
                            🍽️ {provider.restaurants_count}
                          </span>
                        ) : null}
                        {provider.entrance_fees_count && provider.entrance_fees_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded font-medium" title="Entrance Fees">
                            🎫 {provider.entrance_fees_count}
                          </span>
                        ) : null}
                        {provider.extra_expenses_count && provider.extra_expenses_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium" title="Extra Expenses">
                            💵 {provider.extra_expenses_count}
                          </span>
                        ) : null}
                        {!provider.daily_tours_count &&
                         !provider.transfers_count &&
                         !provider.vehicles_count &&
                         !provider.restaurants_count &&
                         !provider.entrance_fees_count &&
                         !provider.extra_expenses_count ? (
                          <span className="text-xs text-gray-400">No services</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{provider.city || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {provider.contact_phone && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">📞</span>
                            {provider.contact_phone}
                          </div>
                        )}
                        {provider.contact_email && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">✉️</span>
                            {provider.contact_email}
                          </div>
                        )}
                        {!provider.contact_phone && !provider.contact_email && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(provider.status)}`}>
                        {provider.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onView(provider)}
                          className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => onEdit(provider)}
                          className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(provider)}
                          className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Details Row */}
                  {isExpanded && hasExpandableContent && (
                    <tr className="bg-gray-50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="ml-12 mr-4">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Address */}
                            {provider.address && (
                              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                                <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                  <h5 className="text-sm font-semibold text-blue-900">Address</h5>
                                </div>
                                <div className="p-4">
                                  <p className="text-sm text-gray-900">{provider.address}</p>
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {provider.notes && (
                              <div className="bg-white rounded-lg border border-yellow-200 overflow-hidden">
                                <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200">
                                  <h5 className="text-sm font-semibold text-yellow-900">Notes</h5>
                                </div>
                                <div className="p-4">
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{provider.notes}</p>
                                </div>
                              </div>
                            )}
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
