'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Requests', href: '/requests', icon: '📬' },
  { name: 'Quotations', href: '/quotations', icon: '💰' },
  { name: 'Bookings', href: '/bookings', icon: '📅' },
  { name: 'Tour Operators', href: '/agents', icon: '🏢' },
  {
    name: 'Clients',
    href: '/clients',
    icon: '👥',
    subItems: [
      { name: 'Direct Clients', href: '/clients/direct', icon: '👤' },
      { name: 'Agent Clients', href: '/clients/agent', icon: '👥' },
    ]
  },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: '🏨',
    subItems: [
      { name: 'Service Providers', href: '/suppliers', icon: '📋' },
      { name: 'Hotels', href: '/hotels', icon: '🏨' },
      { name: 'Daily Tours', href: '/daily-tours', icon: '🗺️' },
      { name: 'Transfers', href: '/transfers', icon: '🚗' },
      { name: 'Vehicles', href: '/vehicles', icon: '🚙' },
      { name: 'Guides', href: '/guides', icon: '👨‍🏫' },
      { name: 'Entrance Fees', href: '/entrance-fees', icon: '🎫' },
      { name: 'Restaurants', href: '/restaurants', icon: '🍽️' },
      { name: 'Extra Expenses', href: '/extra-expenses', icon: '💵' },
    ]
  },
  { name: 'Invoices', href: '/invoices', icon: '🧾' },
  { name: 'Finance', href: '/finance', icon: '💰' },
  { name: 'Reports', href: '/reports', icon: '📈' },
  { name: 'API Docs', href: '/api-docs', icon: '📖' },
  { name: 'Settings', href: '/settings', icon: '⚙️', adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Clients', 'Suppliers']);

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-primary-600">Tour CRM</h1>
        <p className="text-sm text-gray-500 mt-1">Tour Operator System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation
          .filter(item => {
            // Filter out admin-only items if user is not an admin
            if (item.adminOnly) {
              return user?.role === 'org_admin' || user?.role === 'super_admin';
            }
            return true;
          })
          .map((item) => {
          const isActive = pathname === item.href;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedItems.includes(item.name);
          const isSubItemActive = hasSubItems && item.subItems.some(sub => pathname === sub.href);

          return (
            <div key={item.name}>
              {hasSubItems ? (
                <button
                  onClick={() => toggleExpand(item.name)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive || isSubItemActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  <span className={`text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              )}

              {/* Submenu Items */}
              {hasSubItems && isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.subItems.map((subItem) => {
                    const isSubActive = pathname === subItem.href;
                    return (
                      <Link
                        key={subItem.name}
                        href={subItem.href}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                          isSubActive
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">{subItem.icon}</span>
                        <span className="text-sm">{subItem.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-semibold text-sm">
                {user?.email?.substring(0, 2).toUpperCase() || 'FT'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role?.replace('_', ' ') || 'Operator'}
              </p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
