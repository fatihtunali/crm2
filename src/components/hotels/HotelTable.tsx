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

  const getPriceInfo = (hotel: Hotel) => {
    if (!hotel.pricing_id || !hotel.double_room_bb) {
      return 'No pricing';
    }

    const currency = hotel.currency || 'EUR';
    const price = parseFloat(hotel.double_room_bb.toString()).toFixed(2);

    return `${currency} ${price} / night`;
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
            {hotels.map((hotel) => (
              <tr key={hotel.id} className="hover:bg-gray-50">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
