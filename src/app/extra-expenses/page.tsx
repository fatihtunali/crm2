'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ExtraExpenseFilters from '@/components/extra-expenses/ExtraExpenseFilters';
import ExtraExpenseTable from '@/components/extra-expenses/ExtraExpenseTable';
import ViewExtraExpenseModal from '@/components/extra-expenses/ViewExtraExpenseModal';
import NewExtraExpenseModal from '@/components/extra-expenses/NewExtraExpenseModal';
import EditExtraExpenseModal from '@/components/extra-expenses/EditExtraExpenseModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

interface ExtraExpense {
  id: number;
  organization_id: number;
  provider_id: number | null;
  provider_name: string | null;
  expense_name: string;
  expense_category: string;
  city: string;
  currency: string;
  unit_price: number;
  unit_type: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  favorite_priority?: number;
}

export default function ExtraExpensesPage() {
  const { organizationId } = useAuth();
  const [expenses, setExpenses] = useState<ExtraExpense[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExtraExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newExpenseModalOpen, setNewExpenseModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExtraExpense | null>(null);

  // Delete state
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchAllExpenses();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchExpenses();
    }
  }, [organizationId, statusFilter, categoryFilter, cityFilter, searchTerm]);

  async function fetchAllExpenses() {
    try {
      const res = await fetch('/api/extra-expenses?limit=10000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const expensesData = Array.isArray(data.data) ? data.data : [];
      setAllExpenses(expensesData);
    } catch (error) {
      console.error('Failed to fetch all extra expenses:', error);
      setAllExpenses([]);
    }
  }

  async function fetchExpenses() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '10000',
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (categoryFilter && categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }

      if (cityFilter && cityFilter !== 'all') {
        params.append('city', cityFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const res = await fetch(`/api/extra-expenses?${params.toString()}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      const expensesData = Array.isArray(data.data) ? data.data : [];
      setExpenses(expensesData);
    } catch (error) {
      console.error('Failed to fetch extra expenses:', error);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  function handleView(expense: ExtraExpense) {
    setSelectedExpense(expense);
    setViewModalOpen(true);
  }

  function handleEdit(expense: ExtraExpense) {
    setSelectedExpense(expense);
    setEditModalOpen(true);
  }

  function handleDelete(expense: ExtraExpense) {
    setSelectedExpense(expense);
    setDeleteModalOpen(true);
  }

  function handleNewExpense() {
    setNewExpenseModalOpen(true);
  }

  function handleViewEdit() {
    setViewModalOpen(false);
    setEditModalOpen(true);
  }

  async function confirmDelete() {
    if (!selectedExpense) return;

    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/extra-expenses', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({ id: selectedExpense.id })
      });

      if (!res.ok) {
        throw new Error('Failed to archive extra expense');
      }

      setDeleteModalOpen(false);
      fetchExpenses();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to archive extra expense. Please try again.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // Get unique categories and cities for filters
  const categories = Array.from(new Set(allExpenses.map(e => e.expense_category))).sort();
  const cities = Array.from(new Set(allExpenses.map(e => e.city))).sort();

  const statusCounts = {
    all: allExpenses.length,
    active: allExpenses.filter(e => e.status === 'active').length,
    inactive: allExpenses.filter(e => e.status === 'inactive').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Extra Expenses</h1>
          <p className="text-gray-500 mt-1">Manage extra expenses and costs</p>
        </div>
        <button
          onClick={handleNewExpense}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
        >
          + New Extra Expense
        </button>
      </div>

      {/* Filters */}
      <ExtraExpenseFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        cityFilter={cityFilter}
        onCityFilterChange={setCityFilter}
        statusCounts={statusCounts}
        categories={categories}
        cities={cities}
      />

      {/* Results Summary */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold">{expenses.length}</span> of <span className="font-semibold">{allExpenses.length}</span> extra expenses
        </p>
      </div>

      {/* Extra Expenses Table */}
      <ExtraExpenseTable
        expenses={expenses}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={fetchExpenses}
      />

      {/* Modals */}
      <ViewExtraExpenseModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        onEdit={handleViewEdit}
        expense={selectedExpense}
      />

      <EditExtraExpenseModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchExpenses}
        expense={selectedExpense}
      />

      <NewExtraExpenseModal
        isOpen={newExpenseModalOpen}
        onClose={() => setNewExpenseModalOpen(false)}
        onSuccess={fetchExpenses}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Archive Extra Expense"
        message="Are you sure you want to archive"
        itemName={selectedExpense?.expense_name || ''}
        isDeleting={deleteSubmitting}
      />
    </div>
  );
}
