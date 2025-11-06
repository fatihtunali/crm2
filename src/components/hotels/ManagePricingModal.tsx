import { useState, useEffect } from 'react';

interface PricingRecord {
  id: number;
  hotel_id: number;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  double_room_bb: number | null;
  single_supplement_bb: number | null;
  triple_room_bb: number | null;
  child_0_6_bb: number | null;
  child_6_12_bb: number | null;
  hb_supplement: number | null;
  fb_supplement: number | null;
  ai_supplement: number | null;
  base_meal_plan: string | null;
  notes: string | null;
  status: string;
}

interface ManagePricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelId: number;
  hotelName: string;
}

export default function ManagePricingModal({ isOpen, onClose, hotelId, hotelName }: ManagePricingModalProps) {
  const [pricingRecords, setPricingRecords] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const [formData, setFormData] = useState({
    season_name: '',
    start_date: '',
    end_date: '',
    currency: 'EUR',
    double_room_bb: '',
    single_supplement_bb: '',
    triple_room_bb: '',
    child_0_6_bb: '',
    child_6_12_bb: '',
    hb_supplement: '',
    fb_supplement: '',
    ai_supplement: '',
    base_meal_plan: 'BB',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && hotelId) {
      fetchPricing();
    }
  }, [isOpen, hotelId]);

  async function fetchPricing() {
    setLoading(true);
    try {
      const res = await fetch(`/api/hotel-pricing?hotel_id=${hotelId}&status=active`);
      const data = await res.json();

      // API returns paginated response: { data: [...], total: X }
      // Convert Money format (amount_minor) to plain numbers
      const records = Array.isArray(data.data) ? data.data.map((record: any) => ({
        ...record,
        double_room_bb: record.double_room_bb?.amount_minor ? record.double_room_bb.amount_minor / 100 : null,
        single_supplement_bb: record.single_supplement_bb?.amount_minor ? record.single_supplement_bb.amount_minor / 100 : null,
        triple_room_bb: record.triple_room_bb?.amount_minor ? record.triple_room_bb.amount_minor / 100 : null,
        child_0_6_bb: record.child_0_6_bb?.amount_minor ? record.child_0_6_bb.amount_minor / 100 : null,
        child_6_12_bb: record.child_6_12_bb?.amount_minor ? record.child_6_12_bb.amount_minor / 100 : null,
        hb_supplement: record.hb_supplement?.amount_minor ? record.hb_supplement.amount_minor / 100 : null,
        fb_supplement: record.fb_supplement?.amount_minor ? record.fb_supplement.amount_minor / 100 : null,
        ai_supplement: record.ai_supplement?.amount_minor ? record.ai_supplement.amount_minor / 100 : null,
        currency: record.double_room_bb?.currency || record.currency || 'EUR'
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
      double_room_bb: record.double_room_bb?.toString() || '',
      single_supplement_bb: record.single_supplement_bb?.toString() || '',
      triple_room_bb: record.triple_room_bb?.toString() || '',
      child_0_6_bb: record.child_0_6_bb?.toString() || '',
      child_6_12_bb: record.child_6_12_bb?.toString() || '',
      hb_supplement: record.hb_supplement?.toString() || '',
      fb_supplement: record.fb_supplement?.toString() || '',
      ai_supplement: record.ai_supplement?.toString() || '',
      base_meal_plan: record.base_meal_plan || 'BB',
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
      double_room_bb: '',
      single_supplement_bb: '',
      triple_room_bb: '',
      child_0_6_bb: '',
      child_6_12_bb: '',
      hb_supplement: '',
      fb_supplement: '',
      ai_supplement: '',
      base_meal_plan: 'BB',
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
        double_room_bb: toMoney(formData.double_room_bb),
        single_supplement_bb: toMoney(formData.single_supplement_bb),
        triple_room_bb: toMoney(formData.triple_room_bb),
        child_0_6_bb: toMoney(formData.child_0_6_bb),
        child_6_12_bb: toMoney(formData.child_6_12_bb),
        hb_supplement: toMoney(formData.hb_supplement),
        fb_supplement: toMoney(formData.fb_supplement),
        ai_supplement: toMoney(formData.ai_supplement),
        base_meal_plan: formData.base_meal_plan,
        notes: formData.notes
      };

      if (editingId) {
        const res = await fetch('/api/hotel-pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload, status: 'active' })
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to update pricing');
        }
      } else {
        const res = await fetch('/api/hotel-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hotel_id: hotelId, ...payload })
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
      await fetch('/api/hotel-pricing', {
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

  const formatMealPlan = (plan: string | null) => {
    if (!plan) return 'N/A';
    const plans: { [key: string]: string } = {
      'BB': 'Bed & Breakfast',
      'HB': 'Half Board',
      'FB': 'Full Board',
      'AI': 'All Inclusive'
    };
    return plans[plan] || plan;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Pricing</h2>
            <p className="text-sm text-gray-600">{hotelName}</p>
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
                {/* Room Pricing */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Room Pricing (per night)</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Double Room (BB):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.double_room_bb}
                        onChange={(e) => setFormData({...formData, double_room_bb: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Single Supplement:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.single_supplement_bb}
                        onChange={(e) => setFormData({...formData, single_supplement_bb: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Triple Room (BB):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.triple_room_bb}
                        onChange={(e) => setFormData({...formData, triple_room_bb: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Child & Supplements */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Child Pricing & Meal Supplements</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Child 0-6 (BB):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.child_0_6_bb}
                        onChange={(e) => setFormData({...formData, child_0_6_bb: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Child 6-12 (BB):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.child_6_12_bb}
                        onChange={(e) => setFormData({...formData, child_6_12_bb: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">HB Supplement:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.hb_supplement}
                        onChange={(e) => setFormData({...formData, hb_supplement: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">FB Supplement:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fb_supplement}
                        onChange={(e) => setFormData({...formData, fb_supplement: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">AI Supplement:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.ai_supplement}
                        onChange={(e) => setFormData({...formData, ai_supplement: e.target.value})}
                        className="w-full px-3 py-1 border border-gray-300 rounded"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Meal Plan *</label>
                  <select
                    value={formData.base_meal_plan}
                    onChange={(e) => setFormData({...formData, base_meal_plan: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="BB">Bed & Breakfast (BB)</option>
                    <option value="HB">Half Board (HB)</option>
                    <option value="FB">Full Board (FB)</option>
                    <option value="AI">All Inclusive (AI)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Any additional notes..."
                  />
                </div>
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
                      <p className="text-sm text-gray-600 mt-1">
                        Base: <span className="font-medium">{formatMealPlan(record.base_meal_plan)}</span>
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
                    {/* Room Prices */}
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Room Pricing ({record.currency})</p>
                      <div className="space-y-1 text-gray-600">
                        {record.double_room_bb && <p>Double Room (BB): {record.currency} {parseFloat(record.double_room_bb.toString()).toFixed(2)}</p>}
                        {record.single_supplement_bb && <p>Single Supplement: {record.currency} {parseFloat(record.single_supplement_bb.toString()).toFixed(2)}</p>}
                        {record.triple_room_bb && <p>Triple Room (BB): {record.currency} {parseFloat(record.triple_room_bb.toString()).toFixed(2)}</p>}
                      </div>
                    </div>

                    {/* Child & Supplements */}
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Child & Meal Supplements ({record.currency})</p>
                      <div className="space-y-1 text-gray-600">
                        {record.child_0_6_bb && <p>Child 0-6 (BB): {record.currency} {parseFloat(record.child_0_6_bb.toString()).toFixed(2)}</p>}
                        {record.child_6_12_bb && <p>Child 6-12 (BB): {record.currency} {parseFloat(record.child_6_12_bb.toString()).toFixed(2)}</p>}
                        {record.hb_supplement && <p>HB Supplement: {record.currency} {parseFloat(record.hb_supplement.toString()).toFixed(2)}</p>}
                        {record.fb_supplement && <p>FB Supplement: {record.currency} {parseFloat(record.fb_supplement.toString()).toFixed(2)}</p>}
                        {record.ai_supplement && <p>AI Supplement: {record.currency} {parseFloat(record.ai_supplement.toString()).toFixed(2)}</p>}
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
