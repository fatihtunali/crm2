interface EntranceFee {
  id: number;
  google_place_id: string | null;
  organization_id: number | null;
  site_name: string;
  city: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  status: string;
  photo_url_1: string | null;
  photo_url_2: string | null;
  photo_url_3: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  website: string | null;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  adult_price: number | null;
  child_price: number | null;
  student_price: number | null;
}

interface ViewEntranceFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onManagePricing: () => void;
  entranceFee: EntranceFee | null;
}

export default function ViewEntranceFeeModal({ isOpen, onClose, onEdit, onManagePricing, entranceFee }: ViewEntranceFeeModalProps) {
  if (!isOpen || !entranceFee) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const photos = [entranceFee.photo_url_1, entranceFee.photo_url_2, entranceFee.photo_url_3].filter((photo): photo is string => Boolean(photo));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Entrance Fee Details</h2>
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
                  alt={`${entranceFee.site_name} - Photo ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
              ))}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Site Name</h3>
              <p className="text-gray-900 font-semibold text-lg">{entranceFee.site_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">City</h3>
              <p className="text-gray-900">{entranceFee.city}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(entranceFee.status)}`}>
                {entranceFee.status}
              </span>
            </div>
            {entranceFee.rating && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Rating</h3>
                <p className="text-gray-900">⭐ {parseFloat(entranceFee.rating.toString()).toFixed(1)} {entranceFee.user_ratings_total && `(${entranceFee.user_ratings_total} reviews)`}</p>
              </div>
            )}
            {entranceFee.google_place_id && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Google Place ID</h3>
                <p className="text-gray-900 font-mono text-xs">{entranceFee.google_place_id}</p>
              </div>
            )}
            {entranceFee.latitude && entranceFee.longitude && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Coordinates</h3>
                <p className="text-gray-900 text-sm">{entranceFee.latitude}, {entranceFee.longitude}</p>
              </div>
            )}
            {entranceFee.website && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Website</h3>
                <a href={entranceFee.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  {entranceFee.website}
                </a>
              </div>
            )}
            {entranceFee.google_maps_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Google Maps</h3>
                <a href={entranceFee.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  View on Google Maps
                </a>
              </div>
            )}
          </div>

          {/* Description */}
          {entranceFee.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{entranceFee.description}</p>
            </div>
          )}

          {/* Pricing */}
          {entranceFee.pricing_id && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Pricing</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <p className="font-semibold text-gray-900">{entranceFee.season_name}</p>
                  {entranceFee.season_start && entranceFee.season_end && (
                    <p className="text-sm text-gray-600">
                      {new Date(entranceFee.season_start).toLocaleDateString('en-GB')} - {new Date(entranceFee.season_end).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  {entranceFee.adult_price && (
                    <div>
                      <p className="text-gray-600 mb-1">Adult Price</p>
                      <p className="font-semibold text-gray-900">{entranceFee.currency} {parseFloat(entranceFee.adult_price.toString()).toFixed(2)}</p>
                    </div>
                  )}
                  {entranceFee.child_price && (
                    <div>
                      <p className="text-gray-600 mb-1">Child Price</p>
                      <p className="font-semibold text-gray-900">{entranceFee.currency} {parseFloat(entranceFee.child_price.toString()).toFixed(2)}</p>
                    </div>
                  )}
                  {entranceFee.student_price && (
                    <div>
                      <p className="text-gray-600 mb-1">Student Price</p>
                      <p className="font-semibold text-gray-900">{entranceFee.currency} {parseFloat(entranceFee.student_price.toString()).toFixed(2)}</p>
                    </div>
                  )}
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
