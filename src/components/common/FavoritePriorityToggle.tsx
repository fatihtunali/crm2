'use client';

import { useState, useRef, useEffect } from 'react';

interface FavoritePriorityToggleProps {
  currentPriority: number;
  itemId: number;
  itemType: 'hotel' | 'guide' | 'vehicle' | 'restaurant' | 'transfer' | 'tour' | 'entrance-fee';
  onUpdate?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * FavoritePriorityToggle Component
 *
 * A reusable component for marking and prioritizing favorite items in the CRM.
 * Supports a 0-10 priority scale where:
 * - 0 = Not a favorite
 * - 1-4 = Secondary favorites
 * - 5-7 = Preferred options
 * - 8-10 = Top favorites (AI will strongly prefer these)
 *
 * Usage:
 * <FavoritePriorityToggle
 *   currentPriority={hotel.favorite_priority}
 *   itemId={hotel.id}
 *   itemType="hotel"
 *   onUpdate={refreshData}
 * />
 */
export default function FavoritePriorityToggle({
  currentPriority,
  itemId,
  itemType,
  onUpdate,
  size = 'md'
}: FavoritePriorityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [priority, setPriority] = useState(currentPriority);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Update local state when prop changes
  useEffect(() => {
    setPriority(currentPriority);
  }, [currentPriority]);

  const handlePriorityChange = async (newPriority: number) => {
    if (newPriority === priority) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setPriority(newPriority);

    try {
      // Map itemType to API endpoint
      const endpointMap: Record<string, string> = {
        'hotel': 'hotels',
        'guide': 'guides',
        'vehicle': 'vehicles',
        'restaurant': 'restaurants',
        'transfer': 'transfers',
        'tour': 'daily-tours',
        'entrance-fee': 'entrance-fees'
      };

      const endpoint = endpointMap[itemType];

      const response = await fetch(`/api/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': '1' // This should be dynamically set from context/auth
        },
        body: JSON.stringify({
          id: itemId,
          favorite_priority: newPriority
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update favorite priority');
      }

      // Success - close dropdown and trigger refresh
      setIsOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating favorite priority:', error);
      // Revert on error
      setPriority(currentPriority);
      alert('Failed to update favorite priority. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: {
      star: 'text-sm',
      badge: 'text-xs px-1.5 py-0.5',
      dropdown: 'w-48'
    },
    md: {
      star: 'text-base',
      badge: 'text-xs px-2 py-0.5',
      dropdown: 'w-56'
    },
    lg: {
      star: 'text-lg',
      badge: 'text-sm px-2 py-1',
      dropdown: 'w-64'
    }
  };

  const classes = sizeClasses[size];

  const getPriorityColor = (p: number) => {
    if (p === 0) return 'text-gray-300';
    if (p <= 4) return 'text-yellow-400';
    if (p <= 7) return 'text-yellow-500';
    return 'text-yellow-600';
  };

  const getPriorityLabel = (p: number) => {
    if (p === 0) return 'Not a favorite';
    if (p <= 4) return 'Secondary favorite';
    if (p <= 7) return 'Preferred';
    return 'Top favorite';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center gap-1 hover:opacity-80 transition-opacity ${
          isLoading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={`Favorite Priority: ${priority} (${getPriorityLabel(priority)})`}
      >
        <span className={`${classes.star} ${getPriorityColor(priority)}`}>
          {priority > 0 ? '⭐' : '☆'}
        </span>
        {priority > 0 && (
          <span className={`${classes.badge} font-semibold bg-yellow-100 text-yellow-800 rounded`}>
            {priority}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-2 ${classes.dropdown} bg-white border border-gray-200 rounded-lg shadow-xl p-4`}>
          <div className="text-sm font-semibold mb-2 text-gray-700">
            Favorite Priority
          </div>

          {/* Current value display */}
          <div className="mb-3 p-2 bg-gray-50 rounded text-center">
            <div className="text-2xl mb-1">{priority > 0 ? '⭐' : '☆'}</div>
            <div className="text-lg font-bold text-gray-800">{priority}</div>
            <div className="text-xs text-gray-500">{getPriorityLabel(priority)}</div>
          </div>

          {/* Slider */}
          <div className="mb-3">
            <input
              type="range"
              min="0"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Quick set buttons */}
          <div className="space-y-2 mb-3">
            <button
              onClick={() => setPriority(0)}
              className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                priority === 0
                  ? 'bg-gray-200 text-gray-800 font-semibold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">☆</span>
              Not a Favorite (0)
            </button>
            <button
              onClick={() => setPriority(5)}
              className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                priority === 5
                  ? 'bg-yellow-100 text-yellow-800 font-semibold'
                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              }`}
            >
              <span className="mr-2">⭐</span>
              Preferred (5)
            </button>
            <button
              onClick={() => setPriority(10)}
              className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                priority === 10
                  ? 'bg-yellow-200 text-yellow-900 font-semibold'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
              }`}
            >
              <span className="mr-2">⭐</span>
              Top Favorite (10)
            </button>
          </div>

          {/* Save/Cancel buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => handlePriorityChange(priority)}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
              disabled={isLoading || priority === currentPriority}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Info text */}
          <div className="mt-3 pt-2 border-t text-xs text-gray-500">
            <p>
              Priority 8-10: AI will <strong>strongly prefer</strong> these when generating itineraries
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
