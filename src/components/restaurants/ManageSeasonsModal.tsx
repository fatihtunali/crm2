import { useState, useEffect } from 'react';

interface SeasonRecord {
  id: number;
  organization_id: number;
  restaurant_name: string;
  city: string;
  meal_type: string;
  season_name: string;
  start_date: string;
  end_date: string;
  currency: string;
  adult_lunch_price: number | null;
  child_lunch_price: number | null;
  adult_dinner_price: number | null;
  child_dinner_price: number | null;
  menu_description: string | null;
  effective_from: string | null;
  created_by: string | null;
  notes: string | null;
  status: string;
}

interface ManageSeasonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName: string;
  restaurantId: number;
  onSuccess: () => void;
}

export default function ManageSeasonsModal({ isOpen, onClose, restaurantName, restaurantId, onSuccess }: ManageSeasonsModalProps) {
  const [seasonRecords, setSeasonRecords] = useState<SeasonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const [formData, setFormData] = useState({
    restaurant_name: restaurantName,
    city: '',
    meal_type: 'Both',
    season_name: '',
    start_date: '',
    end_date: '',
    currency: 'EUR',
    adult_lunch_price: '',
    child_lunch_price: '',
    adult_dinner_price: '',
    child_dinner_price: '',
    menu_description: '',
    effective_from: '',
    created_by: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && restaurantId) {
      fetchSeasons();
    }
  }, [isOpen, restaurantId]);

  async function fetchSeasons() {
    setLoading(true);
    try {
      const res = await fetch('/api/restaurants?status=active&limit=1000');
      const data = await res.json();

      // API returns paginated response: { data: [...], total: X }
      // Filter records for this restaurant
      const allRecords = Array.isArray(data.data) ? data.data : [];
      const filtered = allRecords.filter((r: SeasonRecord) => r.restaurant_name === restaurantName);

      setSeasonRecords(filtered);

      // Get the first record to populate city and meal_type for new records
      if (filtered.length > 0) {
        setFormData(prev => ({
          ...prev,
          restaurant_name: restaurantName,
          city: filtered[0].city,
          meal_type: filtered[0].meal_type
        }));
      }
    } catch (error) {
      console.error('Failed to fetch seasons:', error);
      setSeasonRecords([]);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(record: SeasonRecord) {
    setEditingId(record.id);
    setFormData({
      restaurant_name: record.restaurant_name,
      city: record.city,
      meal_type: record.meal_type,
      season_name: record.season_name,
      start_date: new Date(record.start_date).toISOString().split('T')[0],
      end_date: new Date(record.end_date).toISOString().split('T')[0],
      currency: record.currency,
      adult_lunch_price: record.adult_lunch_price?.toString() || '',
      child_lunch_price: record.child_lunch_price?.toString() || '',
      adult_dinner_price: record.adult_dinner_price?.toString() || '',
      child_dinner_price: record.child_dinner_price?.toString() || '',
      menu_description: record.menu_description || '',
      effective_from: record.effective_from ? new Date(record.effective_from).toISOString().split('T')[0] : '',
      created_by: record.created_by || '',
      notes: record.notes || ''
    });
    setShowNewForm(false);
  }

  function startNew() {
    setEditingId(null);
    // Keep restaurant_name, city, and meal_type from existing records
    const baseData = seasonRecords.length > 0 ? {
      restaurant_name: seasonRecords[0].restaurant_name,
      city: seasonRecords[0].city,
      meal_type: seasonRecords[0].meal_type,
      currency: seasonRecords[0].currency
    } : {
      restaurant_name: restaurantName,
      city: '',
      meal_type: 'Both',
      currency: 'EUR'
    };

    setFormData({
      ...baseData,
      season_name: '',
      start_date: '',
      end_date: '',
      adult_lunch_price: '',
      child_lunch_price: '',
      adult_dinner_price: '',
      child_dinner_price: '',
      menu_description: '',
      effective_from: '',
      created_by: '',
      notes: ''
    });
    setShowNewForm(true);
  }

  async function handleSave() {
    try {
      const payload = {
        organization_id: 1,
        restaurant_name: formData.restaurant_name,
        city: formData.city,
        meal_type: formData.meal_type,
        season_name: formData.season_name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        currency: formData.currency,
        adult_lunch_price: formData.adult_lunch_price ? parseFloat(formData.adult_lunch_price) : null,
        child_lunch_price: formData.child_lunch_price ? parseFloat(formData.child_lunch_price) : null,
        adult_dinner_price: formData.adult_dinner_price ? parseFloat(formData.adult_dinner_price) : null,
        child_dinner_price: formData.child_dinner_price ? parseFloat(formData.child_dinner_price) : null,
        menu_description: formData.menu_description || null,
        effective_from: formData.effective_from || null,
        created_by: formData.created_by || null,
        notes: formData.notes || null,
        status: 'active'
      };

      if (editingId) {
        await fetch('/api/restaurants', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload })
        });
      } else {
        await fetch('/api/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      setEditingId(null);
      setShowNewForm(false);
      fetchSeasons();
      onSuccess();
    } catch (error) {
      console.error('Failed to save season:', error);
      alert('Failed to save season');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this seasonal pricing record?')) return;

    try {
      await fetch('/api/restaurants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchSeasons();
      onSuccess();
    } catch (error) {
      console.error('Failed to delete season:', error);
      alert('Failed to delete season');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Seasonal Pricing</h2>
            <p className="text-sm text-gray-600">{restaurantName}</p>
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
              + Add New Season
            </button>
          )}

          {/* Form */}
          {(showNewForm || editingId) && (
            <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-4">{editingId ? 'Edit Season' : 'New Season'}</h3>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name *</label>
                  <input
                    type="text"
                    value={formData.restaurant_name}
                    onChange={(e) => setFormData({...formData, restaurant_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Istanbul"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type *</label>
                  <select
                    value={formData.meal_type}
                    onChange={(e) => setFormData({...formData, meal_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Lunch">Lunch</option>
                    <option value="Dinner">Dinner</option>
                    <option value="Both">Both</option>
                  </select>
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
              </div>

              {/* Season & Dates */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({...formData, effective_from: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adult Lunch Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.adult_lunch_price}
                    onChange={(e) => setFormData({...formData, adult_lunch_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Child Lunch Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.child_lunch_price}
                    onChange={(e) => setFormData({...formData, child_lunch_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adult Dinner Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.adult_dinner_price}
                    onChange={(e) => setFormData({...formData, adult_dinner_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Child Dinner Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.child_dinner_price}
                    onChange={(e) => setFormData({...formData, child_dinner_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Menu Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Description</label>
                <textarea
                  value={formData.menu_description}
                  onChange={(e) => setFormData({...formData, menu_description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Describe the menu..."
                />
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                  <input
                    type="text"
                    value={formData.created_by}
                    onChange={(e) => setFormData({...formData, created_by: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Your name"
                  />
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

          {/* Season Records List */}
          <div className="space-y-4">
            {loading ? (
              <p className="text-center text-gray-500">Loading...</p>
            ) : seasonRecords.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No seasonal pricing records yet. Click "Add New Season" to create one.</p>
            ) : (
              seasonRecords.map((record) => (
                <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{record.season_name}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(record.start_date).toLocaleDateString('en-GB')} - {new Date(record.end_date).toLocaleDateString('en-GB')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-600">{record.city}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600">{record.meal_type}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className={`inline-block px-2 py-1 text-xs rounded ${
                          record.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {record.status}
                        </span>
                      </div>
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

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {record.adult_lunch_price !== null && (
                      <div>
                        <p className="text-gray-600">Adult Lunch</p>
                        <p className="font-semibold text-gray-900">{record.currency} {parseFloat(record.adult_lunch_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                    {record.child_lunch_price !== null && (
                      <div>
                        <p className="text-gray-600">Child Lunch</p>
                        <p className="font-semibold text-gray-900">{record.currency} {parseFloat(record.child_lunch_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                    {record.adult_dinner_price !== null && (
                      <div>
                        <p className="text-gray-600">Adult Dinner</p>
                        <p className="font-semibold text-gray-900">{record.currency} {parseFloat(record.adult_dinner_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                    {record.child_dinner_price !== null && (
                      <div>
                        <p className="text-gray-600">Child Dinner</p>
                        <p className="font-semibold text-gray-900">{record.currency} {parseFloat(record.child_dinner_price.toString()).toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  {record.menu_description && (
                    <p className="mt-2 text-sm text-gray-600 italic border-t pt-2">{record.menu_description}</p>
                  )}
                  {record.notes && (
                    <p className="mt-1 text-sm text-gray-500">Note: {record.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
