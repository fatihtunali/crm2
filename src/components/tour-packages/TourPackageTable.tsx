interface TourPackage {
  id: number;
  provider_id: number | null;
  provider_name: string | null;
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

interface TourPackageTableProps {
  packages: TourPackage[];
  loading: boolean;
  onView: (pkg: TourPackage) => void;
  onEdit: (pkg: TourPackage) => void;
  onDelete: (pkg: TourPackage) => void;
}

export default function TourPackageTable({
  packages,
  loading,
  onView,
  onEdit,
  onDelete
}: TourPackageTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTourTypeColor = (type: string) => {
    return type === 'SIC' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  };

  const getDurationText = (pkg: TourPackage) => {
    if (pkg.duration_type === 'DAYS' && pkg.duration_days) {
      return `${pkg.duration_days} ${pkg.duration_days === 1 ? 'Day' : 'Days'}`;
    } else if (pkg.duration_type === 'HOURS' && pkg.duration_hours) {
      return `${pkg.duration_hours} ${pkg.duration_hours === 1 ? 'Hour' : 'Hours'}`;
    } else if (pkg.duration_days && pkg.duration_hours) {
      return `${pkg.duration_days}D ${pkg.duration_hours}H`;
    }
    return 'N/A';
  };

  const getPriceRange = (pkg: TourPackage) => {
    if (!pkg.pricing_id) return 'No pricing';

    const prices = pkg.tour_type === 'SIC'
      ? [pkg.sic_price_2_pax, pkg.sic_price_4_pax, pkg.sic_price_6_pax, pkg.sic_price_8_pax, pkg.sic_price_10_pax]
      : [pkg.pvt_price_2_pax, pkg.pvt_price_4_pax, pkg.pvt_price_6_pax, pkg.pvt_price_8_pax, pkg.pvt_price_10_pax];

    const validPrices = prices.filter(p => p !== null && p !== undefined) as number[];

    if (validPrices.length === 0) return 'No pricing';

    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    const currency = pkg.currency || 'EUR';

    if (min === max) {
      return `${currency} ${min.toFixed(2)}`;
    }
    return `${currency} ${min.toFixed(2)} - ${max.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No tour packages found</div>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tour</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {packages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{pkg.provider_name || 'Not assigned'}</div>
                  {pkg.provider_id && <div className="text-xs font-mono text-gray-500">Provider #{pkg.provider_id}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {pkg.photo_url_1 && (
                      <img
                        src={pkg.photo_url_1}
                        alt={pkg.tour_name}
                        className="w-12 h-12 rounded object-cover mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{pkg.tour_name}</div>
                      {pkg.rating && (
                        <div className="text-xs text-gray-500">
                          ⭐ {parseFloat(pkg.rating.toString()).toFixed(1)} {pkg.user_ratings_total && `(${pkg.user_ratings_total})`}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 font-mono">{pkg.tour_code}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{pkg.city}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{getDurationText(pkg)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getTourTypeColor(pkg.tour_type)}`}>
                    {pkg.tour_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{getPriceRange(pkg)}</div>
                  {pkg.season_name && (
                    <div className="text-xs text-gray-500">{pkg.season_name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(pkg.status)}`}>
                    {pkg.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(pkg)}
                      className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(pkg)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(pkg)}
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
