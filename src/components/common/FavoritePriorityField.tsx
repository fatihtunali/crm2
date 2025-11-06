'use client';

interface FavoritePriorityFieldProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  showHelp?: boolean;
}

/**
 * FavoritePriorityField Component
 *
 * A form field component for setting favorite priority in add/edit modals.
 * Includes a slider and quick-set buttons for easy selection.
 *
 * Usage in forms:
 * <FavoritePriorityField
 *   value={formData.favorite_priority}
 *   onChange={(val) => setFormData({ ...formData, favorite_priority: val })}
 * />
 */
export default function FavoritePriorityField({
  value,
  onChange,
  disabled = false,
  label = 'Favorite Priority',
  showHelp = true
}: FavoritePriorityFieldProps) {
  const getPriorityLabel = (p: number) => {
    if (p === 0) return 'Not a favorite';
    if (p <= 4) return 'Secondary favorite';
    if (p <= 7) return 'Preferred';
    return 'Top favorite';
  };

  const getPriorityColor = (p: number) => {
    if (p === 0) return 'text-gray-500';
    if (p <= 4) return 'text-yellow-600';
    if (p <= 7) return 'text-yellow-700';
    return 'text-yellow-800';
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      {/* Current value display */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className="text-2xl">
          {value > 0 ? '⭐' : '☆'}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-800">{value}</span>
            <span className={`text-sm font-medium ${getPriorityColor(value)}`}>
              {getPriorityLabel(value)}
            </span>
          </div>
        </div>
      </div>

      {/* Slider */}
      <div>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
          <span>0</span>
          <span>2</span>
          <span>4</span>
          <span>6</span>
          <span>8</span>
          <span>10</span>
        </div>
      </div>

      {/* Quick set buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onChange(0)}
          disabled={disabled}
          className={`px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            value === 0
              ? 'bg-gray-200 text-gray-800 font-semibold border-2 border-gray-400'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
          }`}
        >
          <div className="mb-1">☆</div>
          <div className="text-xs">None</div>
        </button>

        <button
          type="button"
          onClick={() => onChange(5)}
          disabled={disabled}
          className={`px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            value === 5
              ? 'bg-yellow-100 text-yellow-800 font-semibold border-2 border-yellow-400'
              : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-300'
          }`}
        >
          <div className="mb-1">⭐</div>
          <div className="text-xs">Medium (5)</div>
        </button>

        <button
          type="button"
          onClick={() => onChange(10)}
          disabled={disabled}
          className={`px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            value === 10
              ? 'bg-yellow-200 text-yellow-900 font-semibold border-2 border-yellow-500'
              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-400'
          }`}
        >
          <div className="mb-1">⭐</div>
          <div className="text-xs">Top (10)</div>
        </button>
      </div>

      {/* Help text */}
      {showHelp && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-xs text-blue-800">
            <strong>How Priority Works:</strong>
            <ul className="mt-1 ml-4 space-y-1 list-disc">
              <li><strong>0:</strong> Standard option - no priority</li>
              <li><strong>1-4:</strong> Secondary favorite - use if top favorites unavailable</li>
              <li><strong>5-7:</strong> Preferred option - select when suitable</li>
              <li><strong>8-10:</strong> Top favorite - AI will <strong>strongly prefer</strong> these when generating itineraries</li>
            </ul>
          </div>
        </div>
      )}

      {/* Additional note for AI integration */}
      <p className="text-xs text-gray-500 italic">
        Items with higher priority will appear first in lists and be preferred by the AI itinerary generator.
      </p>
    </div>
  );
}
