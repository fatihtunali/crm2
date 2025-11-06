# Favorites/Priority Ranking System - Complete Implementation Guide

## Overview
This document provides a complete implementation guide for the favorites/priority ranking system in the CRM application. The system allows users to mark and prioritize their favorite providers (hotels, guides, vehicles, restaurants, transfers, daily tours, entrance fees) with a 0-10 priority scale.

## Implementation Status

### ✅ COMPLETED:
1. **Database Migration** - `migrations/add-favorite-priority.sql`
2. **API Endpoints Updated**:
   - ✅ hotels/route.ts (GET, POST, PUT)
   - ✅ guides/route.ts (GET, POST, PUT)
   - ✅ vehicles/route.ts (GET, POST, PUT)
   - ⚠️ restaurants/route.ts (GET updated, POST/PUT need completion)
   - ⚠️ transfers/route.ts (needs update)
   - ⚠️ daily-tours/route.ts (needs update)
   - ⚠️ entrance-fees/route.ts (needs update)
3. **AI Quotation Logic** - `src/lib/ai.ts` and `src/app/api/quotations/[id]/generate-itinerary/route.ts`
   - ✅ AI prompt updated to consider favorite_priority
   - ✅ Database queries updated to fetch and sort by favorite_priority

### 🔄 REMAINING TASKS:

#### 1. Complete Remaining API Endpoints

##### transfers/route.ts
Add favorite_priority support similar to vehicles:
- Add `favorite_priority` to column map in sort params
- Add `favorite_priority` to INSERT statement
- Add `favorite_priority` to UPDATE statement
- Add validation (0-10 range) in POST and PUT
- Update default ORDER BY to: `ORDER BY favorite_priority DESC, ...`

##### daily-tours/route.ts
Add favorite_priority support:
- Add `favorite_priority` to allowed columns for sorting
- Add to INSERT/UPDATE queries
- Add validation
- Update ORDER BY clause

##### entrance-fees/route.ts
Add favorite_priority support:
- Add `favorite_priority` to allowed columns for sorting
- Add to INSERT/UPDATE queries
- Add validation
- Update ORDER BY clause

#### 2. UI Components - Add Favorite Toggle

All service table components need a favorite toggle/priority selector. Here's the pattern:

**Location**: Table row cells
**UI Pattern**:
- Star icon (⭐) that can be clicked
- Shows current priority as a badge/number
- Click to open dropdown/slider (0-10)
- Visual: Gold star for favorites (priority > 0), gray for non-favorites

**Files to Update**:
1. `src/components/providers/ProvidersTable.tsx` - Hotels section
2. `src/components/daily-tours/TourPackageTable.tsx`
3. `src/app/hotels/page.tsx` (if has table)
4. `src/app/guides/page.tsx` (if has table)
5. `src/app/vehicles/page.tsx` (if has table)
6. `src/app/restaurants/page.tsx` (if has table)
7. `src/app/transfers/page.tsx` (if has table)
8. `src/app/entrance-fees/page.tsx` (if has table)

**Implementation Example**:
```tsx
// Add a new column to the table
<td className="px-6 py-4">
  <FavoritePriorityToggle
    currentPriority={item.favorite_priority || 0}
    itemId={item.id}
    itemType="hotel"
    onUpdate={handleFavoriteUpdate}
  />
</td>

// Create FavoritePriorityToggle component
const FavoritePriorityToggle = ({ currentPriority, itemId, itemType, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [priority, setPriority] = useState(currentPriority);

  const handlePriorityChange = async (newPriority: number) => {
    setPriority(newPriority);
    setIsOpen(false);

    // Call API to update
    const response = await fetch(`/api/${itemType}s`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, favorite_priority: newPriority })
    });

    if (response.ok) {
      onUpdate?.();
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1">
        <span className={priority > 0 ? 'text-yellow-500' : 'text-gray-300'}>
          ⭐
        </span>
        {priority > 0 && (
          <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
            {priority}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 bg-white border rounded-lg shadow-lg p-4">
          <div className="text-sm font-semibold mb-2">Priority (0-10)</div>
          <input
            type="range"
            min="0"
            max="10"
            value={priority}
            onChange={(e) => handlePriorityChange(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
          <div className="flex gap-2 mt-3">
            {[0, 5, 10].map(p => (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                {p === 0 ? 'None' : p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

#### 3. Edit/Add Modals - Add Favorite Priority Field

**Files to Update**:
1. `src/components/providers/EditProviderModal.tsx`
2. `src/components/providers/NewProviderModal.tsx`
3. `src/components/daily-tours/EditTourPackageModal.tsx`
4. `src/components/vehicles/EditVehicleModal.tsx`
5. `src/components/restaurants/EditRestaurantModal.tsx`
6. `src/components/transfers/EditTransferModal.tsx`
7. `src/components/entrance-fees/EditEntranceFeeModal.tsx`
8. Similar components for guides

**Implementation Pattern**:
```tsx
// Add to form state
const [formData, setFormData] = useState({
  // ... existing fields
  favorite_priority: item?.favorite_priority || 0
});

