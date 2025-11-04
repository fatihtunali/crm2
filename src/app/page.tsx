'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { organizationId } = useAuth();
  const [stats, setStats] = useState<any>({
    activeRequests: 0,
    thisMonthBookings: 0,
    revenue: { amount_minor: 0, currency: 'EUR' },
    pendingQuotes: 0
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [upcomingTours, setUpcomingTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Add X-Tenant-Id header for multi-tenancy
        const headers = {
          'X-Tenant-Id': organizationId
        };

        const [statsRes, requestsRes, toursRes] = await Promise.all([
          fetch('/api/dashboard/stats', { headers }),
          fetch('/api/dashboard/recent-requests', { headers }),
          fetch('/api/dashboard/upcoming-tours', { headers })
        ]);

        const statsData = await statsRes.json();
        const requestsData = await requestsRes.json();
        const toursData = await toursRes.json();

        // Handle both direct response and wrapped response formats
        const stats = statsData.data || statsData;
        setStats({
          activeRequests: stats.activeRequests || 0,
          thisMonthBookings: stats.thisMonthBookings || 0,
          revenue: stats.revenue || { amount_minor: 0, currency: 'EUR' },
          pendingQuotes: stats.pendingQuotes || 0
        });
        setRecentRequests(requestsData);
        setUpcomingTours(toursData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [organizationId]);

  const statsDisplay = [
    {
      label: 'Active Requests',
      value: loading ? '...' : stats.activeRequests,
      icon: '📬',
      color: 'blue'
    },
    {
      label: 'This Month Bookings',
      value: loading ? '...' : stats.thisMonthBookings,
      icon: '📅',
      color: 'green'
    },
    {
      label: 'Total Revenue (EUR)',
      value: loading ? '...' : `€${((stats.revenue?.amount_minor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: '💰',
      color: 'yellow'
    },
    {
      label: 'Pending Quotes',
      value: loading ? '...' : stats.pendingQuotes,
      icon: '⏳',
      color: 'purple'
    },
  ];

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'pending' || statusLower === 'new') return 'bg-blue-100 text-blue-700';
    if (statusLower === 'confirmed' || statusLower === 'booked') return 'bg-green-100 text-green-700';
    if (statusLower === 'completed') return 'bg-gray-100 text-gray-700';
    if (statusLower === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsDisplay.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{stat.icon}</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Requests */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Requests</h2>
            <a href="/requests" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </a>
          </div>
          <div className="p-6">
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            ) : recentRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No recent requests</p>
            ) : (
              <div className="space-y-4">
                {recentRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{request.agent}</h4>
                      <p className="text-sm text-gray-500">{request.package} • {request.pax} pax</p>
                      <p className="text-xs text-gray-400 mt-1">{request.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        €{(request.value.amount_minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tours */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Tours</h2>
            <a href="/bookings" className="text-sm text-primary-600 hover:text-primary-700">
              View all →
            </a>
          </div>
          <div className="p-6">
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading...</p>
            ) : upcomingTours.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No upcoming tours</p>
            ) : (
              <div className="space-y-4">
                {upcomingTours.map((tour: any) => (
                  <div key={tour.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{tour.package}</h4>
                      <p className="text-sm text-gray-500">{tour.agent} • {tour.pax} pax</p>
                      <p className="text-xs text-gray-400 mt-1">Guide: {tour.guide}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{tour.date}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${getStatusColor(tour.status)}`}>
                        {tour.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-center">
            <span className="text-2xl block mb-2">➕</span>
            <span className="text-sm font-medium text-gray-700">New Request</span>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-center">
            <span className="text-2xl block mb-2">💰</span>
            <span className="text-sm font-medium text-gray-700">Create Quote</span>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-center">
            <span className="text-2xl block mb-2">📅</span>
            <span className="text-sm font-medium text-gray-700">Add Booking</span>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-center">
            <span className="text-2xl block mb-2">🧾</span>
            <span className="text-sm font-medium text-gray-700">Generate Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
}
