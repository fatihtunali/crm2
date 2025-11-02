interface HotelFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  starRatingFilter: string;
  onStarRatingFilterChange: (value: string) => void;
  hotelCategoryFilter: string;
  onHotelCategoryFilterChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  statusCounts: {
    all: number;
    active: number;
    inactive: number;
  };
  cities: string[];
}

export default function HotelFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  starRatingFilter,
  onStarRatingFilterChange,
  hotelCategoryFilter,
  onHotelCategoryFilterChange,
  cityFilter,
  onCityFilterChange,
  statusCounts,
  cities
}: HotelFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by hotel name, city, or address..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Star Rating Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Star Rating</label>
          <select
            value={starRatingFilter}
            onChange={(e) => onStarRatingFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Star</option>
            <option value="4">4 Star</option>
            <option value="3">3 Star</option>
            <option value="2">2 Star</option>
            <option value="1">1 Star</option>
          </select>
        </div>

        {/* Hotel Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={hotelCategoryFilter}
            onChange={(e) => onHotelCategoryFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="budget">Budget</option>
            <option value="standard_3star">Standard 3-Star</option>
            <option value="standard_4star">Standard 4-Star</option>
            <option value="standard_5star">Standard 5-Star</option>
            <option value="special_class">Special Class</option>
            <option value="luxury">Luxury</option>
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
