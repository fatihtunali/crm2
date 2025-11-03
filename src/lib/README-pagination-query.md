# Pagination & Query Utilities

This directory contains utility functions for implementing pagination and building safe SQL queries in the CRM2 project.

## Files

- **pagination.ts** - Pagination helpers for parsing params and building paged responses
- **query-builder.ts** - SQL query building utilities with parameterized queries for security

## Usage Examples

### Basic Pagination

```typescript
import { parsePaginationParams, buildPagedResponse } from '@/lib/pagination';
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Parse pagination parameters from URL
  const { page, pageSize, offset } = parsePaginationParams(searchParams);

  // Query with pagination
  const data = await query(
    'SELECT * FROM users LIMIT ? OFFSET ?',
    [pageSize, offset]
  );

  // Get total count
  const [{ count }] = await query('SELECT COUNT(*) as count FROM users');

  // Build paged response
  const response = buildPagedResponse(data, count, page, pageSize);

  return NextResponse.json(response);
}
```

### Pagination with Sorting

```typescript
import { parsePaginationParams, parseSortParams } from '@/lib/pagination';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const { page, pageSize, offset } = parsePaginationParams(searchParams);
  const sort = searchParams.get('sort');
  const orderBy = parseSortParams(sort) || 'created_at DESC';

  const sql = `SELECT * FROM users ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const data = await query(sql, [pageSize, offset]);

  const [{ count }] = await query('SELECT COUNT(*) as count FROM users');

  return buildPagedResponse(data, count, page, pageSize);
}
```

### Query Builder with Filters

```typescript
import { buildWhereClause, buildSearchClause } from '@/lib/query-builder';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Build WHERE clause from filters
  const filters = {
    status: searchParams.get('status') || undefined,
    city: searchParams.get('city') || undefined,
    price_min: searchParams.get('price_min') || undefined,
    price_max: searchParams.get('price_max') || undefined,
  };

  const { whereSQL, params } = buildWhereClause(filters);

  let sql = 'SELECT * FROM hotels';
  if (whereSQL) {
    sql += ` WHERE ${whereSQL}`;
  }

  const data = await query(sql, params);
  return NextResponse.json(data);
}
```

### Search with Multiple Fields

```typescript
import { buildSearchClause } from '@/lib/query-builder';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const searchTerm = searchParams.get('search') || '';

  // Search across multiple fields
  const { searchSQL, params } = buildSearchClause(searchTerm, [
    'hotel_name',
    'city',
    'description'
  ]);

  let sql = 'SELECT * FROM hotels';
  if (searchSQL) {
    sql += ` WHERE ${searchSQL}`;
  }

  const data = await query(sql, params);
  return NextResponse.json(data);
}
```

### Complete Example: Pagination + Filters + Search + Sort

```typescript
import {
  parsePaginationParams,
  parseSortParams,
  buildPagedResponse
} from '@/lib/pagination';
import {
  buildWhereClause,
  buildSearchClause,
  combineWhereAndSearch,
  buildQuery
} from '@/lib/query-builder';
import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Parse pagination
  const { page, pageSize, offset } = parsePaginationParams(searchParams);

  // Parse sorting
  const sortParam = searchParams.get('sort');
  const orderBy = parseSortParams(sortParam) || 'created_at DESC';

  // Build filters
  const filters = {
    status: searchParams.get('status') || undefined,
    city: searchParams.get('city') || undefined,
    hotel_category: searchParams.get('category') || undefined,
  };
  const whereClause = buildWhereClause(filters);

  // Build search
  const searchTerm = searchParams.get('search') || '';
  const searchClause = buildSearchClause(searchTerm, ['hotel_name', 'city']);

  // Build complete query
  const { sql, params } = buildQuery('SELECT * FROM hotels', {
    where: whereClause,
    search: searchClause,
    orderBy,
    limit: pageSize,
    offset,
  });

  // Execute query
  const data = await query(sql, params);

  // Get total count with same filters
  const combined = combineWhereAndSearch(whereClause, searchClause);
  let countSQL = 'SELECT COUNT(*) as count FROM hotels';
  if (combined.whereSQL) {
    countSQL += ` WHERE ${combined.whereSQL}`;
  }
  const [{ count }] = await query(countSQL, combined.params);

  // Build paged response
  const response = buildPagedResponse(data, count, page, pageSize);

  return NextResponse.json(response);
}
```

## Security Features

### SQL Injection Prevention

Both utilities implement multiple security measures:

1. **Field Name Sanitization**: Only alphanumeric characters and underscores allowed
   ```typescript
   // ✅ Valid: 'user_name', 'created_at', 'price'
   // ❌ Invalid: 'user.name', 'DROP TABLE', '1; DELETE FROM'
   ```

2. **Parameterized Queries**: All values use `?` placeholders
   ```typescript
   buildWhereClause({ status: 'active' })
   // Returns: { whereSQL: "status = ?", params: ['active'] }
   // NOT: "status = 'active'" (vulnerable to injection)
   ```

3. **Array Value Handling**: Safe IN clause generation
   ```typescript
   buildWhereClause({ status: ['active', 'pending'] })
   // Returns: { whereSQL: "status IN (?, ?)", params: ['active', 'pending'] }
   ```

## API Response Format

The `buildPagedResponse` function returns data in this standard format:

```typescript
{
  data: T[],           // Array of items
  total: number,       // Total items across all pages
  page: number,        // Current page (1-indexed)
  limit: number,       // Items per page
  totalPages: number   // Total number of pages
}
```

## Constants

- `DEFAULT_PAGE_SIZE = 25` - Default items per page
- `MAX_PAGE_SIZE = 200` - Maximum items per page to prevent overload
