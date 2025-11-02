'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  supplier_invoice_number?: string;
  booking_id: number;
  quote_number: string;
  provider_id: number;
  provider_name: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  items: InvoiceItem[];
  currency?: string;
  original_amount?: number;
  exchange_rate?: number;
  exchange_rate_date?: string;
}

export default function PayableInvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSupplierNumber, setEditingSupplierNumber] = useState(false);
  const [supplierNumber, setSupplierNumber] = useState('');
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [currencyData, setCurrencyData] = useState({
    currency: 'EUR',
    original_amount: '',
    exchange_rate: '',
    exchange_rate_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchInvoice();
  }, []);

  async function fetchInvoice() {
    try {
      const res = await fetch(`/api/invoices/payable/${resolvedParams.id}`);
      const data = await res.json();
      setInvoice(data);
      setSupplierNumber(data.supplier_invoice_number || '');
      setCurrencyData({
        currency: data.currency || 'EUR',
        original_amount: data.original_amount ? String(data.original_amount) : String(data.total_amount),
        exchange_rate: data.exchange_rate ? String(data.exchange_rate) : '',
        exchange_rate_date: data.exchange_rate_date || new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSupplierNumber() {
    try {
      const res = await fetch(`/api/invoices/payable/${resolvedParams.id}/supplier-number`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_invoice_number: supplierNumber })
      });

      if (res.ok) {
        setEditingSupplierNumber(false);
        fetchInvoice(); // Refresh
      }
    } catch (error) {
      console.error('Failed to update supplier invoice number:', error);
    }
  }

  async function saveCurrency() {
    try {
      const res = await fetch(`/api/invoices/payable/${resolvedParams.id}/currency`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currencyData)
      });

      if (res.ok) {
        setEditingCurrency(false);
        fetchInvoice(); // Refresh
      }
    } catch (error) {
      console.error('Failed to update currency:', error);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'pending': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center">Invoice not found</div>;
  }

  const outstanding = Number(invoice.total_amount) - Number(invoice.paid_amount);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payable Invoice</h1>
          <p className="text-gray-500 mt-1">Invoice details and payment information</p>
        </div>
        <Link
          href="/invoices"
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Back to Invoices
        </Link>
      </div>

      {/* Invoice Details */}
      <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Invoice Information</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Our Invoice Number</div>
                <div className="font-semibold text-gray-900">{invoice.invoice_number}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Supplier Invoice Number</div>
                {editingSupplierNumber ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={supplierNumber}
                      onChange={(e) => setSupplierNumber(e.target.value)}
                      placeholder="Enter supplier invoice #"
                      className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <button
                      onClick={saveSupplierNumber}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingSupplierNumber(false);
                        setSupplierNumber(invoice.supplier_invoice_number || '');
                      }}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-gray-900">
                      {invoice.supplier_invoice_number || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                    <button
                      onClick={() => setEditingSupplierNumber(true)}
                      className="text-primary-600 hover:text-primary-700 text-sm"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-500">Booking Reference</div>
                <Link
                  href={`/quotations/${invoice.booking_id}/view`}
                  className="font-semibold text-primary-600 hover:text-primary-700"
                >
                  {invoice.quote_number}
                </Link>
              </div>
              <div>
                <div className="text-sm text-gray-500">Invoice Date</div>
                <div className="font-semibold text-gray-900">
                  {new Date(invoice.invoice_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Due Date</div>
                <div className="font-semibold text-gray-900">
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Provider Details</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Provider ID</div>
                <div className="font-mono text-sm font-semibold text-gray-900">#{invoice.provider_id}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Provider Name</div>
                <div className="font-semibold text-gray-900">{invoice.provider_name}</div>
              </div>
              {invoice.notes && (
                <div>
                  <div className="text-sm text-gray-500">Notes</div>
                  <div className="text-gray-700">{invoice.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Information */}
        {invoice.payment_date && (
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-500">Payment Date</div>
                <div className="font-semibold text-gray-900">
                  {new Date(invoice.payment_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Payment Method</div>
                <div className="font-semibold text-gray-900">{invoice.payment_method || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Payment Reference</div>
                <div className="font-semibold text-gray-900">{invoice.payment_reference || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="p-6 bg-gray-50 border-b">
          <h2 className="text-xl font-bold text-gray-900">Invoice Items</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">Description</th>
              <th className="text-right p-4 font-semibold text-gray-700">Quantity</th>
              <th className="text-right p-4 font-semibold text-gray-700">Unit Price</th>
              <th className="text-right p-4 font-semibold text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="p-4">{item.description}</td>
                <td className="p-4 text-right">{item.quantity}</td>
                <td className="p-4 text-right">€{Number(item.unit_price).toFixed(2)}</td>
                <td className="p-4 text-right font-semibold">€{Number(item.total_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Currency Information */}
      <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Currency Information</h2>
          {!editingCurrency && (
            <button
              onClick={() => setEditingCurrency(true)}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              ✏️ Edit Currency
            </button>
          )}
        </div>

        {editingCurrency ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={currencyData.currency}
                  onChange={(e) => setCurrencyData({ ...currencyData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="TRY">TRY (₺)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Original Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={currencyData.original_amount}
                  onChange={(e) => setCurrencyData({ ...currencyData, original_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {currencyData.currency !== 'EUR' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Exchange Rate (1 EUR = X {currencyData.currency})
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={currencyData.exchange_rate}
                    onChange={(e) => setCurrencyData({ ...currencyData, exchange_rate: e.target.value })}
                    placeholder="e.g., 35.50"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate Date</label>
                  <input
                    type="date"
                    value={currencyData.exchange_rate_date}
                    onChange={(e) => setCurrencyData({ ...currencyData, exchange_rate_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            )}

            {currencyData.currency !== 'EUR' && currencyData.exchange_rate && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-sm text-blue-800">
                  <strong>Calculation:</strong> {currencyData.original_amount} {currencyData.currency} ÷ {currencyData.exchange_rate} = €
                  {(Number(currencyData.original_amount) / Number(currencyData.exchange_rate)).toFixed(2)}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={saveCurrency}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              >
                Save Currency
              </button>
              <button
                onClick={() => {
                  setEditingCurrency(false);
                  setCurrencyData({
                    currency: invoice.currency || 'EUR',
                    original_amount: invoice.original_amount ? String(invoice.original_amount) : String(invoice.total_amount),
                    exchange_rate: invoice.exchange_rate ? String(invoice.exchange_rate) : '',
                    exchange_rate_date: invoice.exchange_rate_date || new Date().toISOString().split('T')[0]
                  });
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500">Currency</div>
              <div className="font-semibold text-gray-900">{invoice.currency || 'EUR'}</div>
            </div>
            {invoice.currency && invoice.currency !== 'EUR' && (
              <>
                <div>
                  <div className="text-sm text-gray-500">Original Amount</div>
                  <div className="font-semibold text-gray-900">
                    {invoice.currency === 'TRY' ? '₺' : '£'}
                    {Number(invoice.original_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Exchange Rate</div>
                  <div className="font-semibold text-gray-900">
                    1 EUR = {Number(invoice.exchange_rate || 0).toFixed(4)} {invoice.currency}
                    {invoice.exchange_rate_date && (
                      <div className="text-xs text-gray-500 mt-1">
                        ({new Date(invoice.exchange_rate_date).toLocaleDateString()})
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="max-w-md ml-auto space-y-4">
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Total Amount:</span>
            <span className="font-bold text-gray-900">€{Number(invoice.total_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Paid Amount:</span>
            <span className="font-bold text-green-600">€{Number(invoice.paid_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl border-t pt-4">
            <span className="font-bold text-gray-900">Outstanding:</span>
            <span className="font-bold text-red-600">€{outstanding.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
