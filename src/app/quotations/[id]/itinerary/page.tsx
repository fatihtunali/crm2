'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (resolvedParams) {
      fetchQuotation();
    }
  }, [resolvedParams]);

  async function fetchQuotation() {
    if (!resolvedParams) return;

    try {
      const res = await fetch(`/api/quotations/${resolvedParams.id}`);
      const data = await res.json();
      setQuotation(data);
    } catch (error) {
      console.error('Failed to fetch quotation:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading itinerary...</div>;
  }

  if (!quotation || !quotation.days || quotation.days.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No itinerary available</p>
        <button
          onClick={() => router.push(`/quotations/${resolvedParams?.id}`)}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Back to Quotation
        </button>
      </div>
    );
  }

  const startDate = new Date(quotation.start_date);
  const endDate = new Date(quotation.end_date);
  const totalDays = quotation.days.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push(`/quotations/${resolvedParams?.id}`)}
              className="text-white hover:text-primary-100 flex items-center gap-2"
            >
              ← Back to Quote
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 font-medium"
            >
              🖨️ Print Itinerary
            </button>
          </div>

          <h1 className="text-4xl font-bold mb-2">{quotation.destination}</h1>
          <p className="text-primary-100 text-lg">
            {startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-primary-100 mt-2">
            {totalDays} Days • {quotation.adults} Adult{quotation.adults > 1 ? 's' : ''}{quotation.children > 0 ? ` • ${quotation.children} Child${quotation.children > 1 ? 'ren' : ''}` : ''}
          </p>
        </div>
      </div>

      {/* Itinerary Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Customer Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trip Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Prepared for:</span>
              <p className="font-medium text-gray-900">{quotation.customer_name}</p>
            </div>
            <div>
              <span className="text-gray-500">Tour Type:</span>
              <p className="font-medium text-gray-900">{quotation.tour_type || 'Private'}</p>
            </div>
          </div>
        </div>

        {/* Day by Day Itinerary */}
        <div className="space-y-8">
          {quotation.days.map((day: any, index: number) => (
            <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Day Header */}
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">
                    {day.title || `Day ${day.day_number}`}
                  </h3>
                  {day.meals && (
                    <span className="px-3 py-1 bg-white text-primary-700 text-sm font-medium rounded-full">
                      {day.meals}
                    </span>
                  )}
                </div>
                <p className="text-primary-100 text-sm mt-1">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>

              {/* Day Content */}
              <div className="p-6">
                {day.narrative ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {day.narrative}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No description available for this day.</p>
                )}

                {/* Activities Summary */}
                {day.expenses && day.expenses.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Included Activities & Services:</h4>
                    <ul className="space-y-2">
                      {day.expenses.map((expense: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-primary-600 mt-1">✓</span>
                          <span>{expense.description || getCategoryLabel(expense.category)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>This itinerary is subject to change based on local conditions and availability.</p>
          <p className="mt-2">For questions or modifications, please contact us.</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .shadow-sm {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: { [key: string]: string } = {
    'hotelAccommodation': 'Hotel Accommodation',
    'sicTourCost': 'Guided Tour',
    'transportation': 'Transfer',
    'entranceFees': 'Entrance Fees',
    'guide': 'Tour Guide',
    'meal': 'Meal',
    'other': 'Additional Service'
  };
  return labels[category] || category;
}
