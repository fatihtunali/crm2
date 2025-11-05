#!/bin/bash

# List of files and their resources
# Format: "filepath|resource"
FILES=(
"src/app/api/users/[id]/route.ts|users"
"src/app/api/agents/route.ts|agents"
"src/app/api/agents/[id]/route.ts|agents"
"src/app/api/invoices/payable/route.ts|invoices"
"src/app/api/invoices/receivable/route.ts|invoices"
"src/app/api/invoices/payable/[id]/route.ts|invoices"
"src/app/api/invoices/receivable/[id]/route.ts|invoices"
"src/app/api/invoices/payable/[id]/payment/route.ts|invoices"
"src/app/api/invoices/receivable/[id]/payment/route.ts|invoices"
"src/app/api/invoices/payable/[id]/currency/route.ts|invoices"
"src/app/api/invoices/payable/[id]/supplier-number/route.ts|invoices"
"src/app/api/invoices/check/[id]/route.ts|invoices"
"src/app/api/invoices/generate/route.ts|invoices"
"src/app/api/providers/route.ts|providers"
"src/app/api/providers/[id]/route.ts|providers"
"src/app/api/hotels/route.ts|providers"
"src/app/api/hotels/[id]/route.ts|providers"
"src/app/api/guides/route.ts|providers"
"src/app/api/guides/[id]/route.ts|providers"
"src/app/api/vehicles/route.ts|providers"
"src/app/api/vehicles/[id]/route.ts|providers"
"src/app/api/restaurants/route.ts|providers"
"src/app/api/restaurants/[id]/route.ts|providers"
"src/app/api/transfers/route.ts|providers"
"src/app/api/transfers/[id]/route.ts|providers"
"src/app/api/entrance-fees/route.ts|providers"
"src/app/api/entrance-fees/[id]/route.ts|providers"
"src/app/api/daily-tours/route.ts|providers"
"src/app/api/daily-tours/[id]/route.ts|providers"
"src/app/api/extra-expenses/route.ts|providers"
"src/app/api/extra-expenses/[id]/route.ts|providers"
"src/app/api/suppliers/search/route.ts|providers"
"src/app/api/requests/route.ts|requests"
"src/app/api/requests/[id]/route.ts|requests"
"src/app/api/finance/summary/route.ts|finance"
"src/app/api/finance/customers/route.ts|finance"
"src/app/api/finance/suppliers/route.ts|finance"
"src/app/api/finance/exchange-rates/route.ts|finance"
"src/app/api/finance/exchange-rates/latest/route.ts|finance"
"src/app/api/dashboard/stats/route.ts|dashboard"
"src/app/api/dashboard/recent-requests/route.ts|dashboard"
"src/app/api/dashboard/upcoming-tours/route.ts|dashboard"
"src/app/api/admin/cleanup-tours/route.ts|admin"
"src/app/api/admin/migrate-providers/route.ts|admin"
"src/app/api/admin/check-schema/route.ts|admin"
"src/app/api/hotel-pricing/route.ts|pricing"
"src/app/api/hotel-pricing/[id]/route.ts|pricing"
"src/app/api/guide-pricing/route.ts|pricing"
"src/app/api/guide-pricing/[id]/route.ts|pricing"
"src/app/api/vehicle-pricing/route.ts|pricing"
"src/app/api/vehicle-pricing/[id]/route.ts|pricing"
"src/app/api/tour-pricing/route.ts|pricing"
"src/app/api/tour-pricing/[id]/route.ts|pricing"
"src/app/api/entrance-fee-pricing/route.ts|pricing"
"src/app/api/entrance-fee-pricing/[id]/route.ts|pricing"
)

# Reports files (all use 'reports' resource)
REPORTS=(
"src/app/api/reports/agents/clients/route.ts"
"src/app/api/reports/agents/performance/route.ts"
"src/app/api/reports/clients/demographics/route.ts"
"src/app/api/reports/clients/acquisition-retention/route.ts"
"src/app/api/reports/clients/lifetime-value/route.ts"
"src/app/api/reports/executive/summary/route.ts"
"src/app/api/reports/financial/aging/route.ts"
"src/app/api/reports/financial/dashboard/route.ts"
"src/app/api/reports/financial/commissions/route.ts"
"src/app/api/reports/financial/profit-loss/route.ts"
"src/app/api/reports/financial/providers/route.ts"
"src/app/api/reports/operations/booking-status/route.ts"
"src/app/api/reports/operations/service-usage/route.ts"
"src/app/api/reports/operations/capacity/route.ts"
"src/app/api/reports/operations/response-times/route.ts"
"src/app/api/reports/operations/upcoming-tours/route.ts"
"src/app/api/reports/pricing/analysis/route.ts"
"src/app/api/reports/pricing/cost-structure/route.ts"
"src/app/api/reports/sales/overview/route.ts"
"src/app/api/reports/sales/destinations/route.ts"
"src/app/api/reports/sales/trends/route.ts"
"src/app/api/reports/sales/quotes/route.ts"
)

process_file() {
    local file="$1"
    local resource="$2"

    if [ ! -f "$file" ]; then
        echo "  ? File not found: $file"
        return 1
    fi

    # Skip if already updated
    if grep -q "requirePermission" "$file"; then
        echo "  - Already updated: $file"
        return 0
    fi

    # Skip if no requireTenant
    if ! grep -q "requireTenant" "$file"; then
        echo "  - No requireTenant: $file"
        return 0
    fi

    echo "  ✓ Updating: $file"

    # Step 1: Replace import
    sed -i "s/import { requireTenant } from '@\/middleware\/tenancy';/import { requirePermission } from '@\/middleware\/permissions';/g" "$file"

    # Step 2: Replace authentication calls (multi-line pattern)
    perl -i -0pe "s/const tenantResult = await requireTenant\(request\);\s+if \('error' in tenantResult\) \{\s+return errorResponse\(tenantResult\.error\);\s+\}\s+const \{ (tenantId(?:, user)?|user(?:, tenantId)?) \} = tenantResult;/const authResult = await requirePermission(request, '$resource', 'read');\n    if ('error' in authResult) {\n      return authResult.error;\n    }\n    const { \$1 } = authResult;/g" "$file"

    # Step 3: Replace other method patterns (for POST, PUT, PATCH, DELETE)
    perl -i -0pe "s/const tenantResult = await requireTenant\(request\);/const authResult = await requirePermission(request, '$resource', 'create');/g" "$file" 

    perl -i -0pe "s/const authResult = await requirePermission\(request, '$resource', 'create'\);\s+if \('error' in authResult\) \{\s+return authResult\.error;\s+\}/const authResult = await requirePermission(request, '$resource', 'create');\n    if ('error' in authResult) {\n      return authResult.error;\n    }/g" "$file"
}

echo "Processing files..."
echo ""

# Process regular files
for entry in "${FILES[@]}"; do
    IFS='|' read -r file resource <<< "$entry"
    process_file "$file" "$resource"
done

# Process report files
for file in "${REPORTS[@]}"; do
    process_file "$file" "reports"
done

echo ""
echo "Done!"

