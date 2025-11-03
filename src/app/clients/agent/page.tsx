'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  client_type: 'tour_operator_client' | 'direct_client';
  tour_operator_id: number | null;
  nationality: string;
  language_preference: string;
  status: 'active' | 'inactive' | 'blacklisted';
  created_at: string;
}

export default function AgentClientsPage() {
  const { organizationId } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (organizationId) {
      fetchClients();
    }
  }, [organizationId]);

  async function fetchClients() {
    try {
      // Filter for tour operator clients only
      const res = await fetch('/api/clients?client_type=tour_operator_client&limit=1000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setClients(data.data || []);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter(client => {
    const matchesSearch =
      `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    inactive: clients.filter(c => c.status === 'inactive').length,
    blacklisted: clients.filter(c => c.status === 'blacklisted').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Clients</h1>
          <p className="text-gray-500 mt-1">Travelers sent by tour operators</p>
        </div>
        <button
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Agent Client
        </button>
      </div>

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Privacy Note</h3>
            <p className="text-sm text-blue-700">
              These are actual travelers (not tour operators). When sending bookings to hotels and suppliers,
              use the <strong>client's name</strong> (e.g., "John Smith"), NOT the tour operator's name.
              This protects your B2B relationships.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status ({statusCounts.all})</option>
            <option value="active">Active ({statusCounts.active})</option>
            <option value="inactive">Inactive ({statusCounts.inactive})</option>
            <option value="blacklisted">Blacklisted ({statusCounts.blacklisted})</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredClients.length}</span> of <span className="font-semibold">{clients.length}</span> agent clients
        </p>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading clients...</div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No agent clients found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">ID</th>
                <th className="text-left p-4 font-semibold text-gray-700">Name</th>
                <th className="text-left p-4 font-semibold text-gray-700">Email</th>
                <th className="text-left p-4 font-semibold text-gray-700">Phone</th>
                <th className="text-left p-4 font-semibold text-gray-700">Tour Operator</th>
                <th className="text-left p-4 font-semibold text-gray-700">Nationality</th>
                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Created</th>
                <th className="text-right p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 text-sm font-mono text-gray-600">#{client.id}</td>
                  <td className="p-4 font-medium text-gray-900">
                    {client.first_name} {client.last_name}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{client.email}</td>
                  <td className="p-4 text-sm text-gray-600">{client.phone || 'N/A'}</td>
                  <td className="p-4">
                    {client.tour_operator_id ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        Agent #{client.tour_operator_id}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Not linked</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{client.nationality || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      client.status === 'active' ? 'bg-green-100 text-green-700' :
                      client.status === 'inactive' ? 'bg-gray-100 text-gray-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right text-sm">
                    <button className="text-primary-600 hover:text-primary-700 font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
