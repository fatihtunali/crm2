interface RequestFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusCounts: {
    all: number;
    pending: number;
    confirmed: number;
    booked: number;
    completed: number;
    cancelled: number;
  };
}

export default function RequestFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts
}: RequestFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by customer name, email, or destination..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All ({statusCounts.all})</option>
            <option value="pending">Pending ({statusCounts.pending})</option>
            <option value="confirmed">Confirmed ({statusCounts.confirmed})</option>
            <option value="booked">Booked ({statusCounts.booked})</option>
            <option value="completed">Completed ({statusCounts.completed})</option>
            <option value="cancelled">Cancelled ({statusCounts.cancelled})</option>
          </select>
        </div>
      </div>
    </div>
  );
}
