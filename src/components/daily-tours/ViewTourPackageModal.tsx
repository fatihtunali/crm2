interface TourPackage {
  id: number;
  tour_name: string;
  tour_code: string;
  city: string;
  duration_days: number | null;
  duration_hours: number | null;
  duration_type: string | null;
  description: string;
  tour_type: string;
  inclusions: string | null;
  exclusions: string | null;
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
  sic_price_2_pax: number | null;
  sic_price_4_pax: number | null;
  sic_price_6_pax: number | null;
  sic_price_8_pax: number | null;
  sic_price_10_pax: number | null;
  pvt_price_2_pax: number | null;
  pvt_price_4_pax: number | null;
  pvt_price_6_pax: number | null;
  pvt_price_8_pax: number | null;
  pvt_price_10_pax: number | null;
}

interface ViewTourPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onManagePricing: () => void;
  tourPackage: TourPackage | null;
}

export default function ViewTourPackageModal({ isOpen, onClose, onEdit, onManagePricing, tourPackage }: ViewTourPackageModalProps) {
  if (!isOpen || !tourPackage) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDurationText = () => {
    if (tourPackage.duration_type === 'DAYS' && tourPackage.duration_days) {
      return `${tourPackage.duration_days} ${tourPackage.duration_days === 1 ? 'Day' : 'Days'}`;
    } else if (tourPackage.duration_type === 'HOURS' && tourPackage.duration_hours) {
      return `${tourPackage.duration_hours} ${tourPackage.duration_hours === 1 ? 'Hour' : 'Hours'}`;
    } else if (tourPackage.duration_days && tourPackage.duration_hours) {
      return `${tourPackage.duration_days} Days ${tourPackage.duration_hours} Hours`;
    }
    return 'N/A';
  };

  const photos = [tourPackage.photo_url_1, tourPackage.photo_url_2, tourPackage.photo_url_3].filter((photo): photo is string => Boolean(photo));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Tour Package Details</h2>
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
                  alt={`${tourPackage.tour_name} - Photo ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
              ))}
            </div>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Tour Name</h3>
              <p className="text-gray-900 font-semibold text-lg">{tourPackage.tour_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Tour Code</h3>
              <p className="text-gray-900 font-mono">{tourPackage.tour_code}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">City</h3>
              <p className="text-gray-900">{tourPackage.city}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
              <p className="text-gray-900">{getDurationText()}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Tour Type</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${tourPackage.tour_type === 'SIC' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {tourPackage.tour_type}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(tourPackage.status)}`}>
                {tourPackage.status}
              </span>
            </div>
            {tourPackage.rating && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Rating</h3>
                <p className="text-gray-900">⭐ {parseFloat(tourPackage.rating.toString()).toFixed(1)} {tourPackage.user_ratings_total && `(${tourPackage.user_ratings_total} reviews)`}</p>
              </div>
            )}
            {tourPackage.website && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Website</h3>
                <a href={tourPackage.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  {tourPackage.website}
                </a>
              </div>
            )}
          </div>

          {/* Description */}
          {tourPackage.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{tourPackage.description}</p>
            </div>
          )}

          {/* Inclusions */}
          {tourPackage.inclusions && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Inclusions</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{tourPackage.inclusions}</p>
              </div>
            </div>
          )}

          {/* Exclusions */}
          {tourPackage.exclusions && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Exclusions</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{tourPackage.exclusions}</p>
              </div>
            </div>
          )}

          {/* Pricing */}
          {tourPackage.pricing_id && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Pricing</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <p className="font-semibold text-gray-900">{tourPackage.season_name}</p>
                  {tourPackage.season_start && tourPackage.season_end && (
                    <p className="text-sm text-gray-600">
                      {new Date(tourPackage.season_start).toLocaleDateString('en-GB')} - {new Date(tourPackage.season_end).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* SIC Pricing */}
                  {tourPackage.tour_type === 'SIC' && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">SIC Pricing (per person)</h4>
                      <table className="w-full text-sm">
                        <tbody>
                          {tourPackage.sic_price_2_pax && <tr><td className="py-1">2 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.sic_price_2_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.sic_price_4_pax && <tr><td className="py-1">4 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.sic_price_4_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.sic_price_6_pax && <tr><td className="py-1">6 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.sic_price_6_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.sic_price_8_pax && <tr><td className="py-1">8 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.sic_price_8_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.sic_price_10_pax && <tr><td className="py-1">10 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.sic_price_10_pax.toString()).toFixed(2)}</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Private Pricing */}
                  {tourPackage.tour_type === 'PRIVATE' && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Private Tour Pricing (per person)</h4>
                      <table className="w-full text-sm">
                        <tbody>
                          {tourPackage.pvt_price_2_pax && <tr><td className="py-1">2 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.pvt_price_2_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.pvt_price_4_pax && <tr><td className="py-1">4 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.pvt_price_4_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.pvt_price_6_pax && <tr><td className="py-1">6 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.pvt_price_6_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.pvt_price_8_pax && <tr><td className="py-1">8 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.pvt_price_8_pax.toString()).toFixed(2)}</td></tr>}
                          {tourPackage.pvt_price_10_pax && <tr><td className="py-1">10 PAX:</td><td className="font-semibold">{tourPackage.currency} {parseFloat(tourPackage.pvt_price_10_pax.toString()).toFixed(2)}</td></tr>}
                        </tbody>
                      </table>
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
