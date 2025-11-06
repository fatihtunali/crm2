import { useState, useEffect } from 'react';

interface PricingRecord {
  id: number;
  vehicle_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  price_per_day: number | null;
  price_half_day: number | null;
  notes: string | null;
  status: string;
}

interface ManagePricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: number;
  vehicleType: string;
}

export default function ManagePricingModal({ isOpen, onClose, vehicleId, vehicleType }: ManagePricingModalProps) {
  const [pricingRecords, setPricingRecords] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const [formData, setFormData] = useState({
    season_name: '',
    start_date: '',
    end_date: '',
    currency: 'EUR',
    price_per_day: '',
    price_half_day: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && vehicleId) {
      fetchPricing();
    }
  }, [isOpen, vehicleId]);

  async function fetchPricing() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicle-pricing?vehicle_id=${vehicleId}&status=active`);
      const data = await res.json();

      // API returns paginated response: { data: [...], total: X }
      // Convert Money format (amount_minor) to plain numbers
      const records = Array.isArray(data.data) ? data.data.map((record: any) => ({
        ...record,
        price_per_day: record.price_per_day?.amount_minor ? record.price_per_day.amount_minor / 100 : null,
        price_half_day: record.price_half_day?.amount_minor ? record.price_half_day.amount_minor / 100 : null,
        currency: record.price_per_day?.currency || record.currency || 'EUR'
      })) : [];

      setPricingRecords(records);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
      setPricingRecords([]);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(record: PricingRecord) {
    setEditingId(record.id);
    setFormData({
      season_name: record.season_name,
      start_date: new Date(record.start_date).toISOString().split('T')[0],
      end_date: new Date(record.end_date).toISOString().split('T')[0],
      currency: record.currency,
      price_per_day: record.price_per_day?.toString() || '',
      price_half_day: record.price_half_day?.toString() || '',
      notes: record.notes || ''
    });
    setShowNewForm(false);
  }

  function startNew() {
    setEditingId(null);
    setFormData({
      season_name: '',
      start_date: '',
      end_date: '',
      currency: 'EUR',
      price_per_day: '',
      price_half_day: '',
      notes: ''
    });
    setShowNewForm(true);
  }

  async function handleSave() {
    try {
      // Convert prices to Money format (amount_minor = cents)
      const toMoney = (value: string) => {
        const amount = parseFloat(value);
        return isNaN(amount) ? { amount_minor: 0, currency: formData.currency } : { amount_minor: Math.round(amount * 100), currency: formData.currency };
      };

      const payload = {
        season_name: formData.season_name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        currency: formData.currency,
        price_per_day: toMoney(formData.price_per_day),
        price_half_day: toMoney(formData.price_half_day),
        notes: formData.notes
      };

      if (editingId) {
        const res = await fetch('/api/vehicle-pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload, status: 'active' })
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to update pricing');
        }
      } else {
        const res = await fetch('/api/vehicle-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicle_id: vehicleId, ...payload })
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to create pricing');
        }
      }

      setEditingId(null);
      setShowNewForm(false);
      fetchPricing();
    } catch (error: any) {
      console.error('Failed to save pricing:', error);
      alert(error.message || 'Failed to save pricing');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this pricing record?')) return;

    try {
      await fetch('/api/vehicle-pricing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchPricing();
    } catch (error) {
      console.error('Failed to delete pricing:', error);
      alert('Failed to delete pricing');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Pricing</h2>
            <p className="text-sm text-gray-600">{vehicleType}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Add New Button */}
          {!showNewForm && !editingId && (
            <button
              onClick={startNew}
              className="mb-4 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
            >
              + Add New Pricing
            </button>
          )}

          {/* Form */}
          {(showNewForm || editingId) && (
            <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-4">{editingId ? 'Edit Pricing' : 'New Pricing'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Season Name *</label>
                  <input
                    type="text"
                    value={formData.season_name}
                    onChange={(e) => setFormData({...formData, season_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Winter 2025-26"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="TRY">TRY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_per_day}
                    onChange={(e) => setFormData({...formData, price_per_day: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Half Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_half_day}
                    onChange={(e) => setFormData({...formData, price_half_day: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditingId(null); setShowNewForm(false); }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Pricing Records List */}
          <div className="space-y-4">
            {loading ? (
              <p className="text-center text-gray-500">Loading...</p>
            ) : pricingRecords.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No pricing records yet. Click "Add New Pricing" to create one.</p>
            ) : (
              pricingRecords.map((record) => (
                <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{record.season_name}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(record.start_date).toLocaleDateString('en-GB')} - {new Date(record.end_date).toLocaleDateString('en-GB')}
                      </p>
                      <span className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                        record.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(record)}
                        className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {record.price_per_day && (
                      <div>
                        <p className="font-medium text-gray-700">Full Day Price</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {record.currency} {parseFloat(record.price_per_day.toString()).toFixed(2)}
                        </p>
                      </div>
                    )}
                    {record.price_half_day && (
                      <div>
                        <p className="font-medium text-gray-700">Half Day Price</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {record.currency} {parseFloat(record.price_half_day.toString()).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {record.notes && (
                    <p className="mt-2 text-sm text-gray-600 italic">{record.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
