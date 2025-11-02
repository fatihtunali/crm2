interface TransferFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  fromCityFilter: string;
  onFromCityFilterChange: (value: string) => void;
  toCityFilter: string;
  onToCityFilterChange: (value: string) => void;
  statusCounts: {
    all: number;
    active: number;
    inactive: number;
  };
  fromCities: string[];
  toCities: string[];
}

export default function TransferFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  fromCityFilter,
  onFromCityFilterChange,
  toCityFilter,
  onToCityFilterChange,
  statusCounts,
  fromCities,
  toCities
}: TransferFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by city, season, or vehicle type..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* From City Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From City</label>
          <select
            value={fromCityFilter}
            onChange={(e) => onFromCityFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Cities</option>
            {fromCities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* To City Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To City</label>
          <select
            value={toCityFilter}
            onChange={(e) => onToCityFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Cities</option>
            {toCities.map((city) => (
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
