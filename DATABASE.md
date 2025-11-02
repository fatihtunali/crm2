# CRM Database Documentation

## 📊 Database Information

- **Database Name:** `crm_db`
- **User:** `crm`
- **Password:** `Dlr235672.-Yt`
- **Host:** `134.209.137.11`
- **Port:** `3306`
- **Remote Access:** ✓ Enabled
- **Total Tables:** 31
- **Total Rows:** 4,130

---

## 🔌 Connection String

```
mysql://crm:Dlr235672.-Yt@134.209.137.11:3306/crm_db
```

---

## 📋 Available Tables

### Core Business Tables

| Table | Description | Rows |
|-------|-------------|------|
| `quotes` | Customer quotes and proposals | 16 |
| `customer_itineraries` | Customer trip requests | 68 |
| `bookings` | Confirmed bookings | 0 |
| `organizations` | Partner organizations | 3 |
| `users` | System users | 5 |

### Inventory Tables

| Table | Description | Rows |
|-------|-------------|------|
| `hotels` | Hotel database | 1,341 |
| `hotel_pricing` | Hotel pricing by season | 1,507 |
| `tours` | Available tours | 79 |
| `tour_pricing` | Tour pricing by season | 126 |
| `vehicles` | Vehicle fleet | 48 |
| `vehicle_pricing` | Vehicle pricing | 85 |
| `guides` | Tour guides | 54 |
| `guide_pricing` | Guide pricing | 132 |

### Cost Tables

| Table | Description | Rows |
|-------|-------------|------|
| `entrance_fees` | Museum/site entrance fees | 68 |
| `entrance_fee_pricing` | Entrance fee pricing | 142 |
| `meal_pricing` | Restaurant meal pricing | 241 |
| `extra_expenses` | Misc expenses (tips, parking) | 74 |
| `intercity_transfers` | Transfer pricing between cities | 113 |
| `flight_pricing` | Flight pricing | 10 |

### System Tables

| Table | Description | Rows |
|-------|-------------|------|
| `currency_rates` | Exchange rates | 4 |
| `hotel_categories` | Hotel category definitions | 6 |
| `organization_credits` | Org credit balances | 3 |
| `subscriptions` | Subscription plans | 4 |
| `invoices` | Billing invoices | 0 |
| `payment_methods` | Payment methods | 0 |
| `white_label_settings` | White label configs | 1 |
| `activity_logs` | Activity logs | 0 |
| `analytics_events` | Analytics tracking | 0 |
| `places` | Google Places data | 0 |
| `place_photos` | Place photos | 0 |
| `itinerary_places` | Itinerary stops | 0 |

---

## 🛠️ Quick Access Commands

### NPM Scripts

```bash
# Explore database structure
npm run db:explore

# Backup database
npm run db:backup

# Query specific table
npm run db:query quotes 10
npm run db:query hotels 20
npm run db:query customer_itineraries

# Re-setup database (DANGER: drops and recreates!)
npm run db:setup
```

### Direct Node Scripts

```bash
# Query any table
node query-table.js quotes
node query-table.js hotels 50
node query-table.js customer_itineraries

# Explore all tables
node explore-db.js

# Backup full database
node backup-tqa-db.js
```

---

## 💻 Using in Code

### Import the database helper

```typescript
import db from '@/lib/db';

// Get all quotes
const quotes = await db.getAllQuotes();

// Get quote by ID
const quote = await db.getQuoteById(1);

// Get quotes by status
const sentQuotes = await db.getQuotesByStatus('sent');

// Get all hotels
const hotels = await db.getAllHotels();

// Get hotels by city
const istanbulHotels = await db.getHotelsByCity('Istanbul');

// Get hotel pricing
const pricing = await db.getHotelPricing(hotelId);

// Get all tours
const tours = await db.getAllTours();

// Custom query
import { query } from '@/lib/db';
const results = await query('SELECT * FROM quotes WHERE status = ?', ['sent']);
```

### Available Database Methods

```typescript
// Quotes
db.getAllQuotes()
db.getQuoteById(id)
db.getQuotesByStatus(status)

// Customer Itineraries (Requests)
db.getAllItineraries()
db.getItineraryById(id)
db.getItinerariesByStatus(status)

// Hotels
db.getAllHotels()
db.getHotelsByCity(city)
db.getHotelById(id)
db.getHotelPricing(hotelId)

// Tours
db.getAllTours()
db.getToursByCity(city)
db.getTourById(id)
db.getTourPricing(tourId)

// Vehicles
db.getAllVehicles()
db.getVehicleById(id)
db.getVehiclePricing(vehicleId)

// Guides
db.getAllGuides()
db.getGuidesByCity(city)
db.getGuidePricing(guideId)

// Entrance Fees
db.getAllEntranceFees()
db.getEntranceFeesByCity(city)
db.getEntranceFeePricing(feeId)

// Meals & Extras
db.getMealPricingByCity(city)
db.getExtraExpensesByCity(city)

// Transfers
db.getIntercityTransfers(fromCity, toCity)

// Organizations & Users
db.getAllOrganizations()
db.getUserById(id)
db.getUserByEmail(email)

// Bookings
db.getAllBookings()
db.getBookingById(id)

// Generic queries
db.getTableData(tableName, limit)
db.getTableCount(tableName)
```

---

## 📂 File Structure

```
CRM/
├── .env                          # Database credentials
├── DATABASE.md                   # This file
├── src/
│   └── lib/
│       └── db.ts                 # Database helper functions
├── database_backup/              # Full database backup
│   ├── tqa_db_complete_backup.sql
│   ├── tqa_db_structure_only.sql
│   └── database_summary.json
├── explore-db.js                 # Explore database structure
├── backup-tqa-db.js             # Backup TQA database
├── query-table.js                # Query any table
└── setup-crm-database.js        # Setup CRM database
```

---

## 🔐 Security Notes

- Database credentials are in `.env` (not committed to git)
- Remote access enabled for development
- For production: restrict IP access
- For production: use environment variables

---

## 🚀 Next Steps

1. ✅ Database created and populated
2. ✅ Helper functions ready
3. ⏳ Build API routes
4. ⏳ Connect frontend to real data
5. ⏳ Add CRUD operations

---

## 📞 Quick Examples

### View Quotes
```bash
npm run db:query quotes
```

### View Hotels in Istanbul
```bash
node -e "require('./src/lib/db').default.getHotelsByCity('Istanbul').then(console.table)"
```

### Count all records
```bash
node -e "require('./query-table.js')"
```
