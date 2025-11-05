import { useState, Fragment, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Provider {
  id: number;
  organization_id: number;
  provider_name: string;
  provider_type: string;
  city: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  parent_provider_id?: number | null;
  is_parent?: number;
  company_tax_id?: string | null;
  company_legal_name?: string | null;
  parent_company_name?: string | null;
  parent_legal_name?: string | null;
  parent_tax_id?: string | null;
  child_divisions_count?: number;
  daily_tours_count?: number;
  transfers_count?: number;
  vehicles_count?: number;
  restaurants_count?: number;
  entrance_fees_count?: number;
  extra_expenses_count?: number;
}

interface PricingData {
  tours: any[];
  vehicles: any[];
  restaurants: any[];
  entranceFees: any[];
  transfers: any[];
  extraExpenses: any[];
}

interface ProvidersTableProps {
  providers: Provider[];
  loading: boolean;
  onView: (provider: Provider) => void;
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
}

export default function ProvidersTable({
  providers,
  loading,
  onView,
  onEdit,
  onDelete
}: ProvidersTableProps) {
  const { organizationId } = useAuth();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [pricingData, setPricingData] = useState<Map<number, PricingData>>(new Map());
  const [loadingPricing, setLoadingPricing] = useState<Set<number>>(new Set());

  const toggleExpand = async (id: number, provider: Provider) => {
    const isExpanding = !expandedRows.has(id);

    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });

    // Fetch pricing data if expanding and not already loaded
    if (isExpanding && !pricingData.has(id)) {
      await fetchPricingData(id, provider);
    }
  };

  const fetchPricingData = async (providerId: number, provider: Provider) => {
    setLoadingPricing(prev => new Set(prev).add(providerId));

    try {
      const headers = { 'X-Tenant-Id': organizationId };

      // Fetch all relevant pricing data in parallel
      const promises = [];

      // Fetch tours pricing
      if (provider.daily_tours_count && provider.daily_tours_count > 0) {
        promises.push(
          fetch(`/api/daily-tours?provider_id=${providerId}&limit=100`, { headers })
            .then(res => res.json())
            .then(data => ({ type: 'tours', data: data.data || [] }))
            .catch(() => ({ type: 'tours', data: [] }))
        );
      }

      // Fetch vehicles pricing
      if (provider.vehicles_count && provider.vehicles_count > 0) {
        promises.push(
          fetch(`/api/vehicles?provider_id=${providerId}&limit=100`, { headers })
            .then(res => res.json())
            .then(data => ({ type: 'vehicles', data: data.data || [] }))
            .catch(() => ({ type: 'vehicles', data: [] }))
        );
      }

      // Fetch restaurants pricing
      if (provider.restaurants_count && provider.restaurants_count > 0) {
        promises.push(
          fetch(`/api/restaurants?provider_id=${providerId}&limit=100`, { headers })
            .then(res => res.json())
            .then(data => ({ type: 'restaurants', data: data.data || [] }))
            .catch(() => ({ type: 'restaurants', data: [] }))
        );
      }

      // Fetch entrance fees pricing
      if (provider.entrance_fees_count && provider.entrance_fees_count > 0) {
        promises.push(
          fetch(`/api/entrance-fees?provider_id=${providerId}&limit=100`, { headers })
            .then(res => res.json())
            .then(data => ({ type: 'entranceFees', data: data.data || [] }))
            .catch(() => ({ type: 'entranceFees', data: [] }))
        );
      }

      // Fetch transfers pricing
      if (provider.transfers_count && provider.transfers_count > 0) {
        promises.push(
          fetch(`/api/transfers?provider_id=${providerId}&limit=100`, { headers })
            .then(res => res.json())
            .then(data => ({ type: 'transfers', data: data.data || [] }))
            .catch(() => ({ type: 'transfers', data: [] }))
        );
      }

      const results = await Promise.all(promises);

      const pricing: PricingData = {
        tours: [],
        vehicles: [],
        restaurants: [],
        entranceFees: [],
        transfers: [],
        extraExpenses: []
      };

      results.forEach(result => {
        if (result.type === 'tours') pricing.tours = result.data;
        if (result.type === 'vehicles') pricing.vehicles = result.data;
        if (result.type === 'restaurants') pricing.restaurants = result.data;
        if (result.type === 'entranceFees') pricing.entranceFees = result.data;
        if (result.type === 'transfers') pricing.transfers = result.data;
      });

      setPricingData(prev => new Map(prev).set(providerId, pricing));
    } catch (error) {
      console.error('Failed to fetch pricing data:', error);
    } finally {
      setLoadingPricing(prev => {
        const newSet = new Set(prev);
        newSet.delete(providerId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getProviderTypeColor = (type: string) => {
    switch (type) {
      case 'hotel': return 'bg-blue-100 text-blue-700';
      case 'tour_operator': return 'bg-purple-100 text-purple-700';
      case 'transport': return 'bg-yellow-100 text-yellow-700';
      case 'restaurant': return 'bg-orange-100 text-orange-700';
      case 'government': return 'bg-indigo-100 text-indigo-700';
      case 'guide': return 'bg-green-100 text-green-700';
      case 'entrance_fee': return 'bg-pink-100 text-pink-700';
      case 'other': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

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

  const formatPrice = (price: number | null, currency: string = 'EUR') => {
    if (price === null || price === undefined) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';
    return `${currency} ${numPrice.toFixed(2)}`;
  };

  const hasServices = (provider: Provider) => {
    return (provider.daily_tours_count && provider.daily_tours_count > 0) ||
           (provider.transfers_count && provider.transfers_count > 0) ||
           (provider.vehicles_count && provider.vehicles_count > 0) ||
           (provider.restaurants_count && provider.restaurants_count > 0) ||
           (provider.entrance_fees_count && provider.entrance_fees_count > 0) ||
           (provider.extra_expenses_count && provider.extra_expenses_count > 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-12 text-center text-gray-500">No suppliers found</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Services</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Info</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {providers.map((provider) => {
              const isExpanded = expandedRows.has(provider.id);
              const hasExpandableContent = hasServices(provider);
              const pricing = pricingData.get(provider.id);
              const isLoadingPricing = loadingPricing.has(provider.id);

              return (
                <Fragment key={provider.id}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {hasExpandableContent && (
                        <button
                          onClick={() => toggleExpand(provider.id, provider)}
                          className="text-gray-400 hover:text-gray-600 transition-transform"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          ▶
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-500">#{provider.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {provider.is_parent === 1 && (
                          <span className="inline-flex items-center mr-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                            📁 Parent
                          </span>
                        )}
                        {provider.provider_name}
                      </div>
                      {provider.parent_company_name && (
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="inline-flex items-center">
                            ↳ Division of <span className="font-medium ml-1">{provider.parent_company_name}</span>
                          </span>
                        </div>
                      )}
                      {provider.company_legal_name && provider.is_parent === 1 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Legal: {provider.company_legal_name}
                        </div>
                      )}
                      {provider.child_divisions_count && provider.child_divisions_count > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          {provider.child_divisions_count} division{provider.child_divisions_count > 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        // Parse provider_types if it exists
                        let types: string[] = [];
                        try {
                          if ((provider as any).provider_types) {
                            types = typeof (provider as any).provider_types === 'string'
                              ? JSON.parse((provider as any).provider_types)
                              : (provider as any).provider_types;
                          } else {
                            types = [provider.provider_type];
                          }
                        } catch {
                          types = [provider.provider_type];
                        }

                        return (
                          <div className="flex flex-wrap gap-1">
                            {types.map(type => (
                              <span key={type} className={`px-2 py-1 text-xs rounded-full font-medium ${getProviderTypeColor(type)}`}>
                                {formatProviderTypeName(type)}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {provider.daily_tours_count && provider.daily_tours_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium" title="Daily Tours">
                            🗺️ {provider.daily_tours_count}
                          </span>
                        ) : null}
                        {provider.transfers_count && provider.transfers_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-medium" title="Transfers">
                            🚗 {provider.transfers_count}
                          </span>
                        ) : null}
                        {provider.vehicles_count && provider.vehicles_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium" title="Vehicles">
                            🚙 {provider.vehicles_count}
                          </span>
                        ) : null}
                        {provider.restaurants_count && provider.restaurants_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded font-medium" title="Restaurants">
                            🍽️ {provider.restaurants_count}
                          </span>
                        ) : null}
                        {provider.entrance_fees_count && provider.entrance_fees_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded font-medium" title="Entrance Fees">
                            🎫 {provider.entrance_fees_count}
                          </span>
                        ) : null}
                        {provider.extra_expenses_count && provider.extra_expenses_count > 0 ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium" title="Extra Expenses">
                            💵 {provider.extra_expenses_count}
                          </span>
                        ) : null}
                        {!provider.daily_tours_count &&
                         !provider.transfers_count &&
                         !provider.vehicles_count &&
                         !provider.restaurants_count &&
                         !provider.entrance_fees_count &&
                         !provider.extra_expenses_count ? (
                          <span className="text-xs text-gray-400">No services</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{provider.city || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {provider.contact_phone && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">📞</span>
                            {provider.contact_phone}
                          </div>
                        )}
                        {provider.contact_email && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">✉️</span>
                            {provider.contact_email}
                          </div>
                        )}
                        {!provider.contact_phone && !provider.contact_email && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(provider.status)}`}>
                        {provider.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onView(provider)}
                          className="text-primary-600 hover:text-primary-900 px-3 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          View
                        </button>
                        <button
                          onClick={() => onEdit(provider)}
                          className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(provider)}
                          className="text-red-600 hover:text-red-900 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Pricing Row */}
                  {isExpanded && hasExpandableContent && (
                    <tr className="bg-gray-50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="ml-12 mr-4">
                          {isLoadingPricing ? (
                            <div className="text-center py-8">
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"></div>
                              <p className="mt-2 text-sm text-gray-600">Loading pricing information...</p>
                            </div>
                          ) : pricing ? (
                            <div className="space-y-4">
                              {/* Tours Pricing */}
                              {pricing.tours.length > 0 && (
                                <div className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                                  <div className="bg-purple-50 px-4 py-2 border-b border-purple-200">
                                    <h5 className="text-sm font-semibold text-purple-900">Daily Tours ({pricing.tours.length})</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tour Name</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Season</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">SIC 2 Pax</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">PVT 2 Pax</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {pricing.tours.map((tour: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900">{tour.tour_name}</td>
                                            <td className="px-4 py-2 text-gray-700">{tour.season_name || '-'}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-purple-700">{formatPrice(tour.sic_price_2_pax, tour.currency)}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-purple-700">{formatPrice(tour.pvt_price_2_pax, tour.currency)}</td>
                                            <td className="px-4 py-2 text-right">
                                              <span className={`px-2 py-1 text-xs rounded-full ${tour.pricing_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {tour.pricing_id ? 'Active' : 'No Pricing'}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Vehicles Pricing */}
                              {pricing.vehicles.length > 0 && (
                                <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                                  <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                    <h5 className="text-sm font-semibold text-blue-900">Vehicles ({pricing.vehicles.length})</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Vehicle Type</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Capacity</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Season</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Per Day</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Half Day</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {pricing.vehicles.map((vehicle: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900">{vehicle.vehicle_type}</td>
                                            <td className="px-4 py-2 text-gray-700">{vehicle.max_capacity} pax</td>
                                            <td className="px-4 py-2 text-gray-700">{vehicle.season_name || '-'}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(vehicle.price_per_day, vehicle.currency)}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-blue-700">{formatPrice(vehicle.price_half_day, vehicle.currency)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Restaurants Pricing */}
                              {pricing.restaurants.length > 0 && (
                                <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
                                  <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                                    <h5 className="text-sm font-semibold text-orange-900">Restaurants ({pricing.restaurants.length})</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Restaurant Name</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Meal Type</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Adult Lunch</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Adult Dinner</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Season</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {pricing.restaurants.map((restaurant: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900">{restaurant.restaurant_name}</td>
                                            <td className="px-4 py-2 text-gray-700">{restaurant.meal_type || '-'}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-orange-700">{formatPrice(restaurant.adult_lunch_price, restaurant.currency)}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-orange-700">{formatPrice(restaurant.adult_dinner_price, restaurant.currency)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">{restaurant.season_name || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Entrance Fees Pricing */}
                              {pricing.entranceFees.length > 0 && (
                                <div className="bg-white rounded-lg border border-pink-200 overflow-hidden">
                                  <div className="bg-pink-50 px-4 py-2 border-b border-pink-200">
                                    <h5 className="text-sm font-semibold text-pink-900">Entrance Fees ({pricing.entranceFees.length})</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Site Name</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">City</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Adult</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Child</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Student</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {pricing.entranceFees.map((fee: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900">{fee.site_name}</td>
                                            <td className="px-4 py-2 text-gray-700">{fee.city}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-pink-700">{formatPrice(fee.adult_price, fee.currency)}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-pink-700">{formatPrice(fee.child_price, fee.currency)}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-pink-700">{formatPrice(fee.student_price, fee.currency)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Transfers Pricing */}
                              {pricing.transfers.length > 0 && (
                                <div className="bg-white rounded-lg border border-yellow-200 overflow-hidden">
                                  <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200">
                                    <h5 className="text-sm font-semibold text-yellow-900">Transfers ({pricing.transfers.length})</h5>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Route</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Season</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">One Way</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Round Trip</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200">
                                        {pricing.transfers.map((transfer: any, idx: number) => (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-gray-900">{transfer.from_city} → {transfer.to_city}</td>
                                            <td className="px-4 py-2 text-gray-700">{transfer.season_name || '-'}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-yellow-700">{formatPrice(transfer.price_oneway, 'EUR')}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-yellow-700">{formatPrice(transfer.price_roundtrip, 'EUR')}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <p>No pricing data available</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
