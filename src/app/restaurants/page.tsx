'use client';

import { useEffect, useState } from 'react';
import RestaurantFilters from '@/components/restaurants/RestaurantFilters';
import RestaurantTable from '@/components/restaurants/RestaurantTable';
import ViewRestaurantModal from '@/components/restaurants/ViewRestaurantModal';
import NewRestaurantModal from '@/components/restaurants/NewRestaurantModal';
import EditRestaurantModal from '@/components/restaurants/EditRestaurantModal';
import ManageSeasonsModal from '@/components/restaurants/ManageSeasonsModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface Restaurant {
  id: number;
  provider_id: number | null;
  provider_name: string | null;
  organization_id: number;
  restaurant_name: string;
  city: string;
  meal_type: string;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  adult_lunch_price: number | null;
  child_lunch_price: number | null;
  adult_dinner_price: number | null;
  child_dinner_price: number | null;
  menu_description: string | null;
  effective_from: string | null;
  created_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [mealTypeFilter, setMealTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newRestaurantModalOpen, setNewRestaurantModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [seasonsModalOpen, setSeasonsModalOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    filterRestaurants();
  }, [restaurants, statusFilter, cityFilter, mealTypeFilter, searchTerm]);

  async function fetchRestaurants() {
    try {
      const res = await fetch('/api/restaurants');
      const data = await res.json();
      setRestaurants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }

  function filterRestaurants() {
    let filtered = restaurants;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (cityFilter !== 'all') {
      filtered = filtered.filter(r => r.city === cityFilter);
    }

    if (mealTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.meal_type === mealTypeFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.restaurant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.season_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.menu_description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRestaurants(filtered);
  }

  function handleView(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    setViewModalOpen(true);
  }

  function handleEdit(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    setEditModalOpen(true);
  }

  function handleDelete(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    setDeleteModalOpen(true);
  }

  function handleManageSeasons(restaurant: Restaurant) {
    setSelectedRestaurant(restaurant);
    setSeasonsModalOpen(true);
  }

  function handleNewRestaurant() {
    setNewRestaurantModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  function handleViewManageSeasons() {
    setViewModalOpen(false);
    setSeasonsModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedRestaurant) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/restaurants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRestaurant.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive restaurant');
      }

      setDeleteModalOpen(false);
      fetchRestaurants();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive restaurant. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: restaurants.length,
    active: restaurants.filter(r => r.status === 'active').length,
    inactive: restaurants.filter(r => r.status === 'inactive').length,
  };

  // Get unique cities and meal types for filters
  const cities = Array.from(new Set(restaurants.map(r => r.city))).sort();
  const mealTypes = ['Lunch', 'Dinner', 'Both'];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurants</h1>
          <p className="text-gray-500 mt-1">Manage restaurant meal pricing and seasonal rates</p>
        </div>
        <button
          onClick={handleNewRestaurant}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Restaurant
        </button>
      </div>

      {/* Filters */}
      <RestaurantFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        mealTypeFilter={mealTypeFilter}
        onMealTypeFilterChange={setMealTypeFilter}
        statusCounts={statusCounts}
        cities={cities}
        mealTypes={mealTypes}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredRestaurants.length}</span> of <span className="font-semibold">{restaurants.length}</span> restaurants
        </p>
      </div>

      {/* Restaurants Table */}
      <RestaurantTable
        restaurants={filteredRestaurants}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManageSeasons={handleManageSeasons}
      />

      {/* Modals */}
      <ViewRestaurantModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onManageSeasons={handleViewManageSeasons}
        restaurant={selectedRestaurant}
      />

      <EditRestaurantModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchRestaurants}
        restaurant={selectedRestaurant}
      />

      <NewRestaurantModal
        isOpen={newRestaurantModalOpen}
        onClose={() => setNewRestaurantModalOpen(false)}
        onSuccess={fetchRestaurants}
      />

      <ManageSeasonsModal
        isOpen={seasonsModalOpen}
        onClose={() => setSeasonsModalOpen(false)}
        restaurantName={selectedRestaurant?.restaurant_name || ''}
        restaurantId={selectedRestaurant?.id || 0}
        onSuccess={fetchRestaurants}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Restaurant Pricing"
        message="Are you sure you want to archive this restaurant pricing record for"
        itemName={`${selectedRestaurant?.restaurant_name} - ${selectedRestaurant?.season_name}` || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
