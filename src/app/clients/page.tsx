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
  nationality: string;
  language_preference: string;
  status: 'active' | 'inactive' | 'blacklisted';
  created_at: string;
}

export default function ClientsPage() {
  const { organizationId } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');

  useEffect(() => {
    if (organizationId) {
      fetchClients();
    }
  }, [organizationId]);

  async function fetchClients() {
    try {
      const res = await fetch('/api/clients?limit=1000', {
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
    const matchesType = clientTypeFilter === 'all' || client.client_type === clientTypeFilter;

    return matchesSearch && matchesStatus && matchesType;
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
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">Manage your customers and travelers</p>
        </div>
        <button
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Client
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />

          {/* Client Type Filter */}
          <select
            value={clientTypeFilter}
            onChange={(e) => setClientTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            <option value="direct_client">Direct Clients</option>
            <option value="tour_operator_client">Tour Operator Clients</option>
          </select>

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
          Showing <span className="font-semibold">{filteredClients.length}</span> of <span className="font-semibold">{clients.length}</span> clients
        </p>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading clients...</div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No clients found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">ID</th>
                <th className="text-left p-4 font-semibold text-gray-700">Name</th>
                <th className="text-left p-4 font-semibold text-gray-700">Email</th>
                <th className="text-left p-4 font-semibold text-gray-700">Phone</th>
                <th className="text-left p-4 font-semibold text-gray-700">Type</th>
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
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      client.client_type === 'direct_client'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {client.client_type === 'direct_client' ? 'Direct' : 'Tour Operator'}
                    </span>
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
