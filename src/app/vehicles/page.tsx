'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import VehicleFilters from '@/components/vehicles/VehicleFilters';
import VehicleTable from '@/components/vehicles/VehicleTable';
import ViewVehicleModal from '@/components/vehicles/ViewVehicleModal';
import NewVehicleModal from '@/components/vehicles/NewVehicleModal';
import EditVehicleModal from '@/components/vehicles/EditVehicleModal';
import ManagePricingModal from '@/components/vehicles/ManagePricingModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface Vehicle {
  id: number;
  provider_id: number | null;
  provider_name: string | null;
  organization_id: number;
  vehicle_type: string;
  max_capacity: number;
  city: string;
  description: string | null;
  status: string;
  created_at: string;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  price_per_day: number | null;
  price_half_day: number | null;
}

export default function VehiclesPage() {
  const { organizationId } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newVehicleModalOpen, setNewVehicleModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllVehicles();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchVehicles();
    }
  }, [organizationId, statusFilter, cityFilter, searchTerm]);

  async function fetchAllVehicles() {
    try {
      const res = await fetch('/api/vehicles?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const vehiclesData = Array.isArray(data.data) ? data.data : [];
      setAllVehicles(vehiclesData);
    } catch (error) {
      console.error('Failed to fetch all vehicles:', error);
      setAllVehicles([]);
    }
  }

  async function fetchVehicles() {
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

      const res = await fetch(`/api/vehicles?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const vehiclesData = Array.isArray(data.data) ? data.data : [];
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Failed to fetch vehicles:', error);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setViewModalOpen(true);
  }

  function handleEdit(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setEditModalOpen(true);
  }

  function handleDelete(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setDeleteModalOpen(true);
  }

  function handleNewVehicle() {
    setNewVehicleModalOpen(true);
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
    if (!selectedVehicle) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({ id: selectedVehicle.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive vehicle');
      }

      setDeleteModalOpen(false);
      fetchVehicles();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive vehicle. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: allVehicles.length,
    active: allVehicles.filter(v => v.status === 'active').length,
    inactive: allVehicles.filter(v => v.status === 'inactive').length,
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(allVehicles.map(v => v.city))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vehicles for Daily Use</h1>
          <p className="text-gray-500 mt-1">Manage vehicles for daily rental services</p>
        </div>
        <button
          onClick={handleNewVehicle}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Vehicle
        </button>
      </div>

      {/* Filters */}
      <VehicleFilters
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
          Showing <span className="font-semibold">{vehicles.length}</span> of <span className="font-semibold">{allVehicles.length}</span> vehicles
        </p>
      </div>

      {/* Vehicles Table */}
      <VehicleTable
        vehicles={vehicles}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modals */}
      <ViewVehicleModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onManagePricing={handleManagePricing}
        vehicle={selectedVehicle}
      />

      <EditVehicleModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchVehicles}
        vehicle={selectedVehicle}
      />

      <NewVehicleModal
        isOpen={newVehicleModalOpen}
        onClose={() => setNewVehicleModalOpen(false)}
        onSuccess={fetchVehicles}
      />

      <ManagePricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        vehicleId={selectedVehicle?.id || 0}
        vehicleType={selectedVehicle?.vehicle_type || ''}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Vehicle"
        message="Are you sure you want to archive the vehicle"
        itemName={selectedVehicle?.vehicle_type || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
