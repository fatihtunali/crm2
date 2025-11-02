'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';

interface Invoice {
  id: number;
  invoice_number: string;
  booking_id: number;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}

export default function ReceivableInvoiceViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, []);

  async function fetchInvoice() {
    try {
      const res = await fetch(`/api/invoices/receivable/${resolvedParams.id}`);
      const data = await res.json();
      setInvoice(data);
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
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
          <h1 className="text-3xl font-bold text-gray-900">Receivable Invoice</h1>
          <p className="text-gray-500 mt-1">Customer invoice details</p>
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
                <div className="text-sm text-gray-500">Invoice Number</div>
                <div className="font-semibold text-gray-900">{invoice.invoice_number}</div>
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Details</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Customer Name</div>
                <div className="font-semibold text-gray-900">{invoice.customer_name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <div className="text-gray-700">{invoice.customer_email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Phone</div>
                <div className="text-gray-700">{invoice.customer_phone || '-'}</div>
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

      {/* Totals */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="max-w-md ml-auto space-y-4">
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-bold text-gray-900">€{Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Tax:</span>
            <span className="font-bold text-gray-900">€{Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl border-t pt-4">
            <span className="font-bold text-gray-900">Total Amount:</span>
            <span className="font-bold text-gray-900">€{Number(invoice.total_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">Paid Amount:</span>
            <span className="font-bold text-green-600">€{Number(invoice.paid_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl border-t pt-4">
            <span className="font-bold text-gray-900">Outstanding:</span>
            <span className="font-bold text-green-600">€{outstanding.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