// Add to form JSX
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Favorite Priority
  </label>
  <div className="flex items-center gap-4">
    <input
      type="range"
      min="0"
      max="10"
      value={formData.favorite_priority}
      onChange={(e) => setFormData({
        ...formData,
        favorite_priority: parseInt(e.target.value)
      })}
      className="flex-1"
    />
    <span className="text-lg font-semibold w-12 text-center">
      {formData.favorite_priority}
    </span>
  </div>
  <div className="flex gap-2 mt-2">
    <button
      type="button"
      onClick={() => setFormData({ ...formData, favorite_priority: 0 })}
      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
    >
      No Favorite
    </button>
    <button
      type="button"
      onClick={() => setFormData({ ...formData, favorite_priority: 5 })}
      className="px-3 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 rounded"
    >
      Medium (5)
    </button>
    <button
      type="button"
      onClick={() => setFormData({ ...formData, favorite_priority: 10 })}
      className="px-3 py-1 text-xs bg-yellow-200 hover:bg-yellow-300 rounded"
    >
      Top Favorite (10)
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-2">
    Higher priority items (8-10) will be strongly preferred by AI when generating itineraries
  </p>
</div>
```

## Database Schema

The migration adds `favorite_priority` column to all service tables:
- hotels
- guides
- vehicles
- restaurants (meal_pricing table)
- transfers
- tours (daily_tours)
- entrance_fees

**Column Spec**:
```sql
favorite_priority TINYINT UNSIGNED DEFAULT 0 NOT NULL
COMMENT 'Favorite priority (0=not favorite, 1-10=priority ranking, 10=highest)'
```

**Indexes Created**:
```sql
CREATE INDEX idx_favorite_priority ON table_name(favorite_priority, organization_id);
```

**Constraints**:
```sql
ALTER TABLE table_name
ADD CONSTRAINT chk_table_name_favorite_priority
CHECK (favorite_priority BETWEEN 0 AND 10);
```

## API Endpoint Pattern

All endpoints follow this pattern:

### GET Endpoints:
1. Add `favorite_priority` to SELECT query
2. Add `'favorite_priority'` to ALLOWED_COLUMNS array
3. Update default ORDER BY: `ORDER BY favorite_priority DESC, ...`
4. Support filtering: `?favorite_priority=10` or `?is_favorite=true`

### POST Endpoints:
1. Add `favorite_priority` to destructured body
2. Add validation:
```typescript
if (favorite_priority !== undefined && favorite_priority !== null) {
  const priority = parseInt(favorite_priority);
  if (isNaN(priority) || priority < 0 || priority > 10) {
    return validationErrorResponse(
      'Invalid input',
      [{ field: 'favorite_priority', issue: 'invalid_range', message: 'Favorite priority must be between 0 and 10' }],
      requestId
    );
  }
}
```
3. Add to INSERT fields and values: `favorite_priority || 0`

### PUT Endpoints:
1. Add validation (same as POST)
2. Add to UPDATE statement
3. Use existing value if not provided:
```typescript
favorite_priority !== undefined ? favorite_priority : existingItem.favorite_priority
```

## AI Integration

The AI quotation system now:
1. **Fetches** items with favorite_priority from database (ORDER BY favorite_priority DESC)
2. **Passes** favorite_priority values to Claude AI in the prompt
3. **Instructs** AI to prioritize items with higher favorite_priority (8-10 = top favorites)
4. **Allows** AI to use non-favorites when needed for availability, budget, or location

## Testing Checklist

### Database:
- [ ] Run migration SQL successfully
- [ ] Verify columns exist in all tables
- [ ] Verify indexes created
- [ ] Verify constraints work (test inserting value 11, should fail)

### API Endpoints:
- [ ] Test GET with sorting by favorite_priority
- [ ] Test POST with favorite_priority=10
- [ ] Test POST with favorite_priority=15 (should fail validation)
- [ ] Test PUT to update favorite_priority
- [ ] Verify favorites appear first in list responses

### AI Integration:
- [ ] Create hotels with different favorite_priority values (0, 5, 10)
- [ ] Generate itinerary
- [ ] Verify high-priority hotels are selected by AI
- [ ] Verify AI considers location/availability over favorites when needed

### UI:
- [ ] Test favorite toggle in tables
- [ ] Test priority slider in modals
- [ ] Verify visual indicators (gold stars)
- [ ] Test quick-set buttons (0, 5, 10)

## Migration Execution

```bash
# Connect to MySQL
mysql -u your_user -p your_database

# Run migration
source migrations/add-favorite-priority.sql

# Verify
SHOW COLUMNS FROM hotels LIKE 'favorite_priority';
SHOW INDEX FROM hotels WHERE Key_name = 'idx_favorite_priority';
```

## TypeScript Types

Add to relevant interfaces:

```typescript
interface Hotel {
  // ... existing fields
  favorite_priority: number; // 0-10
}

interface Guide {
  // ... existing fields
  favorite_priority: number;
}

// etc for all service types
```

## Notes

1. **Multi-tenancy**: favorite_priority is per-organization (each tenant has own favorites)
2. **Default Value**: 0 (not a favorite)
3. **AI Behavior**: AI considers favorites but can override for logical/practical reasons
4. **Performance**: Indexes on (favorite_priority, organization_id) ensure fast queries
5. **Validation**: Server-side validation prevents invalid values (outside 0-10 range)

## Support

For questions or issues:
1. Check this guide first
2. Review completed implementations (hotels, guides, vehicles)
3. Test with sample data before production use
