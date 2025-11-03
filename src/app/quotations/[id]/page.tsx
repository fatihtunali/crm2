'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SupplierSearch from '@/components/SupplierSearch';

interface Expense {
  id?: number;
  category: string;
  hotel_category?: string;
  location?: string;
  description?: string;
  price: number;
  single_supplement?: number;
  child_0to2?: number;
  child_3to5?: number;
  child_6to11?: number;
  vehicle_count?: number;
  price_per_vehicle?: number;
}

interface Day {
  id?: number;
  day_number: number;
  date: string;
  expenses: Expense[];
}

interface Quotation {
  id: number;
  quote_number: string;
  quote_name: string;
  customer_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  tour_type: string;
  pax: number;
  adults: number;
  children: number;
  markup: number;
  tax: number;
  status: string;
  days: Day[];
}

const EXPENSE_CATEGORIES = [
  { value: 'hotelAccommodation', label: 'Hotel Accommodation' },
  { value: 'sicTourCost', label: 'SIC Tour Cost' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'entranceFees', label: 'Entrance Fees' },
  { value: 'parking', label: 'Parking' },
  { value: 'guide', label: 'Guide' },
  { value: 'meal', label: 'Meal' },
  { value: 'other', label: 'Other' }
];

const HOTEL_CATEGORIES = ['3 stars', '4 stars', '5 stars', 'Special Class', 'Boutique'];

