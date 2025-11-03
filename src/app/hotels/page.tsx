'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import HotelFilters from '@/components/hotels/HotelFilters';
import HotelTable from '@/components/hotels/HotelTable';
import ViewHotelModal from '@/components/hotels/ViewHotelModal';
import NewHotelModal from '@/components/hotels/NewHotelModal';
import EditHotelModal from '@/components/hotels/EditHotelModal';
import ManagePricingModal from '@/components/hotels/ManagePricingModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import Pagination from '@/components/Pagination';

interface Hotel {
  id: number;
  google_place_id: string | null;
  organization_id: number | null;
  hotel_name: string;
  city: string;
  star_rating: number | null;
  hotel_category: string | null;
  room_count: number | null;
  is_boutique: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  status: string;
  photo_url_1: string | null;
  photo_url_2: string | null;
  photo_url_3: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  website: string | null;
  editorial_summary: string | null;
  place_types: string | null;
  price_level: number | null;
  business_status: string | null;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  double_room_bb: number | null;
  single_supplement_bb: number | null;
  triple_room_bb: number | null;
  child_0_6_bb: number | null;
  child_6_12_bb: number | null;
  hb_supplement: number | null;
  fb_supplement: number | null;
  ai_supplement: number | null;
  base_meal_plan: string | null;
}

export default function HotelsPage() {
  const { organizationId } = useAuth();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [allHotels, setAllHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [starRatingFilter, setStarRatingFilter] = useState('all');
  const [hotelCategoryFilter, setHotelCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newHotelModalOpen, setNewHotelModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllHotels();
    }
  }, [organizationId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, starRatingFilter, hotelCategoryFilter, cityFilter, searchTerm]);

  useEffect(() => {
    if (organizationId) {
      fetchHotels();
    }
  }, [organizationId, currentPage, statusFilter, starRatingFilter, hotelCategoryFilter, cityFilter, searchTerm]);

  async function fetchAllHotels() {
    try {
      const res = await fetch('/api/hotels?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setAllHotels(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch all hotels:', error);
      setAllHotels([]);
    }
  }

  async function fetchHotels() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (starRatingFilter && starRatingFilter !== 'all') {
        params.append('star_rating', starRatingFilter);
      }

      if (hotelCategoryFilter && hotelCategoryFilter !== 'all') {
        params.append('hotel_category', hotelCategoryFilter);
      }

      if (cityFilter && cityFilter !== 'all') {
        params.append('city', cityFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetch(`/api/hotels?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();

      setHotels(Array.isArray(data.data) ? data.data : []);
      setTotalItems(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch hotels:', error);
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(hotel: Hotel) {
    setSelectedHotel(hotel);
    setViewModalOpen(true);
  }

  function handleEdit(hotel: Hotel) {
    setSelectedHotel(hotel);
    setEditModalOpen(true);
  }

  function handleDelete(hotel: Hotel) {
    setSelectedHotel(hotel);
    setDeleteModalOpen(true);
  }

  function handleNewHotel() {
    setNewHotelModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  function handleManagePricing(hotel?: Hotel) {
    if (hotel) {
      setSelectedHotel(hotel);
    }
    setViewModalOpen(false);
    setPricingModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedHotel) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/hotels/${selectedHotel.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        }
      });

      if (!res.ok) {
        throw new Error('Failed to archive hotel');
      }

      setDeleteModalOpen(false);
      fetchHotels();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive hotel. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: allHotels.length,
    active: allHotels.filter(h => h.status === 'active').length,
    inactive: allHotels.filter(h => h.status === 'inactive').length,
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(allHotels.map(h => h.city))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hotels</h1>
          <p className="text-gray-500 mt-1">Manage hotel inventory and pricing</p>
        </div>
        <button
          onClick={handleNewHotel}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Hotel
        </button>
      </div>

      {/* Filters */}
      <HotelFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        starRatingFilter={starRatingFilter}
        onStarRatingFilterChange={setStarRatingFilter}
        hotelCategoryFilter={hotelCategoryFilter}
        onHotelCategoryFilterChange={setHotelCategoryFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        statusCounts={statusCounts}
        cities={cities}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{hotels.length}</span> of <span className="font-semibold">{totalItems}</span> hotels
        </p>
      </div>

      {/* Hotels Table */}
      <HotelTable
        hotels={hotels}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManagePricing={handleManagePricing}
      />

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
        />
      )}

      {/* Modals */}
      <ViewHotelModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onManagePricing={handleManagePricing}
        hotel={selectedHotel}
      />

      <EditHotelModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchHotels}
        hotel={selectedHotel}
      />

      <NewHotelModal
        isOpen={newHotelModalOpen}
        onClose={() => setNewHotelModalOpen(false)}
        onSuccess={fetchHotels}
      />

      <ManagePricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        hotelId={selectedHotel?.id || 0}
        hotelName={selectedHotel?.hotel_name || ''}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Hotel"
        message="Are you sure you want to archive the hotel"
        itemName={selectedHotel?.hotel_name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
