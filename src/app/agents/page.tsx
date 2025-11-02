'use client';

import { useEffect, useState } from 'react';
import AgentFilters from '@/components/agents/AgentFilters';
import AgentTable from '@/components/agents/AgentTable';
import ViewAgentModal from '@/components/agents/ViewAgentModal';
import NewAgentModal from '@/components/agents/NewAgentModal';
import EditAgentModal from '@/components/agents/EditAgentModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  website: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newAgentModalOpen, setNewAgentModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [agents, statusFilter, searchTerm]);

  async function fetchAgents() {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterAgents() {
    let filtered = agents;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.country && a.country.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredAgents(filtered);
  }

  function handleView(agent: Agent) {
    setSelectedAgent(agent);
    setViewModalOpen(true);
  }

  function handleEdit(agent: Agent) {
    setSelectedAgent(agent);
    setEditModalOpen(true);
  }

  function handleDelete(agent: Agent) {
    setSelectedAgent(agent);
    setDeleteModalOpen(true);
  }

  function handleNewAgent() {
    setNewAgentModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedAgent) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedAgent.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive agent');
      }

      setDeleteModalOpen(false);
      fetchAgents();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive agent. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const statusCounts = {
    all: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    inactive: agents.filter(a => a.status === 'inactive').length,
    suspended: agents.filter(a => a.status === 'suspended').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agents</h1>
          <p className="text-gray-500 mt-1">Manage travel agents and operators</p>
        </div>
        <button
          onClick={handleNewAgent}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Agent
        </button>
      </div>

      {/* Filters */}
      <AgentFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredAgents.length}</span> of <span className="font-semibold">{agents.length}</span> agents
        </p>
      </div>

      {/* Agents Table */}
      <AgentTable
        agents={filteredAgents}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modals */}
      <ViewAgentModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        agent={selectedAgent}
      />

      <EditAgentModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchAgents}
        agent={selectedAgent}
      />

      <NewAgentModal
        isOpen={newAgentModalOpen}
        onClose={() => setNewAgentModalOpen(false)}
        onSuccess={fetchAgents}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Agent"
        message="Are you sure you want to archive"
        itemName={selectedAgent?.name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