export default function QuotationBuilderPage() {
  const { organizationId } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Supplier search modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchingForDay, setSearchingForDay] = useState<number | null>(null);
  const [searchingForExpense, setSearchingForExpense] = useState<number | null>(null);
  const [searchCategory, setSearchCategory] = useState('');

  useEffect(() => {
    fetchQuotation();
  }, [params.id]);

  async function fetchQuotation() {
    try {
      const res = await fetch(`/api/quotations/${params.id}`, {
        headers: {
          'X-Tenant-Id': organizationId
        }
      });
      const data = await res.json();

      // If no days exist, initialize with days based on start/end date
      if (!data.days || data.days.length === 0) {
        const days = generateDaysFromDates(data.start_date, data.end_date);
        data.days = days;
      }

      setQuotation(data);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
    } finally {
      setLoading(false);
    }
  }

  function generateDaysFromDates(startDate: string, endDate: string): Day[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days: Day[] = [];

    let currentDate = new Date(start);
    let dayNumber = 1;

    while (currentDate <= end) {
      days.push({
        day_number: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        expenses: []
      });
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
    }

    return days;
  }

  function addExpenseToDay(dayIndex: number) {
    if (!quotation) return;

    const newExpense: Expense = {
      category: 'hotelAccommodation',
      location: '',
      description: '',
      price: 0,
      single_supplement: 0,
      child_0to2: 0,
      child_3to5: 0,
      child_6to11: 0
    };

    const updatedDays = [...quotation.days];
    updatedDays[dayIndex].expenses.push(newExpense);
    setQuotation({ ...quotation, days: updatedDays });
  }

  function updateExpense(dayIndex: number, expenseIndex: number, field: string, value: any) {
    if (!quotation) return;

    const updatedDays = [...quotation.days];
    updatedDays[dayIndex].expenses[expenseIndex] = {
      ...updatedDays[dayIndex].expenses[expenseIndex],
      [field]: value
    };
    setQuotation({ ...quotation, days: updatedDays });
  }

  function removeExpense(dayIndex: number, expenseIndex: number) {
    if (!quotation) return;

    const updatedDays = [...quotation.days];
    updatedDays[dayIndex].expenses.splice(expenseIndex, 1);
    setQuotation({ ...quotation, days: updatedDays });
  }

  function openSupplierSearch(dayIndex: number, expenseIndex: number, category: string) {
    setSearchingForDay(dayIndex);
    setSearchingForExpense(expenseIndex);
    setSearchCategory(category);
    setSearchModalOpen(true);
  }

  function handleSupplierSelect(item: any) {
    if (!quotation || searchingForDay === null || searchingForExpense === null) return;

    const updatedDays = [...quotation.days];
    const expense = updatedDays[searchingForDay].expenses[searchingForExpense];

    // Auto-populate expense based on selected item
    expense.location = item.location || '';
    expense.description = item.name || '';
    expense.price = Number(item.price) || 0;

    if (item.single_supplement) expense.single_supplement = Number(item.single_supplement);
    if (item.child_0to2) expense.child_0to2 = Number(item.child_0to2);
    if (item.child_3to5) expense.child_3to5 = Number(item.child_3to5);
    if (item.child_6to11) expense.child_6to11 = Number(item.child_6to11);
    if (item.hotel_category) expense.hotel_category = item.hotel_category;

    setQuotation({ ...quotation, days: updatedDays });
  }

  async function saveQuotation() {
    if (!quotation) return;

    setSaving(true);
    try {
      // Save all days and expenses
      for (const day of quotation.days) {
        // Create or update day
        let dayId = day.id;

        if (!dayId) {
          const dayRes = await fetch(`/api/quotations/${params.id}/days`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': organizationId
            },
            body: JSON.stringify({
              day_number: day.day_number,
              date: day.date
            })
          });
          const dayData = await dayRes.json();
          dayId = dayData.id;
        }

        // Save expenses
        for (const expense of day.expenses) {
          if (expense.id) {
            // Update existing expense
            await fetch(`/api/quotations/${params.id}/expenses`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': organizationId
              },
              body: JSON.stringify({ ...expense, quote_day_id: dayId })
            });
          } else {
            // Create new expense
            await fetch(`/api/quotations/${params.id}/expenses`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': organizationId
              },
              body: JSON.stringify({ ...expense, quote_day_id: dayId })
            });
          }
        }
      }

      // Calculate total price
      const totalPrice = calculateTotalPrice();

      // Update quote with total
      await fetch('/api/quotations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': organizationId
        },
        body: JSON.stringify({
          id: quotation.id,
          total_price: totalPrice,
          status: quotation.status
        })
      });

      alert('Quotation saved successfully!');
      fetchQuotation();
    } catch (error) {
      console.error('Failed to save quotation:', error);
      alert('Failed to save quotation');
    } finally {
      setSaving(false);
    }
  }

  function calculateTotalPrice(): number {
    if (!quotation) return 0;

    let total = 0;

    quotation.days.forEach(day => {
      day.expenses.forEach(expense => {
        total += Number(expense.price) || 0;
      });
    });

    // Apply markup
    if (quotation.markup) {
      total += total * (quotation.markup / 100);
    }

    // Apply tax
    if (quotation.tax) {
      total += total * (quotation.tax / 100);
    }

    return total;
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!quotation) {
    return <div className="p-8 text-center">Quotation not found</div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">{quotation.quote_number}</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
              {quotation.status}
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            {quotation.customer_name} • {quotation.destination}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/quotations/${params.id}/itinerary`)}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 font-medium"
          >
            📋 View Itinerary
          </button>
          <button
            onClick={() => router.push('/quotations')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to List
          </button>
          <button
            onClick={saveQuotation}
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Quotation'}
          </button>
        </div>
      </div>

      {/* Quote Info Summary */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4 grid grid-cols-4 gap-4">
        <div>
          <div className="text-sm text-gray-500">Tour Type</div>
          <div className="font-medium">{quotation.tour_type}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">PAX</div>
          <div className="font-medium">{quotation.adults} Adults, {quotation.children} Children</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Markup / Tax</div>
          <div className="font-medium">{quotation.markup}% / {quotation.tax}%</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Total Price</div>
          <div className="font-medium text-primary-600 text-lg">€{calculateTotalPrice().toFixed(2)}</div>
        </div>
      </div>

      {/* Days and Expenses */}
      <div className="space-y-6">
        {quotation.days.map((day, dayIndex) => (
          <div key={dayIndex} className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Day Header */}
            <div className="bg-primary-50 px-6 py-4 border-b border-primary-100">
              <h3 className="text-lg font-semibold text-primary-900">
                Day {day.day_number} - {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
            </div>

            {/* Expenses */}
            <div className="p-6 space-y-3">
              {day.expenses.map((expense, expenseIndex) => (
                <div key={expenseIndex} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all">
                  {/* Category Selector */}
                  <div className="flex-shrink-0 w-40">
                    <select
                      value={expense.category}
                      onChange={(e) => updateExpense(dayIndex, expenseIndex, 'category', e.target.value)}
                      className="w-full px-2 py-1 text-xs font-medium bg-primary-50 text-primary-700 border-0 rounded focus:ring-1 focus:ring-primary-500"
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={expense.description || ''}
                      onChange={(e) => updateExpense(dayIndex, expenseIndex, 'description', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent"
                      placeholder="Description..."
                    />
                  </div>

                  {/* Location */}
                  <div className="w-32">
                    <input
                      type="text"
                      value={expense.location || ''}
                      onChange={(e) => updateExpense(dayIndex, expenseIndex, 'location', e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent"
                      placeholder="Location"
                    />
                  </div>

                  {/* Price */}
                  <div className="w-28 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-gray-400 text-sm">€</span>
                      <input
                        type="number"
                        value={expense.price}
                        onChange={(e) => updateExpense(dayIndex, expenseIndex, 'price', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 text-sm text-right font-medium border-0 border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:ring-0 bg-transparent"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openSupplierSearch(dayIndex, expenseIndex, expense.category)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="Browse Database"
                    >
                      📦
                    </button>
                    <button
                      onClick={() => removeExpense(dayIndex, expenseIndex)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Expense Button */}
              <button
                onClick={() => addExpenseToDay(dayIndex)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
              >
                + Add Expense to Day {day.day_number}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Supplier Search Modal */}
      {searchModalOpen && (
        <SupplierSearch
          category={searchCategory}
          location={quotation.days[searchingForDay || 0]?.expenses[searchingForExpense || 0]?.location}
          date={quotation.days[searchingForDay || 0]?.date}
          onSelect={handleSupplierSelect}
          onClose={() => setSearchModalOpen(false)}
        />
      )}
    </div>
  );
}
