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
}

interface GuideTableProps {
  guides: Guide[];
  loading: boolean;
  onView: (guide: Guide) => void;
  onEdit: (guide: Guide) => void;
  onDelete: (guide: Guide) => void;
}

export default function GuideTable({
  guides,
  loading,
  onView,
  onEdit,
  onDelete
}: GuideTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
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
            {guides.map((guide) => (
              <tr key={guide.id} className="hover:bg-gray-50">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
