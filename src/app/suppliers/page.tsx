'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProvidersFilters from '@/components/providers/ProvidersFilters';
import ProvidersTable from '@/components/providers/ProvidersTable';
import ViewProviderModal from '@/components/providers/ViewProviderModal';
import NewProviderModal from '@/components/providers/NewProviderModal';
import EditProviderModal from '@/components/providers/EditProviderModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import Pagination from '@/components/Pagination';

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
}

export default function SuppliersPage() {
  const { organizationId } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerTypeFilter, setProviderTypeFilter] = useState('all');
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
  const [newProviderModalOpen, setNewProviderModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllProviders();
    }
  }, [organizationId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, providerTypeFilter, cityFilter, searchTerm]);

  useEffect(() => {
    if (organizationId) {
      fetchProviders();
    }
  }, [organizationId, currentPage, statusFilter, providerTypeFilter, cityFilter, searchTerm]);

  async function fetchAllProviders() {
    try {
      const res = await fetch('/api/providers?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setAllProviders(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch all providers:', error);
      setAllProviders([]);
    }
  }

  async function fetchProviders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (providerTypeFilter && providerTypeFilter !== 'all') {
        params.append('provider_type', providerTypeFilter);
      }

      if (cityFilter && cityFilter !== 'all') {
        params.append('city', cityFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetch(`/api/providers?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();

      setProviders(Array.isArray(data.data) ? data.data : []);
      setTotalItems(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(provider: Provider) {
    setSelectedProvider(provider);
    setViewModalOpen(true);
  }

  function handleEdit(provider: Provider) {
    setSelectedProvider(provider);
    setEditModalOpen(true);
  }

  function handleDelete(provider: Provider) {
    setSelectedProvider(provider);
    setDeleteModalOpen(true);
  }

  function handleNewProvider() {
    setNewProviderModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedProvider) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/providers/${selectedProvider.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        }
      });

      if (!res.ok) {
        throw new Error('Failed to archive provider');
      }

      setDeleteModalOpen(false);
      fetchProviders();
      fetchAllProviders();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive provider. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: allProviders.length,
    active: allProviders.filter(p => p.status === 'active').length,
    inactive: allProviders.filter(p => p.status === 'inactive').length,
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(allProviders.map(p => p.city).filter(Boolean))).sort() as string[];

  // Get unique provider types for filter
  const providerTypes = Array.from(new Set(allProviders.map(p => p.provider_type))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500 mt-1">Manage service providers and suppliers</p>
        </div>
        <button
          onClick={handleNewProvider}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Supplier
        </button>
      </div>

      {/* Filters */}
      <ProvidersFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        providerTypeFilter={providerTypeFilter}
        onProviderTypeFilterChange={setProviderTypeFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        statusCounts={statusCounts}
        cities={cities}
        providerTypes={providerTypes}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{providers.length}</span> of <span className="font-semibold">{totalItems}</span> suppliers
        </p>
      </div>

      {/* Providers Table */}
      <ProvidersTable
        providers={providers}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
      <ViewProviderModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        provider={selectedProvider}
      />

      <EditProviderModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          fetchProviders();
          fetchAllProviders();
        }}
        provider={selectedProvider}
      />

      <NewProviderModal
        isOpen={newProviderModalOpen}
        onClose={() => setNewProviderModalOpen(false)}
        onSuccess={() => {
          fetchProviders();
          fetchAllProviders();
        }}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Supplier"
        message="Are you sure you want to archive the supplier"
        itemName={selectedProvider?.provider_name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
