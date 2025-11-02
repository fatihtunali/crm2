'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Requests', href: '/requests', icon: '📬' },
  { name: 'Agents', href: '/agents', icon: '👥' },
  { name: 'Quotations', href: '/quotations', icon: '💰' },
  { name: 'Bookings', href: '/bookings', icon: '📅' },
  {
    name: 'Suppliers',
    href: '/suppliers',
    icon: '🏨',
    subItems: [
      { name: 'Hotels', href: '/hotels', icon: '🏨' },
      { name: 'Daily Tours', href: '/tour-packages', icon: '🗺️' },
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
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Suppliers']);

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
        {navigation.map((item) => {
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

      {/* User Info */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-semibold">FT</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Fatih</p>
            <p className="text-xs text-gray-500">Tour Operator</p>
          </div>
        </div>
      </div>
    </div>
  );
}
