interface EntranceFee {
  id: number;
  google_place_id: string | null;
  organization_id: number | null;
  provider_id: number | null;
  provider_name: string | null;
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

interface EntranceFeeTableProps {
  fees: EntranceFee[];
  loading: boolean;
  onView: (fee: EntranceFee) => void;
  onEdit: (fee: EntranceFee) => void;
  onDelete: (fee: EntranceFee) => void;
  onManagePricing: (fee: EntranceFee) => void;
}

export default function EntranceFeeTable({
  fees,
  loading,
  onView,
  onEdit,
  onDelete,
  onManagePricing
}: EntranceFeeTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPricingDisplay = (fee: EntranceFee) => {
    if (!fee.pricing_id) return 'No pricing';

    const currency = fee.currency || 'EUR';
    const prices = [];

    if (fee.adult_price) prices.push(`Adult: ${currency} ${parseFloat(fee.adult_price.toString()).toFixed(2)}`);
    if (fee.child_price) prices.push(`Child: ${currency} ${parseFloat(fee.child_price.toString()).toFixed(2)}`);
    if (fee.student_price) prices.push(`Student: ${currency} ${parseFloat(fee.student_price.toString()).toFixed(2)}`);

    if (prices.length === 0) return 'No pricing';

    return prices.join(' | ');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No entrance fees found</div>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Pricing</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fees.map((fee) => (
              <tr key={fee.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{fee.provider_name || 'Not assigned'}</div>
                  {fee.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{fee.provider_id}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {fee.photo_url_1 && (
                      <img
                        src={fee.photo_url_1}
                        alt={fee.site_name}
                        className="w-12 h-12 rounded object-cover mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{fee.site_name}</div>
                      {fee.rating && (
                        <div className="text-xs text-gray-500">
                          ⭐ {parseFloat(fee.rating.toString()).toFixed(1)} {fee.user_ratings_total && `(${fee.user_ratings_total})`}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{fee.city}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {fee.rating ? (
                    <div className="text-sm text-gray-900">
                      ⭐ {parseFloat(fee.rating.toString()).toFixed(1)}
                      {fee.user_ratings_total && (
                        <span className="text-xs text-gray-500 ml-1">({fee.user_ratings_total})</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">N/A</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{getPricingDisplay(fee)}</div>
                  {fee.season_name && (
                    <div className="text-xs text-gray-500">{fee.season_name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(fee.status)}`}>
                    {fee.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(fee)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(fee)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onManagePricing(fee)}
                      className="text-green-600 hover:text-green-900 px-3 py-1 rounded hover:bg-green-50 transition-colors"
                    >
                      Pricing
                    </button>
                    <button
                      onClick={() => onDelete(fee)}
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
