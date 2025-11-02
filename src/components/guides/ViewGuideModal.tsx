interface Guide {
  id: number;
  organization_id: number;
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
}

interface ViewGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onManagePricing: () => void;
  guide: Guide | null;
}

export default function ViewGuideModal({ isOpen, onClose, onEdit, onManagePricing, guide }: ViewGuideModalProps) {
  if (!isOpen || !guide) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Guide Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">City</h3>
              <p className="text-gray-900 font-semibold text-lg">{guide.city}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Language</h3>
              <p className="text-gray-900 font-semibold text-lg">{guide.language}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(guide.status)}`}>
                {guide.status}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
              <p className="text-gray-900">{new Date(guide.created_at).toLocaleDateString('en-GB')}</p>
            </div>
          </div>

          {/* Description */}
          {guide.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{guide.description}</p>
            </div>
          )}

          {/* Current Pricing */}
          {guide.pricing_id && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Pricing</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <p className="font-semibold text-gray-900">{guide.season_name}</p>
                  {guide.season_start && guide.season_end && (
                    <p className="text-sm text-gray-600">
                      {new Date(guide.season_start).toLocaleDateString('en-GB')} - {new Date(guide.season_end).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {guide.full_day_price !== null && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Full Day</p>
                      <p className="font-semibold text-gray-900">{guide.currency} {parseFloat(guide.full_day_price.toString()).toFixed(2)}</p>
                    </div>
                  )}
                  {guide.half_day_price !== null && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Half Day</p>
                      <p className="font-semibold text-gray-900">{guide.currency} {parseFloat(guide.half_day_price.toString()).toFixed(2)}</p>
                    </div>
                  )}
                  {guide.night_price !== null && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Night</p>
                      <p className="font-semibold text-gray-900">{guide.currency} {parseFloat(guide.night_price.toString()).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!guide.pricing_id && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">No active pricing available. Click "Manage Pricing" to add pricing information.</p>
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
