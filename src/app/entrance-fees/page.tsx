'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import EntranceFeeFilters from '@/components/entrance-fees/EntranceFeeFilters';
import EntranceFeeTable from '@/components/entrance-fees/EntranceFeeTable';
import ViewEntranceFeeModal from '@/components/entrance-fees/ViewEntranceFeeModal';
import NewEntranceFeeModal from '@/components/entrance-fees/NewEntranceFeeModal';
import EditEntranceFeeModal from '@/components/entrance-fees/EditEntranceFeeModal';
import ManagePricingModal from '@/components/entrance-fees/ManagePricingModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface EntranceFee {
  id: number;
  google_place_id: string | null;
  organization_id: number | null;
  provider_id: number | null;
  provider_name: string | null;
  site_name: string;
  city: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
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
  adult_price: number | null;
  child_price: number | null;
  student_price: number | null;
}

export default function EntranceFeesPage() {
  const { organizationId } = useAuth();
  const [fees, setFees] = useState<EntranceFee[]>([]);
  const [allFees, setAllFees] = useState<EntranceFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newFeeModalOpen, setNewFeeModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<EntranceFee | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllFees();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchFees();
    }
  }, [organizationId, statusFilter, cityFilter, searchTerm]);

  async function fetchAllFees() {
    try {
      const res = await fetch('/api/entrance-fees?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const feesData = Array.isArray(data.data) ? data.data : [];
      setAllFees(feesData);
    } catch (error) {
      console.error('Failed to fetch all entrance fees:', error);
      setAllFees([]);
    }
  }

  async function fetchFees() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '10000',
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (cityFilter && cityFilter !== 'all') {
        params.append('city', cityFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetch(`/api/entrance-fees?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const feesData = Array.isArray(data.data) ? data.data : [];
      setFees(feesData);
    } catch (error) {
      console.error('Failed to fetch entrance fees:', error);
      setFees([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(fee: EntranceFee) {
    setSelectedFee(fee);
    setViewModalOpen(true);
  }

  function handleEdit(fee: EntranceFee) {
    setSelectedFee(fee);
    setEditModalOpen(true);
  }

  function handleDelete(fee: EntranceFee) {
    setSelectedFee(fee);
    setDeleteModalOpen(true);
  }

  function handleManagePricing(fee: EntranceFee) {
    setSelectedFee(fee);
    setPricingModalOpen(true);
  }

  function handleNewFee() {
    setNewFeeModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  function handleViewManagePricing() {
    setViewModalOpen(false);
    setPricingModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedFee) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/entrance-fees', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({ id: selectedFee.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive entrance fee');
      }

      setDeleteModalOpen(false);
      fetchFees();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive entrance fee. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: allFees.length,
    active: allFees.filter(f => f.status === 'active').length,
    inactive: allFees.filter(f => f.status === 'inactive').length,
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(allFees.map(f => f.city))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entrance Fees</h1>
          <p className="text-gray-500 mt-1">Manage entrance fees for attractions and sites</p>
        </div>
        <button
          onClick={handleNewFee}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Entrance Fee
        </button>
      </div>

      {/* Filters */}
      <EntranceFeeFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        statusCounts={statusCounts}
        cities={cities}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{fees.length}</span> of <span className="font-semibold">{allFees.length}</span> entrance fees
        </p>
      </div>

      {/* Entrance Fees Table */}
      <EntranceFeeTable
        fees={fees}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManagePricing={handleManagePricing}
      />

      {/* Modals */}
      <ViewEntranceFeeModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onManagePricing={handleViewManagePricing}
        entranceFee={selectedFee}
      />

      <EditEntranceFeeModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchFees}
        entranceFee={selectedFee}
      />

      <NewEntranceFeeModal
        isOpen={newFeeModalOpen}
        onClose={() => setNewFeeModalOpen(false)}
        onSuccess={fetchFees}
      />

      <ManagePricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        entranceFeeId={selectedFee?.id || 0}
        siteName={selectedFee?.site_name || ''}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Entrance Fee"
        message="Are you sure you want to archive the entrance fee"
        itemName={selectedFee?.site_name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
