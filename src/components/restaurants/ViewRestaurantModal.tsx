interface Restaurant {
  id: number;
  organization_id: number;
  restaurant_name: string;
  city: string;
  meal_type: string;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  adult_lunch_price: number | null;
  child_lunch_price: number | null;
  adult_dinner_price: number | null;
  child_dinner_price: number | null;
  menu_description: string | null;
  effective_from: string | null;
  created_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface ViewRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onManageSeasons: () => void;
  restaurant: Restaurant | null;
}

export default function ViewRestaurantModal({ isOpen, onClose, onEdit, onManageSeasons, restaurant }: ViewRestaurantModalProps) {
  if (!isOpen || !restaurant) return null;

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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Restaurant Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Basic Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Restaurant Name</h4>
                <p className="text-gray-900 font-semibold text-lg">{restaurant.restaurant_name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">City</h4>
                <p className="text-gray-900 font-semibold text-lg">{restaurant.city}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Meal Type</h4>
                <p className="text-gray-900">{restaurant.meal_type}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(restaurant.status)}`}>
                  {restaurant.status}
                </span>
              </div>
            </div>
          </div>

          {/* Season & Dates */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Season & Dates</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Season Name</h4>
                <p className="text-gray-900 font-semibold">{restaurant.season_name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Currency</h4>
                <p className="text-gray-900">{restaurant.currency}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Start Date</h4>
                <p className="text-gray-900">{new Date(restaurant.start_date).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">End Date</h4>
                <p className="text-gray-900">{new Date(restaurant.end_date).toLocaleDateString('en-GB')}</p>
              </div>
              {restaurant.effective_from && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Effective From</h4>
                  <p className="text-gray-900">{new Date(restaurant.effective_from).toLocaleDateString('en-GB')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(restaurant.meal_type === 'Lunch' || restaurant.meal_type === 'Both') && (
                  <>
                    {restaurant.adult_lunch_price !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Adult Lunch</p>
                        <p className="font-semibold text-gray-900">{restaurant.currency} {parseFloat(restaurant.adult_lunch_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                    {restaurant.child_lunch_price !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Child Lunch</p>
                        <p className="font-semibold text-gray-900">{restaurant.currency} {parseFloat(restaurant.child_lunch_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                  </>
                )}
                {(restaurant.meal_type === 'Dinner' || restaurant.meal_type === 'Both') && (
                  <>
                    {restaurant.adult_dinner_price !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Adult Dinner</p>
                        <p className="font-semibold text-gray-900">{restaurant.currency} {parseFloat(restaurant.adult_dinner_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                    {restaurant.child_dinner_price !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Child Dinner</p>
                        <p className="font-semibold text-gray-900">{restaurant.currency} {parseFloat(restaurant.child_dinner_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Menu Description */}
          {restaurant.menu_description && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Menu Description</h3>
              <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200">{restaurant.menu_description}</p>
            </div>
          )}

          {/* Notes */}
          {restaurant.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200">{restaurant.notes}</p>
            </div>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
            {restaurant.created_by && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Created By</h4>
                <p className="text-gray-900">{restaurant.created_by}</p>
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">Created At</h4>
              <p className="text-gray-900">{new Date(restaurant.created_at).toLocaleDateString('en-GB')}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            onClick={() => { onClose(); onManageSeasons(); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Manage Seasons
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
