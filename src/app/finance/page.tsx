'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Supplier {
  provider_id: number;
  provider_name: string;
  provider_type: string;
  contact_email: string;
  contact_phone: string;
  invoice_count: number;
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  last_payment_date: string | null;
  overdue_count: number;
  pending_count: number;
  paid_count: number;
}

interface Customer {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  invoice_count: number;
  booking_count: number;
  total_invoiced: number;
  total_received: number;
  outstanding: number;
  last_payment_date: string | null;
  overdue_count: number;
  partial_count: number;
  paid_count: number;
}

interface Summary {
  receivables: any;
  payables: any;
  receivablesAging: any;
  payablesAging: any;
  topSuppliers: any[];
  topCustomers: any[];
  netPosition: number;
  totalTurnover: number;
  totalCosts: number;
  netMargin: number;
  marginPercentage: number;
}

export default function FinancePage() {
  const { organizationId } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'suppliers' | 'customers'>('dashboard');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await fetch('/api/finance/summary', {
          headers: {
            'X-Tenant-Id': organizationId
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        } else {
          console.error('Failed to fetch summary');
          setSummary(null);
        }
      } else if (activeTab === 'suppliers') {
        const res = await fetch('/api/finance/suppliers?limit=1000', {
          headers: {
            'X-Tenant-Id': organizationId
          }
        });
        const data = await res.json();
        setSuppliers(Array.isArray(data.data) ? data.data : []);
      } else if (activeTab === 'customers') {
        const res = await fetch('/api/finance/customers?limit=1000', {
          headers: {
            'X-Tenant-Id': organizationId
          }
        });
        const data = await res.json();
        setCustomers(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">💰 Finance</h1>
        <p className="text-gray-500 mt-1">Track payments, suppliers, and customer accounts</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'suppliers'
              ? 'bg-red-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          🏢 Suppliers (We Owe)
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
            activeTab === 'customers'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          👥 Customers (They Owe)
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          {activeTab === 'dashboard' && summary && <DashboardTab summary={summary} />}
          {activeTab === 'suppliers' && <SuppliersTab suppliers={suppliers} />}
          {activeTab === 'customers' && <CustomersTab customers={customers} />}
        </>
      )}
    </div>
  );
}

