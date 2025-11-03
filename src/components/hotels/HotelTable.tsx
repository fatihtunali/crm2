import { useState, Fragment } from 'react';

interface Hotel {
  id: number;
  google_place_id: string | null;
  organization_id: number | null;
  hotel_name: string;
  city: string;
  star_rating: number | null;
  hotel_category: string | null;
  room_count: number | null;
  is_boutique: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  status: string;
  photo_url_1: string | null;
  photo_url_2: string | null;
  photo_url_3: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  website: string | null;
  editorial_summary: string | null;
  place_types: string | null;
  price_level: number | null;
  business_status: string | null;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  double_room_bb: number | null;
  single_supplement_bb: number | null;
  triple_room_bb: number | null;
  child_0_6_bb: number | null;
  child_6_12_bb: number | null;
  hb_supplement: number | null;
  fb_supplement: number | null;
  ai_supplement: number | null;
  base_meal_plan: string | null;
}

interface HotelTableProps {
  hotels: Hotel[];
  loading: boolean;
  onView: (hotel: Hotel) => void;
  onEdit: (hotel: Hotel) => void;
  onDelete: (hotel: Hotel) => void;
  onManagePricing: (hotel: Hotel) => void;
}

export default function HotelTable({
  hotels,
  loading,
  onView,
  onEdit,
  onDelete,
  onManagePricing
}: HotelTableProps) {
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

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'luxury': return 'bg-purple-100 text-purple-700';
      case 'special_class': return 'bg-indigo-100 text-indigo-700';
      case 'standard_5star': return 'bg-blue-100 text-blue-700';
      case 'standard_4star': return 'bg-cyan-100 text-cyan-700';
      case 'standard_3star': return 'bg-teal-100 text-teal-700';
      case 'budget': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatCategoryName = (category: string | null) => {
    if (!category) return 'N/A';
    const names: { [key: string]: string } = {
      'budget': 'Budget',
      'standard_3star': 'Standard 3-Star',
      'standard_4star': 'Standard 4-Star',
      'standard_5star': 'Standard 5-Star',
      'special_class': 'Special Class',
      'luxury': 'Luxury'
    };
    return names[category] || category;
  };

  const getStarRating = (rating: number | null) => {
    if (!rating) return '';
    return '⭐'.repeat(rating);
  };

  const formatPrice = (price: number | null, currency: string = 'EUR') => {
    if (price === null || price === undefined) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `${currency} ${numPrice.toFixed(2)}`;
  };

  const hasPricing = (hotel: Hotel) => {
    return hotel.pricing_id !== null;
  };

  const getPriceInfo = (hotel: Hotel) => {
    if (!hotel.pricing_id || !hotel.double_room_bb) {
      return 'No pricing';
    }

    const currency = hotel.currency || 'EUR';
    const price = parseFloat(hotel.double_room_bb.toString()).toFixed(2);

    return `${currency} ${price} / night`;
  };

  const getMealPlanLabel = (plan: string | null) => {
    const labels: { [key: string]: string } = {
      'BB': 'Bed & Breakfast',
      'HB': 'Half Board',
      'FB': 'Full Board',
      'AI': 'All Inclusive'
    };
    return plan ? labels[plan] || plan : 'N/A';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No hotels found</div>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hotel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pricing</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {hotels.map((hotel) => {
              const isExpanded = expandedRows.has(hotel.id);
              const showPricing = hasPricing(hotel);

              return (
                <Fragment key={hotel.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {showPricing && (
                        <button
                          onClick={() => toggleExpand(hotel.id)}
                          className="text-gray-400 hover:text-gray-600 transition-transform"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          ▶
                        </button>
                      )}
                    </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {hotel.photo_url_1 && (
                      <img
                        src={hotel.photo_url_1}
                        alt={hotel.hotel_name}
                        className="w-12 h-12 rounded object-cover mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{hotel.hotel_name}</div>
                      <div className="text-xs text-gray-500">
                        {getStarRating(hotel.star_rating)}
                        {hotel.is_boutique === 1 && <span className="ml-2 text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded">Boutique</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{hotel.city}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {hotel.rating && (
                    <div className="text-sm text-gray-900">
                      ⭐ {parseFloat(hotel.rating.toString()).toFixed(1)}
                      {hotel.user_ratings_total && (
                        <span className="text-xs text-gray-500 ml-1">({hotel.user_ratings_total})</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getCategoryColor(hotel.hotel_category)}`}>
                    {formatCategoryName(hotel.hotel_category)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{getPriceInfo(hotel)}</div>
                  {hotel.season_name && (
                    <div className="text-xs text-gray-500">{hotel.season_name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(hotel.status)}`}>
                    {hotel.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(hotel)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(hotel)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onManagePricing(hotel)}
                      className="text-green-600 hover:text-green-900 px-3 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                      Pricing
                    </button>
                    <button
                      onClick={() => onDelete(hotel)}
                      className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>

              {/* Expandable Pricing Row */}
              {isExpanded && showPricing && (
                <tr className="bg-gray-50">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="ml-12 mr-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Pricing Details {hotel.season_name && `- ${hotel.season_name}`}
                        </h4>
                        {hotel.season_start && hotel.season_end && (
                          <span className="text-xs text-gray-500">
                            Valid: {new Date(hotel.season_start).toLocaleDateString()} - {new Date(hotel.season_end).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Room Rates Table */}
                        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                          <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                            <h5 className="text-sm font-semibold text-blue-900">Room Rates</h5>
                            <p className="text-xs text-blue-600">Base: {getMealPlanLabel(hotel.base_meal_plan)}</p>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price / Night</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">Double Room</td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(hotel.double_room_bb, hotel.currency || 'EUR')}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">Single Supplement</td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(hotel.single_supplement_bb, hotel.currency || 'EUR')}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">Triple Room</td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(hotel.triple_room_bb, hotel.currency || 'EUR')}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">Child (0-6 years)</td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(hotel.child_0_6_bb, hotel.currency || 'EUR')}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">Child (6-12 years)</td>
                                <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(hotel.child_6_12_bb, hotel.currency || 'EUR')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Meal Plan Supplements Table */}
                        <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
                          <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                            <h5 className="text-sm font-semibold text-green-900">Meal Plan Supplements</h5>
                            <p className="text-xs text-green-600">Additional charges per person/night</p>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Meal Plan</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Supplement</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">
                                  <div className="font-medium">Half Board (HB)</div>
                                  <div className="text-xs text-gray-500">Breakfast + Dinner</div>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-green-700">{formatPrice(hotel.hb_supplement, hotel.currency || 'EUR')}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">
                                  <div className="font-medium">Full Board (FB)</div>
                                  <div className="text-xs text-gray-500">Breakfast + Lunch + Dinner</div>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-green-700">{formatPrice(hotel.fb_supplement, hotel.currency || 'EUR')}</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-700">
                                  <div className="font-medium">All Inclusive (AI)</div>
                                  <div className="text-xs text-gray-500">All meals + drinks + snacks</div>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-green-700">{formatPrice(hotel.ai_supplement, hotel.currency || 'EUR')}</td>
                              </tr>
                            </tbody>
                          </table>
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
