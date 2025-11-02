'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PaymentModal from '@/components/PaymentModal';

interface Invoice {
  id: number;
  invoice_number: string;
  booking_id: number;
  quote_number: string;
  provider_name?: string;
  customer_name?: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  created_at: string;
}

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<'payable' | 'receivable'>('payable');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInvoices();
    // Reset filters when tab changes
    setStatusFilter('all');
    setProviderFilter('all');
    setSearchTerm('');
  }, [activeTab]);

  useEffect(() => {
    applyFilters();
  }, [statusFilter, providerFilter, searchTerm, allInvoices]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${activeTab}`);
      const data = await res.json();
      const invoiceData = Array.isArray(data) ? data : [];
      setAllInvoices(invoiceData);
      setInvoices(invoiceData);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setAllInvoices([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...allInvoices];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    // Provider/Customer filter
    if (providerFilter !== 'all') {
      filtered = filtered.filter(inv => {
        const name = activeTab === 'payable' ? inv.provider_name : inv.customer_name;
        return name === providerFilter;
      });
    }

    // Search filter (invoice number or booking number)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(search) ||
        inv.quote_number?.toLowerCase().includes(search)
      );
    }

    setInvoices(filtered);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
  const totalOutstanding = totalAmount - totalPaid;

  // Get unique providers/customers for filter
  const uniqueProviders = Array.from(
    new Set(
      allInvoices.map(inv =>
        activeTab === 'payable' ? inv.provider_name : inv.customer_name
      ).filter(Boolean)
    )
  ).sort();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-500 mt-1">Manage payables and receivables</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('payable')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'payable'
              ? 'bg-red-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          💸 Payables (What We Owe)
        </button>
        <button
          onClick={() => setActiveTab('receivable')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'receivable'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          💰 Receivables (What They Owe)
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Invoice/Booking
            </label>
            <input
              type="text"
              placeholder="Search invoice or booking number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Provider/Customer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {activeTab === 'payable' ? 'Filter by Provider/Supplier' : 'Filter by Customer'}
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All {activeTab === 'payable' ? 'Providers' : 'Customers'}</option>
              {uniqueProviders.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Active Filters Info */}
        {(statusFilter !== 'all' || providerFilter !== 'all' || searchTerm) && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-600">Active filters:</span>
            {searchTerm && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                Search: "{searchTerm}"
              </span>
            )}
            {providerFilter !== 'all' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {activeTab === 'payable' ? 'Provider' : 'Customer'}: {providerFilter}
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                Status: {statusFilter}
              </span>
            )}
            <button
              onClick={() => {
                setStatusFilter('all');
                setProviderFilter('all');
                setSearchTerm('');
              }}
              className="ml-auto text-red-600 hover:text-red-700 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Total Invoices</div>
          <div className="text-3xl font-bold text-gray-900">{invoices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Total Amount</div>
          <div className={`text-3xl font-bold ${activeTab === 'payable' ? 'text-red-600' : 'text-green-600'}`}>
            €{totalAmount.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Paid</div>
          <div className="text-3xl font-bold text-blue-600">
            €{totalPaid.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm text-gray-500 mb-1">Outstanding</div>
          <div className="text-3xl font-bold text-orange-600">
            €{totalOutstanding.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Generate Invoices Button */}
      <div className="mb-6">
        <Link
          href="/invoices/generate"
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm inline-block"
        >
          ⚡ Generate Invoices from Bookings
        </Link>
      </div>

      {/* Results Summary */}
      {!loading && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold">{invoices.length}</span> of <span className="font-semibold">{allInvoices.length}</span> invoices
          </p>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 mb-4">
              No {activeTab === 'payable' ? 'payable' : 'receivable'} invoices yet
            </div>
            <Link
              href="/invoices/generate"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Generate invoices from bookings →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Invoice #</th>
                <th className="text-left p-4 font-semibold text-gray-700">
                  {activeTab === 'payable' ? 'Provider' : 'Customer'}
                </th>
                <th className="text-left p-4 font-semibold text-gray-700">Booking #</th>
                <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                <th className="text-left p-4 font-semibold text-gray-700">Due Date</th>
                <th className="text-left p-4 font-semibold text-gray-700">Amount</th>
                <th className="text-left p-4 font-semibold text-gray-700">Paid</th>
                <th className="text-left p-4 font-semibold text-gray-700">Outstanding</th>
                <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-primary-600">
                    {invoice.invoice_number || `INV-${invoice.id}`}
                  </td>
                  <td className="p-4">
                    {activeTab === 'payable' ? invoice.provider_name : invoice.customer_name}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/quotations/${invoice.booking_id}/view`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {invoice.quote_number}
                    </Link>
                  </td>
                  <td className="p-4 text-sm">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-sm">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4 font-bold">
                    €{Number(invoice.total_amount).toFixed(2)}
                  </td>
                  <td className="p-4 text-green-600">
                    €{Number(invoice.paid_amount).toFixed(2)}
                  </td>
                  <td className="p-4 text-orange-600 font-medium">
                    €{(Number(invoice.total_amount) - Number(invoice.paid_amount)).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/invoices/${activeTab}/${invoice.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View
                      </Link>
                      {invoice.status !== 'paid' && (
                        <>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowPaymentModal(true);
                            }}
                            className="text-green-600 hover:text-green-700 font-medium"
                          >
                            💰 Pay
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment Modal */}
      {selectedInvoice && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          type={activeTab}
          onSuccess={() => {
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}
