'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TourPackageFilters from '@/components/daily-tours/TourPackageFilters';
import TourPackageTable from '@/components/daily-tours/TourPackageTable';
import ViewTourPackageModal from '@/components/daily-tours/ViewTourPackageModal';
import NewTourPackageModal from '@/components/daily-tours/NewTourPackageModal';
import EditTourPackageModal from '@/components/daily-tours/EditTourPackageModal';
import ManagePricingModal from '@/components/daily-tours/ManagePricingModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

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

export default function TourPackagesPage() {
  const { organizationId } = useAuth();
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [allPackages, setAllPackages] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tourTypeFilter, setTourTypeFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newPackageModalOpen, setNewPackageModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<TourPackage | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllPackages();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchPackages();
    }
  }, [organizationId, statusFilter, tourTypeFilter, cityFilter, searchTerm]);

  async function fetchAllPackages() {
    try {
      const res = await fetch('/api/daily-tours?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setAllPackages(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch all daily tours:', error);
      setAllPackages([]);
    }
  }

  async function fetchPackages() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '10000',
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (tourTypeFilter && tourTypeFilter !== 'all') {
        params.append('tour_type', tourTypeFilter);
      }

      if (cityFilter && cityFilter !== 'all') {
        params.append('city', cityFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetch(`/api/daily-tours?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setPackages(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch daily tours:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(pkg: TourPackage) {
    setSelectedPackage(pkg);
    setViewModalOpen(true);
  }

  function handleEdit(pkg: TourPackage) {
    setSelectedPackage(pkg);
    setEditModalOpen(true);
  }

  function handleDelete(pkg: TourPackage) {
    setSelectedPackage(pkg);
    setDeleteModalOpen(true);
  }

  function handleNewPackage() {
    setNewPackageModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  function handleManagePricing() {
    setViewModalOpen(false);
    setPricingModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedPackage) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/daily-tours/${selectedPackage.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        }
      });

      if (!res.ok) {
        throw new Error('Failed to archive daily tour');
      }

      setDeleteModalOpen(false);
      fetchPackages();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive tour package. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: allPackages.length,
    active: allPackages.filter(p => p.status === 'active').length,
    inactive: allPackages.filter(p => p.status === 'inactive').length,
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(allPackages.map(p => p.city))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Tours</h1>
          <p className="text-gray-500 mt-1">Manage daily tour products from suppliers</p>
        </div>
        <button
          onClick={handleNewPackage}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Daily Tour
        </button>
      </div>

      {/* Filters */}
      <TourPackageFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        tourTypeFilter={tourTypeFilter}
        onTourTypeFilterChange={setTourTypeFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        statusCounts={statusCounts}
        cities={cities}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{packages.length}</span> of <span className="font-semibold">{allPackages.length}</span> daily tours
        </p>
      </div>

      {/* Tour Packages Table */}
      <TourPackageTable
        packages={packages}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modals */}
      <ViewTourPackageModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onManagePricing={handleManagePricing}
        tourPackage={selectedPackage}
      />

      <EditTourPackageModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchPackages}
        tourPackage={selectedPackage}
      />

      <NewTourPackageModal
        isOpen={newPackageModalOpen}
        onClose={() => setNewPackageModalOpen(false)}
        onSuccess={fetchPackages}
      />

      <ManagePricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        tourId={selectedPackage?.id || 0}
        tourName={selectedPackage?.tour_name || ''}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Tour Package"
        message="Are you sure you want to archive the tour package"
        itemName={selectedPackage?.tour_name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
