# API Documentation

This directory contains the complete API documentation for the CRM system in OpenAPI 3.0 (Swagger) format.

## Viewing the Documentation

### Option 1: Swagger Editor Online
1. Go to [Swagger Editor](https://editor.swagger.io/)
2. Copy the contents of `swagger.yaml`
3. Paste into the editor

### Option 2: Swagger UI locally
```bash
npm install -g swagger-ui-express
```

### Option 3: VS Code Extension
Install the "OpenAPI (Swagger) Editor" extension in VS Code and open `swagger.yaml`.

## API Overview

### Base URL
- Development: `http://localhost:3000`
- Production: Update in swagger.yaml

### Main API Categories

#### 1. Suppliers Management
- **Hotels** - `/api/hotels`
- **Guides** - `/api/guides`
- **Vehicles** - `/api/vehicles`
- **Tour Packages** - `/api/tour-packages`
- **Restaurants** - `/api/restaurants`
- **Transfers** - `/api/transfers`
- **Extra Expenses** - `/api/extra-expenses`
- **Entrance Fees** - `/api/entrance-fees`

All supplier endpoints support:
- `GET` - List all items (with filtering)
- `POST` - Create new item
- `PUT` - Update existing item
- `DELETE` - Archive item (soft delete)

#### 2. Providers
- **GET** `/api/providers` - Get all active provider companies

#### 3. Quotations
- **GET** `/api/quotations` - List all quotations
- **POST** `/api/quotations` - Create new quotation
- **GET** `/api/quotations/{id}` - Get specific quotation
- **PUT** `/api/quotations/{id}` - Update quotation
- **POST** `/api/quotations/{id}/generate-itinerary` - AI-generated itinerary
- **PUT** `/api/quotations/{id}/status` - Update status

#### 4. Invoices
##### Receivable (from customers)
- **GET** `/api/invoices/receivable` - List receivable invoices
- **GET** `/api/invoices/receivable/{id}` - Get specific invoice
- **PUT** `/api/invoices/receivable/{id}/payment` - Record payment

##### Payable (to suppliers)
- **GET** `/api/invoices/payable` - List payable invoices
- **GET** `/api/invoices/payable/{id}` - Get specific invoice
- **PUT** `/api/invoices/payable/{id}/payment` - Record payment

##### Generate
- **POST** `/api/invoices/generate` - Generate invoices for quotation

#### 5. Finance
- **GET** `/api/finance/summary` - Financial summary (revenue, expenses, profit)
- **GET** `/api/finance/customers` - Customer financial data
- **GET** `/api/finance/suppliers` - Supplier financial data

#### 6. Dashboard
- **GET** `/api/dashboard/stats` - Dashboard statistics
- **GET** `/api/dashboard/recent-requests` - Recent customer requests
- **GET** `/api/dashboard/upcoming-tours` - Upcoming tours

#### 7. Search
- **GET** `/api/suppliers/search?query={text}` - Search across all suppliers

## Common Query Parameters

### Filtering
Most GET endpoints support filtering:
- `status` - Filter by status (active, inactive, all)
- `city` - Filter by city
- `search` - Text search
- Additional type-specific filters (see swagger.yaml)

### Response Format
All responses are in JSON format.

Success response:
```json
{
  "success": true,
  "data": {...}
}
```

Error response:
```json
{
  "error": "Error message description"
}
```

## Authentication
Currently, the API does not require authentication. This should be implemented before production deployment.

## Currency
All monetary values are in EUR (Euro) as of the latest update.

## Status Codes
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Provider Tracking
All suppliers (except hotels which already had IDs) now support provider/company tracking via:
- `provider_id` - Foreign key to providers table
- `provider_name` - Company name for easy reference

This allows grouping all services by the provider company.
