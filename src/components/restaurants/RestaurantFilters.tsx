interface RestaurantFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  mealTypeFilter: string;
  onMealTypeFilterChange: (value: string) => void;
  statusCounts: {
    all: number;
    active: number;
    inactive: number;
  };
  cities: string[];
  mealTypes: string[];
}

export default function RestaurantFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  cityFilter,
  onCityFilterChange,
  mealTypeFilter,
  onMealTypeFilterChange,
  statusCounts,
  cities,
  mealTypes
}: RestaurantFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by restaurant name, city, season..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
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

        {/* Meal Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Meal Type</label>
          <select
            value={mealTypeFilter}
            onChange={(e) => onMealTypeFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Meal Types</option>
            {mealTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
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
