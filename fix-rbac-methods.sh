#!/bin/bash

# Fix all HTTP methods in files that were just updated

API_DIR="src/app/api"

fix_file() {
    local file="$1"
    local resource="$2"

    if [ ! -f "$file" ]; then
        return 1
    fi

    # Skip if no requirePermission
    if ! grep -q "requirePermission" "$file"; then
        return 0
    fi

    echo "  ✓ Fixing methods in: $file"

    # Use Python to properly fix all methods
    python3 << PYTHON_EOF
import re

with open('$file', 'r', encoding='utf-8') as f:
    content = f.read()

# Method to action mapping
method_actions = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
}

for method, action in method_actions.items():
    # Pattern to match: export async function METHOD(...) { ... const authResult = await requirePermission(request, 'resource', 'read');
    # We need to replace 'read' with the correct action

    # First find all methods
    pattern = r'export\s+async\s+function\s+' + method + r'\s*\([^)]*\)\s*{[^{]*const\s+authResult\s*=\s*await\s+requirePermission\(request,\s*[\'"]' + resource + r'[\'"],\s*[\'"](\w+)[\'"]\);'

    def replacer(match):
        current_action = match.group(1)
        if current_action != action:
            return match.group(0).replace(f"'{current_action}'", f"'{action}'")
        return match.group(0)

    content = re.sub(pattern, replacer, content)

with open('$file', 'w', encoding='utf-8') as f:
    f.write(content)
PYTHON_EOF
}

# Fix all files that were updated
fix_file "src/app/api/users/[id]/route.ts" "users"
fix_file "src/app/api/invoices/payable/route.ts" "invoices"
fix_file "src/app/api/invoices/receivable/route.ts" "invoices"
fix_file "src/app/api/invoices/payable/[id]/route.ts" "invoices"
fix_file "src/app/api/invoices/receivable/[id]/route.ts" "invoices"
fix_file "src/app/api/invoices/payable/[id]/payment/route.ts" "invoices"
fix_file "src/app/api/invoices/receivable/[id]/payment/route.ts" "invoices"
fix_file "src/app/api/providers/route.ts" "providers"
fix_file "src/app/api/providers/[id]/route.ts" "providers"
fix_file "src/app/api/hotels/route.ts" "providers"
fix_file "src/app/api/hotels/[id]/route.ts" "providers"
fix_file "src/app/api/guides/route.ts" "providers"
fix_file "src/app/api/guides/[id]/route.ts" "providers"
fix_file "src/app/api/vehicles/route.ts" "providers"
fix_file "src/app/api/vehicles/[id]/route.ts" "providers"
fix_file "src/app/api/restaurants/route.ts" "providers"
fix_file "src/app/api/transfers/route.ts" "providers"
fix_file "src/app/api/entrance-fees/route.ts" "providers"
fix_file "src/app/api/suppliers/search/route.ts" "providers"
fix_file "src/app/api/requests/route.ts" "requests"
fix_file "src/app/api/requests/[id]/route.ts" "requests"
fix_file "src/app/api/finance/summary/route.ts" "finance"
fix_file "src/app/api/finance/customers/route.ts" "finance"
fix_file "src/app/api/finance/suppliers/route.ts" "finance"
fix_file "src/app/api/dashboard/stats/route.ts" "dashboard"
fix_file "src/app/api/dashboard/recent-requests/route.ts" "dashboard"
fix_file "src/app/api/dashboard/upcoming-tours/route.ts" "dashboard"
fix_file "src/app/api/admin/cleanup-tours/route.ts" "admin"
fix_file "src/app/api/admin/migrate-providers/route.ts" "admin"
fix_file "src/app/api/admin/check-schema/route.ts" "admin"

# Reports
for file in src/app/api/reports/**/route.ts; do
    fix_file "$file" "reports"
done

echo "Done fixing methods!"
