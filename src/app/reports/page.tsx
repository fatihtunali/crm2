'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ReportCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  description: string;
}

interface Report {
  id: string;
  name: string;
  category: string;
  description: string;
  href: string;
  isFavorite?: boolean;
}

const categories: ReportCategory[] = [
  {
    id: 'sales',
    name: 'Sales & Revenue',
    icon: '💰',
    count: 4,
    description: 'Sales performance, quotes, and revenue analysis'
  },
  {
    id: 'clients',
    name: 'Clients & Customers',
    icon: '👥',
    count: 3,
    description: 'Client demographics, lifetime value, and retention'
  },
  {
    id: 'agents',
    name: 'Tour Operators',
    icon: '🏢',
    count: 2,
    description: 'Agent performance and client analysis'
  },
  {
    id: 'financial',
    name: 'Financial',
    icon: '📊',
    count: 5,
    description: 'P&L, invoices, payments, and commissions'
  },
  {
    id: 'operations',
    name: 'Operations',
    icon: '⚙️',
    count: 5,
    description: 'Tours, capacity, services, and bookings'
  },
  {
    id: 'pricing',
    name: 'Pricing & Costs',
    icon: '💵',
    count: 2,
    description: 'Pricing analysis and cost structure'
  },
  {
    id: 'executive',
    name: 'Executive',
    icon: '📈',
    count: 1,
    description: 'High-level dashboards and summaries'
  }
];

