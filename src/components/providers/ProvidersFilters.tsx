interface ProvidersFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  providerTypeFilter: string;
  onProviderTypeFilterChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  statusCounts: {
    all: number;
    active: number;
    inactive: number;
  };
  cities: string[];
  providerTypes: string[];
}

export default function ProvidersFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  providerTypeFilter,
  onProviderTypeFilterChange,
  cityFilter,
  onCityFilterChange,
  statusCounts,
  cities,
  providerTypes
}: ProvidersFiltersProps) {
  const formatProviderTypeName = (type: string) => {
    const names: { [key: string]: string } = {
      'hotel': 'Hotel',
      'tour_operator': 'Tour Operator',
      'transport': 'Transport',
      'restaurant': 'Restaurant',
      'government': 'Government',
      'guide': 'Guide',
      'entrance_fee': 'Entrance Fee',
      'other': 'Other'
    };
    return names[type] || type;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by name, city, or email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Provider Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Provider Type</label>
          <select
            value={providerTypeFilter}
            onChange={(e) => onProviderTypeFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="hotel">Hotel</option>
            <option value="tour_operator">Tour Operator</option>
            <option value="transport">Transport</option>
            <option value="restaurant">Restaurant</option>
            <option value="government">Government</option>
            <option value="guide">Guide</option>
            <option value="entrance_fee">Entrance Fee</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* City Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <select
            value={cityFilter}
            onChange={(e) => onCityFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          onClick={() => onStatusFilterChange('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active ({statusCounts.active})
        </button>
        <button
          onClick={() => onStatusFilterChange('inactive')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'inactive'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inactive ({statusCounts.inactive})
        </button>
      </div>
    </div>
  );
}
