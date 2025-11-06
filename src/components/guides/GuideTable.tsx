import { useState, Fragment } from 'react';
import FavoritePriorityToggle from '@/components/common/FavoritePriorityToggle';

interface Guide {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
  city: string;
  language: string;
  description: string;
  status: string;
  created_at: string;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  full_day_price: number | null;
  half_day_price: number | null;
  night_price: number | null;
  favorite_priority?: number;
}

interface GuideTableProps {
  guides: Guide[];
  loading: boolean;
  onView: (guide: Guide) => void;
  onEdit: (guide: Guide) => void;
  onDelete: (guide: Guide) => void;
  onRefresh?: () => void;
}

export default function GuideTable({
  guides,
  loading,
  onView,
  onEdit,
  onDelete,
  onRefresh
}: GuideTableProps) {
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

  const getPriceRange = (guide: Guide) => {
    if (!guide.pricing_id) return 'No pricing';

    const prices = [guide.full_day_price, guide.half_day_price, guide.night_price];
    const validPrices = prices.filter(p => p !== null && p !== undefined) as number[];

    if (validPrices.length === 0) return 'No pricing';

    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    const currency = guide.currency || 'EUR';

    if (min === max) {
      return `${currency} ${parseFloat(min.toString()).toFixed(2)}`;
    }
    return `${currency} ${parseFloat(min.toString()).toFixed(2)} - ${parseFloat(max.toString()).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No guides found</div>
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
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Favorite</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider / Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {guides.map((guide) => {
              const isExpanded = expandedRows.has(guide.id);

              return (
                <Fragment key={guide.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpand(guide.id)}
                        className="text-gray-400 hover:text-gray-600 transition-transform"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      >
                        ▶
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center">
                        <FavoritePriorityToggle
                          currentPriority={guide.favorite_priority || 0}
                          itemId={guide.id}
                          itemType="guide"
                          onUpdate={onRefresh}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{guide.provider_name || 'Not assigned'}</div>
                      {guide.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{guide.provider_id}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{guide.city}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{guide.language}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate">
                        {guide.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{getPriceRange(guide)}</div>
                      {guide.season_name && (
                        <div className="text-xs text-gray-500">{guide.season_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(guide.status)}`}>
                        {guide.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onView(guide)}
                          className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => onEdit(guide)}
                          className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(guide)}
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
                      <td colSpan={9} className="px-4 py-4">
                        <div className="ml-12 mr-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Guide Details - {guide.city} ({guide.language})
                            </h4>
                            {guide.season_name && (
                              <span className="text-xs text-gray-500">
                                Season: {guide.season_name}
                                {guide.season_start && guide.season_end && (
                                  <> ({new Date(guide.season_start).toLocaleDateString()} - {new Date(guide.season_end).toLocaleDateString()})</>
                                )}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Pricing Table */}
                            <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                              <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                <h5 className="text-sm font-semibold text-blue-900">Guide Pricing</h5>
                                <p className="text-xs text-blue-600">{guide.city} - {guide.language}</p>
                              </div>
                              {guide.pricing_id ? (
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service Type</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {guide.full_day_price && (
                                      <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-700">
                                          <div className="font-medium">Full Day</div>
                                          <div className="text-xs text-gray-500">Full day tour guide service</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-semibold text-blue-700">
                                          {formatPrice(guide.full_day_price, guide.currency || 'EUR')}
                                        </td>
                                      </tr>
                                    )}
                                    {guide.half_day_price && (
                                      <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-700">
                                          <div className="font-medium">Half Day</div>
                                          <div className="text-xs text-gray-500">Half day tour guide service</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-semibold text-blue-700">
                                          {formatPrice(guide.half_day_price, guide.currency || 'EUR')}
                                        </td>
                                      </tr>
                                    )}
                                    {guide.night_price && (
                                      <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-gray-700">
                                          <div className="font-medium">Night Service</div>
                                          <div className="text-xs text-gray-500">Evening/night tour guide service</div>
                                        </td>
                                        <td className="px-4 py-2 text-right font-semibold text-blue-700">
                                          {formatPrice(guide.night_price, guide.currency || 'EUR')}
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

                            {/* Guide Details */}
                            <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                              <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                                <h5 className="text-sm font-semibold text-green-900">Guide Information</h5>
                                <p className="text-xs text-green-600">Additional details</p>
                              </div>
                              <div className="p-4 space-y-3">
                                <div>
                                  <div className="text-xs text-gray-500 uppercase">City</div>
                                  <div className="text-sm font-medium text-gray-900">{guide.city}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 uppercase">Language</div>
                                  <div className="text-sm font-medium text-gray-900">{guide.language}</div>
                                </div>
                                {guide.description && (
                                  <div>
                                    <div className="text-xs text-gray-500 uppercase">Description</div>
                                    <div className="text-sm text-gray-900">{guide.description}</div>
                                  </div>
                                )}
                                {guide.provider_name && (
                                  <div>
                                    <div className="text-xs text-gray-500 uppercase">Provider</div>
                                    <div className="text-sm font-medium text-gray-900">{guide.provider_name}</div>
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
