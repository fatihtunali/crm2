import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PricingRecord {
  id: number;
  tour_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  sic_price_2_pax: number | null;
  sic_price_4_pax: number | null;
  sic_price_6_pax: number | null;
  sic_price_8_pax: number | null;
  sic_price_10_pax: number | null;
  pvt_price_2_pax: number | null;
  pvt_price_4_pax: number | null;
  pvt_price_6_pax: number | null;
  pvt_price_8_pax: number | null;
  pvt_price_10_pax: number | null;
  sic_provider_id: number | null;
  pvt_provider_id: number | null;
  notes: string | null;
  status: string;
}

interface Provider {
  id: number;
  provider_name: string;
  provider_type: string;
  provider_types?: string[] | string;
}

interface ManagePricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourId: number;
  tourName: string;
}

export default function ManagePricingModal({ isOpen, onClose, tourId, tourName }: ManagePricingModalProps) {
  const { organizationId } = useAuth();
  const [pricingRecords, setPricingRecords] = useState<PricingRecord[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const [formData, setFormData] = useState({
    season_name: '',
    start_date: '',
    end_date: '',
    currency: 'EUR',
    sic_price_2_pax: '',
    sic_price_4_pax: '',
    sic_price_6_pax: '',
    sic_price_8_pax: '',
    sic_price_10_pax: '',
    pvt_price_2_pax: '',
    pvt_price_4_pax: '',
    pvt_price_6_pax: '',
    pvt_price_8_pax: '',
    pvt_price_10_pax: '',
    sic_provider_id: null as number | null,
    pvt_provider_id: null as number | null,
    notes: ''
  });

  useEffect(() => {
    if (isOpen && tourId) {
      fetchPricing();
      fetchProviders();
    }
  }, [isOpen, tourId]);

  async function fetchPricing() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tour-pricing?tour_id=${tourId}&limit=1000`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });

      if (!res.ok) {
        console.error('Failed to fetch pricing:', res.status);
        setPricingRecords([]);
        return;
      }

      const response = await res.json();

      // Handle paged response with Money objects
      const records = Array.isArray(response.data) ? response.data : [];

      // Convert Money objects to simple numbers
      const converted = records.map((record: any) => ({
        ...record,
        sic_price_2_pax: record.sic_price_2_pax?.amount_minor ? record.sic_price_2_pax.amount_minor / 100 : null,
        sic_price_4_pax: record.sic_price_4_pax?.amount_minor ? record.sic_price_4_pax.amount_minor / 100 : null,
        sic_price_6_pax: record.sic_price_6_pax?.amount_minor ? record.sic_price_6_pax.amount_minor / 100 : null,
        sic_price_8_pax: record.sic_price_8_pax?.amount_minor ? record.sic_price_8_pax.amount_minor / 100 : null,
        sic_price_10_pax: record.sic_price_10_pax?.amount_minor ? record.sic_price_10_pax.amount_minor / 100 : null,
        pvt_price_2_pax: record.pvt_price_2_pax?.amount_minor ? record.pvt_price_2_pax.amount_minor / 100 : null,
        pvt_price_4_pax: record.pvt_price_4_pax?.amount_minor ? record.pvt_price_4_pax.amount_minor / 100 : null,
        pvt_price_6_pax: record.pvt_price_6_pax?.amount_minor ? record.pvt_price_6_pax.amount_minor / 100 : null,
        pvt_price_8_pax: record.pvt_price_8_pax?.amount_minor ? record.pvt_price_8_pax.amount_minor / 100 : null,
        pvt_price_10_pax: record.pvt_price_10_pax?.amount_minor ? record.pvt_price_10_pax.amount_minor / 100 : null,
        currency: record.sic_price_2_pax?.currency || 'EUR'
      }));

      setPricingRecords(converted);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
      setPricingRecords([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProviders() {
    try {
      // Fetch tour operators for SIC/PVT pricing
      const res = await fetch('/api/providers?provider_type=tour_operator&limit=1000', {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();
      setProviders(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviders([]);
    }
  }

  function startEdit(record: PricingRecord) {
    setEditingId(record.id);
    setFormData({
      season_name: record.season_name,
      start_date: new Date(record.start_date).toISOString().split('T')[0],
      end_date: new Date(record.end_date).toISOString().split('T')[0],
      currency: record.currency,
      sic_price_2_pax: record.sic_price_2_pax?.toString() || '',
      sic_price_4_pax: record.sic_price_4_pax?.toString() || '',
      sic_price_6_pax: record.sic_price_6_pax?.toString() || '',
      sic_price_8_pax: record.sic_price_8_pax?.toString() || '',
      sic_price_10_pax: record.sic_price_10_pax?.toString() || '',
      pvt_price_2_pax: record.pvt_price_2_pax?.toString() || '',
      pvt_price_4_pax: record.pvt_price_4_pax?.toString() || '',
      pvt_price_6_pax: record.pvt_price_6_pax?.toString() || '',
      pvt_price_8_pax: record.pvt_price_8_pax?.toString() || '',
      pvt_price_10_pax: record.pvt_price_10_pax?.toString() || '',
      sic_provider_id: record.sic_provider_id,
      pvt_provider_id: record.pvt_provider_id,
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
      sic_price_2_pax: '',
      sic_price_4_pax: '',
      sic_price_6_pax: '',
      sic_price_8_pax: '',
      sic_price_10_pax: '',
      pvt_price_2_pax: '',
      pvt_price_4_pax: '',
      pvt_price_6_pax: '',
      pvt_price_8_pax: '',
      pvt_price_10_pax: '',
      sic_provider_id: null,
      pvt_provider_id: null,
      notes: ''
    });
    setShowNewForm(true);
  }

  async function handleSave() {
    try {
      const payload = {
        ...formData,
        sic_price_2_pax: formData.sic_price_2_pax ? parseFloat(formData.sic_price_2_pax) : null,
        sic_price_4_pax: formData.sic_price_4_pax ? parseFloat(formData.sic_price_4_pax) : null,
        sic_price_6_pax: formData.sic_price_6_pax ? parseFloat(formData.sic_price_6_pax) : null,
        sic_price_8_pax: formData.sic_price_8_pax ? parseFloat(formData.sic_price_8_pax) : null,
        sic_price_10_pax: formData.sic_price_10_pax ? parseFloat(formData.sic_price_10_pax) : null,
        pvt_price_2_pax: formData.pvt_price_2_pax ? parseFloat(formData.pvt_price_2_pax) : null,
        pvt_price_4_pax: formData.pvt_price_4_pax ? parseFloat(formData.pvt_price_4_pax) : null,
        pvt_price_6_pax: formData.pvt_price_6_pax ? parseFloat(formData.pvt_price_6_pax) : null,
        pvt_price_8_pax: formData.pvt_price_8_pax ? parseFloat(formData.pvt_price_8_pax) : null,
        pvt_price_10_pax: formData.pvt_price_10_pax ? parseFloat(formData.pvt_price_10_pax) : null,
        sic_provider_id: formData.sic_provider_id,
        pvt_provider_id: formData.pvt_provider_id,
      };

      if (editingId) {
        await fetch('/api/tour-pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload, status: 'active' })
        });
      } else {
        await fetch('/api/tour-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tour_id: tourId, ...payload })
        });
      }

      setEditingId(null);
      setShowNewForm(false);
      fetchPricing();
    } catch (error) {
      console.error('Failed to save pricing:', error);
      alert('Failed to save pricing');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this pricing record?')) return;

    try {
      await fetch('/api/tour-pricing', {
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
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Pricing</h2>
            <p className="text-sm text-gray-600">{tourName}</p>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                {/* SIC Pricing */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">SIC Pricing (per person)</h4>

                  {/* SIC Provider */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">SIC Tour Operator</label>
                    <select
                      value={formData.sic_provider_id || ''}
                      onChange={(e) => setFormData({...formData, sic_provider_id: e.target.value ? parseInt(e.target.value) : null})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Not assigned</option>
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.provider_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {['2', '4', '6', '8', '10'].map(pax => (
                      <div key={pax} className="flex items-center gap-2">
                        <label className="w-16 text-sm">{pax} PAX:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData[`sic_price_${pax}_pax` as keyof typeof formData] || ''}
                          onChange={(e) => setFormData({...formData, [`sic_price_${pax}_pax`]: e.target.value})}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Private Pricing */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Private Pricing (per person)</h4>

                  {/* PVT Provider */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">PVT Tour Operator</label>
                    <select
                      value={formData.pvt_provider_id || ''}
                      onChange={(e) => setFormData({...formData, pvt_provider_id: e.target.value ? parseInt(e.target.value) : null})}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Not assigned</option>
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.provider_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {['2', '4', '6', '8', '10'].map(pax => (
                      <div key={pax} className="flex items-center gap-2">
                        <label className="w-16 text-sm">{pax} PAX:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData[`pvt_price_${pax}_pax` as keyof typeof formData] || ''}
                          onChange={(e) => setFormData({...formData, [`pvt_price_${pax}_pax`]: e.target.value})}
                          className="flex-1 px-3 py-1 border border-gray-300 rounded"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>
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
                    {/* SIC Prices */}
                    <div>
                      <p className="font-medium text-gray-700 mb-1">SIC Pricing ({record.currency})</p>
                      {record.sic_provider_id && (
                        <p className="text-xs text-blue-600 mb-2">
                          Operator: {providers.find(p => p.id === record.sic_provider_id)?.provider_name || 'Unknown'}
                        </p>
                      )}
                      <div className="space-y-1 text-gray-600">
                        {record.sic_price_2_pax && <p>2 PAX: {record.currency} {parseFloat(record.sic_price_2_pax.toString()).toFixed(2)}</p>}
                        {record.sic_price_4_pax && <p>4 PAX: {record.currency} {parseFloat(record.sic_price_4_pax.toString()).toFixed(2)}</p>}
                        {record.sic_price_6_pax && <p>6 PAX: {record.currency} {parseFloat(record.sic_price_6_pax.toString()).toFixed(2)}</p>}
                        {record.sic_price_8_pax && <p>8 PAX: {record.currency} {parseFloat(record.sic_price_8_pax.toString()).toFixed(2)}</p>}
                        {record.sic_price_10_pax && <p>10 PAX: {record.currency} {parseFloat(record.sic_price_10_pax.toString()).toFixed(2)}</p>}
                      </div>
                    </div>

                    {/* Private Prices */}
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Private Pricing ({record.currency})</p>
                      {record.pvt_provider_id && (
                        <p className="text-xs text-blue-600 mb-2">
                          Operator: {providers.find(p => p.id === record.pvt_provider_id)?.provider_name || 'Unknown'}
                        </p>
                      )}
                      <div className="space-y-1 text-gray-600">
                        {record.pvt_price_2_pax && <p>2 PAX: {record.currency} {parseFloat(record.pvt_price_2_pax.toString()).toFixed(2)}</p>}
                        {record.pvt_price_4_pax && <p>4 PAX: {record.currency} {parseFloat(record.pvt_price_4_pax.toString()).toFixed(2)}</p>}
                        {record.pvt_price_6_pax && <p>6 PAX: {record.currency} {parseFloat(record.pvt_price_6_pax.toString()).toFixed(2)}</p>}
                        {record.pvt_price_8_pax && <p>8 PAX: {record.currency} {parseFloat(record.pvt_price_8_pax.toString()).toFixed(2)}</p>}
                        {record.pvt_price_10_pax && <p>10 PAX: {record.currency} {parseFloat(record.pvt_price_10_pax.toString()).toFixed(2)}</p>}
                      </div>
                    </div>
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
