'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TransferFilters from '@/components/transfers/TransferFilters';
import TransferTable from '@/components/transfers/TransferTable';
import ViewTransferModal from '@/components/transfers/ViewTransferModal';
import NewTransferModal from '@/components/transfers/NewTransferModal';
import EditTransferModal from '@/components/transfers/EditTransferModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface Transfer {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
  vehicle_id: number;
  from_city: string;
  to_city: string;
  season_name: string;
  start_date: string;
  end_date: string;
  price_oneway: number;
  price_roundtrip: number;
  estimated_duration_hours: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  created_by: number | null;
  vehicle_type: string | null;
  capacity: number | null;
  favorite_priority?: number;
}

export default function TransfersPage() {
  const { organizationId } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromCityFilter, setFromCityFilter] = useState('all');
  const [toCityFilter, setToCityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newTransferModalOpen, setNewTransferModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllTransfers();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchTransfers();
    }
  }, [organizationId, statusFilter, fromCityFilter, toCityFilter, searchTerm]);

  async function fetchAllTransfers() {
    try {
      const res = await fetch('/api/transfers?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();

      const transfersData = Array.isArray(data.data) ? data.data : [];
      const converted = transfersData.map((transfer: any) => ({
        ...transfer,
        price_oneway: transfer.price_oneway?.amount_minor ? transfer.price_oneway.amount_minor / 100 : transfer.price_oneway,
        price_roundtrip: transfer.price_roundtrip?.amount_minor ? transfer.price_roundtrip.amount_minor / 100 : transfer.price_roundtrip
      }));

      setAllTransfers(converted);
    } catch (error) {
      console.error('Failed to fetch all transfers:', error);
      setAllTransfers([]);
    }
  }

  async function fetchTransfers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '10000',
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (fromCityFilter && fromCityFilter !== 'all') {
        params.append('from_city', fromCityFilter);
      }

      if (toCityFilter && toCityFilter !== 'all') {
        params.append('to_city', toCityFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetch(`/api/transfers?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();

      const transfersData = Array.isArray(data.data) ? data.data : [];
      const converted = transfersData.map((transfer: any) => ({
        ...transfer,
        price_oneway: transfer.price_oneway?.amount_minor ? transfer.price_oneway.amount_minor / 100 : transfer.price_oneway,
        price_roundtrip: transfer.price_roundtrip?.amount_minor ? transfer.price_roundtrip.amount_minor / 100 : transfer.price_roundtrip
      }));

      setTransfers(converted);
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(transfer: Transfer) {
    setSelectedTransfer(transfer);
    setViewModalOpen(true);
  }

  function handleEdit(transfer: Transfer) {
    setSelectedTransfer(transfer);
    setEditModalOpen(true);
  }

  function handleDelete(transfer: Transfer) {
    setSelectedTransfer(transfer);
    setDeleteModalOpen(true);
  }

  function handleNewTransfer() {
    setNewTransferModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedTransfer) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({ id: selectedTransfer.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive transfer');
      }

      setDeleteModalOpen(false);
      fetchTransfers();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive transfer. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: allTransfers.length,
    active: allTransfers.filter(t => t.status === 'active').length,
    inactive: allTransfers.filter(t => t.status === 'inactive').length,
  };

  // Get unique cities for filters
  const fromCities = Array.from(new Set(allTransfers.map(t => t.from_city))).sort();
  const toCities = Array.from(new Set(allTransfers.map(t => t.to_city))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Intercity Transfers</h1>
          <p className="text-gray-500 mt-1">Manage intercity transfer services and pricing</p>
        </div>
        <button
          onClick={handleNewTransfer}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Transfer
        </button>
      </div>

      {/* Filters */}
      <TransferFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        fromCityFilter={fromCityFilter}
        onFromCityFilterChange={setFromCityFilter}
        toCityFilter={toCityFilter}
        onToCityFilterChange={setToCityFilter}
        statusCounts={statusCounts}
        fromCities={fromCities}
        toCities={toCities}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{transfers.length}</span> of <span className="font-semibold">{allTransfers.length}</span> transfers
        </p>
      </div>

      {/* Transfers Table */}
      <TransferTable
        transfers={transfers}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={fetchTransfers}
      />

      {/* Modals */}
      <ViewTransferModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        transfer={selectedTransfer}
      />

      <EditTransferModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchTransfers}
        transfer={selectedTransfer}
      />

      <NewTransferModal
        isOpen={newTransferModalOpen}
        onClose={() => setNewTransferModalOpen(false)}
        onSuccess={fetchTransfers}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Transfer"
        message="Are you sure you want to archive the transfer from"
        itemName={selectedTransfer ? `${selectedTransfer.from_city} to ${selectedTransfer.to_city}` : ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