function DashboardTab({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-6">
      {/* Business Performance Metrics */}
      <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary-600">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Business Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Total Turnover (Revenue)</div>
            <div className="text-2xl font-bold text-primary-600">
              €{((summary.totalTurnover?.amount_minor || 0) / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">All customer invoices</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Total Costs</div>
            <div className="text-2xl font-bold text-orange-600">
              €{((summary.totalCosts?.amount_minor || 0) / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">All supplier invoices</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Net Margin (Profit)</div>
            <div className={`text-2xl font-bold ${(summary.netMargin?.amount_minor || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{((summary.netMargin?.amount_minor || 0) / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Turnover - Costs</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Margin %</div>
            <div className={`text-2xl font-bold ${summary.marginPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(summary.marginPercentage || 0).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Profit margin</div>
          </div>
        </div>
      </div>

      {/* Outstanding Payments Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm p-6 border border-green-200">
          <div className="text-sm text-green-700 font-medium mb-1">💰 Receivables (They Owe Us)</div>
          <div className="text-3xl font-bold text-green-900">
            €{((summary?.receivables?.total_outstanding?.amount_minor || 0) / 100).toFixed(2)}
          </div>
          <div className="text-xs text-green-600 mt-2">
            {summary?.receivables?.overdue_count || 0} overdue invoices
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-sm p-6 border border-red-200">
          <div className="text-sm text-red-700 font-medium mb-1">💸 Payables (We Owe Them)</div>
          <div className="text-3xl font-bold text-red-900">
            €{((summary?.payables?.total_outstanding?.amount_minor || 0) / 100).toFixed(2)}
          </div>
          <div className="text-xs text-red-600 mt-2">
            {summary?.payables?.overdue_count || 0} overdue invoices
          </div>
        </div>

        <div className={`bg-gradient-to-br ${(summary.netPosition?.amount_minor || 0) >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'} rounded-lg shadow-sm p-6 border`}>
          <div className={`text-sm ${(summary.netPosition?.amount_minor || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'} font-medium mb-1`}>
            ⚖️ Net Position
          </div>
          <div className={`text-3xl font-bold ${(summary.netPosition?.amount_minor || 0) >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
            €{(Math.abs(summary.netPosition?.amount_minor || 0) / 100).toFixed(2)}
          </div>
          <div className={`text-xs ${(summary.netPosition?.amount_minor || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'} mt-2`}>
            {(summary.netPosition?.amount_minor || 0) >= 0 ? 'Net receivable' : 'Net payable'}
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Receivables Aging */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Receivables Aging</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">0-30 days</span>
              <span className="font-bold text-gray-900">
                €{((summary?.receivablesAging?.aging_0_30?.amount_minor || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">31-60 days</span>
              <span className="font-bold text-yellow-600">
                €{((summary?.receivablesAging?.aging_31_60?.amount_minor || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">60+ days (Overdue)</span>
              <span className="font-bold text-red-600">
                €{((summary?.receivablesAging?.aging_60_plus?.amount_minor || 0) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payables Aging */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Payables Aging</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">0-30 days</span>
              <span className="font-bold text-gray-900">
                €{((summary?.payablesAging?.aging_0_30?.amount_minor || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">31-60 days</span>
              <span className="font-bold text-yellow-600">
                €{((summary?.payablesAging?.aging_31_60?.amount_minor || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">60+ days (Overdue)</span>
              <span className="font-bold text-red-600">
                €{((summary?.payablesAging?.aging_60_plus?.amount_minor || 0) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Suppliers We Owe */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🏢 Top 5 Suppliers We Owe</h3>
          {!summary?.topSuppliers || summary.topSuppliers.length === 0 ? (
            <p className="text-sm text-gray-500">No outstanding supplier payments</p>
          ) : (
            <div className="space-y-3">
              {summary.topSuppliers.map((supplier, idx) => (
                <div key={idx} className="flex justify-between items-center pb-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700 font-medium">{supplier.provider_name}</span>
                  <span className="font-bold text-red-600">
                    €{((supplier.outstanding?.amount_minor || 0) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Customers Who Owe Us */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Top 5 Customers Who Owe Us</h3>
          {!summary?.topCustomers || summary.topCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No outstanding customer payments</p>
          ) : (
            <div className="space-y-3">
              {summary.topCustomers.map((customer, idx) => (
                <div key={idx} className="flex justify-between items-center pb-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700 font-medium">{customer.customer_name}</span>
                  <span className="font-bold text-green-600">
                    €{((customer.outstanding?.amount_minor || 0) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuppliersTab({ suppliers }: { suppliers: Supplier[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {suppliers.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No supplier financial data yet</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">ID</th>
              <th className="text-left p-4 font-semibold text-gray-700">Supplier Name</th>
              <th className="text-left p-4 font-semibold text-gray-700">Type</th>
              <th className="text-left p-4 font-semibold text-gray-700">Contact</th>
              <th className="text-right p-4 font-semibold text-gray-700">Invoices</th>
              <th className="text-right p-4 font-semibold text-gray-700">Total Invoiced</th>
              <th className="text-right p-4 font-semibold text-gray-700">Paid</th>
              <th className="text-right p-4 font-semibold text-gray-700">Outstanding</th>
              <th className="text-left p-4 font-semibold text-gray-700">Status</th>
              <th className="text-left p-4 font-semibold text-gray-700">Last Payment</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.provider_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 text-sm font-mono text-gray-600">#{supplier.provider_id}</td>
                <td className="p-4 font-medium text-gray-900">{supplier.provider_name}</td>
                <td className="p-4 text-sm text-gray-600 capitalize">{supplier.provider_type}</td>
                <td className="p-4 text-sm text-gray-600">
                  <div>{supplier.contact_email}</div>
                  <div className="text-xs text-gray-500">{supplier.contact_phone}</div>
                </td>
                <td className="p-4 text-right text-sm">
                  <div className="text-gray-900 font-medium">{supplier.invoice_count}</div>
                  <div className="text-xs text-gray-500">
                    {supplier.paid_count}✓ {supplier.pending_count}⏳ {supplier.overdue_count}⚠️
                  </div>
                </td>
                <td className="p-4 text-right font-bold text-gray-900">
                  €{((supplier.total_invoiced?.amount_minor || 0) / 100).toFixed(2)}
                </td>
                <td className="p-4 text-right text-green-600">
                  €{((supplier.total_paid?.amount_minor || 0) / 100).toFixed(2)}
                </td>
                <td className="p-4 text-right font-bold text-red-600">
                  €{((supplier.outstanding?.amount_minor || 0) / 100).toFixed(2)}
                </td>
                <td className="p-4">
                  {(supplier.outstanding?.amount_minor || 0) > 0 ? (
                    supplier.overdue_count > 0 ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        {supplier.overdue_count} Overdue
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        Pending
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      Paid
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-gray-600">
                  {supplier.last_payment_date
                    ? new Date(supplier.last_payment_date).toLocaleDateString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CustomersTab({ customers }: { customers: Customer[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {customers.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No customer financial data yet</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">Customer Name</th>
              <th className="text-left p-4 font-semibold text-gray-700">Contact</th>
              <th className="text-right p-4 font-semibold text-gray-700">Bookings</th>
              <th className="text-right p-4 font-semibold text-gray-700">Invoices</th>
              <th className="text-right p-4 font-semibold text-gray-700">Total Invoiced</th>
              <th className="text-right p-4 font-semibold text-gray-700">Received</th>
              <th className="text-right p-4 font-semibold text-gray-700">Outstanding</th>
              <th className="text-left p-4 font-semibold text-gray-700">Status</th>
              <th className="text-left p-4 font-semibold text-gray-700">Last Payment</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 font-medium text-gray-900">{customer.customer_name}</td>
                <td className="p-4 text-sm text-gray-600">
                  <div>{customer.customer_email}</div>
                  <div className="text-xs text-gray-500">{customer.customer_phone}</div>
                </td>
                <td className="p-4 text-right text-sm text-gray-900">{customer.booking_count}</td>
                <td className="p-4 text-right text-sm">
                  <div className="text-gray-900 font-medium">{customer.invoice_count}</div>
                  <div className="text-xs text-gray-500">
                    {customer.paid_count}✓ {customer.partial_count}⏳ {customer.overdue_count}⚠️
                  </div>
                </td>
                <td className="p-4 text-right font-bold text-gray-900">
                  €{((customer.total_invoiced?.amount_minor || 0) / 100).toFixed(2)}
                </td>
                <td className="p-4 text-right text-green-600">
                  €{((customer.total_received?.amount_minor || 0) / 100).toFixed(2)}
                </td>
                <td className="p-4 text-right font-bold text-orange-600">
                  €{((customer.outstanding?.amount_minor || 0) / 100).toFixed(2)}
                </td>
                <td className="p-4">
                  {(customer.outstanding?.amount_minor || 0) > 0 ? (
                    customer.overdue_count > 0 ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        {customer.overdue_count} Overdue
                      </span>
                    ) : customer.partial_count > 0 ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        Partial
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        Pending
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      Paid
                    </span>
                  )}
                </td>
                <td className="p-4 text-sm text-gray-600">
                  {customer.last_payment_date
                    ? new Date(customer.last_payment_date).toLocaleDateString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
