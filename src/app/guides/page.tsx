'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import GuideFilters from '@/components/guides/GuideFilters';
import GuideTable from '@/components/guides/GuideTable';
import ViewGuideModal from '@/components/guides/ViewGuideModal';
import NewGuideModal from '@/components/guides/NewGuideModal';
import EditGuideModal from '@/components/guides/EditGuideModal';
import ManagePricingModal from '@/components/guides/ManagePricingModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface Guide {
  id: number;
  provider_id: number | null;
  provider_name: string | null;
  organization_id: number;
  city: string;
  language: string;
  description: string;
  status: string;
  created_at: string;
  pricing_id: number | null;
  season_name: string | null;
  season_start: string | null;
  season_end: string | null;
  currency: string | null;
  full_day_price: number | null;
  half_day_price: number | null;
  night_price: number | null;
  favorite_priority?: number;
}

export default function GuidesPage() {
  const { organizationId } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [filteredGuides, setFilteredGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newGuideModalOpen, setNewGuideModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchGuides();
  }, []);

  useEffect(() => {
    filterGuides();
  }, [guides, statusFilter, cityFilter, languageFilter, searchTerm]);

  async function fetchGuides() {
    try {
      const res = await fetch('/api/guides?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();

      // Handle paged response format
      const guidesData = Array.isArray(data.data) ? data.data : [];
      setGuides(guidesData);
    } catch (error) {
      console.error('Failed to fetch guides:', error);
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }

  function filterGuides() {
    let filtered = guides;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.status === statusFilter);
    }

    if (cityFilter !== 'all') {
      filtered = filtered.filter(g => g.city === cityFilter);
    }

    if (languageFilter !== 'all') {
      filtered = filtered.filter(g => g.language === languageFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(g =>
        g.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredGuides(filtered);
  }

  function handleView(guide: Guide) {
    setSelectedGuide(guide);
    setViewModalOpen(true);
  }

  function handleEdit(guide: Guide) {
    setSelectedGuide(guide);
    setEditModalOpen(true);
  }

  function handleDelete(guide: Guide) {
    setSelectedGuide(guide);
    setDeleteModalOpen(true);
  }

  function handleNewGuide() {
    setNewGuideModalOpen(true);
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
    if (!selectedGuide) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/guides', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({ id: selectedGuide.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive guide');
      }

      setDeleteModalOpen(false);
      fetchGuides();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive guide. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: guides.length,
    active: guides.filter(g => g.status === 'active').length,
    inactive: guides.filter(g => g.status === 'inactive').length,
  };

  // Get unique cities and languages for filters
  const cities = Array.from(new Set(guides.map(g => g.city))).sort();
  const languages = Array.from(new Set(guides.map(g => g.language))).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tour Guides</h1>
          <p className="text-gray-500 mt-1">Manage tour guide profiles and pricing</p>
        </div>
        <button
          onClick={handleNewGuide}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Guide
        </button>
      </div>

      {/* Filters */}
      <GuideFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        languageFilter={languageFilter}
        onLanguageFilterChange={setLanguageFilter}
        statusCounts={statusCounts}
        cities={cities}
        languages={languages}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredGuides.length}</span> of <span className="font-semibold">{guides.length}</span> guides
        </p>
      </div>

      {/* Guides Table */}
      <GuideTable
        guides={filteredGuides}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={fetchGuides}
      />

      {/* Modals */}
      <ViewGuideModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        onManagePricing={handleManagePricing}
        guide={selectedGuide}
      />

      <EditGuideModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchGuides}
        guide={selectedGuide}
      />

      <NewGuideModal
        isOpen={newGuideModalOpen}
        onClose={() => setNewGuideModalOpen(false)}
        onSuccess={fetchGuides}
      />

      <ManagePricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        guideId={selectedGuide?.id || 0}
        guideName={`${selectedGuide?.city} - ${selectedGuide?.language}` || ''}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Guide"
        message="Are you sure you want to archive the guide"
        itemName={`${selectedGuide?.city} - ${selectedGuide?.language}` || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
