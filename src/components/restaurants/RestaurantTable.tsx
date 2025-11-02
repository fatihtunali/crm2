interface Restaurant {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
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

interface RestaurantTableProps {
  restaurants: Restaurant[];
  loading: boolean;
  onView: (restaurant: Restaurant) => void;
  onEdit: (restaurant: Restaurant) => void;
  onDelete: (restaurant: Restaurant) => void;
  onManageSeasons: (restaurant: Restaurant) => void;
}

export default function RestaurantTable({
  restaurants,
  loading,
  onView,
  onEdit,
  onDelete,
  onManageSeasons
}: RestaurantTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriceDisplay = (restaurant: Restaurant) => {
    const prices: string[] = [];

    if (restaurant.meal_type === 'Lunch' || restaurant.meal_type === 'Both') {
      if (restaurant.adult_lunch_price !== null) {
        prices.push(`L: ${restaurant.currency} ${parseFloat(restaurant.adult_lunch_price.toString()).toFixed(2)}`);
      }
    }

    if (restaurant.meal_type === 'Dinner' || restaurant.meal_type === 'Both') {
      if (restaurant.adult_dinner_price !== null) {
        prices.push(`D: ${restaurant.currency} ${parseFloat(restaurant.adult_dinner_price.toString()).toFixed(2)}`);
      }
    }

    return prices.length > 0 ? prices.join(' | ') : 'No pricing';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No restaurants found</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider / Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restaurant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meal Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Season</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adult Prices</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {restaurants.map((restaurant) => (
              <tr key={restaurant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{restaurant.provider_name || 'Not assigned'}</div>
                  {restaurant.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{restaurant.provider_id}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{restaurant.restaurant_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{restaurant.city}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{restaurant.meal_type}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{restaurant.season_name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(restaurant.start_date).toLocaleDateString('en-GB')} - {new Date(restaurant.end_date).toLocaleDateString('en-GB')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{getPriceDisplay(restaurant)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(restaurant.status)}`}>
                    {restaurant.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(restaurant)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(restaurant)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onManageSeasons(restaurant)}
                      className="text-green-600 hover:text-green-900 px-3 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                      Seasons
                    </button>
                    <button
                      onClick={() => onDelete(restaurant)}
                      className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
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
