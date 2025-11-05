#!/bin/bash
# Bulk apply RBAC to all API endpoints

API_DIR="/c/Users/fatih/Desktop/CRM/src/app/api"

# Files to skip
SKIP_PATTERNS="auth|health|roles|audit-logs"

# Resource mappings - path prefix to resource name
declare -A RESOURCES
RESOURCES[invoices]="invoices"
RESOURCES[users]="users"
RESOURCES[agents]="agents"
RESOURCES[providers]="providers"
RESOURCES[hotels]="providers"
RESOURCES[guides]="providers"
RESOURCES[vehicles]="providers"
RESOURCES[restaurants]="providers"
RESOURCES[transfers]="providers"
RESOURCES[suppliers]="providers"
RESOURCES[entrance-fees]="providers"
RESOURCES[daily-tours]="providers"
RESOURCES[extra-expenses]="providers"
RESOURCES[reports]="reports"
RESOURCES[finance]="finance"
RESOURCES[dashboard]="dashboard"
RESOURCES[admin]="admin"
RESOURCES[requests]="requests"
RESOURCES[hotel-pricing]="pricing"
RESOURCES[guide-pricing]="pricing"
RESOURCES[vehicle-pricing]="pricing"
RESOURCES[tour-pricing]="pricing"
RESOURCES[entrance-fee-pricing]="pricing"

# Function to get resource from path
get_resource() {
    local path="$1"

    # Extract the API segment (first directory after /api/)
    local segment=$(echo "$path" | sed 's|.*/api/\([^/]*\).*|\1|')

    # Check if in resources map
    echo "${RESOURCES[$segment]}"
}

# Function to update a single file
update_file() {
    local file="$1"
    local resource="$2"

    # Skip if already uses requirePermission
    if grep -q "requirePermission" "$file"; then
        echo "  - Already has RBAC: $file"
        return 0
    fi

    # Skip if doesn't use requireTenant
    if ! grep -q "requireTenant" "$file"; then
        echo "  - No requireTenant: $file"
        return 0
    fi

    echo "  ✓ Updating: $file"

    # Create backup
    cp "$file" "$file.bak"

    # Replace import statement
    sed -i "s/import { requireTenant } from '@\/middleware\/tenancy';/import { requirePermission } from '@\/middleware\/permissions';/g" "$file"

    # Replace GET endpoints
    sed -i "/export async function GET/,/const { tenantId, user } = tenantResult;/ {
        s/const tenantResult = await requireTenant(request);/const authResult = await requirePermission(request, '$resource', 'read');/
        s/if ('error' in tenantResult) {/if ('error' in authResult) {/
        s/return standardErrorResponse(/return authResult.error;\n    }\n    \/\/ OLD ERROR HANDLING - REMOVE\n    if (false) {\n      return standardErrorResponse(/
        s/tenantResult\.error/authResult.error/g
        s/const { tenantId, user } = tenantResult;/const { tenantId, user } = authResult;/
    }" "$file"

    # Clean up temp markers
    sed -i '/\/\/ OLD ERROR HANDLING - REMOVE/,/^    }$/d' "$file"
}

# Process all route files
find "$API_DIR" -name "route.ts" -type f | while read -r file; do
    # Skip patterns
    if echo "$file" | grep -E "$SKIP_PATTERNS" > /dev/null; then
        continue
    fi

    # Get resource
    resource=$(get_resource "$file")

    if [ -z "$resource" ]; then
        echo "  ? Unknown resource: $file"
        continue
    fi

    update_file "$file" "$resource"
done

echo "Done!"
