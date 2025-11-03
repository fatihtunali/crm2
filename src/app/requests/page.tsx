'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Money } from '@/types/api';
import RequestFilters from '@/components/requests/RequestFilters';
import RequestTable from '@/components/requests/RequestTable';
import ViewRequestModal from '@/components/requests/ViewRequestModal';
import NewRequestModal from '@/components/requests/NewRequestModal';
import EditRequestModal from '@/components/requests/EditRequestModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface Request {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  adults: number;
  children: number;
  total_price: Money;
  price_per_person: Money;
  status: string;
  tour_type: string | null;
  hotel_category: string | null;
  source: string;
  created_at: string;
}

export default function RequestsPage() {
  const { organizationId } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchRequests();
    }
  }, [organizationId]);

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter, searchTerm]);

  async function fetchRequests() {
    try {
      const res = await fetch('/api/requests', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setRequests(data.data || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterRequests() {
    let filtered = requests;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.destination.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRequests(filtered);
  }

  function handleView(request: Request) {
    setSelectedRequest(request);
    setViewModalOpen(true);
  }

  function handleEdit(request: Request) {
    setSelectedRequest(request);
    setEditModalOpen(true);
  }

  function handleCreateQuote(request: Request) {
    alert(`Creating quote for ${request.customer_name}...\nThis will navigate to the quotation page.`);
    // TODO: Navigate to quote creation page with request data
  }

  function handleDelete(request: Request) {
    setSelectedRequest(request);
    setDeleteModalOpen(true);
  }

  function handleNewRequest() {
    setNewRequestModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  function handleViewQuote() {
    setViewModalOpen(false);
    if (selectedRequest) {
      handleCreateQuote(selectedRequest);
    }
  }

  async function confirmDelete() {
    if (!selectedRequest) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRequest.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive request');
      }

      setDeleteModalOpen(false);
      fetchRequests();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive request. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    booked: requests.filter(r => r.status === 'booked').length,
    completed: requests.filter(r => r.status === 'completed').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
          <p className="text-gray-500 mt-1">Manage all incoming customer requests</p>
        </div>
        <button
          onClick={handleNewRequest}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Request
        </button>
      </div>

      {/* Filters */}
      <RequestFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredRequests.length}</span> of <span className="font-semibold">{requests.length}</span> requests
        </p>
      </div>

      {/* Requests Table */}
      <RequestTable
        requests={filteredRequests}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onQuote={handleCreateQuote}
        onDelete={handleDelete}
      />

      {/* Modals */}
      <ViewRequestModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onQuote={handleViewQuote}
        request={selectedRequest}
      />

      <EditRequestModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchRequests}
        request={selectedRequest}
      />

      <NewRequestModal
        isOpen={newRequestModalOpen}
        onClose={() => setNewRequestModalOpen(false)}
        onSuccess={fetchRequests}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Request"
        message="Are you sure you want to archive the request from"
        itemName={selectedRequest?.customer_name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
