'use client';

import { useState, useEffect } from 'react';

interface SupplierSearchProps {
  category: string;
  location?: string;
  date?: string;
  onSelect: (item: any) => void;
  onClose: () => void;
}

export default function SupplierSearch({ category, location, date, onSelect, onClose }: SupplierSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    searchSuppliers();
  }, [searchTerm, location, date]);

  async function searchSuppliers() {
    if (!category) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        ...(location && { location }),
        ...(date && { date }),
        ...(searchTerm && { search: searchTerm })
      });

      const res = await fetch(`/api/suppliers/search?${params.toString()}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to search suppliers:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Select {category === 'hotelAccommodation' ? 'Hotel' :
                      category === 'sicTourCost' ? 'Tour' :
                      category === 'transportation' ? 'Transfer' :
                      category === 'entranceFees' ? 'Entrance Fee' :
                      category === 'guide' ? 'Guide' :
                      category === 'meal' ? 'Restaurant' : 'Item'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Search Input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          ) : results.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No items found</div>
          ) : (
            <div className="space-y-2">
              {results.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{item.name}</div>
                  {item.provider_name && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Provider: {item.provider_name} {item.provider_id && `(#${item.provider_id})`}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mt-1">
                    {item.location && <span className="mr-3">📍 {item.location}</span>}
                    {item.price && (
                      <span className="text-primary-600 font-medium">
                        {item.currency || '$'} {Number(item.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.hotel_category && (
                    <div className="text-xs text-gray-500 mt-1">
                      {item.hotel_category} • {item.star_rating} stars
                    </div>
                  )}
                  {item.vehicle_type && (
                    <div className="text-xs text-gray-500 mt-1">
                      {item.vehicle_type} • Capacity: {item.max_capacity}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