const allReports: Report[] = [
  // Executive
  {
    id: 'executive-summary',
    name: 'Executive Summary Dashboard',
    category: 'executive',
    description: 'High-level overview of business performance',
    href: '/reports/executive/summary',
    isFavorite: true
  },

  // Sales & Revenue
  {
    id: 'sales-overview',
    name: 'Sales Overview Dashboard',
    category: 'sales',
    description: 'Complete sales performance metrics and trends',
    href: '/reports/sales/overview',
    isFavorite: true
  },
  {
    id: 'quote-performance',
    name: 'Quote Performance Report',
    category: 'sales',
    description: 'Quote-to-booking conversion and lifecycle analysis',
    href: '/reports/sales/quotes'
  },
  {
    id: 'revenue-destination',
    name: 'Revenue by Destination',
    category: 'sales',
    description: 'Compare revenue across different destinations',
    href: '/reports/sales/destinations'
  },
  {
    id: 'sales-trends',
    name: 'Sales Trends',
    category: 'sales',
    description: 'Monthly and yearly sales patterns',
    href: '/reports/sales/trends'
  },

  // Clients & Customers
  {
    id: 'client-demographics',
    name: 'Client Demographics',
    category: 'clients',
    description: 'Understand your customer base by nationality, type, and language',
    href: '/reports/clients/demographics'
  },
  {
    id: 'client-lifetime-value',
    name: 'Client Lifetime Value',
    category: 'clients',
    description: 'Identify your most valuable clients',
    href: '/reports/clients/lifetime-value',
    isFavorite: true
  },
  {
    id: 'client-acquisition',
    name: 'Client Acquisition & Retention',
    category: 'clients',
    description: 'Track new clients and retention rates',
    href: '/reports/clients/acquisition-retention'
  },

  // Tour Operators/Agents
  {
    id: 'agent-performance',
    name: 'Agent Performance Dashboard',
    category: 'agents',
    description: 'Compare performance across tour operators',
    href: '/reports/agents/performance'
  },
  {
    id: 'agent-clients',
    name: 'Agent Client Analysis',
    category: 'agents',
    description: 'Client portfolio by tour operator',
    href: '/reports/agents/clients'
  },

  // Financial
  {
    id: 'financial-dashboard',
    name: 'Financial Dashboard',
    category: 'financial',
    description: 'Complete financial overview with P&L',
    href: '/reports/financial/dashboard',
    isFavorite: true
  },
  {
    id: 'profit-loss',
    name: 'Profit & Loss Report',
    category: 'financial',
    description: 'Detailed P&L statement',
    href: '/reports/financial/profit-loss'
  },
  {
    id: 'invoice-aging',
    name: 'Invoice Aging Report',
    category: 'financial',
    description: 'Outstanding invoices by aging bucket',
    href: '/reports/financial/aging'
  },
  {
    id: 'provider-payments',
    name: 'Provider Payment Analysis',
    category: 'financial',
    description: 'Track payments to suppliers',
    href: '/reports/financial/providers'
  },
  {
    id: 'commission-tracking',
    name: 'Commission Tracking',
    category: 'financial',
    description: 'Markup and commission analysis',
    href: '/reports/financial/commissions'
  },

  // Operations
  {
    id: 'upcoming-tours',
    name: 'Upcoming Tours Report',
    category: 'operations',
    description: 'View all upcoming tours and bookings',
    href: '/reports/operations/upcoming-tours',
    isFavorite: true
  },
  {
    id: 'capacity-utilization',
    name: 'Capacity Utilization',
    category: 'operations',
    description: 'Resource utilization analysis',
    href: '/reports/operations/capacity'
  },
  {
    id: 'service-usage',
    name: 'Service Usage Report',
    category: 'operations',
    description: 'Track popular services and combinations',
    href: '/reports/operations/service-usage'
  },
  {
    id: 'response-times',
    name: 'Request Response Times',
    category: 'operations',
    description: 'Track quote response efficiency',
    href: '/reports/operations/response-times'
  },
  {
    id: 'booking-status',
    name: 'Booking Status Report',
    category: 'operations',
    description: 'Current status of all bookings',
    href: '/reports/operations/booking-status'
  },

  // Pricing & Costs
  {
    id: 'pricing-analysis',
    name: 'Pricing Analysis',
    category: 'pricing',
    description: 'Analyze pricing strategy and trends',
    href: '/reports/pricing/analysis'
  },
  {
    id: 'cost-structure',
    name: 'Cost Structure Report',
    category: 'pricing',
    description: 'Break down costs by category',
    href: '/reports/pricing/cost-structure'
  }
];

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const favoriteReports = allReports.filter(r => r.isFavorite);

  const filteredReports = allReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || report.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedReports = filteredReports.reduce((acc, report) => {
    if (!acc[report.category]) {
      acc[report.category] = [];
    }
    acc[report.category].push(report);
    return acc;
  }, {} as Record<string, Report[]>);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Business intelligence and analytics</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Categories */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">CATEGORIES</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedCategory === 'all'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-sm">All Reports</div>
            <div className="text-xs text-gray-500 mt-1">{allReports.length} reports</div>
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCategory === category.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-2">{category.icon}</div>
              <div className="font-semibold text-sm">{category.name}</div>
              <div className="text-xs text-gray-500 mt-1">{category.count} reports</div>
            </button>
          ))}
        </div>
      </div>

      {/* Favorite Reports */}
      {selectedCategory === 'all' && searchTerm === '' && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">⭐ FAVORITE REPORTS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteReports.map((report) => (
              <Link
                key={report.id}
                href={report.href}
                className="block p-5 bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-lg hover:shadow-md transition-all hover:border-primary-300"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{report.name}</h3>
                  <span className="text-yellow-500">⭐</span>
                </div>
                <p className="text-sm text-gray-600">{report.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Reports by Category */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          {selectedCategory === 'all' ? 'ALL REPORTS' : categories.find(c => c.id === selectedCategory)?.name.toUpperCase()}
        </h2>

        {Object.keys(groupedReports).length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No reports found matching your search</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedReports).map(([categoryId, reports]) => {
              const category = categories.find(c => c.id === categoryId);
              if (!category) return null;

              return (
                <div key={categoryId} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-500">{category.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {reports.map((report) => (
                      <Link
                        key={report.id}
                        href={report.href}
                        className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all group"
                      >
                        <span className="text-primary-600 group-hover:text-primary-700 mt-0.5">▶</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 group-hover:text-primary-700">
                              {report.name}
                            </h4>
                            {report.isFavorite && <span className="text-xs">⭐</span>}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
