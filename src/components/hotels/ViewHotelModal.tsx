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

interface ViewHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onManagePricing: () => void;
  hotel: Hotel | null;
}

export default function ViewHotelModal({ isOpen, onClose, onEdit, onManagePricing, hotel }: ViewHotelModalProps) {
  if (!isOpen || !hotel) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
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
    if (!rating || rating < 0 || rating > 5) return 'N/A';
    const count = Math.max(0, Math.min(5, Math.floor(rating)));
    return Array(count).fill('⭐').join('');
  };

  const formatMealPlan = (plan: string | null) => {
    if (!plan) return 'N/A';
    const plans: { [key: string]: string } = {
      'BB': 'Bed & Breakfast',
      'HB': 'Half Board',
      'FB': 'Full Board',
      'AI': 'All Inclusive'
    };
    return plans[plan] || plan;
  };

  const photos = [hotel.photo_url_1, hotel.photo_url_2, hotel.photo_url_3].filter((photo): photo is string => Boolean(photo));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Hotel Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Photos */}
          {photos.length > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${hotel.hotel_name} - Photo ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
              ))}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Hotel Name</h3>
              <p className="text-gray-900 font-semibold text-lg">{hotel.hotel_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">City</h3>
              <p className="text-gray-900">{hotel.city}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Star Rating</h3>
              <p className="text-gray-900">{getStarRating(hotel.star_rating)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
              <p className="text-gray-900">{formatCategoryName(hotel.hotel_category)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Room Count</h3>
              <p className="text-gray-900">{hotel.room_count || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Type</h3>
              <p className="text-gray-900">
                {hotel.is_boutique === 1 ? (
                  <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm">Boutique Hotel</span>
                ) : (
                  'Standard Hotel'
                )}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(hotel.status)}`}>
                {hotel.status}
              </span>
            </div>
            {hotel.rating && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Google Rating</h3>
                <p className="text-gray-900">⭐ {parseFloat(hotel.rating.toString()).toFixed(1)} {hotel.user_ratings_total && `(${hotel.user_ratings_total} reviews)`}</p>
              </div>
            )}
          </div>

          {/* Contact Information */}
          {(hotel.address || hotel.contact_phone || hotel.contact_email || hotel.website) && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {hotel.address && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Address</h4>
                    <p className="text-gray-900">{hotel.address}</p>
                  </div>
                )}
                {hotel.contact_phone && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Phone</h4>
                    <p className="text-gray-900">{hotel.contact_phone}</p>
                  </div>
                )}
                {hotel.contact_email && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                    <p className="text-gray-900">{hotel.contact_email}</p>
                  </div>
                )}
                {hotel.website && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Website</h4>
                    <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      {hotel.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {(hotel.latitude || hotel.longitude || hotel.google_maps_url) && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
              <div className="grid grid-cols-2 gap-4">
                {hotel.latitude && hotel.longitude && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Coordinates</h4>
                    <p className="text-gray-900">{hotel.latitude}, {hotel.longitude}</p>
                  </div>
                )}
                {hotel.google_maps_url && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Google Maps</h4>
                    <a href={hotel.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      View on Google Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editorial Summary */}
          {hotel.editorial_summary && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{hotel.editorial_summary}</p>
            </div>
          )}

          {/* Notes */}
          {hotel.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{hotel.notes}</p>
              </div>
            </div>
          )}

          {/* Current Pricing */}
          {hotel.pricing_id && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Pricing</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <p className="font-semibold text-gray-900">{hotel.season_name}</p>
                  {hotel.season_start && hotel.season_end && (
                    <p className="text-sm text-gray-600">
                      {new Date(hotel.season_start).toLocaleDateString('en-GB')} - {new Date(hotel.season_end).toLocaleDateString('en-GB')}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Base Meal Plan: <span className="font-medium">{formatMealPlan(hotel.base_meal_plan)}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Room Pricing */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Room Pricing ({hotel.currency})</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        {hotel.double_room_bb && <tr><td className="py-1">Double Room (BB):</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.double_room_bb.toString()).toFixed(2)}</td></tr>}
                        {hotel.single_supplement_bb && <tr><td className="py-1">Single Supplement:</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.single_supplement_bb.toString()).toFixed(2)}</td></tr>}
                        {hotel.triple_room_bb && <tr><td className="py-1">Triple Room (BB):</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.triple_room_bb.toString()).toFixed(2)}</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* Child & Supplements */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Child & Meal Supplements ({hotel.currency})</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        {hotel.child_0_6_bb && <tr><td className="py-1">Child 0-6:</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.child_0_6_bb.toString()).toFixed(2)}</td></tr>}
                        {hotel.child_6_12_bb && <tr><td className="py-1">Child 6-12:</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.child_6_12_bb.toString()).toFixed(2)}</td></tr>}
                        {hotel.hb_supplement && <tr><td className="py-1">HB Supplement:</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.hb_supplement.toString()).toFixed(2)}</td></tr>}
                        {hotel.fb_supplement && <tr><td className="py-1">FB Supplement:</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.fb_supplement.toString()).toFixed(2)}</td></tr>}
                        {hotel.ai_supplement && <tr><td className="py-1">AI Supplement:</td><td className="font-semibold">{hotel.currency} {parseFloat(hotel.ai_supplement.toString()).toFixed(2)}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            onClick={() => { onClose(); onManagePricing(); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Manage Pricing
          </button>
          <div className="flex gap-3">
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
    </div>
  );
}
